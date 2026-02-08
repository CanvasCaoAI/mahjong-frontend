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

  update(handRaw: Tile[], canDiscard: boolean, melds: Meld[] = []) {
    // re-render for now (simple); later can optimize.
    this.destroy();

    // Detect freshly drawn tile: server draw appends to the end.
    // Requirement: 新摸的那张牌显示在最右侧，等到打牌之后再排序。
    if (this.lastHandRaw && handRaw.length === this.lastHandRaw.length + 1) {
      // Heuristic: draw() pushes at the end in server implementation.
      this.pendingDrawIndex = handRaw.length - 1;
    }

    // If not in a discard-able state with 14 tiles, don't treat any tile as "fresh draw".
    const isFreshDrawState = canDiscard && handRaw.length >= 14;
    if (!isFreshDrawState) this.pendingDrawIndex = null;

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
        const suitOrder: Record<string, number> = { m: 0, p: 1, s: 2, z: 3 };
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

    // === Melds (e.g. 碰) ===
    // 需求：显示在手牌左边；与手牌不连起来；视觉上像“摊开”(平放)
    // 碰牌展示尺寸：宽度与手牌一致；高度通过 scaleY 压扁（宽度不变）
    const meldTileW = 56;
    const meldTileH = 72;
    // 碰牌加一点间距
    const meldGap = gap + 6;

    const flatMeldTiles: Tile[] = [];
    for (const m of melds) flatMeldTiles.push(...m.tiles);
    const meldW = flatMeldTiles.length ? (flatMeldTiles.length - 1) * meldGap + meldTileW : 0;

    const totalW = hand.length > 0 ? (hand.length - 1) * gap + 60 : 0;
    const margin = Math.round(tableW * 0.03);

    // 碰牌与手牌之间的断开距离
    const groupGap = flatMeldTiles.length ? 36 : 0;

    // 让（meld + gap + hand）整体尽量居中
    const wholeW = meldW + groupGap + totalW;
    const centeredWholeStart = (tableW - wholeW) / 2;
    const startWholeX = Math.max(margin, centeredWholeStart);

    // meld 起点 / hand 起点
    const meldStartX = startWholeX;
    const startX = meldStartX + meldW + groupGap;

    // render meld tiles (flat)
    // 需求：看上去更“扁”，并且底部有一个白色的矩形方块
    // 只是图片高度降低，宽度不变
    const flatScaleY = 0.60;
    // 切掉碰牌图片顶部（像“摊开”被桌面挡住一点）
    const cropTopPx = 12;

    // 底部白色矩形：宽度同麻将，高度先定 20 看效果
    const baseH = 20;
    const baseInset = 0;

    for (let i = 0; i < flatMeldTiles.length; i++) {
      const x = meldStartX + i * meldGap + meldTileW / 2;
      const key = tileKey(flatMeldTiles[i] as any);

      const img = this.scene.add.image(x, y, key);
      // 不转 90 度
      img.setDisplaySize(meldTileW, meldTileH);

      // 切掉顶部：crop 使用的是原始纹理像素尺寸（frame），不是 displaySize
      const fw = img.frame.width;
      const fh = img.frame.height;
      const cropTop = Math.max(0, Math.min(cropTopPx, fh - 1));
      img.setCrop(0, cropTop, fw, fh - cropTop);

      // 只压高度，宽度不变
      img.setScale(1, flatScaleY);
      img.setAlpha(0.98);
      img.setDepth(60);

      // white base block (under the tile) —— 放在牌下面，不要盖住牌面
      const tileRenderH = meldTileH * flatScaleY;
      // 视觉上麻将牌外框宽度接近 TileButton 的 60px（而不是牌面 56px）
      const baseW = (meldTileW + 6) - baseInset * 2;
      const base = this.scene.add.rectangle(
        x,
        y + tileRenderH * 0.5 + baseH * 0.5 - 1,
        baseW,
        baseH,
        0xFFFFFF,
        0.95
      );
      base.setDepth(59);

      this.meldSprites.push(base, img);
    }

    for (let i = 0; i < hand.length; i++) {
      // 最右侧“新摸牌”稍微与其他牌拉开一点，视觉上更明显
      const extraGap = (drawn && i === hand.length - 1) ? 18 : 0;
      const x = startX + i * gap + extraGap;
      const { tile, idx: serverIndex } = hand[i];

      const btn = new TileButton(this.scene, x + 30, y, `tile_${tile}` as any, () => {
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
      });

      btn.setEnabled(true);
      this.buttons.push(btn);
    }
  }
}
