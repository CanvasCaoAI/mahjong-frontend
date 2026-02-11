import Phaser from 'phaser';
import type { Meld, Tile } from '../../domain/types';
import { tileKey } from '../../domain/tileset';
import { TileButton } from './TileButton';

export class HandView {
  private buttons: TileButton[] = [];
  private meldSprites: Phaser.GameObjects.GameObject[] = [];
  private selected: TileButton | null = null;

  // 用于“新摸的那张牌”不参与排序，放到最右侧显示
  private lastHandRaw: Tile[] | null = null;
  private pendingDrawIndex: number | null = null;

  private scene: Phaser.Scene;
  private opts: {
    y: number;
    gap: number;
    width: number;
    onDiscard: (args: { displayIndex: number; serverIndex: number; tile: Tile }) => void;
    onInvalidDiscard?: () => void;
  };

  setLayout(layout: { y: number; gap: number; width: number }) {
    this.opts.y = layout.y;
    this.opts.gap = layout.gap;
    this.opts.width = layout.width;
  }

  constructor(
    scene: Phaser.Scene,
    opts: {
      y: number;
      gap: number;
      width: number;
      onDiscard: (args: { displayIndex: number; serverIndex: number; tile: Tile }) => void;
      onInvalidDiscard?: () => void;
    }
  ) {
    this.scene = scene;
    this.opts = opts;
  }

  destroy() {
    this.buttons.forEach(b => b.destroy());
    this.buttons = [];

    this.meldSprites.forEach(s => s.destroy());
    this.meldSprites = [];

    this.selected = null;
  }

  setAllEnabled(v: boolean) {
    for (const b of this.buttons) b.setEnabled(v);
  }

  getButton(displayIndex: number): TileButton | undefined {
    return this.buttons[displayIndex];
  }

  /**
   * 主要入口：更新底部手牌区域。
   *
   * 结构拆分为 3 块：
   * 1) 花牌（最左侧 upright）
   * 2) 碰/杠/吃（其次，flat）
   * 3) 手牌（最右侧包含“最新摸的牌”）
   */
  update(handRaw: Tile[], canDiscard: boolean, melds: Meld[] = []) {
    // re-render for now (simple); later can optimize.
    this.destroy();

    // Detect freshly drawn tile.
    // - after 杠：手牌会先减少（移除杠牌）再补摸 1 张，整体长度不一定是 +1
    // - 所以只要处于“可出牌”状态且手牌长度发生变化，就把最后一张当作“新摸牌”
    if (canDiscard && this.lastHandRaw && handRaw.length !== this.lastHandRaw.length && handRaw.length > 0) {
      this.pendingDrawIndex = handRaw.length - 1;
    }

    // First render after round start: 也把最后一张当作新摸牌
    if (!this.lastHandRaw && canDiscard && handRaw.length > 0) {
      this.pendingDrawIndex = handRaw.length - 1;
    }

    if (!canDiscard) this.pendingDrawIndex = null;

    const drawn = (this.pendingDrawIndex !== null && this.pendingDrawIndex >= 0 && this.pendingDrawIndex < handRaw.length)
      ? { tile: handRaw[this.pendingDrawIndex] as Tile, idx: this.pendingDrawIndex }
      : null;

    // Auto-sort hand for display (excluding the drawn tile), but keep original indices for server actions.
    const base = handRaw
      .map((tile, idx) => ({ tile, idx }))
      .filter((x) => !drawn || x.idx !== drawn.idx)
      .sort((a, b) => {
        const sa = a.tile[0];
        const sb = b.tile[0];
        const na = Number(a.tile.slice(1));
        const nb = Number(b.tile.slice(1));
        const suitOrder: Record<string, number> = { m: 0, p: 1, s: 2, z: 3, f: 4 };
        const ds = (suitOrder[sa] ?? 99) - (suitOrder[sb] ?? 99);
        if (ds) return ds;
        return na - nb;
      });

    const hand = drawn ? [...base, drawn] : base;

    // Store for next diff
    this.lastHandRaw = handRaw.slice();

    const y = this.opts.y;
    const gap = this.opts.gap;
    const tableW = this.opts.width;

    // Hand tile sizing: scale with screen width/height; keep readable on mobile
    const minDim = Math.min(this.scene.scale.width, this.scene.scale.height);
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const tileW = Math.round(clamp(minDim * 0.07, 42, 60));
    const tileH = Math.round(tileW * 1.30);
    const imgW = Math.round(tileW - 4);
    const imgH = Math.round(tileH - 6);

    // Meld sizing
    const meldTileW = tileW;
    const meldTileH = tileH * 0.8;
    const meldGap = Math.round(meldTileW + Math.max(2, tileW * 0.04));

    // Split melds into: flowers (left) and flat melds (peng/chi/gang)
    const flowerTiles: Tile[] = [];
    const flatMeldTiles: Tile[] = [];
    for (const m of melds) {
      if (m.type === 'flower') flowerTiles.push(...m.tiles);
      else flatMeldTiles.push(...m.tiles);
    }

    const flowerGap = Math.round(meldTileW + Math.max(2, tileW * 0.04));
    const flowerW = flowerTiles.length ? (flowerTiles.length - 1) * flowerGap + meldTileW : 0;
    const meldW = flatMeldTiles.length ? (flatMeldTiles.length - 1) * meldGap + meldTileW : 0;

    const totalW = hand.length > 0 ? (hand.length - 1) * gap + tileW : 0;
    const margin = Math.round(tableW * 0.03);

    // gaps between groups
    const gapFlowerToMeld = flowerTiles.length && flatMeldTiles.length ? Math.round(Math.max(10, gap * 0.25)) : 0;

    // 花牌与手牌也需要留距离：
    // - 如果没有碰/杠/吃，则花牌直接与手牌分组
    // - 如果有碰/杠/吃，则由 gapMeldToHand 负责分组
    const gapFlowerToHand = flowerTiles.length && !flatMeldTiles.length ? Math.round(Math.max(18, gap * 0.35)) : 0;

    const gapMeldToHand = flatMeldTiles.length ? Math.round(Math.max(18, gap * 0.35)) : 0;

    // center whole group
    const wholeW = flowerW + gapFlowerToMeld + meldW + (gapMeldToHand || gapFlowerToHand) + totalW;
    const centeredWholeStart = (tableW - wholeW) / 2;
    const startWholeX = Math.max(margin, centeredWholeStart);

    const flowerStartX = startWholeX;
    const meldStartX = flowerStartX + flowerW + gapFlowerToMeld;
    const handStartX = meldStartX + meldW + (gapMeldToHand || gapFlowerToHand);

    // 1) 花牌：最左侧
    this.renderFlowers({
      tiles: flowerTiles,
      startX: flowerStartX,
      y,
      gap: flowerGap,
      tileW: meldTileW,
      tileH: meldTileH,
    });

    // 2) 碰/杠/吃：其次
    this.renderFlatMelds({
      tiles: flatMeldTiles,
      startX: meldStartX,
      y,
      gap: meldGap,
      tileW: meldTileW,
      tileH: meldTileH,
    });

    // 3) 手牌：含最新摸牌
    this.renderHand({
      hand,
      canDiscard,
      startX: handStartX,
      y,
      gap,
      tileW,
      tileH,
      imgW,
      imgH,
      drawn: !!drawn,
    });
  }

