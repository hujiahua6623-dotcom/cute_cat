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

function mountView(el: HTMLElement): void {
  el.classList.add("view-enter");
  app.appendChild(el);
}

function renderAuth(): void {
  clearView();
  let mode: "login" | "register" = "login";
  const refs = createAuthView();
  const { wrap, tabLogin, tabRegister, form, healthMsg, healthCheck, submit } = refs;
  mountView(wrap);

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
  mountView(wrap);

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
let phaserResizeObserver: ResizeObserver | null = null;
let wsClient: GardenWsClient | null = null;
let wsUnsub: (() => void) | null = null;
let toastUnsub: (() => void) | null = null;
let pointerCleanup: (() => void) | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let inventorySyncTimer: ReturnType<typeof setInterval> | null = null;
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
  if (inventorySyncTimer) {
    clearInterval(inventorySyncTimer);
    inventorySyncTimer = null;
  }
  pointerCleanup?.();
  pointerCleanup = null;
  phaserResizeObserver?.disconnect();
  phaserResizeObserver = null;
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

  store.setUser({ userId: me.userId, nickname: me.nickname, coins: me.coins });
  store.setPetContext(me.petId, me.gardenId);

  const pet = await api.getPet(me.petId);
  store.hydrateFromPetSnapshot({
    stats: pet.stats,
    gameTime: pet.gameTime,
    growthStage: pet.growthStage,
    stabilityScore: pet.stability.stabilityScore,
    consecutiveStableDays: pet.stability.consecutiveStableDays,
    lastGameDayIndex: pet.stability.lastGameDayIndex,
    sickCountInWindow: pet.stability.sickCountInWindow,
    windowGameDays: pet.stability.windowGameDays,
  });

  const offline = await api.getOfflineSummary(me.petId);
  await showOfflineModal(offline.reasons, String(offline.suggestedActionType));

  gardenSessionCancelled = false;
  clearView();
  const view = createGardenView();
  const {
    root,
    wsBar,
    toggleStatsBtn,
    toggleEventsBtn,
    actionButtons,
    feedSelect,
    inventoryList,
    shopRows,
    hospitalTreatBtn,
    leaveButton,
    dockShopBtn,
    dockBagBtn,
    dockHospitalBtn,
    dockClosePanelBtn,
    floatingPanel,
    panelShop,
    panelInventory,
    panelHospital,
  } = view;
  mountView(root);
  const shopCatalog = [
    { itemId: "food_basic_01", label: "基础口粮", price: 12 },
    { itemId: "food_fancy_01", label: "精致盛宴", price: 26 },
  ] as const;
  const inventory = new Map<string, number>(shopCatalog.map((it) => [it.itemId, 0]));
  let inventorySyncToken = 0;

  const renderInventoryUi = (): void => {
    const lines = shopCatalog.map((it) => `${it.label} × ${inventory.get(it.itemId) ?? 0}`);
    inventoryList.innerHTML = lines.map((line) => `<div>${line}</div>`).join("");

    const prev = feedSelect.value;
    const options = ['<option value="">请选择库存道具</option>'];
    for (const it of shopCatalog) {
      const count = inventory.get(it.itemId) ?? 0;
      if (count > 0) {
        const devHint = import.meta.env.DEV ? ` title="${it.itemId}"` : "";
        options.push(`<option value="${it.itemId}"${devHint}>${it.label}（${count}）</option>`);
      }
    }
    feedSelect.innerHTML = options.join("");
    if (prev && (inventory.get(prev) ?? 0) > 0) {
      feedSelect.value = prev;
    }
  };

  const bumpInventory = (itemId: string, delta: number): void => {
    const next = Math.max(0, (inventory.get(itemId) ?? 0) + delta);
    inventory.set(itemId, next);
    renderInventoryUi();
  };

  const applyInventoryAbsolute = (itemId: string, count: number): void => {
    if (!inventory.has(itemId)) return;
    inventory.set(itemId, Math.max(0, Math.floor(count)));
    renderInventoryUi();
  };

  const syncInventoryFromServer = async (): Promise<void> => {
    const token = ++inventorySyncToken;
    try {
      const inv = await api.getInventory();
      if (token !== inventorySyncToken) return;
      for (const it of shopCatalog) {
        inventory.set(it.itemId, 0);
      }
      for (const row of inv.items) {
        if (inventory.has(row.itemId)) {
          inventory.set(row.itemId, Math.max(0, Number(row.count) || 0));
        }
      }
      renderInventoryUi();
    } catch {
      // Keep current inventory view when transient sync failed.
    }
  };

  for (const it of shopCatalog) {
    const row = document.createElement("div");
    row.className = "shop-row";
    row.innerHTML = `
      <div>
        <div class="shop-row-title">${it.label}</div>
        <div class="shop-row-meta"${import.meta.env.DEV ? ` title="${it.itemId}"` : ""}>${it.price} 金币</div>
      </div>
    `;
    const buyBtn = document.createElement("button");
    buyBtn.type = "button";
    buyBtn.className = "btn btn-secondary";
    buyBtn.textContent = "购买";
    buyBtn.addEventListener("click", async () => {
      buyBtn.disabled = true;
      buyBtn.classList.add("loading");
      try {
        const res = await api.shopBuy(it.itemId, 1);
        inventory.set(res.itemId, res.inventoryCount);
        store.setCoins(res.coinsAfter);
        renderInventoryUi();
        showActionToast(`购买成功：${it.label}（库存 ${res.inventoryCount}）`);
        void syncInventoryFromServer();
      } catch (err) {
        const msg = err instanceof ApiRequestError ? `${err.code}: ${err.message}` : String(err);
        showActionToast(`购买失败：${msg}`);
      } finally {
        buyBtn.disabled = false;
        buyBtn.classList.remove("loading");
      }
    });
    row.appendChild(buyBtn);
    shopRows.appendChild(row);
  }
  await syncInventoryFromServer();
  const statsOverlay = root.querySelector(".overlay-top") as HTMLElement;
  const eventOverlay = root.querySelector(".overlay-event") as HTMLElement;
  let seenActiveEventSignature = "";
  const getActiveEventSignature = (): string => {
    const state = store.getState();
    return [...state.activeEvents.values()]
      .filter((ev) => ev.phase !== "ended")
      .map((ev) => `${ev.eventId}:${ev.phase}`)
      .sort()
      .join("|");
  };
  toggleStatsBtn.addEventListener("click", () => {
    statsOverlay.classList.toggle("hidden");
  });
  toggleEventsBtn.addEventListener("click", () => {
    eventOverlay.classList.toggle("hidden");
    if (!eventOverlay.classList.contains("hidden")) {
      seenActiveEventSignature = getActiveEventSignature();
      view.eventDot.classList.add("hidden");
    }
  });

  const openPanel = (mode: "shop" | "bag" | "hospital"): void => {
    floatingPanel.classList.remove("hidden");
    panelShop.style.display = mode === "shop" ? "block" : "none";
    panelInventory.style.display = mode === "bag" ? "block" : "none";
    panelHospital.style.display = mode === "hospital" ? "block" : "none";
  };
  const closePanel = (): void => {
    floatingPanel.classList.add("hidden");
  };
  dockShopBtn.addEventListener("click", () => openPanel("shop"));
  dockBagBtn.addEventListener("click", () => openPanel("bag"));
  dockHospitalBtn.addEventListener("click", () => openPanel("hospital"));
  dockClosePanelBtn.addEventListener("click", closePanel);

  inventorySyncTimer = setInterval(() => {
    if (gardenSessionCancelled) return;
    void syncInventoryFromServer();
  }, 5000);

  const syncHud = (): void => {
    const state = store.getState();
    try {
      renderGardenHud(state, view);
      const currentActiveEventSignature = getActiveEventSignature();
      if (!currentActiveEventSignature) {
        view.eventDot.classList.add("hidden");
      } else if (eventOverlay.classList.contains("hidden")) {
        const hasNewActiveEvent = currentActiveEventSignature !== seenActiveEventSignature;
        view.eventDot.classList.toggle("hidden", !hasNewActiveEvent);
      } else {
        seenActiveEventSignature = currentActiveEventSignature;
        view.eventDot.classList.add("hidden");
      }
    } catch (error) {
      throw error;
    }
  };
  const unsub = store.subscribe(syncHud);
  syncHud();

  phaserGame = createGardenGame("game-mount");
  const gameMountEl = document.getElementById("game-mount");
  if (gameMountEl && typeof ResizeObserver !== "undefined") {
    phaserResizeObserver = new ResizeObserver(() => {
      phaserGame?.scale.refresh();
    });
    phaserResizeObserver.observe(gameMountEl);
  }
  queueMicrotask(() => phaserGame?.scale.refresh());
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
    onInventoryChanged: applyInventoryAbsolute,
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
      if (actionType === "Feed") {
        const selectedFeedItemId = feedSelect.value || null;
        if (!selectedFeedItemId) {
          showActionToast("请先购买食物，再喂食");
          return;
        }
        if ((inventory.get(selectedFeedItemId) ?? 0) <= 0) {
          showActionToast("该道具库存不足，请先购买");
          return;
        }
        wsClient.petAction(activeGardenId, me.petId, actionType, nextRequestId(), selectedFeedItemId);
        bumpInventory(selectedFeedItemId, -1);
        setTimeout(() => {
          void syncInventoryFromServer();
        }, 500);
        return;
      }
      wsClient.petAction(activeGardenId, me.petId, actionType, nextRequestId());
    });
  });

  hospitalTreatBtn.addEventListener("click", async () => {
    if (!me.petId) return;
    hospitalTreatBtn.disabled = true;
    hospitalTreatBtn.classList.add("loading");
    try {
      const res = await api.hospitalTreat(me.petId);
      store.overwriteStats(res.stats);
      store.setCoins(res.coinsAfter);
      showActionToast(`治疗成功：花费 ${res.treatCost}，剩余金币 ${res.coinsAfter}`);
      if (res.narrativeSuggestions?.[0]) {
        showActionToast(`护理建议：${res.narrativeSuggestions[0]}`);
      }
    } catch (err) {
      const msg = err instanceof ApiRequestError ? `${err.code}: ${err.message}` : String(err);
      showActionToast(`治疗失败：${msg}`);
    } finally {
      hospitalTreatBtn.disabled = false;
      hospitalTreatBtn.classList.remove("loading");
    }
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
  store.setUser({ userId: me.userId, nickname: me.nickname, coins: me.coins });
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
