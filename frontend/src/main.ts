import "./styles/app.css";
import { ApiRequestError, clearTokens, fetchHealth, getAccessToken, setTokens } from "./network/httpClient";
import * as api from "./network/api";
import { GardenWsClient, nextRequestId } from "./network/wsClient";
import type { GardenSnapshotPayload, WsServerMessage } from "./network/types";
import { GameStore } from "./state/gameStore";
import { createGardenGame, getGardenScene } from "./game/createGame";

const app = document.getElementById("app")!;

const store = new GameStore();

function clearView(): void {
  app.innerHTML = "";
}

function showError(el: HTMLElement, message: string): void {
  const prev = el.querySelector(".error-banner");
  if (prev) prev.remove();
  const banner = document.createElement("div");
  banner.className = "error-banner";
  banner.textContent = message;
  el.prepend(banner);
}

function renderAuth(): void {
  clearView();
  let mode: "login" | "register" = "login";
  const wrap = document.createElement("div");
  wrap.className = "panel";
  wrap.innerHTML = `
    <h1 style="margin-top:0;font-size:1.5rem;">小屋里的电子宠物</h1>
    <div class="tabs">
      <button type="button" data-tab="login" class="active">登录</button>
      <button type="button" data-tab="register">注册</button>
    </div>
    <form id="auth-form">
      <div class="field" id="nick-field" style="display:none">
        <label for="nickname">昵称</label>
        <input id="nickname" name="nickname" autocomplete="nickname" />
      </div>
      <div class="field">
        <label for="email">邮箱</label>
        <input id="email" name="email" type="email" required autocomplete="username" />
      </div>
      <div class="field">
        <label for="password">密码</label>
        <input id="password" name="password" type="password" required autocomplete="current-password" />
      </div>
      <div class="btn-row">
        <button type="submit" class="btn" id="auth-submit">进入</button>
        <button type="button" class="btn btn-secondary" id="health-check">检查后端 /health</button>
      </div>
    </form>
    <p class="health-pill" id="health-msg"></p>
  `;
  app.appendChild(wrap);

  const tabLogin = wrap.querySelector('[data-tab="login"]') as HTMLButtonElement;
  const tabReg = wrap.querySelector('[data-tab="register"]') as HTMLButtonElement;
  const nickField = wrap.querySelector("#nick-field") as HTMLElement;
  const form = wrap.querySelector("#auth-form") as HTMLFormElement;
  const healthMsg = wrap.querySelector("#health-msg") as HTMLElement;

  const syncTab = (): void => {
    mode = tabReg.classList.contains("active") ? "register" : "login";
    tabLogin.classList.toggle("active", mode === "login");
    tabReg.classList.toggle("active", mode === "register");
    nickField.style.display = mode === "register" ? "block" : "none";
    (wrap.querySelector("#auth-submit") as HTMLButtonElement).textContent =
      mode === "register" ? "注册并进入" : "登录";
  };
  tabLogin.addEventListener("click", () => {
    tabLogin.classList.add("active");
    tabReg.classList.remove("active");
    syncTab();
  });
  tabReg.addEventListener("click", () => {
    tabReg.classList.add("active");
    tabLogin.classList.remove("active");
    syncTab();
  });

  wrap.querySelector("#health-check")?.addEventListener("click", async () => {
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
    const submit = wrap.querySelector("#auth-submit") as HTMLButtonElement;
    submit.disabled = true;
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
    }
  });
}

const PET_TYPES = ["cat", "dog", "chick", "duck", "rabbit", "pig"] as const;

