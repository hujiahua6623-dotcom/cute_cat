import Phaser from "phaser";
import { gameAssetUrl } from "../utils/gameAssetUrl";

/** Server historically stored pet Y in ~[0.2, 0.8]; map into visible grass band (see doc/API pet display note). */
const PET_NORM_Y_SRC_LO = 0.2;
const PET_NORM_Y_SRC_HI = 0.8;
const PET_NORM_Y_GROUND_LO = 0.62;
const PET_NORM_Y_GROUND_HI = 0.8;

function mapPetNormYToGroundBand(y: number): number {
  const t = Math.max(0, Math.min(1, (y - PET_NORM_Y_SRC_LO) / (PET_NORM_Y_SRC_HI - PET_NORM_Y_SRC_LO)));
  return PET_NORM_Y_GROUND_LO + t * (PET_NORM_Y_GROUND_HI - PET_NORM_Y_GROUND_LO);
}

/**
 * Phaser layer: garden backdrop, pets, local cursor dot, remote user pointers.
 * Coordinates are normalized 0–1 on the canvas (doc/API §8).
 * Pet sprites use Y mapped into the ground band so they align with art; pointers use raw norm coords.
 */
export class GardenScene extends Phaser.Scene {
  /** Sprite + name label; bob animation runs on the container so labels track pets. */
  private petRoots = new Map<string, Phaser.GameObjects.Container>();
  private localCursor!: Phaser.GameObjects.Sprite;

  private remotePointers = new Map<string, Phaser.GameObjects.Sprite>();
  private petBobTweens = new Map<string, Phaser.Tweens.Tween>();
  private detailSprites: Phaser.GameObjects.Image[] = [];
  private ambientSprites: Phaser.GameObjects.Image[] = [];

  /** Emits normalized (x,y) for throttled `updatePointer` (~100ms in app). */
  readonly pointerNormEmitter = new Phaser.Events.EventEmitter();
  private cloudSprites: Phaser.GameObjects.Image[] = [];

  /** Optional file keys that failed in preload (Phaser may still register a broken texture). */
  private failedOptionalKeys = new Set<string>();

  constructor() {
    super("GardenScene");
  }

