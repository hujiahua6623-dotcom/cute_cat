import type { GameStoreState } from "../state/gameStore";
import type { GardenViewRefs } from "./views";

function statPercent(v: number): number {
  return Math.max(0, Math.min(100, v));
}

export function renderGardenHud(state: GameStoreState, view: GardenViewRefs): void {
  const st = state.stats;
  if (st) {
    // Hunger stat is "higher = worse"; bar + label show satiety (100 - hunger).
    const satiety = 100 - st.hunger;
    const satPct = statPercent(satiety);
    view.barHunger.style.width = `${satPct}%`;
    view.barHealth.style.width = `${statPercent(st.health)}%`;
    view.barMood.style.width = `${statPercent(st.mood)}%`;
    view.valueHunger.textContent = `${Math.round(satPct)}`;
    view.valueHealth.textContent = `${Math.round(statPercent(st.health))}`;
    view.valueMood.textContent = `${Math.round(statPercent(st.mood))}`;
  } else {
    view.valueHunger.textContent = "--";
    view.valueHealth.textContent = "--";
    view.valueMood.textContent = "--";
  }

  const gt = state.gameTime;
  view.gardenMeta.textContent = gt
    ? `游戏时间：第 ${gt.gameDayIndex} 天 · ${gt.gameHourFloat.toFixed(2)} 时 · ${state.nickname ?? ""} · 金币 ${state.coins ?? "--"}`
    : "";
  view.growthLine.textContent =
    state.growthStage !== null && state.stabilityScore !== null
      ? `成长阶段 ${state.growthStage} · 稳定度 ${state.stabilityScore.toFixed(2)} · 连稳 ${state.consecutiveStableDays ?? "-"} · 窗口病史 ${state.sickCountInWindow ?? "-"} · 窗口天数 ${state.windowGameDays ?? "-"} · 最近结算日 ${state.lastGameDayIndex ?? "-"}`
      : "";

  // Event priority:
  // 1) current user's daily task (owner-scoped), 2) social task.
  // Never fallback to other users' daily tasks.
  const events = [...state.activeEvents.values()];
  const ownDailyEvent = events.find((ev) => ev.eventType === "daily" && ev.ownerUserId === state.userId);
  const event = ownDailyEvent ?? events.find((ev) => ev.eventType === "social");
  if (!event) {
    view.eventList.textContent = "暂无活动";
    return;
  }

  if (event.eventType === "social" && !ownDailyEvent) {
    view.eventList.innerHTML = `
      <div class="event-title">${event.title ?? "花园活动"}</div>
      <div class="event-task-label">当前账号暂无每日任务，摸头不会推进该条目。</div>
    `;
    return;
  }

  const task = event.tasks?.[0];
  if (!task) {
    view.eventList.textContent = "暂无可用任务";
    return;
  }

  const rewardCoins = event.rewardsGranted?.coins;
  const taskPct = task.target > 0 ? statPercent((task.current / task.target) * 100) : 0;

  view.eventList.innerHTML = `
    <div class="event-title">${event.title ?? "活动任务"}</div>
    <div class="event-task-label">${task.label}</div>
    <div class="event-progress-bar stat-bar">
      <span style="width:${taskPct}%"></span>
    </div>
    <div class="event-progress-text">${task.current}/${task.target}</div>
    ${
      event.narrativeSuggestions?.[0]
        ? `<div class="event-task-label">建议：${event.narrativeSuggestions[0]}</div>`
        : ""
    }
    ${
      event.phase === "ended" && typeof rewardCoins === "number"
        ? `<div class="event-reward">奖励已发放：+${rewardCoins} 金币</div>`
        : ""
    }
  `;
}

const WS_LABELS: Record<string, string> = {
  connecting: "连接中…",
  connected: "已连接",
  reconnecting: "重连中…",
  disconnected: "连接断开",
};

export function renderWsStatusBar(wsBar: HTMLElement, status: string): void {
  wsBar.className = `ws-bar ${status}`;
  wsBar.innerHTML = `<span class="ws-dot"></span>${WS_LABELS[status] ?? status}`;
}
