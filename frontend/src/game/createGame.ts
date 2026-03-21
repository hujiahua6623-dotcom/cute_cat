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
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      pixelArt: true,
    },
  });
}

export function getGardenScene(game: Phaser.Game): GardenScene | null {
  const s = game.scene.getScene("GardenScene");
  return s instanceof GardenScene ? s : null;
}
