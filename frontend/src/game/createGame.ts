import Phaser from "phaser";
import { GardenScene } from "./GardenScene";

export function createGardenGame(parentId: string): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: parentId,
    width: 960,
    height: 540,
    backgroundColor: "#f5ecd7",
    scene: [GardenScene],
    scale: {
      // FIT leaves empty bands inside the canvas when parent aspect ≠ game (shows as “checkerboard”); ENVELOP fills.
      mode: Phaser.Scale.ENVELOP,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 960,
      height: 540,
    },
    render: {
      pixelArt: true,
      antialias: false,
      roundPixels: true,
      transparent: false,
    },
  });
}

export function getGardenScene(game: Phaser.Game): GardenScene | null {
  const s = game.scene.getScene("GardenScene");
  return s instanceof GardenScene ? s : null;
}
