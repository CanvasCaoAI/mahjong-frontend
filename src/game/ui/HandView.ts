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

  // Lock sizing for the whole round, but allow recompute when flowers/melds change.
  // Do NOT recompute on hand length changes (13/14) to avoid jitter.
  private lockedTileW: number | null = null;
  private lockedGap: number | null = null;
  private lockedSig: string | null = null; // recompute trigger signature

  private scene: Phaser.Scene;
  private opts: {
    y: number;
    gap: number;
    width: number;
    xLeft?: number;
    xRight?: number;
    onDiscard: (args: { displayIndex: number; serverIndex: number; tile: Tile }) => void;
    onInvalidDiscard?: () => void;
  };

  setLayout(layout: { y: number; gap: number; width: number; xLeft?: number; xRight?: number }) {
    this.opts.y = layout.y;
    this.opts.gap = layout.gap;
    this.opts.width = layout.width;
    this.opts.xLeft = layout.xLeft;
    this.opts.xRight = layout.xRight;
  }

  constructor(
    scene: Phaser.Scene,
    opts: {
      y: number;
      gap: number;
      width: number;
      xLeft?: number;
      xRight?: number;
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

    // Some servers may temporarily include flower tiles in hand during the "draw flower -> replace" flow.
    // For UI we always treat Suit 'f' as flowers area (left) and never as discardable hand tiles.
    const isFlower = (t: Tile) => t[0] === 'f';
    const lastNonFlowerIndex = (() => {
      for (let i = handRaw.length - 1; i >= 0; i--) {
        if (!isFlower(handRaw[i] as Tile)) return i;
      }
      return -1;
    })();

    // Detect freshly drawn tile.
    // - after 杠：手牌会先减少（移除杠牌）再补摸 1 张，整体长度不一定是 +1
    // - 所以只要处于“可出牌”状态且手牌长度发生变化，就把最后一张（非花）当作“新摸牌”
    if (canDiscard && this.lastHandRaw && handRaw.length !== this.lastHandRaw.length && lastNonFlowerIndex >= 0) {
      this.pendingDrawIndex = lastNonFlowerIndex;
    }

    // First render after round start: 也把最后一张（非花）当作新摸牌
    if (!this.lastHandRaw && canDiscard && lastNonFlowerIndex >= 0) {
      this.pendingDrawIndex = lastNonFlowerIndex;
    }

    if (!canDiscard) this.pendingDrawIndex = null;

    const drawn = (this.pendingDrawIndex !== null && this.pendingDrawIndex >= 0 && this.pendingDrawIndex < handRaw.length)
      ? { tile: handRaw[this.pendingDrawIndex] as Tile, idx: this.pendingDrawIndex }
      : null;

    // Auto-sort hand for display (excluding the drawn tile), but keep original indices for server actions.
    // Also exclude flower tiles from hand display.
    const base = handRaw
      .map((tile, idx) => ({ tile, idx }))
      .filter((x) => !isFlower(x.tile as Tile))
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

    const hand = (drawn && !isFlower(drawn.tile)) ? [...base, drawn] : base;

    // Store for next diff
    this.lastHandRaw = handRaw.slice();

    const y = this.opts.y;
    // Hand gap should track tile width (no independent scaling).
    // i.e. spacing between tiles = tileW.
    let gap = 0;
    const tableW = this.opts.width;

    // Split melds into: flowers (left) and flat melds (peng/chi/gang)
    // Plus: treat any 'f' tiles still present in handRaw as flowers too (UI-safety for first draw).
    const flowerTiles: Tile[] = [];
    const flatMeldTiles: Tile[] = [];
    for (const m of melds) {
      if (m.type === 'flower') flowerTiles.push(...m.tiles);
      else flatMeldTiles.push(...m.tiles);
    }

    // If table is empty (between rounds), reset locked sizing.
    if (handRaw.length === 0 && flowerTiles.length === 0 && flatMeldTiles.length === 0) {
      this.lockedTileW = null;
      this.lockedGap = null;
      this.lockedSig = null;
    }

    // Recompute sizing only when flowers/melds composition changes (e.g. 补花导致花牌数量增加).
    // This avoids constant re-layout jitter on 13/14 hand oscillation.
    const sig = `${flowerTiles.length}:${flatMeldTiles.length}`;
    if (this.lockedSig && this.lockedSig !== sig) {
      this.lockedTileW = null;
      this.lockedGap = null;
    }
    this.lockedSig = sig;
    // Avoid double-counting if server already moved a flower into melds but still echoes it in hand.
    const flowerCount = new Map<Tile, number>();
    for (const t of flowerTiles) flowerCount.set(t, (flowerCount.get(t) ?? 0) + 1);
    for (const t of handRaw) {
      if (t[0] !== 'f') continue;
      const c = flowerCount.get(t as Tile) ?? 0;
      if (c > 0) continue;
      flowerTiles.push(t);
      flowerCount.set(t as Tile, 1);
    }

    // Hand tile sizing: lock per round (until manual refresh).
    // Goal: the whole group occupies ~80% screen width.
    const minDim = Math.min(this.scene.scale.width, this.scene.scale.height);

    const calc = (tileW: number, gap: number, handLenForSizing: number) => {
      const tileH = Math.round(tileW * 1.30);
      const imgW = Math.round(tileW - 4);
      const imgH = Math.round(tileH - 6);

      // Meld tiles use the same width/height as hand tiles.
      const meldGap = Math.round(tileW + Math.max(2, tileW * 0.04));

      const flowerGap = Math.round(tileW + Math.max(2, tileW * 0.04));
      const flowerW = flowerTiles.length ? (flowerTiles.length - 1) * flowerGap + tileW : 0;
      const meldW = flatMeldTiles.length ? (flatMeldTiles.length - 1) * meldGap + tileW : 0;
      const totalW = handLenForSizing > 0 ? (handLenForSizing - 1) * gap + tileW : 0;

      const gapFlowerToMeld = flowerTiles.length && flatMeldTiles.length ? Math.round(Math.max(10, gap * 0.25)) : 0;
      const gapFlowerToHand = flowerTiles.length && !flatMeldTiles.length ? Math.round(Math.max(18, gap * 0.35)) : 0;
      const gapMeldToHand = flatMeldTiles.length ? Math.round(Math.max(18, gap * 0.35)) : 0;

      const wholeW = flowerW + gapFlowerToMeld + meldW + (gapMeldToHand || gapFlowerToHand) + totalW;

      return {
        tileW,
        tileH,
        imgW,
        imgH,
        meldGap,
        flowerGap,
        flowerW,
        meldW,
        totalW,
        gapFlowerToMeld,
        gapFlowerToHand,
        gapMeldToHand,
        wholeW,
      };
    };

    // Hand gap should track tile width (no independent scaling).
    let tileW: number;
    if (this.lockedTileW && this.lockedGap) {
      tileW = this.lockedTileW;
      gap = this.lockedGap;
    } else {
      // First compute: size against worst-case 14 tiles to avoid 13/14 oscillation.
      const handLenForSizing = Math.max(hand.length, 14);
      tileW = Math.round(minDim * 0.07);
      gap = tileW;
      let dims0 = calc(tileW, gap, handLenForSizing);

      const targetW = tableW * 0.8;
      const scale = dims0.wholeW > 0 ? (targetW / dims0.wholeW) : 1;

      tileW = Math.round(tileW * scale);
      gap = tileW;

      this.lockedTileW = tileW;
      this.lockedGap = gap;
    }

    // Use actual current hand length for drawing (but sizing is locked).
    const dims = calc(tileW, gap, hand.length);

    // If we scale up, the bottom of flower/meld blocks can get clipped by the viewport.
    // Adjust Y upward so the whole group stays visible.
    const sceneH = this.scene.scale.height;
    // Allow hand group to sit very close to bottom edge
    const bottomLimit = sceneH - 2;
    const handBottom = y + dims.tileH / 2;
    const meldBottom = y + dims.tileH * 0.725; // includes the small base block
    const overflowBottom = Math.max(handBottom, meldBottom) - bottomLimit;
    const yAdj = overflowBottom > 0 ? Math.round(y - overflowBottom) : y;

    // center whole group within a safe horizontal band (avoid overlapping side players)
    const xLeft = this.opts.xLeft ?? 0;
    const xRight = this.opts.xRight ?? tableW;
    const availW = Math.max(0, xRight - xLeft);
    const centeredWholeStart = xLeft + (availW - dims.wholeW) / 2;
    const startWholeX = dims.wholeW > availW ? xLeft : centeredWholeStart;

    const flowerStartX = startWholeX;
    const meldStartX = flowerStartX + dims.flowerW + dims.gapFlowerToMeld;
    const handStartX = meldStartX + dims.meldW + (dims.gapMeldToHand || dims.gapFlowerToHand);

    // 1) 花牌：最左侧
    this.renderFlowers({
      tiles: flowerTiles,
      startX: flowerStartX,
      y: yAdj,
      gap: dims.flowerGap,
      tileW: dims.tileW,
      tileH: dims.tileH,
    });

    // 2) 碰/杠/吃：其次
    this.renderFlatMelds({
      tiles: flatMeldTiles,
      startX: meldStartX,
      y: yAdj,
      gap: dims.meldGap,
      tileW: dims.tileW,
      tileH: dims.tileH,
    });

    // 3) 手牌：含最新摸牌
    this.renderHand({
      hand,
      canDiscard,
      startX: handStartX,
      y: yAdj,
      gap,
      tileW: dims.tileW,
      tileH: dims.tileH,
      imgW: dims.imgW,
      imgH: dims.imgH,
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
      // Flowers: 70% opacity, no base block
      img.setAlpha(0.70);
      img.setDepth(60);

      this.meldSprites.push(img);
    }
  }

  private renderFlatMelds(opts: { tiles: Tile[]; startX: number; y: number; gap: number; tileW: number; tileH: number }) {
    const { tiles, startX, y, gap, tileW, tileH } = opts;

    for (let i = 0; i < tiles.length; i++) {
      const x = startX + i * gap + tileW / 2;
      const key = tileKey(tiles[i] as any);

      const img = this.scene.add.image(x, y, key);
      img.setDisplaySize(tileW, tileH);

      // Melds: 70% opacity, no base block
      img.setAlpha(0.70);
      img.setDepth(60);

      this.meldSprites.push(img);
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