function renderClaim(): void {
  clearView();
  const wrap = document.createElement("div");
  wrap.className = "panel";
  wrap.innerHTML = `
    <h2 style="margin-top:0;">领养宠物</h2>
    <form id="claim-form">
      <div class="field">
        <label for="petName">名字</label>
        <input id="petName" required maxlength="64" placeholder="咪咪" />
      </div>
      <div class="field">
        <label for="petType">类型</label>
        <select id="petType" required>
          ${PET_TYPES.map((t) => `<option value="${t}">${t}</option>`).join("")}
        </select>
      </div>
      <div class="btn-row">
        <button type="submit" class="btn">确认领养</button>
        <button type="button" class="btn btn-secondary" id="logout">退出登录</button>
      </div>
    </form>
  `;
  app.appendChild(wrap);

  wrap.querySelector("#logout")?.addEventListener("click", () => {
    clearTokens();
    store.resetSession();
    renderAuth();
  });

  wrap.querySelector("#claim-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const petName = (wrap.querySelector("#petName") as HTMLInputElement).value.trim();
    const petType = (wrap.querySelector("#petType") as HTMLSelectElement).value;
    try {
      await api.claimPet(petName, petType);
      await enterGarden();
    } catch (err) {
      const msg = err instanceof ApiRequestError ? `${err.code}: ${err.message}` : String(err);
      showError(wrap, msg);
    }
  });
}

/** Offline summary modal; resolves when user dismisses. */
function showOfflineModal(reasons: string[], suggested: string): Promise<void> {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    const list = reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("");
    backdrop.innerHTML = `
      <div class="panel modal">
        <h2>离线摘要</h2>
        <p>你离开期间，花园里发生的事：</p>
        <ul>${list || "<li>（暂无摘要）</li>"}</ul>
        <p class="suggest">建议下一步：<strong>${escapeHtml(suggested)}</strong></p>
        <button type="button" class="btn" data-dismiss>进入花园</button>
      </div>
    `;
    backdrop.querySelector("[data-dismiss]")?.addEventListener("click", () => {
      backdrop.remove();
      resolve();
    });
    document.body.appendChild(backdrop);
  });
}

