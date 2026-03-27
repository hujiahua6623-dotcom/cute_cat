import type { GardenEventWire } from "../../network/types";

type BirthdayModalDom = {
  backdrop: HTMLDivElement;
  title: HTMLElement;
  message: HTMLElement;
  taskLabel: HTMLElement;
  taskProgress: HTMLElement;
  taskBarSpan: HTMLElement;
  reward: HTMLElement;
  rewardCoins: HTMLElement;
};

const modalByEventId = new Map<string, BirthdayModalDom>();

export function hasBirthdayModal(eventId: string): boolean {
  return modalByEventId.has(eventId);
}

function pct(current: number, target: number): number {
  if (!target || target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
}

export function openBirthdayModal(ev: GardenEventWire): void {
  const eventId = ev.eventId;
  if (!eventId) return;

  const existing = modalByEventId.get(eventId);
  if (existing) {
    updateBirthdayModalProgress(ev);
    updateBirthdayModalReward(ev);
    return;
  }

  // Centered modal that must not block underlying buttons (click-through).
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop birthday-backdrop";

  const panel = document.createElement("div");
  panel.className = "panel modal modal--pixel birthday-panel";

  panel.innerHTML = `
    <h2 class="birthday-title">${ev.title ?? "生日庆典"}</h2>
    <p class="offline-meta birthday-message">${ev.message ?? "今天多陪陪它吧（占位）"}</p>

    <div class="birthday-task">
      <div class="section-subtitle">今日任务</div>
      <div class="birthday-task-meta" data-role="taskLabel">${ev.tasks?.[0]?.label ?? "—"}</div>

      <div class="birthday-task-progress">
        <div class="birthday-progress-bar stat-bar">
          <span data-role="taskBarSpan" style="width:0%"></span>
        </div>
        <div class="birthday-task-progress-text" data-role="taskProgressText">0/0</div>
      </div>
    </div>

    <div class="birthday-reward" data-role="reward" style="display:none">
      <div class="section-subtitle">奖励已发放</div>
      <div class="birthday-reward-text" data-role="rewardCoins">+0 金币</div>
    </div>
  `;

  backdrop.appendChild(panel);
  document.body.appendChild(backdrop);

  const dom: BirthdayModalDom = {
    backdrop,
    title: panel.querySelector(".birthday-title") as HTMLElement,
    message: panel.querySelector(".birthday-message") as HTMLElement,
    taskLabel: panel.querySelector('[data-role="taskLabel"]') as HTMLElement,
    taskProgress: panel.querySelector('[data-role="taskProgressText"]') as HTMLElement,
    taskBarSpan: panel.querySelector('[data-role="taskBarSpan"]') as HTMLElement,
    reward: panel.querySelector('[data-role="reward"]') as HTMLElement,
    rewardCoins: panel.querySelector('[data-role="rewardCoins"]') as HTMLElement,
  };

  modalByEventId.set(eventId, dom);
  updateBirthdayModalProgress(ev);
  updateBirthdayModalReward(ev);
}

export function updateBirthdayModalProgress(ev: GardenEventWire): void {
  const dom = modalByEventId.get(ev.eventId);
  if (!dom) return;
  dom.title.textContent = ev.title ?? dom.title.textContent;
  dom.message.textContent = ev.message ?? dom.message.textContent;

  const task = ev.tasks?.[0];
  if (!task) return;

  dom.taskLabel.textContent = task.label;
  dom.taskProgress.textContent = `${task.current}/${task.target}`;
  dom.taskBarSpan.style.width = `${pct(task.current, task.target)}%`;
}

export function updateBirthdayModalReward(ev: GardenEventWire): void {
  const dom = modalByEventId.get(ev.eventId);
  if (!dom) return;

  const coins = ev.rewardsGranted?.coins;
  if (ev.phase !== "ended" || typeof coins !== "number") {
    dom.reward.style.display = "none";
    return;
  }

  dom.rewardCoins.textContent = `+${coins} 金币`;
  dom.reward.style.display = "block";
}

