import type { GameTimePayload, GardenUserWire, PetStats, WsServerMessage } from "../network/types";

export type WsUiStatus = "idle" | "connecting" | "open" | "disconnected" | "reconnecting";

export interface GameStoreState {
  userId: string | null;
  nickname: string | null;
  petId: string | null;
  gardenId: string | null;
  /** Latest pet stats (REST + petStateDelta). */
  stats: PetStats | null;
  gameTime: GameTimePayload | null;
  growthStage: number | null;
  stabilityScore: number | null;
  /** Other users in garden (from snapshot + pointer updates). */
  gardenUsers: Map<string, GardenUserWire>;
  wsStatus: WsUiStatus;
  /** Last action broadcast from *others* (for optional animation); own actions use local feedback. */
  lastRemoteAction: { actionType: string; actorUserId: string; petId: string } | null;
  toastMessage: string | null;
}

function initialState(): GameStoreState {
  return {
    userId: null,
    nickname: null,
    petId: null,
    gardenId: null,
    stats: null,
    gameTime: null,
    growthStage: null,
    stabilityScore: null,
    gardenUsers: new Map(),
    wsStatus: "idle",
    lastRemoteAction: null,
    toastMessage: null,
  };
}

type Listener = () => void;

/**
 * Minimal client cache for garden HUD + Phaser.
 * `applyWsMessage` encodes server-authoritative updates.
 */
export class GameStore {
  private state: GameStoreState = initialState();
  private listeners = new Set<Listener>();

  getState(): GameStoreState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  resetSession(): void {
    this.state = initialState();
    this.notify();
  }

  setUser(me: { userId: string; nickname: string }): void {
    this.state.userId = me.userId;
    this.state.nickname = me.nickname;
    this.notify();
  }

  setPetContext(petId: string | null, gardenId: string | null): void {
    this.state.petId = petId;
    this.state.gardenId = gardenId;
    this.notify();
  }

  hydrateFromPetSnapshot(data: {
    stats: PetStats;
    gameTime: GameTimePayload;
    growthStage: number;
    stabilityScore: number;
  }): void {
    this.state.stats = { ...data.stats };
    this.state.gameTime = { ...data.gameTime };
    this.state.growthStage = data.growthStage;
    this.state.stabilityScore = data.stabilityScore;
    this.notify();
  }

  setWsStatus(s: WsUiStatus): void {
    this.state.wsStatus = s;
    this.notify();
  }

  /** Merge snapshot users into map (normalized pointers). */
  setGardenUsersFromSnapshot(users: GardenUserWire[]): void {
    const uid = this.state.userId;
    this.state.gardenUsers = new Map();
    for (const u of users) {
      if (uid && u.userId === uid) continue;
      this.state.gardenUsers.set(u.userId, { ...u });
    }
    this.notify();
  }

  updateOtherPointer(userId: string, x: number, y: number, nickname?: string): void {
    const prev = this.state.gardenUsers.get(userId);
    this.state.gardenUsers.set(userId, {
      userId,
      nickname: nickname ?? prev?.nickname ?? "…",
      pointer: { x, y },
    });
    this.notify();
  }

  applyPetStateDelta(stats: PetStats, delta: Partial<PetStats>): void {
    this.state.stats = { ...stats };
    const parts = Object.entries(delta)
      .filter(([, v]) => v !== undefined && v !== 0)
      .map(([k, v]) => `${k} ${v !== undefined && Number(v) > 0 ? "+" : ""}${v}`)
      .slice(0, 4);
    if (parts.length) {
      this.state.toastMessage = parts.join(" · ");
    }
    this.notify();
  }

  clearToast(): void {
    this.state.toastMessage = null;
    this.notify();
  }

  setRemoteActionBrief(action: GameStoreState["lastRemoteAction"]): void {
    this.state.lastRemoteAction = action;
    this.notify();
  }

  /**
   * Apply WebSocket payloads; keeps `petStateDelta` as source of truth for stats.
   */
  applyWsMessage(msg: WsServerMessage, localUserId: string | null): void {
    if (msg.type === "gardenSnapshot" && msg.payload) {
      const p = msg.payload as import("../network/types").GardenSnapshotPayload;
      this.state.gameTime = { ...p.gameTime };
      this.setGardenUsersFromSnapshot(p.users);
      const mine = p.pets.find((pet) => pet.petId === this.state.petId);
      if (mine) {
        this.state.stats = { ...mine.stats };
      }
      this.notify();
      return;
    }
    if (
      msg.type === "pointerUpdate" &&
      msg.payload &&
      typeof msg.payload === "object" &&
      "userId" in msg.payload
    ) {
      const pl = msg.payload as { userId: string; pointer: { x: number; y: number } };
      if (localUserId && pl.userId === localUserId) return;
      this.updateOtherPointer(pl.userId, pl.pointer.x, pl.pointer.y);
      return;
    }
    if (
      msg.type === "petStateDelta" &&
      msg.payload &&
      typeof msg.payload === "object" &&
      "stats" in msg.payload
    ) {
      const pl = msg.payload as { petId: string; delta: Partial<PetStats>; stats: PetStats };
      if (pl.petId === this.state.petId) {
        this.applyPetStateDelta(pl.stats, pl.delta);
      }
      return;
    }
    if (
      msg.type === "actionBroadcast" &&
      msg.payload &&
      typeof msg.payload === "object" &&
      "actorUserId" in msg.payload
    ) {
      const pl = msg.payload as { actorUserId: string; petId: string; actionType: string };
      if (localUserId && pl.actorUserId === localUserId) return;
      this.setRemoteActionBrief({ actorUserId: pl.actorUserId, petId: pl.petId, actionType: pl.actionType });
      return;
    }
  }
}
