type AuthMode = "login" | "register";

export interface AuthViewRefs {
  wrap: HTMLDivElement;
  tabLogin: HTMLButtonElement;
  tabRegister: HTMLButtonElement;
  nicknameField: HTMLElement;
  form: HTMLFormElement;
  submit: HTMLButtonElement;
  healthMsg: HTMLElement;
  healthCheck: HTMLButtonElement;
}

export function createAuthView(): AuthViewRefs {
  const wrap = document.createElement("div");
  wrap.className = "panel auth-page";
  wrap.innerHTML = `
    <div class="auth-head">
      <span class="auth-chip">欢迎回来</span>
      <h1 class="auth-title">小屋里的电子宠物</h1>
    </div>
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

  return {
    wrap,
    tabLogin: wrap.querySelector('[data-tab="login"]') as HTMLButtonElement,
    tabRegister: wrap.querySelector('[data-tab="register"]') as HTMLButtonElement,
    nicknameField: wrap.querySelector("#nick-field") as HTMLElement,
    form: wrap.querySelector("#auth-form") as HTMLFormElement,
    submit: wrap.querySelector("#auth-submit") as HTMLButtonElement,
    healthMsg: wrap.querySelector("#health-msg") as HTMLElement,
    healthCheck: wrap.querySelector("#health-check") as HTMLButtonElement,
  };
}

export function syncAuthModeView(mode: AuthMode, refs: AuthViewRefs): void {
  refs.tabLogin.classList.toggle("active", mode === "login");
  refs.tabRegister.classList.toggle("active", mode === "register");
  refs.nicknameField.style.display = mode === "register" ? "block" : "none";
  refs.submit.textContent = mode === "register" ? "注册并进入" : "登录";
}

export interface ClaimViewRefs {
  wrap: HTMLDivElement;
  form: HTMLFormElement;
  petNameInput: HTMLInputElement;
  petTypeSelect: HTMLSelectElement;
  submit: HTMLButtonElement;
  logout: HTMLButtonElement;
}

export function createClaimView(petTypes: readonly string[]): ClaimViewRefs {
  const wrap = document.createElement("div");
  wrap.className = "panel auth-page";
  wrap.innerHTML = `
    <div class="auth-head">
      <span class="auth-chip">开始陪伴</span>
      <h2 class="section-title">领养宠物</h2>
    </div>
    <form id="claim-form">
      <div class="field">
        <label for="petName">名字</label>
        <input id="petName" required maxlength="64" placeholder="咪咪" />
      </div>
      <div class="field">
        <label for="petType">类型</label>
        <select id="petType" required>
          ${petTypes.map((t) => `<option value="${t}">${t}</option>`).join("")}
        </select>
      </div>
      <div class="btn-row">
        <button type="submit" class="btn" id="claim-submit">确认领养</button>
        <button type="button" class="btn btn-secondary" id="logout">退出登录</button>
      </div>
    </form>
  `;

  return {
    wrap,
    form: wrap.querySelector("#claim-form") as HTMLFormElement,
    petNameInput: wrap.querySelector("#petName") as HTMLInputElement,
    petTypeSelect: wrap.querySelector("#petType") as HTMLSelectElement,
    submit: wrap.querySelector("#claim-submit") as HTMLButtonElement,
    logout: wrap.querySelector("#logout") as HTMLButtonElement,
  };
}

export interface GardenViewRefs {
  root: HTMLDivElement;
  wsBar: HTMLElement;
  gameMount: HTMLElement;
  toggleStatsBtn: HTMLButtonElement;
  toggleEventsBtn: HTMLButtonElement;
  eventDot: HTMLElement;
  dockShopBtn: HTMLButtonElement;
  dockBagBtn: HTMLButtonElement;
  dockHospitalBtn: HTMLButtonElement;
  dockClosePanelBtn: HTMLButtonElement;
  floatingPanel: HTMLElement;
  panelShop: HTMLElement;
  panelInventory: HTMLElement;
  panelHospital: HTMLElement;
  barHunger: HTMLElement;
  barHealth: HTMLElement;
  barMood: HTMLElement;
  valueHunger: HTMLElement;
  valueHealth: HTMLElement;
  valueMood: HTMLElement;
  gardenMeta: HTMLElement;
  growthLine: HTMLElement;
  eventList: HTMLElement;
  actionButtons: HTMLButtonElement[];
  feedSelect: HTMLSelectElement;
  inventoryList: HTMLElement;
  shopRows: HTMLDivElement;
  hospitalTreatBtn: HTMLButtonElement;
  leaveButton: HTMLButtonElement;
}

export function createGardenView(): GardenViewRefs {
  const root = document.createElement("div");
  root.className = "garden-layout";
  root.innerHTML = `
    <div class="garden-stage">
      <div id="game-mount" class="game-mount"></div>
      <div id="ws-bar" class="ws-bar ws-corner connecting" role="status" aria-label="连接中"><span class="ws-dot"></span></div>

      <div class="overlay-controls">
        <button type="button" class="overlay-toggle" id="toggle-stats">属性</button>
        <button type="button" class="overlay-toggle" id="toggle-events">活动<span id="event-dot" class="event-dot hidden"></span></button>
      </div>

      <div class="overlay-top panel hud-compact hidden">
        <div class="hud-title">宠物状态</div>
        <div class="meta-line meta-pills" id="garden-meta"></div>
        <div class="stat-grid compact">
          <div class="stat-row"><label class="stat-label hunger">饱腹</label><div class="stat-bar"><span id="bar-hunger" style="width:0%"></span></div><span class="stat-value" id="value-hunger">--</span></div>
          <div class="stat-row"><label class="stat-label health">健康</label><div class="stat-bar health"><span id="bar-health" style="width:0%"></span></div><span class="stat-value" id="value-health">--</span></div>
          <div class="stat-row"><label class="stat-label mood">情绪</label><div class="stat-bar mood"><span id="bar-mood" style="width:0%"></span></div><span class="stat-value" id="value-mood">--</span></div>
        </div>
        <div class="meta-line meta-pills" id="growth-line"></div>
      </div>

      <div class="overlay-event panel event-floating hidden">
          <div class="section-subtitle">活动看板</div>
          <div class="event-list" id="event-list">暂无活动</div>
      </div>

      <div id="floating-panel" class="floating-panel panel hidden">
        <div class="panel-top">
          <span class="section-subtitle">操作面板</span>
          <button type="button" class="btn btn-secondary panel-close" id="dock-close-panel">关闭</button>
        </div>
        <div id="panel-shop" class="panel-section">
          <div class="section-subtitle">商店货架</div>
          <div class="shop-rows" id="shop-rows"></div>
        </div>
        <div id="panel-inventory" class="panel-section">
          <div class="section-subtitle">背包库存</div>
          <div class="inventory-list" id="inventory-list">暂无库存</div>
          <div class="field shop-field">
            <label for="feed-item-select">喂食道具（库存）</label>
            <select id="feed-item-select">
              <option value="">请选择库存道具</option>
            </select>
          </div>
        </div>
        <div id="panel-hospital" class="panel-section">
          <div class="section-subtitle">医院</div>
          <div class="action-bar shop-actions">
            <button type="button" class="btn btn-secondary" id="hospital-treat">去医院治疗</button>
          </div>
        </div>
      </div>

      <div class="overlay-dock">
        <div class="action-dock">
          <button type="button" class="dock-action" data-action="Feed" title="喂食"><span class="dock-icon icon-feed" aria-hidden="true"></span><span>喂食</span></button>
          <button type="button" class="dock-action" data-action="Cuddle" title="抱抱"><span class="dock-icon icon-cuddle" aria-hidden="true"></span><span>抱抱</span></button>
          <button type="button" class="dock-action" data-action="Pat" title="摸头"><span class="dock-icon icon-pat" aria-hidden="true"></span><span>摸头</span></button>
          <button type="button" class="dock-action utility" id="dock-shop" title="商店"><span class="dock-icon icon-shop" aria-hidden="true"></span><span>商店</span></button>
          <button type="button" class="dock-action utility" id="dock-bag" title="背包"><span class="dock-icon icon-bag" aria-hidden="true"></span><span>背包</span></button>
          <button type="button" class="dock-action utility" id="dock-hospital" title="医院"><span class="dock-icon icon-hospital" aria-hidden="true"></span><span>医院</span></button>
          <button type="button" class="dock-action utility danger" id="leave-garden" title="退出"><span class="dock-icon icon-leave" aria-hidden="true"></span><span>退出</span></button>
        </div>
      </div>
    </div>
  `;

  return {
    root,
    wsBar: root.querySelector("#ws-bar") as HTMLElement,
    gameMount: root.querySelector("#game-mount") as HTMLElement,
    toggleStatsBtn: root.querySelector("#toggle-stats") as HTMLButtonElement,
    toggleEventsBtn: root.querySelector("#toggle-events") as HTMLButtonElement,
    eventDot: root.querySelector("#event-dot") as HTMLElement,
    dockShopBtn: root.querySelector("#dock-shop") as HTMLButtonElement,
    dockBagBtn: root.querySelector("#dock-bag") as HTMLButtonElement,
    dockHospitalBtn: root.querySelector("#dock-hospital") as HTMLButtonElement,
    dockClosePanelBtn: root.querySelector("#dock-close-panel") as HTMLButtonElement,
    floatingPanel: root.querySelector("#floating-panel") as HTMLElement,
    panelShop: root.querySelector("#panel-shop") as HTMLElement,
    panelInventory: root.querySelector("#panel-inventory") as HTMLElement,
    panelHospital: root.querySelector("#panel-hospital") as HTMLElement,
    barHunger: root.querySelector("#bar-hunger") as HTMLElement,
    barHealth: root.querySelector("#bar-health") as HTMLElement,
    barMood: root.querySelector("#bar-mood") as HTMLElement,
    valueHunger: root.querySelector("#value-hunger") as HTMLElement,
    valueHealth: root.querySelector("#value-health") as HTMLElement,
    valueMood: root.querySelector("#value-mood") as HTMLElement,
    gardenMeta: root.querySelector("#garden-meta") as HTMLElement,
    growthLine: root.querySelector("#growth-line") as HTMLElement,
    eventList: root.querySelector("#event-list") as HTMLElement,
    actionButtons: [...root.querySelectorAll<HTMLButtonElement>("[data-action]")],
    feedSelect: root.querySelector("#feed-item-select") as HTMLSelectElement,
    inventoryList: root.querySelector("#inventory-list") as HTMLElement,
    shopRows: root.querySelector("#shop-rows") as HTMLDivElement,
    hospitalTreatBtn: root.querySelector("#hospital-treat") as HTMLButtonElement,
    leaveButton: root.querySelector("#leave-garden") as HTMLButtonElement,
  };
}
