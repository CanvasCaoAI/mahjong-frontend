import Phaser from 'phaser';
import type { PublicState, Seat } from '../../domain/types';
import { backKey } from '../../domain/tileset';
import { computeLayout } from './layout';

export class OpponentHandsView {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  destroy() {
    this.objects.forEach(o => o.destroy());
    this.objects = [];
  }

  update(st: PublicState | null) {
    this.destroy();
    if (!st || st.yourSeat === null) return;

    const you = st.yourSeat as Seat;
    // Seat numbers arranged clockwise; map seat->relative draw position.
    const rel = (seat: Seat) => ((you as number) - (seat as number) + 4) % 4; // 0=bottom,1=left,2=top,3=right
    const clamp = (n: number, m: number) => Math.min(n, m);

    const makeBack = (x: number, y: number, angle: number) => {
      const border = this.scene.add.rectangle(x, y, 30, 38, 0x000000, 0);
      border.setStrokeStyle(2, 0x0b3d2e, 0.95);
      border.setAngle(angle);

      const img = this.scene.add.image(x, y, backKey());
      img.setDisplaySize(28, 36);
      img.setAngle(angle);
      img.setAlpha(0.92);

      this.objects.push(border, img);
    };

    const max = 18;
    for (const seat of [0, 1, 2, 3] as const) {
      if (seat === you) continue;
      const count = st.handCounts?.[seat] ?? 0;
      if (!count) continue;

      const r = rel(seat);
      const show = clamp(count, max);

      const l = computeLayout(this.scene);
      if (r === 2) {
        const gap = l.oppTopGap;
        const startX = Math.round(l.w / 2 - ((show - 1) * gap) / 2);
        const y = l.oppTopY;
        for (let i = 0; i < show; i++) makeBack(startX + i * gap, y, 0);
      } else if (r === 1) {
        const x = l.oppSideXInset;
        const startY = l.oppSideYTop;
        const gap = l.oppSideGap;
        for (let i = 0; i < show; i++) makeBack(x, startY + i * gap, 90);
      } else if (r === 3) {
        const x = l.w - l.oppSideXInset;
        const startY = l.oppSideYTop;
        const gap = l.oppSideGap;
        for (let i = 0; i < show; i++) makeBack(x, startY + i * gap, 90);
      }
    }
  }
}
