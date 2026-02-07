import Phaser from 'phaser';
import type { Tile } from '../../domain/types';
import { TileButton } from './TileButton';

export class HandView {
  private buttons: TileButton[] = [];
  private selected: TileButton | null = null;

  private scene: Phaser.Scene;
  private opts: {
    y: number;
    gap: number;
    width: number;
    onDiscard: (args: { displayIndex: number; serverIndex: number; tile: Tile }) => void;
    onInvalidDiscard?: () => void;
  };

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
    this.selected = null;
  }

  setAllEnabled(v: boolean) {
    for (const b of this.buttons) b.setEnabled(v);
  }

  getButton(displayIndex: number): TileButton | undefined {
    return this.buttons[displayIndex];
  }

  update(handRaw: Tile[], canDiscard: boolean) {
    // re-render for now (simple); later can optimize.
    this.destroy();

    // Auto-sort hand for display, but keep original indices for server actions.
    const hand = handRaw.map((tile, idx) => ({ tile, idx })).sort((a, b) => {
      const sa = a.tile[0];
      const sb = b.tile[0];
      const na = Number(a.tile.slice(1));
      const nb = Number(b.tile.slice(1));
      const suitOrder: Record<string, number> = { m: 0, p: 1, s: 2, z: 3 };
      const ds = (suitOrder[sa] ?? 99) - (suitOrder[sb] ?? 99);
      if (ds) return ds;
      return na - nb;
    });

    const y = this.opts.y;
    const gap = this.opts.gap;
    const tableW = this.opts.width;

    const totalW = hand.length > 0 ? (hand.length - 1) * gap + 60 : 0;
    const margin = Math.round(tableW * 0.03);
    const minX = margin;
    const maxX = tableW - margin - totalW;
    const centered = (tableW - totalW) / 2;
    const startX = Math.max(minX, Math.min(centered, maxX));

    for (let i = 0; i < hand.length; i++) {
      const x = startX + i * gap;
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
