import Phaser from 'phaser';
import type { Meld, Tile } from '../../domain/types';
import { tileKey } from '../../domain/tileset';
import { TileButton } from './TileButton';

/**
 * Bottom hand area renderer.
 *
 * Refactor note (2026-02-14):
 * - Hand tile size is derived ONLY from screen width and is fixed (no dynamic shrinking/growing based on hand state).
 * - Flower tiles and flat meld tiles (碰/吃/杠) are always exactly 1/2 of hand tile size.
 * - All dynamic resize logic tied to flowers/kongs/hand length changes has been removed.
 */
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
    const tableW = this.opts.width;

    // Split melds into: flowers (left) and flat melds (peng/chi/gang)
    // Plus: treat any 'f' tiles still present in handRaw as flowers too (UI-safety for first draw).
    const flowerTiles: Tile[] = [];
    const flatMeldTiles: Tile[] = [];
    for (const m of melds) {
      if (m.type === 'flower') flowerTiles.push(...m.tiles);
      else flatMeldTiles.push(...m.tiles);
    }

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

    // ===== Fixed sizing (only depends on screen width) =====
    // Base hand tile size (constant ratio of screen width)
    const w = this.scene.scale.width;
    const handTileW = Math.max(28, Math.round(w * 0.055));
    const handTileH = Math.round(handTileW * 1.30);
    const handImgW = Math.round(handTileW - 4);
    const handImgH = Math.round(handTileH - 6);

    // Flowers & melds are always exactly half of hand tile size
    const smallTileW = Math.max(14, Math.round(handTileW / 2));
    const smallTileH = Math.round(smallTileW * 1.30);

    // Spacing rules: spacing tracks tile width (no independent scaling)
    const handGap = handTileW;
    const smallGap = smallTileW;

    const drawnExtra = (drawn ? Math.round(handGap * 0.6) : 0);

    const flowerW = flowerTiles.length ? (flowerTiles.length - 1) * smallGap + smallTileW : 0;
    const meldW = flatMeldTiles.length ? (flatMeldTiles.length - 1) * smallGap + smallTileW : 0;
    const handW = hand.length ? (hand.length - 1) * handGap + handTileW + drawnExtra : 0;

    const gapFlowerToMeld = (flowerTiles.length && flatMeldTiles.length) ? Math.round(Math.max(10, handTileW * 0.25)) : 0;
    const gapFlowerToHand = (flowerTiles.length && !flatMeldTiles.length) ? Math.round(Math.max(18, handTileW * 0.35)) : 0;
    const gapMeldToHand = (flatMeldTiles.length) ? Math.round(Math.max(18, handTileW * 0.35)) : 0;

    const wholeW = flowerW + gapFlowerToMeld + meldW + (gapMeldToHand || gapFlowerToHand) + handW;

    // Keep bottom visible: compute max-bottom among the three blocks
    const sceneH = this.scene.scale.height;
    const bottomLimit = sceneH - 2;
    const handBottom = y + handTileH / 2;
    const smallBottom = y + smallTileH / 2;
    const overflowBottom = Math.max(handBottom, smallBottom) - bottomLimit;
    const yAdj = overflowBottom > 0 ? Math.round(y - overflowBottom) : y;

    // center whole group within a safe horizontal band (avoid overlapping side players)
    const xLeft = this.opts.xLeft ?? 0;
    const xRight = this.opts.xRight ?? tableW;
    const availW = Math.max(0, xRight - xLeft);
    const centeredWholeStart = xLeft + (availW - wholeW) / 2;
    const startWholeX = wholeW > availW ? xLeft : centeredWholeStart;

    const flowerStartX = startWholeX;
    const meldStartX = flowerStartX + flowerW + gapFlowerToMeld;
    const handStartX = meldStartX + meldW + (gapMeldToHand || gapFlowerToHand);

    // 1) 花牌：最左侧
    this.renderFlowers({
      tiles: flowerTiles,
      startX: flowerStartX,
      y: yAdj,
      gap: smallGap,
      tileW: smallTileW,
      tileH: smallTileH,
    });

    // 2) 碰/杠/吃：其次
    this.renderFlatMelds({
      tiles: flatMeldTiles,
      startX: meldStartX,
      y: yAdj,
      gap: smallGap,
      tileW: smallTileW,
      tileH: smallTileH,
    });

    // 3) 手牌：含最新摸牌
    this.renderHand({
      hand,
      canDiscard,
      startX: handStartX,
      y: yAdj,
      gap: handGap,
      tileW: handTileW,
      tileH: handTileH,
      imgW: handImgW,
      imgH: handImgH,
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
      // Flowers: 70% opacity
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

      // Melds: 70% opacity
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
