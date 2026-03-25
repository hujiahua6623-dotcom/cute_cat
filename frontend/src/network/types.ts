/** Wire shapes aligned with doc/API-后端与前端对接.md */

export type ActionType = "Feed" | "Cuddle" | "Pat" | "Play" | "TreatAtHospital";

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface TokenResponse {
  userId?: string | null;
  accessToken: string;
  accessExpiresIn: number;
  refreshToken: string;
  refreshExpiresIn: number;
}

export interface MeResponse {
  userId: string;
  nickname: string;
  coins: number;
  petId: string | null;
  gardenId: string | null;
}

export interface ClaimPetResponse {
  petId: string;
  gardenId: string;
  petType: string;
  skinSeed: number;
  birthdayGameDay: number;
}

export interface GameTimePayload {
  gameDayIndex: number;
  gameHourIndex?: number;
  gameHourFloat: number;
}

export interface PetStats {
  hunger: number;
  health: number;
  mood: number;
  loyalty: number;
  sickLevel: number;
}

export interface PetSnapshotResponse {
  petId: string;
  ownerUserId: string;
  petName: string;
  petType: string;
  skinSeed: number;
  growthStage: number;
  gameTime: GameTimePayload;
  stats: PetStats;
  stability: {
    stabilityScore: number;
    windowGameDays: number;
    sickCountInWindow: number;
    consecutiveStableDays: number;
    lastGameDayIndex: number;
  };
  memory: { summary: string; milestones: unknown[]; lastUpdatedAt: string | null };
}

export interface ShopBuyResponse {
  itemId: string;
  countAdded: number;
  inventoryCount: number;
  coinsAfter: number;
}

export interface InventoryItem {
  itemId: string;
  count: number;
}

export interface InventoryListResponse {
  items: InventoryItem[];
}

export interface HospitalTreatResponse {
  petId: string;
  treatCost: number;
  coinsAfter: number;
  stats: PetStats;
  delta: Partial<PetStats>;
}

export interface OfflineSummaryResponse {
  petId: string;
  reasons: string[];
  suggestedActionType: ActionType | string;
  sinceGameTime: GameTimePayload;
  untilGameTime: GameTimePayload;
}

export interface WsTicketResponse {
  wsUrl: string;
  ticket: string;
  expiresIn: number;
  gardenId: string;
}

export interface GardenPetWire {
  petId: string;
  ownerUserId: string;
  petName: string;
  petType: string;
  skinSeed: number;
  position: { x: number; y: number };
  stats: PetStats;
  /** Server monotonic version; used to ignore stale petStateDelta. */
  stateVersion?: number;
}

export interface GardenUserWire {
  userId: string;
  nickname: string;
  pointer: { x: number; y: number };
}

export interface GardenSnapshotPayload {
  gardenId: string;
  layoutVersion: number;
  serverNow: string;
  gameTime: GameTimePayload;
  pets: GardenPetWire[];
  users: GardenUserWire[];
  /** Cycle 3: event system SSOT; initialize UI from this array. */
  activeEvents: GardenEventWire[];
}

export type WsClientMessage =
  | { type: "joinGarden"; requestId: string; payload: { gardenId: string; clientViewport?: { width: number; height: number } } }
  | { type: "updatePointer"; requestId: string; payload: { gardenId: string; x: number; y: number } }
  | { type: "petAction"; requestId: string; payload: { gardenId: string; actionType: string; petId: string; itemId?: string } };

export interface GardenEventTaskWire {
  taskId: string;
  label: string;
  current: number;
  target: number;
  scope: "pet" | "garden" | string;
}

export interface GardenEventRewardsGrantedWire {
  coins?: number;
}

export interface GardenEventEndsAtGameTimeWire {
  gameDayIndex: number;
  gameHourFloat: number;
}

export interface GardenEventWire {
  eventId: string;
  eventType: string; // "birthday" | "social" (doc)
  phase: string; // "started" | "tick" | "ended"
  templateId: string;
  gardenId: string;

  petId?: string;
  ownerUserId?: string;
  title?: string;
  message?: string;

  tasks?: GardenEventTaskWire[];
  endsAtGameTime?: GardenEventEndsAtGameTimeWire;
  rewardsGranted?: GardenEventRewardsGrantedWire;
}

export type WsServerMessage =
  | { type: "gardenSnapshot"; requestId?: string; payload: GardenSnapshotPayload }
  | { type: "pointerUpdate"; payload: { gardenId: string; userId: string; pointer: { x: number; y: number } } }
  | {
      type: "actionBroadcast";
      payload: {
        gardenId: string;
        actorUserId: string;
        petId: string;
        actionType: string;
        animationKey: string;
        occurredAtGameTime: GameTimePayload;
      };
    }
  | { type: "petStateDelta"; payload: { petId: string; version: number; delta: Partial<PetStats>; stats: PetStats } }
  | { type: "eventBroadcast"; payload: GardenEventWire }
  | { type: "userLeft"; payload: { gardenId: string; userId: string } }
  | { type: "error"; requestId?: string; payload: { code: string; message: string } }
  | { type: string; requestId?: string; payload?: unknown };
