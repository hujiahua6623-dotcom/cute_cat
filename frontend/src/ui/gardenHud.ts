import type { GameStoreState } from "../state/gameStore";
import type { GardenViewRefs } from "./views";

function statPercent(v: number): number {
  return Math.max(0, Math.min(100, v));
}

export function renderGardenHud(state: GameStoreState, view: GardenViewRefs): void {
  const st = state.stats;
  if (st) {
    view.barHunger.style.width = `${statPercent(st.hunger)}%`;
    view.barHealth.style.width = `${statPercent(st.health)}%`;
    view.barMood.style.width = `${statPercent(st.mood)}%`;
  }

  const gt = state.gameTime;
  view.gardenMeta.textContent = gt
    ? `游戏时间：第 ${gt.gameDayIndex} 天 · ${gt.gameHourFloat.toFixed(2)} 时 · ${state.nickname ?? ""}`
    : "";
  view.growthLine.textContent =
    state.growthStage !== null && state.stabilityScore !== null
      ? `成长阶段 ${state.growthStage} · 稳定度 ${state.stabilityScore.toFixed(2)}`
      : "";
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
