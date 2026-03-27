export function showError(el: HTMLElement, message: string): void {
  const prev = el.querySelector(".error-banner");
  if (prev) prev.remove();
  const banner = document.createElement("div");
  banner.className = "error-banner";
  banner.textContent = message;
  el.prepend(banner);
}

function escapeHtml(text: string): string {
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
}

/** Offline summary modal; resolves when user dismisses. */
export function showOfflineModal(reasons: string[], suggested: string): Promise<void> {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    const list = reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("");
    backdrop.innerHTML = `
      <div class="panel modal modal--pixel">
        <h2>离线摘要</h2>
        <p class="offline-meta">系统已按真实时间持续结算宠物状态</p>
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

export function showActionToast(text: string): void {
  const el = document.createElement("div");
  el.className = text.startsWith("他人：") ? "toast toast--remote toast--pixel" : "toast toast--pixel";
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}
