import type { GardenSnapshotPayload, WsServerMessage } from "../network/types";
import type { GameStore } from "../state/gameStore";
import { showActionToast } from "./feedback";
import {
  hasBirthdayModal,
  openBirthdayModal,
  updateBirthdayModalProgress,
  updateBirthdayModalReward,
} from "./events/birthdayModal";

interface WsHandlerDeps {
  me: { userId: string; petId: string | null };
  store: GameStore;
  getScene: () => {
    setPetNormPosition: (x: number, y: number) => void;
    setGardenPets: (
      pets: Array<{
        petId: string;
        ownerUserId: string;
        petName?: string;
        ownerNickname?: string;
        position: { x: number; y: number };
      }>,
      localUserId: string
    ) => void;
    clearRemotePointers: () => void;
    setRemotePointerNorm: (userId: string, x: number, y: number) => void;
    removeRemotePointer: (userId: string) => void;
    playPetAction: (petId: string, actionType: string) => void;
  } | null;
  syncHud: () => void;
  onInventoryChanged?: (itemId: string, count: number) => void;
}

export function createWsMessageHandler(deps: WsHandlerDeps): (msg: WsServerMessage) => void {
  const { me, store, getScene, syncHud, onInventoryChanged } = deps;

  return (msg: WsServerMessage): void => {
    const uid = store.getState().userId;
    store.applyWsMessage(msg, uid);

    if (msg.type === "gardenSnapshot" && msg.payload) {
      const pl = msg.payload as GardenSnapshotPayload;
      const nicknameByUserId = new Map(pl.users.map((u) => [u.userId, u.nickname]));
      getScene()?.setGardenPets(
        pl.pets.map((p) => ({
          petId: p.petId,
          ownerUserId: p.ownerUserId,
          petName: p.petName,
          ownerNickname: nicknameByUserId.get(p.ownerUserId),
          position: p.position,
        })),
        me.userId
      );
      getScene()?.clearRemotePointers();
      for (const u of pl.users) {
        if (u.userId === me.userId) continue;
        getScene()?.setRemotePointerNorm(u.userId, u.pointer.x, u.pointer.y);
      }

      // Cycle 3 birthday: open once per eventId for the current user's pet owner.
      for (const ev of pl.activeEvents ?? []) {
        if (ev.eventType !== "birthday") continue;
        if (ev.ownerUserId !== me.userId) continue;
        if (!hasBirthdayModal(ev.eventId)) {
          // "Once" is about triggering; if DOM is missing (e.g. removed by screenshot script),
          // we still want to re-open to keep UI consistent.
          if (store.isBirthdayModalShown(ev.eventId) || store.tryConsumeBirthdayModal(ev.eventId)) {
            openBirthdayModal(ev);
          }
        }
        // Keep content fresh across reconnect / snapshot re-sync.
        updateBirthdayModalProgress(ev);
        updateBirthdayModalReward(ev);
      }
    }

    if (msg.type === "pointerUpdate" && msg.payload && typeof msg.payload === "object" && "userId" in msg.payload) {
      const pl = msg.payload as { userId: string; pointer: { x: number; y: number } };
      if (pl.userId !== me.userId) {
        getScene()?.setRemotePointerNorm(pl.userId, pl.pointer.x, pl.pointer.y);
      }
    }

    if (
      msg.type === "inventoryChanged" &&
      msg.payload &&
      typeof msg.payload === "object" &&
      "itemId" in msg.payload &&
      "count" in msg.payload
    ) {
      const pl = msg.payload as { itemId: string; count: number };
      onInventoryChanged?.(pl.itemId, Number(pl.count) || 0);
    }

    if (
      msg.type === "actionBroadcast" &&
      msg.payload &&
      typeof msg.payload === "object" &&
      "actorUserId" in msg.payload
    ) {
      const pl = msg.payload as { actorUserId: string; actionType: string; petId?: string };
      if (pl.petId) {
        getScene()?.playPetAction(pl.petId, pl.actionType);
      }
      if (pl.actorUserId !== me.userId) {
        showActionToast(`他人：${pl.actionType}`);
      }
    }

    if (msg.type === "userLeft" && msg.payload && typeof msg.payload === "object" && "userId" in msg.payload) {
      const pl = msg.payload as { userId: string };
      if (pl.userId !== me.userId) {
        getScene()?.removeRemotePointer(pl.userId);
      }
    }

    if (msg.type === "eventBroadcast" && msg.payload && typeof msg.payload === "object" && "eventId" in msg.payload) {
      const ev = msg.payload as any;

      if (ev.eventType === "birthday" && ev.ownerUserId === me.userId) {
        if (!hasBirthdayModal(ev.eventId)) {
          if (store.isBirthdayModalShown(ev.eventId) || store.tryConsumeBirthdayModal(ev.eventId)) {
            openBirthdayModal(ev);
          }
        }
        updateBirthdayModalProgress(ev);
        if (ev.phase === "ended") {
          updateBirthdayModalReward(ev);
          const coins = ev.rewardsGranted?.coins;
          if (typeof coins === "number") {
            store.addCoins(coins);
            showActionToast(`生日奖励：+${coins} 金币`);
          }
        }
      }

      if (ev.eventType === "social" && ev.phase === "ended") {
        const coins = ev.rewardsGranted?.coins;
        if (typeof coins === "number") {
          store.addCoins(coins);
          showActionToast(`花园社交奖励：+${coins} 金币`);
        }
      }
      if (ev.eventType === "daily" && ev.phase === "ended") {
        const coins = ev.rewardsGranted?.coins;
        if (typeof coins === "number") {
          store.addCoins(coins);
          showActionToast(`每日任务奖励：+${coins} 金币`);
        }
      }
    }

    syncHud();
  };
}
