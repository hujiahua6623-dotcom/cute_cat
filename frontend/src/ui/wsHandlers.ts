import type { GardenSnapshotPayload, WsServerMessage } from "../network/types";
import type { GameStore } from "../state/gameStore";
import { showActionToast } from "./feedback";

interface WsHandlerDeps {
  me: { userId: string; petId: string | null };
  store: GameStore;
  getScene: () => {
    setPetNormPosition: (x: number, y: number) => void;
    clearRemotePointers: () => void;
    setRemotePointerNorm: (userId: string, x: number, y: number) => void;
    removeRemotePointer: (userId: string) => void;
  } | null;
  syncHud: () => void;
}

export function createWsMessageHandler(deps: WsHandlerDeps): (msg: WsServerMessage) => void {
  const { me, store, getScene, syncHud } = deps;

  return (msg: WsServerMessage): void => {
    const uid = store.getState().userId;
    store.applyWsMessage(msg, uid);

    if (msg.type === "gardenSnapshot" && msg.payload) {
      const pl = msg.payload as GardenSnapshotPayload;
      const mine = pl.pets.find((p) => p.petId === me.petId);
      if (mine) {
        getScene()?.setPetNormPosition(mine.position.x, mine.position.y);
      }
      getScene()?.clearRemotePointers();
      for (const u of pl.users) {
        if (u.userId === me.userId) continue;
        getScene()?.setRemotePointerNorm(u.userId, u.pointer.x, u.pointer.y);
      }
    }

    if (msg.type === "pointerUpdate" && msg.payload && typeof msg.payload === "object" && "userId" in msg.payload) {
      const pl = msg.payload as { userId: string; pointer: { x: number; y: number } };
      if (pl.userId !== me.userId) {
        getScene()?.setRemotePointerNorm(pl.userId, pl.pointer.x, pl.pointer.y);
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

    if (msg.type === "userLeft" && msg.payload && typeof msg.payload === "object" && "userId" in msg.payload) {
      const pl = msg.payload as { userId: string };
      if (pl.userId !== me.userId) {
        getScene()?.removeRemotePointer(pl.userId);
      }
    }

    syncHud();
  };
}
