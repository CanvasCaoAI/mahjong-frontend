import Phaser from 'phaser';
import type { Meld, PublicState, Seat, Tile } from '../../domain/types';
import { backKey, tileKey } from '../../domain/tileset';
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

    const meldTilesFor = (seat: Seat): Tile[] => {
      const melds: Meld[] = (st.meldsBySeat?.[seat] ?? []) as any;
      const out: Tile[] = [];
      for (const m of melds) out.push(...m.tiles);
      return out;
    };

    const makeMeldTile = (x: number, y: number, angle: number, tile: Tile) => {
      const key = tileKey(tile as any);
      const img = this.scene.add.image(x, y, key);
      img.setDisplaySize(26, 34);
      img.setAngle(angle);
      img.setAlpha(0.98);
      img.setDepth(4);
      this.objects.push(img);
    };

    const max = 18;

    for (const seat of [0, 1, 2, 3] as const) {
      if (seat === you) continue;

      const count = st.handCounts?.[seat] ?? 0;
      const meldTiles = meldTilesFor(seat);

      // 就算手牌数为 0，只要有碰牌也要显示出来
      if (!count && !meldTiles.length) continue;

      const r = rel(seat);
      const show = clamp(count, max);

      const l = computeLayout(this.scene);

      if (r === 2) {
        // 上侧（对面横排）：组合（背牌+碰牌）需要左右居中；碰牌在背牌右边
        const gap = l.oppTopGap;
        const meldGap = 28; // 上侧碰牌 gap
        const between = (show && meldTiles.length) ? 28 : 0;

        const backsW = show > 0 ? (show - 1) * gap : 0;
        const meldW = meldTiles.length > 0 ? (meldTiles.length - 1) * meldGap : 0;
        const totalW = backsW + between + meldW;
        const startX = Math.round(l.w / 2 - totalW / 2);

        const y = l.oppTopY;
        for (let i = 0; i < show; i++) makeBack(startX + i * gap, y, 0);

        const meldStartX = startX + backsW + between;
        for (let i = 0; i < meldTiles.length; i++) makeMeldTile(meldStartX + i * meldGap, y, 0, meldTiles[i]);
      } else if (r === 1) {
        // 左侧：组合（碰牌在上 + 背牌在下）需要上下居中
        const gapY = l.oppSideGap;
        const meldGap = 28;
        const between = (show && meldTiles.length) ? 26 : 0;

        const x0 = l.oppSideXInset;
        const midY = l.oppSideYTop + (show > 0 ? ((show - 1) * gapY) / 2 : 0);

        const backsH = show > 0 ? (show - 1) * gapY : 0;
        const meldH = meldTiles.length > 0 ? (meldTiles.length - 1) * meldGap : 0;
        const totalH = meldH + between + backsH;
        const groupTopY = Math.round(midY - totalH / 2);

        // melds (top -> down)
        for (let i = 0; i < meldTiles.length; i++) makeMeldTile(x0, groupTopY + i * meldGap, 90, meldTiles[i]);

        // backs (below melds)
        const backsStartY = groupTopY + meldH + between;
        for (let i = 0; i < show; i++) makeBack(x0, backsStartY + i * gapY, 90);
      } else if (r === 3) {
        // 右侧：保持同样居中策略（背牌在上 + 碰牌在下）
        const gapY = l.oppSideGap;
        const meldGap = 28;
        const between = (show && meldTiles.length) ? 26 : 0;

        const x0 = l.w - l.oppSideXInset;
        const midY = l.oppSideYTop + (show > 0 ? ((show - 1) * gapY) / 2 : 0);

        const backsH = show > 0 ? (show - 1) * gapY : 0;
        const meldH = meldTiles.length > 0 ? (meldTiles.length - 1) * meldGap : 0;
        const totalH = backsH + between + meldH;
        const groupTopY = Math.round(midY - totalH / 2);

        // backs (top)
        for (let i = 0; i < show; i++) makeBack(x0, groupTopY + i * gapY, 90);

        // melds (below backs)
        const meldStartY = groupTopY + backsH + between;
        for (let i = 0; i < meldTiles.length; i++) makeMeldTile(x0, meldStartY + i * meldGap, 90, meldTiles[i]);
      }
    }
  }
}