  private renderFlowers(opts: { tiles: Tile[]; startX: number; y: number; gap: number; tileW: number; tileH: number }) {
    const { tiles, startX, y, gap, tileW, tileH } = opts;
    for (let i = 0; i < tiles.length; i++) {
      const x = startX + i * gap + tileW / 2;
      const key = tileKey(tiles[i] as any);
      const img = this.scene.add.image(x, y, key);
      img.setDisplaySize(tileW, tileH);
      img.setAlpha(0.98);
      img.setDepth(60);

      // flower base block (under the tile)
      const baseH = Math.max(10, Math.round(tileH * 0.15));
      const base = this.scene.add.rectangle(
        x,
        y + tileH * 0.65,
        tileW,
        baseH,
        0xFFFFFF,
        0.95
      );
      base.setStrokeStyle(1, 0x0B1020, 0.85);
      base.setDepth(59);

      this.meldSprites.push(base, img);
    }
  }

  private renderFlatMelds(opts: { tiles: Tile[]; startX: number; y: number; gap: number; tileW: number; tileH: number }) {
    const { tiles, startX, y, gap, tileW, tileH } = opts;

    // 底部白色矩形：并加细黑描边
    const baseH = Math.max(10, Math.round(tileH * 0.15));

    for (let i = 0; i < tiles.length; i++) {
      const x = startX + i * gap + tileW / 2;
      const key = tileKey(tiles[i] as any);

      const img = this.scene.add.image(x, y, key);
      img.setDisplaySize(tileW, tileH);

      img.setAlpha(0.98);
      img.setDepth(60);

      const tileRenderH = tileH;
      const base = this.scene.add.rectangle(
        x,
        y + tileRenderH * 0.65,
        tileW,
        baseH,
        0xFFFFFF,
        0.95
      );
      base.setStrokeStyle(1, 0x0B1020, 0.85);
      base.setDepth(59);

      this.meldSprites.push(base, img);
    }
  }

  private renderHand(opts: {
    hand: Array<{ tile: Tile; idx: number }>;
    canDiscard: boolean;
    startX: number;
    y: number;
    gap: number;
    tileW: number;
    tileH: number;
    imgW: number;
    imgH: number;
    drawn: boolean;
  }) {
    const { hand, canDiscard, startX, y, gap, tileW, tileH, imgW, imgH, drawn } = opts;

    for (let i = 0; i < hand.length; i++) {
      const isDrawn = !!(drawn && i === hand.length - 1);
      const extraX = isDrawn ? Math.round(gap * 0.6) : 0;

      const x = startX + i * gap + extraX;
      const { tile, idx: serverIndex } = hand[i];

      const btn = new TileButton(this.scene, x + tileW / 2, y, `tile_${tile}` as any, () => {
        // First click: select
        if (this.selected !== btn) {
          if (this.selected) this.selected.setSelected(false);
          this.selected = btn;
          btn.setSelected(true);
          return;
        }

        // Second click: discard attempt
        if (!canDiscard) {
          this.opts.onInvalidDiscard?.();
          return;
        }

        this.opts.onDiscard({ displayIndex: i, serverIndex, tile });
      }, { w: tileW, h: tileH, imgW, imgH });

      btn.setEnabled(true);
      this.buttons.push(btn);
    }
  }
}
