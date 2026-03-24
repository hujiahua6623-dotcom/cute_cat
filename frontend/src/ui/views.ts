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
    <h1 class="auth-title">小屋里的电子宠物</h1>
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
    <h2 class="section-title">领养宠物</h2>
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
  barHunger: HTMLElement;
  barHealth: HTMLElement;
  barMood: HTMLElement;
  valueHunger: HTMLElement;
  valueHealth: HTMLElement;
  valueMood: HTMLElement;
  gardenMeta: HTMLElement;
  growthLine: HTMLElement;
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
    <div id="ws-bar" class="ws-bar connecting" role="status"><span class="ws-dot"></span>连接中…</div>
    <div class="garden-row">
      <div id="game-mount" class="game-mount"></div>
      <aside class="hud panel">
        <div class="meta-line" id="garden-meta"></div>
        <div class="stat-grid">
          <div class="stat-row"><label>饱腹</label><div class="stat-bar"><span id="bar-hunger" style="width:0%"></span></div><span class="stat-value" id="value-hunger">--</span></div>
          <div class="stat-row"><label>健康</label><div class="stat-bar health"><span id="bar-health" style="width:0%"></span></div><span class="stat-value" id="value-health">--</span></div>
          <div class="stat-row"><label>情绪</label><div class="stat-bar mood"><span id="bar-mood" style="width:0%"></span></div><span class="stat-value" id="value-mood">--</span></div>
        </div>
        <div class="meta-line" id="growth-line"></div>
        <div class="action-bar">
          <button type="button" class="btn" data-action="Feed">喂食</button>
          <button type="button" class="btn" data-action="Cuddle">抱抱</button>
          <button type="button" class="btn" data-action="Pat">摸头</button>
        </div>
        <div class="field shop-field">
          <label for="feed-item-select">喂食道具（库存）</label>
          <select id="feed-item-select">
            <option value="">请选择库存道具</option>
          </select>
        </div>
        <div class="shop-section">
          <div class="section-subtitle">商店</div>
          <div class="shop-rows" id="shop-rows"></div>
        </div>
        <div class="shop-section">
          <div class="section-subtitle">库存</div>
          <div class="inventory-list" id="inventory-list">暂无库存</div>
        </div>
        <div class="action-bar shop-actions">
          <button type="button" class="btn btn-secondary" id="hospital-treat">去医院治疗</button>
        </div>
        <div class="btn-row hud-foot">
          <button type="button" class="btn btn-secondary" id="leave-garden">退出</button>
        </div>
      </aside>
    </div>
  `;

  return {
    root,
    wsBar: root.querySelector("#ws-bar") as HTMLElement,
    gameMount: root.querySelector("#game-mount") as HTMLElement,
    barHunger: root.querySelector("#bar-hunger") as HTMLElement,
    barHealth: root.querySelector("#bar-health") as HTMLElement,
    barMood: root.querySelector("#bar-mood") as HTMLElement,
    valueHunger: root.querySelector("#value-hunger") as HTMLElement,
    valueHealth: root.querySelector("#value-health") as HTMLElement,
    valueMood: root.querySelector("#value-mood") as HTMLElement,
    gardenMeta: root.querySelector("#garden-meta") as HTMLElement,
    growthLine: root.querySelector("#growth-line") as HTMLElement,
    actionButtons: [...root.querySelectorAll<HTMLButtonElement>("[data-action]")],
    feedSelect: root.querySelector("#feed-item-select") as HTMLSelectElement,
    inventoryList: root.querySelector("#inventory-list") as HTMLElement,
    shopRows: root.querySelector("#shop-rows") as HTMLDivElement,
    hospitalTreatBtn: root.querySelector("#hospital-treat") as HTMLButtonElement,
    leaveButton: root.querySelector("#leave-garden") as HTMLButtonElement,
  };
}