  preload(): void {
    this.load.on("loaderror", (file: { key?: string }) => {
      if (file.key) this.failedOptionalKeys.add(file.key);
    });
    // Resource-driven pipeline (preferred):
    // put production assets under frontend/public/assets/game/*
    this.loadOptionalImage("garden-bg-art", gameAssetUrl("assets/game/scene/garden_bg_playfield.png"));
    this.loadOptionalImage("garden-bg-fallback", gameAssetUrl("assets/game/scene/ui_garden_main_multi_pet.png"));
    this.loadOptionalImage("garden-foreground-art", gameAssetUrl("assets/game/scene/garden_foreground.png"));
    this.loadOptionalImage("pet-cat-art", gameAssetUrl("assets/game/pets/cat/cat_idle.png"));
    this.loadOptionalImage("fx-heart-art", gameAssetUrl("assets/game/fx/heart_burst.png"));
    this.loadOptionalImage("fx-spark-art", gameAssetUrl("assets/game/fx/spark_pop.png"));
    this.loadOptionalImage("fx-food-art", gameAssetUrl("assets/game/fx/food_pop.png"));
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.ensureTextures();
    const bgKey = this.pickOptionalTextureKey("garden-bg-art", "garden-bg", [
      ["garden-bg-fallback", "garden-bg"],
    ]);
    const bgImg = this.add.image(w / 2, h / 2, bgKey).setDisplaySize(w, h);
    this.ensureImageNotMissing(bgImg, "garden-bg", { w, h });
    this.cloudSprites = [
      this.add.image(w * 0.2, h * 0.14, "cloud-puff").setScale(1.2).setAlpha(0.7).setDepth(2),
      this.add.image(w * 0.73, h * 0.18, "cloud-puff").setScale(1.05).setAlpha(0.68).setDepth(2),
    ];
    this.placeAmbientParticles(w, h);
    this.placeGroundDetails(w, h);
    const fgKey = this.pickOptionalTextureKey("garden-foreground-art", "garden-foreground");
    const fgImg = this.add.image(w / 2, h * 0.88, fgKey).setDisplaySize(w, h * 0.34).setDepth(6);
    this.ensureImageNotMissing(fgImg, "garden-foreground", { w, h: h * 0.34 });
    this.localCursor = this.add
      .sprite(w * 0.5, h * 0.5, "cursor-self")
      .setDepth(30)
      .setAlpha(0.55)
      .setScale(0.82);

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const nx = pointer.x / w;
      const ny = pointer.y / h;
      this.localCursor.setPosition(pointer.x, pointer.y);
      this.pointerNormEmitter.emit("move", nx, ny);
    });
  }

  private loadOptionalImage(key: string, url: string): void {
    // Missing files are acceptable; scene will fallback to procedural textures.
    this.load.image(key, url);
  }

  /**
   * True if the key points to a real image (not Phaser __MISSING / empty frame).
   * Loader may skip addToCache on error, but some paths still leave unusable entries.
   */
  private isUsableImageKey(key: string): boolean {
    if (this.failedOptionalKeys.has(key)) return false;
    if (!this.textures.exists(key)) return false;
    try {
      const texture = this.textures.get(key);
      if (!texture || texture.key === "__MISSING") return false;
      const frame = texture.get();
      if (!frame?.source) return false;
      const fw = frame.width ?? 0;
      const fh = frame.height ?? 0;
      const sw = frame.source.width ?? 0;
      const sh = frame.source.height ?? 0;
      return fw > 1 && fh > 1 && sw > 1 && sh > 1;
    } catch {
      return false;
    }
  }

  /** If GPU/loader left a placeholder, swap to procedural art (avoids checkerboard band). */
  private ensureImageNotMissing(
    obj: Phaser.GameObjects.Image,
    fallbackKey: string,
    setSize?: { w: number; h: number }
  ): void {
    const fk = obj.frame?.texture?.key;
    if (fk === "__MISSING" || fk === "__DEFAULT") {
      obj.setTexture(fallbackKey);
      if (setSize) obj.setDisplaySize(setSize.w, setSize.h);
    }
  }

  private ensureSpriteNotMissing(obj: Phaser.GameObjects.Sprite, fallbackKey: string): void {
    const fk = obj.frame?.texture?.key;
    if (fk === "__MISSING" || fk === "__DEFAULT") {
      obj.setTexture(fallbackKey);
    }
  }

  /** Use uploaded art only when load + decode succeeded; otherwise procedural fallback (avoids checkerboard). */
  private pickOptionalTextureKey(artKey: string, fallbackKey: string, chain?: [string, string][]): string {
    if (this.isUsableImageKey(artKey)) {
      return artKey;
    }
    if (chain) {
      for (const [nextArt, nextFb] of chain) {
        if (this.isUsableImageKey(nextArt)) {
          return nextArt;
        }
        if (this.textures.exists(nextFb)) return nextFb;
      }
    }
    return fallbackKey;
  }

  update(_time: number, delta: number): void {
    const w = this.scale.width;
    for (let i = 0; i < this.cloudSprites.length; i += 1) {
      const cloud = this.cloudSprites[i];
      cloud.x += delta * (i === 0 ? 0.009 : 0.006);
      if (cloud.x > w + 120) {
        cloud.x = -120;
      }
    }
    for (let i = 0; i < this.ambientSprites.length; i += 1) {
      const p = this.ambientSprites[i];
      p.y -= delta * 0.006;
      p.x += Math.sin((p.y + i * 13) * 0.02) * 0.06;
      if (p.y < 170) {
        p.y = 380 + i * 12;
      }
    }
  }

  private placeAmbientParticles(w: number, h: number): void {
    for (const sprite of this.ambientSprites) {
      sprite.destroy();
    }
    this.ambientSprites = [];
    const spots = [
      [0.18, 0.69, 0.55],
      [0.28, 0.72, 0.45],
      [0.36, 0.68, 0.5],
      [0.48, 0.71, 0.4],
      [0.58, 0.7, 0.52],
      [0.68, 0.73, 0.42],
      [0.79, 0.69, 0.5],
    ] as const;
    for (const [nx, ny, alpha] of spots) {
      const p = this.add.image(nx * w, ny * h, "ambient-dot").setDepth(7).setScale(0.9).setAlpha(alpha);
      this.ambientSprites.push(p);
    }
  }

  private placeGroundDetails(w: number, h: number): void {
    for (const sprite of this.detailSprites) {
      sprite.destroy();
    }
    this.detailSprites = [];

    const detailPoints = [
      [0.09, 0.63, "ground-stone", 0.9],
      [0.14, 0.69, "ground-tuft", 1.05],
      [0.24, 0.72, "ground-flower", 1.0],
      [0.34, 0.66, "ground-stone", 0.85],
      [0.41, 0.73, "ground-tuft", 1.1],
      [0.52, 0.68, "ground-flower", 0.95],
      [0.63, 0.71, "ground-stone", 0.9],
      [0.72, 0.67, "ground-tuft", 1.0],
      [0.81, 0.72, "ground-flower", 1.08],
      [0.9, 0.66, "ground-stone", 0.82],
    ] as const;
    for (const [nx, ny, tex, scale] of detailPoints) {
      const d = this.add.image(nx * w, ny * h, tex).setDepth(5).setScale(scale).setAlpha(0.95);
      this.detailSprites.push(d);
    }
  }

  private ensureTextures(): void {
    if (!this.textures.exists("garden-bg")) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x94d8ff, 1);
      g.fillRect(0, 0, 960, 540);
      g.fillStyle(0x9adffb, 1);
      g.fillRect(0, 0, 960, 210);
      g.fillStyle(0xa7e5ff, 1);
      g.fillRect(0, 210, 960, 56);

      g.fillStyle(0x79b66f, 1);
      g.fillRect(0, 250, 960, 110);
      g.fillStyle(0x6da85f, 1);
      g.fillRect(0, 360, 960, 84);
      g.fillStyle(0x5f954f, 1);
      g.fillRect(0, 444, 960, 96);

      g.fillStyle(0xd7b88d, 1);
      g.fillRoundedRect(122, 284, 668, 90, 22);
      g.fillStyle(0xc8a071, 1);
      g.fillRoundedRect(140, 305, 632, 44, 18);
      g.fillStyle(0xb98d5c, 1);
      g.fillRoundedRect(158, 320, 596, 16, 8);

      g.fillStyle(0x6ca157, 1);
      g.fillCircle(96, 184, 74);
      g.fillCircle(182, 170, 58);
      g.fillCircle(844, 170, 82);
      g.fillCircle(740, 182, 62);
      g.fillStyle(0x5d8d49, 1);
      g.fillCircle(136, 208, 46);
      g.fillCircle(776, 212, 52);
      g.fillStyle(0x6a4a37, 1);
      g.fillRoundedRect(72, 196, 36, 88, 10);
      g.fillRoundedRect(820, 194, 38, 92, 10);

      g.fillStyle(0xeedec4, 1);
      g.fillRoundedRect(556, 96, 286, 182, 14);
      g.fillStyle(0xcf6257, 1);
      g.fillTriangle(534, 104, 699, 4, 864, 104);
      g.fillStyle(0xb54b43, 1);
      g.fillTriangle(548, 104, 699, 24, 850, 104);
      g.fillStyle(0x9e6f53, 1);
      g.fillRoundedRect(676, 190, 64, 88, 8);
      g.fillStyle(0x84bbd5, 1);
      g.fillRoundedRect(604, 146, 58, 46, 6);
      g.fillRoundedRect(754, 146, 58, 46, 6);
      g.lineStyle(4, 0x5c4033, 1);
      g.strokeRoundedRect(556, 96, 286, 182, 14);
      g.strokeTriangle(534, 104, 699, 4, 864, 104);
      g.strokeRoundedRect(604, 146, 58, 46, 6);
      g.strokeRoundedRect(754, 146, 58, 46, 6);
      g.strokeRoundedRect(676, 190, 64, 88, 8);

      g.fillStyle(0xe8d8bb, 1);
      for (let x = 0; x < 960; x += 24) {
        g.fillRect(x, 236, 16, 6);
      }

      const flowers = [
        [84, 330, 0xe07a9f],
        [132, 348, 0xf2b26b],
        [420, 372, 0xe8a26f],
        [472, 384, 0x91c9d8],
        [520, 376, 0xaa86df],
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

    if (!this.textures.exists("cloud-puff")) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xeef9ff, 1);
      g.fillCircle(36, 30, 24);
      g.fillCircle(64, 26, 20);
      g.fillCircle(82, 34, 18);
      g.fillCircle(54, 40, 26);
      g.fillStyle(0xd7effa, 1);
      g.fillEllipse(56, 52, 92, 18);
      g.generateTexture("cloud-puff", 120, 72);
      g.destroy();
    }

    if (!this.textures.exists("garden-foreground")) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x5f954f, 1);
      g.fillRect(0, 0, 960, 180);
      g.fillStyle(0x4c7f3f, 1);
      for (let x = 0; x < 960; x += 48) {
        g.fillRoundedRect(x + 4, 26, 40, 96, 14);
      }
      g.fillStyle(0x72b264, 1);
      for (let x = 0; x < 960; x += 36) {
        g.fillCircle(x + 18, 18 + ((x / 36) % 2) * 6, 14);
      }
      g.fillStyle(0x8ec77b, 1);
      for (let x = 8; x < 960; x += 56) {
        g.fillCircle(x + 18, 8, 10);
      }
      g.generateTexture("garden-foreground", 960, 180);
      g.destroy();
    }

    if (!this.textures.exists("ground-stone")) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xb9a690, 1);
      g.fillRoundedRect(0, 6, 24, 12, 6);
      g.fillStyle(0xa5937f, 1);
      g.fillRoundedRect(3, 8, 18, 8, 4);
      g.generateTexture("ground-stone", 24, 24);
      g.destroy();
    }

    if (!this.textures.exists("ground-tuft")) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x7fbc66, 1);
      g.fillTriangle(4, 20, 10, 4, 14, 20);
      g.fillTriangle(10, 20, 16, 2, 20, 20);
      g.fillTriangle(0, 20, 6, 8, 10, 20);
      g.generateTexture("ground-tuft", 24, 24);
      g.destroy();
    }

    if (!this.textures.exists("ground-flower")) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x7ab75f, 1);
      g.fillRect(10, 10, 4, 12);
      g.fillStyle(0xf1a1bc, 1);
      g.fillCircle(12, 8, 6);
      g.fillStyle(0xffeac4, 1);
      g.fillCircle(12, 8, 2);
      g.generateTexture("ground-flower", 24, 24);
      g.destroy();
    }

    if (!this.textures.exists("ambient-dot")) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xf8f2dc, 1);
      g.fillCircle(4, 4, 3);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(4, 4, 1.3);
      g.generateTexture("ambient-dot", 8, 8);
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

    if (!this.textures.exists("pet-cat-blink")) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x000000, 0.18);
      g.fillEllipse(32, 49, 34, 11);
      g.fillStyle(0xf2b26b, 1);
      g.fillRoundedRect(8, 14, 48, 34, 8);
      g.fillTriangle(12, 18, 21, 3, 27, 18);
      g.fillTriangle(37, 18, 43, 3, 52, 18);
      g.fillStyle(0x3d2914, 1);
      g.fillRect(21, 29, 6, 2);
      g.fillRect(37, 29, 6, 2);
      g.lineStyle(3, 0x3d2914, 1);
      g.lineBetween(31, 37, 34, 37);
      g.lineBetween(31, 40, 34, 40);
      g.generateTexture("pet-cat-blink", 64, 64);
      g.destroy();
    }

    if (!this.textures.exists("fx-heart")) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xf28ca5, 1);
      g.fillCircle(10, 8, 6);
      g.fillCircle(18, 8, 6);
      g.fillTriangle(4, 10, 24, 10, 14, 24);
      g.generateTexture("fx-heart", 28, 26);
      g.destroy();
    }

    if (!this.textures.exists("fx-spark")) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xffe08a, 1);
      g.fillRect(10, 0, 4, 24);
      g.fillRect(0, 10, 24, 4);
      g.fillStyle(0xfff2c4, 1);
      g.fillRect(11, 2, 2, 20);
      g.fillRect(2, 11, 20, 2);
      g.generateTexture("fx-spark", 24, 24);
      g.destroy();
    }

    if (!this.textures.exists("fx-food")) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xf2c488, 1);
      g.fillRoundedRect(0, 10, 24, 14, 6);
      g.fillStyle(0xe38b5c, 1);
      g.fillRoundedRect(2, 12, 20, 10, 5);
      g.fillStyle(0x86b660, 1);
      g.fillRect(10, 0, 4, 10);
      g.generateTexture("fx-food", 24, 24);
      g.destroy();
    }

    if (!this.anims.exists("pet-idle")) {
      this.anims.create({
        key: "pet-idle",
        frames: [{ key: "pet-cat" }, { key: "pet-cat-blink" }, { key: "pet-cat" }],
        frameRate: 2,
        repeat: -1,
        repeatDelay: 1200,
      });
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
      g.fillStyle(0x6b9ac4, 0.55);
      g.fillTriangle(10, 0, 20, 20, 0, 20);
      g.lineStyle(1, 0x3d2914, 0.45);
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
      const py = mapPetNormYToGroundBand(pet.position.y) * h;
      let root = this.petRoots.get(pet.petId);
      if (!root) {
        root = this.add.container(px, py).setDepth(10);
        const petKey = this.pickOptionalTextureKey("pet-cat-art", "pet-cat");
        const marker = this.add.sprite(0, 0, petKey);
        this.ensureSpriteNotMissing(marker, "pet-cat");
        const artPet = marker.texture.key === "pet-cat-art";
        marker.setScale(artPet ? 1.9 : 2);
        if (marker.texture.key === "pet-cat") {
          marker.play("pet-idle");
        }
        const label = this.add
          .text(0, -42, "", {
            fontFamily: "system-ui, sans-serif",
            fontSize: "11px",
            color: "#2f1c10",
            padding: { x: 2, y: 1 },
            shadow: {
              offsetX: 0,
              offsetY: 1,
              color: "#fffef8",
              blur: 2,
              fill: true,
            },
          })
          .setOrigin(0.5, 1);
        root.add(marker);
        root.add(label);
        const bobTween = this.tweens.add({
          targets: root,
          y: py - 4,
          yoyo: true,
          duration: 850,
          repeat: -1,
          ease: "Sine.InOut",
          delay: (this.petRoots.size % 4) * 120,
        });
        this.petBobTweens.set(pet.petId, bobTween);
        this.petRoots.set(pet.petId, root);
      } else {
        root.setPosition(px, py);
        this.petBobTweens.get(pet.petId)?.remove();
        const bobTween = this.tweens.add({
          targets: root,
          y: py - 4,
          yoyo: true,
          duration: 850,
          repeat: -1,
          ease: "Sine.InOut",
        });
        this.petBobTweens.set(pet.petId, bobTween);
      }

      const isMine = pet.ownerUserId === localUserId;
      const badge = isMine ? "★" : "●";
      const labelText = isMine
        ? `${badge} ${pet.petName ?? "宠物"}（你）`
        : `${badge} ${pet.petName ?? "宠物"}`;
      const r = this.petRoots.get(pet.petId)!;
      const label = r.getAt(1) as Phaser.GameObjects.Text;
      label.setText(labelText);
      label.setColor(isMine ? "#2f1c10" : "#2a3250");
    }
    for (const [petId, root] of this.petRoots.entries()) {
      if (!nextIds.has(petId)) {
        const bob = this.petBobTweens.get(petId);
        if (bob) {
          bob.remove();
          this.petBobTweens.delete(petId);
        }
        root.destroy(true);
        this.petRoots.delete(petId);
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

  playPetAction(petId: string, actionType: string): void {
    const root = this.petRoots.get(petId);
    if (!root) return;
    const marker = root.getAt(0) as Phaser.GameObjects.Sprite;
    if (!marker || !(marker instanceof Phaser.GameObjects.Sprite)) return;

    marker.setScale(2.1);
    this.tweens.add({
      targets: marker,
      scale: 2,
      duration: 180,
      ease: "Back.Out",
    });

    const fxKey = this.getActionFxKey(actionType);
    const fxFb = actionType === "Feed" ? "fx-food" : actionType === "Cuddle" ? "fx-heart" : "fx-spark";
    const fx = this.add
      .image(root.x, root.y - 54, fxKey)
      .setDepth(18)
      .setScale(actionType === "Cuddle" ? 1.1 : 0.95)
      .setAlpha(0.95);
    this.ensureImageNotMissing(fx, fxFb);
    this.tweens.add({
      targets: fx,
      y: fx.y - 26,
      alpha: 0,
      duration: 520,
      ease: "Sine.Out",
      onComplete: () => fx.destroy(),
    });
  }

  private getActionFxKey(actionType: string): string {
    if (actionType === "Feed") {
      return this.pickOptionalTextureKey("fx-food-art", "fx-food");
    }
    if (actionType === "Cuddle") {
      return this.pickOptionalTextureKey("fx-heart-art", "fx-heart");
    }
    return this.pickOptionalTextureKey("fx-spark-art", "fx-spark");
  }
}