function escapeHtml(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
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

function statPercent(v: number): number {
  return Math.max(0, Math.min(100, v));
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
  const root = document.createElement("div");
  root.className = "garden-layout";
  root.innerHTML = `
    <div id="ws-bar" class="ws-bar" role="status">连接中…</div>
    <div class="garden-row">
      <div id="game-mount" class="game-mount"></div>
      <aside class="hud panel">
        <div class="meta-line" id="garden-meta"></div>
        <div class="stat-grid">
          <div class="stat-row"><label>饥饿</label><div class="stat-bar"><span id="bar-hunger" style="width:0%"></span></div></div>
          <div class="stat-row"><label>健康</label><div class="stat-bar health"><span id="bar-health" style="width:0%"></span></div></div>
          <div class="stat-row"><label>情绪</label><div class="stat-bar mood"><span id="bar-mood" style="width:0%"></span></div></div>
        </div>
        <div class="meta-line" id="growth-line"></div>
        <div class="action-bar">
          <button type="button" class="btn" data-action="Feed">喂食</button>
          <button type="button" class="btn" data-action="Cuddle">抱抱</button>
          <button type="button" class="btn" data-action="Pat">摸头</button>
        </div>
        <div class="btn-row" style="margin-top:12px">
          <button type="button" class="btn btn-secondary" id="leave-garden">退出</button>
        </div>
      </aside>
    </div>
  `;
  app.appendChild(root);

  const syncHud = (): void => {
    const s = store.getState();
    const st = s.stats;
    if (st) {
      (root.querySelector("#bar-hunger") as HTMLElement).style.width = `${statPercent(st.hunger)}%`;
      (root.querySelector("#bar-health") as HTMLElement).style.width = `${statPercent(st.health)}%`;
      (root.querySelector("#bar-mood") as HTMLElement).style.width = `${statPercent(st.mood)}%`;
    }
    const gt = s.gameTime;
    (root.querySelector("#garden-meta") as HTMLElement).textContent = gt
      ? `游戏时间：第 ${gt.gameDayIndex} 天 · ${gt.gameHourFloat.toFixed(2)} 时 · ${s.nickname ?? ""}`
      : "";
    (root.querySelector("#growth-line") as HTMLElement).textContent =
      s.growthStage !== null && s.stabilityScore !== null
        ? `成长阶段 ${s.growthStage} · 稳定度 ${s.stabilityScore.toFixed(2)}`
        : "";
  };
  const unsub = store.subscribe(syncHud);
  syncHud();

  phaserGame = createGardenGame("game-mount");
  const scene = (): ReturnType<typeof getGardenScene> => (phaserGame ? getGardenScene(phaserGame) : null);

  /** Throttle ~100ms for updatePointer (doc §7). */
  let lastPtr = 0;
  const onNormMove = (nx: number, ny: number): void => {
    const now = Date.now();
    if (now - lastPtr < 100) return;
    lastPtr = now;
    if (wsClient && me.gardenId) {
      wsClient.updatePointer(me.gardenId, nx, ny, nextRequestId());
    }
  };

  requestAnimationFrame(() => {
    const g = scene();
    g?.setPetNormPosition(0.5, 0.5);
    g?.pointerNormEmitter.on("move", onNormMove);
    pointerCleanup = () => {
      g?.pointerNormEmitter.off("move", onNormMove);
    };
  });

  const wsBar = root.querySelector("#ws-bar") as HTMLElement;

  const applyWsStatusClass = (t: string): void => {
    wsBar.className = `ws-bar ${t}`;
    const labels: Record<string, string> = {
      connecting: "连接中…",
      open: "已连接",
      closed: "已断开（重连中）",
    };
    wsBar.textContent = labels[t] ?? t;
  };

  const handleServerMessage = (msg: WsServerMessage): void => {
    const uid = store.getState().userId;
    store.applyWsMessage(msg, uid);

    if (msg.type === "gardenSnapshot" && msg.payload) {
      const pl = msg.payload as GardenSnapshotPayload;
      const mine = pl.pets.find((p) => p.petId === me.petId);
      if (mine) {
        scene()?.setPetNormPosition(mine.position.x, mine.position.y);
      }
      scene()?.clearRemotePointers();
      for (const u of pl.users) {
        if (u.userId === me.userId) continue;
        scene()?.setRemotePointerNorm(u.userId, u.pointer.x, u.pointer.y);
      }
    }
    if (
      msg.type === "pointerUpdate" &&
      msg.payload &&
      typeof msg.payload === "object" &&
      "userId" in msg.payload
    ) {
      const pl = msg.payload as { userId: string; pointer: { x: number; y: number } };
      if (pl.userId !== me.userId) {
        scene()?.setRemotePointerNorm(pl.userId, pl.pointer.x, pl.pointer.y);
      }
    }
    if (
      msg.type === "actionBroadcast" &&
      msg.payload &&
      typeof msg.payload === "object" &&
      "actorUserId" in msg.payload
    ) {
      const pl = msg.payload as { actorUserId: string; actionType: string };
      if (pl.actorUserId !== me.userId) {
        showActionToast(`他人：${pl.actionType}`);
      }
    }

    syncHud();
  };

  const scheduleReconnect = (): void => {
    if (gardenSessionCancelled) return;
    if (reconnectTimer) return;
    store.setWsStatus("reconnecting");
    applyWsStatusClass("reconnecting");
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

  root.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const actionType = btn.dataset.action;
      if (!actionType || !me.petId || !me.gardenId || !wsClient) return;
      wsClient.petAction(me.gardenId, me.petId, actionType, nextRequestId());
    });
  });

  const connectWs = async (): Promise<void> => {
    closeWsOnly();
    store.setWsStatus("connecting");
    applyWsStatusClass("connecting");

    const client = new GardenWsClient((ev) => {
      if (ev === "open") {
        store.setWsStatus("open");
        applyWsStatusClass("open");
      } else if (ev === "connecting") {
        store.setWsStatus("connecting");
        applyWsStatusClass("connecting");
      } else if (!gardenSessionCancelled) {
        store.setWsStatus("disconnected");
        applyWsStatusClass("closed");
        scheduleReconnect();
      }
    });

    wsClient = client;

    try {
      await client.connect();
    } catch {
      if (!gardenSessionCancelled) {
        store.setWsStatus("disconnected");
        applyWsStatusClass("closed");
        scheduleReconnect();
      }
      return;
    }

    wsUnsub = client.subscribe(handleServerMessage);
    client.joinGarden(me.gardenId!, nextRequestId());
  };

  await connectWs();

  root.querySelector("#leave-garden")?.addEventListener("click", () => {
    unsub();
    toastUnsub?.();
    toastUnsub = null;
    destroyGardenRuntime();
    clearTokens();
    store.resetSession();
    renderAuth();
  });
}

function showActionToast(text: string): void {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
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
