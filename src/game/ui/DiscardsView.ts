import Phaser from 'phaser';
import type { PublicState, Seat, Tile } from '../../domain/types';
import { tileKey } from '../../domain/tileset';
import { computeLayout } from './layout';

export class DiscardsView {
  private sprites: Phaser.GameObjects.Image[] = [];
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  destroy() {
    this.sprites.forEach(s => s.destroy());
    this.sprites = [];
  }

  update(st: PublicState | null) {
    this.sprites.forEach(s => s.destroy());
    this.sprites = [];
    if (!st || st.yourSeat === null) return;

    const you = st.yourSeat as Seat;
    // seat numbers arranged clockwise; map seat->relative draw position.
    const rel = (seat: Seat) => ((you as number) - (seat as number) + 4) % 4; // 0=bottom,1=left,2=top,3=right

    const bySeat: Record<number, Tile[]> = { 0: [], 1: [], 2: [], 3: [] };
    for (const d of st.discards ?? []) bySeat[d.seat].push(d.tile);

    const l = computeLayout(this.scene);

    // Tile visual size (in-game)
    const tileW = 28;
    const tileH = 36;

    // No-gap spacing (tiles touch each other)
    const dx = tileW;
    const dy = tileH;

    // For rotated (left/right) tiles: width/height swap visually
    const dxRot = tileH;
    const dyRot = tileW;

    for (const seat of [0, 1, 2, 3] as const) {
      const tiles = (bySeat[seat] ?? []).slice(-40);
      if (!tiles.length) continue;
      const r = rel(seat);

      const cols = l.discardCols;      // bottom/top wrap after 10
      const rows = l.discardSideRows;  // left/right wrap after 10

      if (r === 0 || r === 2) {
        // bottom/top: left->right
        // Center the first row of `cols` tiles.
        const startX = Math.round(l.w / 2 - (cols * dx) / 2 + dx / 2);
        const startY = r === 0 ? l.discardBottomY : l.discardTopY;

        for (let i = 0; i < tiles.length; i++) {
          const rr = Math.floor(i / cols);
          const cc = i % cols;
          const key = tileKey(tiles[i] as any);
          const img = this.scene.add.image(startX + cc * dx, startY + rr * dy, key);
          img.setDisplaySize(tileW, tileH);
          img.setAlpha(0.95);
          this.sprites.push(img);
        }
      } else if (r === 1 || r === 3) {
        // left/right: top->bottom
        const startX = r === 1 ? l.discardLeftX : l.discardRightX;
        const startY = l.discardSideYTop;

        for (let i = 0; i < tiles.length; i++) {
          const cc = Math.floor(i / rows);
          const rr = i % rows;
          const key = tileKey(tiles[i] as any);
          const img = this.scene.add.image(startX + cc * dxRot, startY + rr * dyRot, key);
          img.setAngle(90);
          img.setDisplaySize(tileW, tileH);
          img.setAlpha(0.95);
          this.sprites.push(img);
        }
      }
    }
  }
}
