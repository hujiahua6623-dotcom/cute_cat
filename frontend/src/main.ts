import "./styles/app.css";
import { ApiRequestError, clearTokens, fetchHealth, getAccessToken, setTokens } from "./network/httpClient";
import * as api from "./network/api";
import { GardenWsClient, nextRequestId } from "./network/wsClient";
import { GameStore } from "./state/gameStore";
import { createGardenGame, getGardenScene } from "./game/createGame";
import { showActionToast, showError, showOfflineModal } from "./ui/feedback";
import { createAuthView, createClaimView, createGardenView, syncAuthModeView } from "./ui/views";
import { renderGardenHud, renderWsStatusBar } from "./ui/gardenHud";
import { createWsMessageHandler } from "./ui/wsHandlers";

const app = document.getElementById("app")!;
app.classList.add("app-shell");

const store = new GameStore();

function clearView(): void {
  app.innerHTML = "";
}

function renderAuth(): void {
  clearView();
  let mode: "login" | "register" = "login";
  const refs = createAuthView();
  const { wrap, tabLogin, tabRegister, form, healthMsg, healthCheck, submit } = refs;
  app.appendChild(wrap);

  const syncTab = (): void => {
    mode = tabRegister.classList.contains("active") ? "register" : "login";
    syncAuthModeView(mode, refs);
  };
  tabLogin.addEventListener("click", () => {
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
    syncTab();
  });
  tabRegister.addEventListener("click", () => {
    tabRegister.classList.add("active");
    tabLogin.classList.remove("active");
    syncTab();
  });

  healthCheck.addEventListener("click", async () => {
    healthMsg.textContent = "…";
    try {
      const h = await fetchHealth();
      healthMsg.textContent = `后端健康：${h.status}`;
    } catch {
      healthMsg.textContent = "无法连接后端（需 uvicorn 与 Vite 代理或 VITE_API_BASE_URL）";
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const email = String(fd.get("email") || "").trim();
    const password = String(fd.get("password") || "");
    const nickname = String(fd.get("nickname") || "").trim();
    submit.disabled = true;
    submit.classList.add("loading");
    try {
      if (mode === "register") {
        if (!nickname) {
          showError(wrap, "请填写昵称");
          return;
        }
        const tok = await api.register(email, password, nickname);
        setTokens(tok.accessToken, tok.refreshToken);
      } else {
        const tok = await api.login(email, password);
        setTokens(tok.accessToken, tok.refreshToken);
      }
      await routeAfterAuth();
    } catch (err) {
      const msg = err instanceof ApiRequestError ? `${err.code}: ${err.message}` : String(err);
      showError(wrap, msg);
    } finally {
      submit.disabled = false;
      submit.classList.remove("loading");
    }
  });
}

const PET_TYPES = ["cat", "dog", "chick", "duck", "rabbit", "pig"] as const;

function renderClaim(): void {
  clearView();
  const refs = createClaimView(PET_TYPES);
  const { wrap, form, petNameInput, petTypeSelect, submit, logout } = refs;
  app.appendChild(wrap);

  logout.addEventListener("click", () => {
    clearTokens();
    store.resetSession();
    renderAuth();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const petName = petNameInput.value.trim();
    const petType = petTypeSelect.value;
    submit.disabled = true;
    submit.classList.add("loading");
    try {
      await api.claimPet(petName, petType);
      await enterGarden();
    } catch (err) {
      const msg = err instanceof ApiRequestError ? `${err.code}: ${err.message}` : String(err);
      showError(wrap, msg);
    } finally {
      submit.disabled = false;
      submit.classList.remove("loading");
    }
  });
}

let phaserGame: import("phaser").Game | null = null;
let wsClient: GardenWsClient | null = null;
let wsUnsub: (() => void) | null = null;
let toastUnsub: (() => void) | null = null;
let pointerCleanup: (() => void) | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
/** Set true when user leaves garden; blocks scheduled reconnect. */
let gardenSessionCancelled = false;

function closeWsOnly(): void {
  wsUnsub?.();
  wsUnsub = null;
  wsClient?.close();
  wsClient = null;
}

function destroyGardenRuntime(): void {
  gardenSessionCancelled = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  pointerCleanup?.();
  pointerCleanup = null;
  closeWsOnly();
  if (phaserGame) {
    phaserGame.destroy(true);
    phaserGame = null;
  }
}

async function enterGarden(): Promise<void> {
  const me = await api.getMe();
  if (!me.petId || !me.gardenId) {
    renderClaim();
    return;
  }

  store.setUser({ userId: me.userId, nickname: me.nickname });
  store.setPetContext(me.petId, me.gardenId);

  const pet = await api.getPet(me.petId);
  store.hydrateFromPetSnapshot({
    stats: pet.stats,
    gameTime: pet.gameTime,
    growthStage: pet.growthStage,
    stabilityScore: pet.stability.stabilityScore,
  });

  const offline = await api.getOfflineSummary(me.petId);
  await showOfflineModal(offline.reasons, String(offline.suggestedActionType));

  gardenSessionCancelled = false;
  clearView();
  const view = createGardenView();
  const { root, wsBar, actionButtons, leaveButton } = view;
  app.appendChild(root);

  const syncHud = (): void => {
    renderGardenHud(store.getState(), view);
  };
  const unsub = store.subscribe(syncHud);
  syncHud();

  phaserGame = createGardenGame("game-mount");
  const scene = (): ReturnType<typeof getGardenScene> => (phaserGame ? getGardenScene(phaserGame) : null);
  let activeGardenId = me.gardenId;

  /** Throttle ~100ms for updatePointer (doc §7). */
  let lastPtr = 0;
  const onNormMove = (nx: number, ny: number): void => {
    const now = Date.now();
    if (now - lastPtr < 100) return;
    lastPtr = now;
    if (wsClient && activeGardenId) {
      wsClient.updatePointer(activeGardenId, nx, ny, nextRequestId());
    }
  };

  let pointerBound = false;
  const bindPointerWhenSceneReady = (): void => {
    if (pointerBound || gardenSessionCancelled) return;
    const g = scene();
    if (!g) {
      requestAnimationFrame(bindPointerWhenSceneReady);
      return;
    }
    pointerBound = true;
    g.setPetNormPosition(0.5, 0.5);
    g.pointerNormEmitter.on("move", onNormMove);
    pointerCleanup = () => {
      g.pointerNormEmitter.off("move", onNormMove);
    };
  };
  requestAnimationFrame(bindPointerWhenSceneReady);

  const handleServerMessage = createWsMessageHandler({
    me: { userId: me.userId, petId: me.petId },
    store,
    getScene: scene,
    syncHud,
  });

  const scheduleReconnect = (): void => {
    if (gardenSessionCancelled) return;
    if (reconnectTimer) return;
    store.setWsStatus("reconnecting");
    renderWsStatusBar(wsBar, "reconnecting");
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (gardenSessionCancelled) return;
      connectWs().catch(() => scheduleReconnect());
    }, 1200);
  };

  toastUnsub = store.subscribe(() => {
    const t = store.getState().toastMessage;
    if (t) {
      showActionToast(t);
      store.clearToast();
    }
  });

  actionButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const actionType = btn.dataset.action;
      if (!actionType || !me.petId || !activeGardenId || !wsClient) return;
      wsClient.petAction(activeGardenId, me.petId, actionType, nextRequestId());
    });
  });

  const connectWs = async (): Promise<void> => {
    closeWsOnly();
    store.setWsStatus("connecting");
    renderWsStatusBar(wsBar, "connecting");

    const client = new GardenWsClient((ev) => {
      if (ev === "open") {
        store.setWsStatus("open");
        renderWsStatusBar(wsBar, "connected");
      } else if (ev === "connecting") {
        store.setWsStatus("connecting");
        renderWsStatusBar(wsBar, "connecting");
      } else if (!gardenSessionCancelled) {
        store.setWsStatus("disconnected");
        renderWsStatusBar(wsBar, "disconnected");
        scheduleReconnect();
      }
    });

    wsClient = client;

    try {
      const ticket = await client.connect();
      activeGardenId = ticket.gardenId;
      store.setPetContext(me.petId, activeGardenId);
    } catch {
      if (!gardenSessionCancelled) {
        store.setWsStatus("disconnected");
        renderWsStatusBar(wsBar, "disconnected");
        scheduleReconnect();
      }
      return;
    }

    wsUnsub = client.subscribe(handleServerMessage);
    if (activeGardenId) {
      client.joinGarden(activeGardenId, nextRequestId());
    }
  };

  await connectWs();

  leaveButton.addEventListener("click", () => {
    unsub();
    toastUnsub?.();
    toastUnsub = null;
    destroyGardenRuntime();
    clearTokens();
    store.resetSession();
    renderAuth();
  });
}

async function routeAfterAuth(): Promise<void> {
  const me = await api.getMe();
  store.setUser({ userId: me.userId, nickname: me.nickname });
  store.setPetContext(me.petId, me.gardenId);
  if (!me.petId) {
    renderClaim();
    return;
  }
  await enterGarden();
}

if (getAccessToken()) {
  routeAfterAuth().catch(() => {
    clearTokens();
    renderAuth();
  });
} else {
  renderAuth();
}
