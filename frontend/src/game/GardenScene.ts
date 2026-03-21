import Phaser from "phaser";

/**
 * Phaser layer: garden backdrop, pet placeholder, local cursor dot, remote user pointers.
 * Coordinates are normalized 0–1 on the canvas (doc/API §8).
 */
export class GardenScene extends Phaser.Scene {
  private petMarker!: Phaser.GameObjects.Arc;

  private localCursor!: Phaser.GameObjects.Arc;

  private remotePointers = new Map<string, Phaser.GameObjects.Arc>();

  /** Emits normalized (x,y) for throttled `updatePointer` (~100ms in app). */
  readonly pointerNormEmitter = new Phaser.Events.EventEmitter();

  constructor() {
    super("GardenScene");
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    this.add.rectangle(w / 2, h / 2, w, h, 0xf5ecd7);
    this.add
      .text(w / 2, 28, "花园", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "16px",
        color: "#3d2914",
      })
      .setOrigin(0.5);

    this.petMarker = this.add.circle(w * 0.5, h * 0.5, 22, 0x7bc96f).setStrokeStyle(3, 0x5c4033);
    this.localCursor = this.add.circle(0, 0, 7, 0x6b9ac4, 0.9).setStrokeStyle(2, 0x3d2914);

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const nx = pointer.x / w;
      const ny = pointer.y / h;
      this.localCursor.setPosition(pointer.x, pointer.y);
      this.pointerNormEmitter.emit("move", nx, ny);
    });
  }

  setPetNormPosition(x: number, y: number): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.petMarker.setPosition(x * w, y * h);
  }

  /** Update or create a remote user's pointer (others only on wire). */
  setRemotePointerNorm(userId: string, x: number, y: number): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const px = x * w;
    const py = y * h;
    let g = this.remotePointers.get(userId);
    if (!g) {
      g = this.add.circle(px, py, 9, 0xe07a5f).setStrokeStyle(2, 0x5c4033);
      this.remotePointers.set(userId, g);
    } else {
      g.setPosition(px, py);
    }
  }

  removeRemotePointer(userId: string): void {
    const g = this.remotePointers.get(userId);
    if (g) {
      g.destroy();
      this.remotePointers.delete(userId);
    }
  }

  clearRemotePointers(): void {
    for (const id of this.remotePointers.keys()) {
      this.removeRemotePointer(id);
    }
  }
}
