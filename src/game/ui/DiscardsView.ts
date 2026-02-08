import Phaser from 'phaser';
import type { PublicState, Seat, Tile } from '../../domain/types';
import { tileKey } from '../../domain/tileset';
import { computeLayout } from './layout';

export class DiscardsView {
  private sprites: Phaser.GameObjects.Image[] = [];
  private scene: Phaser.Scene;

  // 黄色倒三角：指示“最后一张打出的牌”
  private lastDiscardMarker: Phaser.GameObjects.Triangle | null = null;
  private lastDiscardMarkerTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  private attachLastDiscardMarker(tileX: number, tileY: number, tileH: number) {
    // 倒三角（尖朝下）
    const y = tileY - tileH / 2 - 10;
    const x = tileX;

    const triW = 16;
    const triH = 12;

    const t = this.scene.add.triangle(
      x,
      y,
      // local points: (0,0) top-left
      0,
      0,
      triW,
      0,
      triW / 2,
      triH,
      0xFACC15 // yellow-400
    );

    t.setOrigin(0.5, 0.5);
    t.setAlpha(0.95);
    t.setDepth(200);

    this.lastDiscardMarker = t;
    this.lastDiscardMarkerTween = this.scene.tweens.add({
      targets: t,
      scaleX: 1.35,
      scaleY: 1.35,
      duration: 450,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  destroy() {
    this.sprites.forEach(s => s.destroy());
    this.sprites = [];

    this.lastDiscardMarkerTween?.stop();
    this.lastDiscardMarkerTween = null;
    this.lastDiscardMarker?.destroy();
    this.lastDiscardMarker = null;
  }

  update(st: PublicState | null) {
    this.sprites.forEach(s => s.destroy());
    this.sprites = [];

    // 先清理 marker（每次 update 会重建牌河视图）
    this.lastDiscardMarkerTween?.stop();
    this.lastDiscardMarkerTween = null;
    this.lastDiscardMarker?.destroy();
    this.lastDiscardMarker = null;

    if (!st || st.yourSeat === null) return;

    const you = st.yourSeat as Seat;
    // seat numbers arranged clockwise; map seat->relative draw position.
    const rel = (seat: Seat) => ((you as number) - (seat as number) + 4) % 4; // 0=bottom,1=left,2=top,3=right

    const bySeat: Record<number, Tile[]> = { 0: [], 1: [], 2: [], 3: [] };
    for (const d of st.discards ?? []) bySeat[d.seat].push(d.tile);

    const lastDiscard = (st.discards && st.discards.length) ? st.discards[st.discards.length - 1] : null;

    const l = computeLayout(this.scene);

    // Tile visual size (in-game)
    // 需求：弃牌区牌面稍微放大 10%，位置仍然动态计算
    const tileW = Math.round(28 * 1.1);
    const tileH = Math.round(36 * 1.1);

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

          // 最后一张打出的牌：上方悬浮黄色倒三角（不停缩放）
          if (lastDiscard && lastDiscard.seat === seat && i === tiles.length - 1) {
            this.attachLastDiscardMarker(img.x, img.y, tileH);
          }
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

          // 最后一张打出的牌：上方悬浮黄色倒三角（不停缩放）
          if (lastDiscard && lastDiscard.seat === seat && i === tiles.length - 1) {
            this.attachLastDiscardMarker(img.x, img.y, tileH);
          }
        }
      }
    }
  }
}
