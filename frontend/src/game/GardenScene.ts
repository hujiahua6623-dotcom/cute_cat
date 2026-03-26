import Phaser from "phaser";

/**
 * Phaser layer: garden backdrop, pets, local cursor dot, remote user pointers.
 * Coordinates are normalized 0–1 on the canvas (doc/API §8).
 */
export class GardenScene extends Phaser.Scene {
  private petMarkers = new Map<string, Phaser.GameObjects.Sprite>();
  private petLabels = new Map<string, Phaser.GameObjects.Text>();
  private petBadges = new Map<string, Phaser.GameObjects.Image>();

  private localCursor!: Phaser.GameObjects.Sprite;

  private remotePointers = new Map<string, Phaser.GameObjects.Sprite>();

  /** Emits normalized (x,y) for throttled `updatePointer` (~100ms in app). */
  readonly pointerNormEmitter = new Phaser.Events.EventEmitter();

  constructor() {
    super("GardenScene");
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.ensureTextures();
    this.add.image(w / 2, h / 2, "garden-bg").setDisplaySize(w, h);
    this.localCursor = this.add.sprite(w * 0.5, h * 0.5, "cursor-self").setDepth(30);

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const nx = pointer.x / w;
      const ny = pointer.y / h;
      this.localCursor.setPosition(pointer.x, pointer.y);
      this.pointerNormEmitter.emit("move", nx, ny);
    });
  }

  private ensureTextures(): void {
    if (!this.textures.exists("garden-bg")) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xa6dbeb, 1);
      g.fillRect(0, 0, 960, 540);
      g.fillStyle(0xc6eef8, 1);
      g.fillEllipse(180, 90, 260, 110);
      g.fillEllipse(760, 100, 220, 100);

      g.fillStyle(0xa8db88, 1);
      g.fillRect(0, 250, 960, 290);
      g.fillStyle(0x8ec86f, 1);
      g.fillRect(0, 350, 960, 190);

      g.fillStyle(0xdab684, 1);
      g.fillRoundedRect(120, 285, 640, 82, 28);
      g.fillStyle(0xc59d68, 1);
      g.fillRoundedRect(140, 305, 600, 40, 18);

      g.fillStyle(0x6ca157, 1);
      g.fillCircle(120, 180, 72);
      g.fillCircle(205, 165, 56);
      g.fillCircle(810, 165, 78);
      g.fillCircle(710, 175, 58);
      g.fillStyle(0x6a4a37, 1);
      g.fillRoundedRect(94, 190, 32, 76, 10);
      g.fillRoundedRect(788, 188, 34, 84, 10);

      g.fillStyle(0xf0e2c8, 1);
      g.fillRoundedRect(580, 96, 260, 168, 14);
      g.fillStyle(0xcc5d53, 1);
      g.fillTriangle(560, 104, 710, 6, 860, 104);
      g.lineStyle(4, 0x5c4033, 1);
      g.strokeRoundedRect(580, 96, 260, 168, 14);
      g.strokeTriangle(560, 104, 710, 6, 860, 104);
      g.fillStyle(0x9c6a4e, 1);
      g.fillRoundedRect(682, 184, 56, 80, 8);
      g.fillStyle(0x89bfd6, 1);
      g.fillRoundedRect(612, 144, 52, 44, 6);
      g.fillRoundedRect(752, 144, 52, 44, 6);
      g.lineStyle(3, 0x5c4033, 1);
      g.strokeRoundedRect(612, 144, 52, 44, 6);
      g.strokeRoundedRect(752, 144, 52, 44, 6);

      const flowers = [
        [84, 330, 0xe07a9f],
        [132, 348, 0xf2b26b],
        [820, 352, 0xa47ddc],
        [870, 336, 0xe88963],
        [894, 362, 0x70b8d2],
      ] as const;
      for (const [x, y, color] of flowers) {
        g.fillStyle(color, 1);
        g.fillCircle(x, y, 8);
        g.fillStyle(0xf7f2d8, 1);
        g.fillCircle(x, y, 3);
      }
      g.generateTexture("garden-bg", 960, 540);
      g.destroy();
    }

    if (!this.textures.exists("pet-cat")) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x000000, 0.18);
      g.fillEllipse(32, 49, 34, 11);
      g.fillStyle(0xf2b26b, 1);
      g.fillRoundedRect(8, 14, 48, 34, 8);
      g.fillTriangle(12, 18, 21, 3, 27, 18);
      g.fillTriangle(37, 18, 43, 3, 52, 18);
      g.fillStyle(0x3d2914, 1);
      g.fillCircle(24, 30, 3);
      g.fillCircle(40, 30, 3);
      g.lineStyle(3, 0x3d2914, 1);
      g.lineBetween(31, 37, 34, 37);
      g.lineBetween(31, 40, 34, 40);
      g.generateTexture("pet-cat", 64, 64);
      g.destroy();
    }

    if (!this.textures.exists("pet-badge-self")) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xffd76a, 1);
      g.fillRect(4, 0, 4, 4);
      g.fillRect(0, 4, 12, 4);
      g.fillRect(4, 8, 4, 4);
      g.lineStyle(2, 0x7c5a12, 1);
      g.strokeRect(0, 4, 12, 4);
      g.generateTexture("pet-badge-self", 12, 12);
      g.destroy();
    }

    if (!this.textures.exists("pet-badge-other")) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x8fb7ff, 1);
      g.fillRect(2, 2, 8, 8);
      g.lineStyle(2, 0x36578f, 1);
      g.strokeRect(2, 2, 8, 8);
      g.generateTexture("pet-badge-other", 12, 12);
      g.destroy();
    }

    if (!this.textures.exists("cursor-self")) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x6b9ac4, 0.95);
      g.fillTriangle(10, 0, 20, 20, 0, 20);
      g.lineStyle(2, 0x3d2914, 1);
      g.strokeTriangle(10, 0, 20, 20, 0, 20);
      g.generateTexture("cursor-self", 20, 20);
      g.destroy();
    }

    if (!this.textures.exists("cursor-other")) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xe07a5f, 0.95);
      g.fillRoundedRect(0, 0, 20, 20, 6);
      g.lineStyle(2, 0x5c4033, 1);
      g.strokeRoundedRect(0, 0, 20, 20, 6);
      g.generateTexture("cursor-other", 20, 20);
      g.destroy();
    }
  }

  setPetNormPosition(x: number, y: number): void {
    // Backward compatibility for older callers: treat as "my pet".
    this.setGardenPets([{ petId: "me", ownerUserId: "me", position: { x, y } }], "me");
  }

  setGardenPets(
    pets: Array<{
      petId: string;
      ownerUserId: string;
      petName?: string;
      ownerNickname?: string;
      position: { x: number; y: number };
    }>,
    localUserId: string
  ): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const nextIds = new Set<string>();
    for (const pet of pets) {
      nextIds.add(pet.petId);
      const px = pet.position.x * w;
      const py = pet.position.y * h;
      let marker = this.petMarkers.get(pet.petId);
      if (!marker) {
        marker = this.add.sprite(px, py, "pet-cat").setScale(2).setDepth(10);
        if (pet.ownerUserId !== localUserId) {
          marker.setTint(0xc9d8ff);
        }
        this.petMarkers.set(pet.petId, marker);
      } else {
        marker.setPosition(px, py);
      }

      const isMine = pet.ownerUserId === localUserId;
      const badge = isMine ? "★" : "●";
      const ownerText = isMine ? "你" : pet.ownerNickname ?? "其他玩家";
      const labelText = `${badge} ${pet.petName ?? "宠物"}（${ownerText}）`;
      let label = this.petLabels.get(pet.petId);
      if (!label) {
        label = this.add
          .text(px, py - 42, labelText, {
            fontSize: "12px",
            color: isMine ? "#2f1c10" : "#2a3250",
            backgroundColor: isMine ? "#fff1cf" : "#e9efff",
            padding: { left: 6, right: 6, top: 2, bottom: 2 },
          })
          .setOrigin(0.5, 1)
          .setDepth(12);
        this.petLabels.set(pet.petId, label);
      } else {
        label.setText(labelText);
        label.setColor(isMine ? "#2f1c10" : "#2a3250");
        label.setBackgroundColor(isMine ? "#fff1cf" : "#e9efff");
        label.setPosition(px, py - 42);
      }

      const badgeTex = isMine ? "pet-badge-self" : "pet-badge-other";
      const labelLeft = label.x - label.width * 0.5;
      const badgeX = labelLeft - 10;
      const badgeY = label.y - label.height * 0.5 + 1;
      let badgeSprite = this.petBadges.get(pet.petId);
      if (!badgeSprite) {
        badgeSprite = this.add.image(badgeX, badgeY, badgeTex).setDepth(13);
        this.petBadges.set(pet.petId, badgeSprite);
      } else {
        badgeSprite.setTexture(badgeTex);
        badgeSprite.setPosition(badgeX, badgeY);
      }
    }
    for (const [petId, marker] of this.petMarkers.entries()) {
      if (!nextIds.has(petId)) {
        marker.destroy();
        this.petMarkers.delete(petId);
        const label = this.petLabels.get(petId);
        if (label) {
          label.destroy();
          this.petLabels.delete(petId);
        }
        const badge = this.petBadges.get(petId);
        if (badge) {
          badge.destroy();
          this.petBadges.delete(petId);
        }
      }
    }
  }

  /** Update or create a remote user's pointer (others only on wire). */
  setRemotePointerNorm(userId: string, x: number, y: number): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const px = x * w;
    const py = y * h;
    let marker = this.remotePointers.get(userId);
    if (!marker) {
      marker = this.add.sprite(px, py, "cursor-other").setDepth(30);
      this.remotePointers.set(userId, marker);
    } else {
      marker.setPosition(px, py);
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
