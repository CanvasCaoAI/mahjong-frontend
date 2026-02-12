import type Phaser from 'phaser';

export type TableLayout = {
  w: number;
  h: number;
  margin: number;

  // HUD
  titleX: number;
  titleY: number;
  hudX: number;
  hudY: number;
  msgX: number;
  msgY: number;

  // Center compass
  compassX: number;
  compassY: number;

  // Hand (bottom)
  handY: number;
  handGap: number;

  // Win prompt (Hu/Pass)
  winY: number;
  winX: number;
  winGap: number;

  // Opponent hands (backs)
  oppTopY: number;
  oppTopGap: number;
  oppSideGap: number;
  oppSideXInset: number;
  oppSideYTop: number;

  // Discards
  discardTileGapX: number;
  discardTileGapY: number;
  discardBottomY: number;
  discardTopY: number;
  discardCenterBandY: number;
  discardCols: number;
  discardSideRows: number;
  discardLeftX: number;
  discardRightX: number;
  discardSideYTop: number;
};

export function computeLayout(scene: Phaser.Scene): TableLayout {
  const w = scene.scale.width;
  const h = scene.scale.height;
  // Global UI scale: purely proportional to screen width (no min/max clamps).
  // Baseline: the original layout was tuned around ~1100px width.
  const s = w / 1100;

  const margin = Math.round(w * 0.03);

  // Keep the original “feel” but scaled
  // Hand should sit closer to bottom edge
  const handY = Math.round(h - 28 * s);

  return {
    w,
    h,
    margin,

    titleX: margin,
    titleY: Math.round(margin * 0.7),
    hudX: margin,
    hudY: Math.round(margin * 0.7) + Math.round(36 * s),
    msgX: margin,
    msgY: Math.round(margin * 0.7) + Math.round(66 * s),

    compassX: Math.round(w / 2),
    compassY: Math.round(h / 2 - 20 * s),

    handY,
    handGap: Math.round(60 * s),

    // Action buttons: anchor near right side (scaled)
    winY: Math.round(handY - 100 * s),
    winX: Math.round(w - margin - 220 * s),
    winGap: Math.round(110 * s),

    // Opponent hands
    oppTopY: Math.round(margin + 90 * s),
    oppTopGap: Math.round(28 * s),
    oppSideGap: Math.round(20 * s),
    oppSideXInset: Math.round(margin + 60 * s),
    oppSideYTop: Math.round(h * 0.30),

    // Discards (scaled gaps, stable anchor bands)
    discardTileGapX: Math.round(34 * s),
    discardTileGapY: Math.round(44 * s),
    discardBottomY: Math.round(h * 0.67),
    discardTopY: Math.round(h * 0.34),
    discardCenterBandY: Math.round(h * 0.50),
    discardCols: 10,
    discardSideRows: 10,
    discardLeftX: Math.round(w * 0.23),
    discardRightX: Math.round(w * 0.77),
    discardSideYTop: Math.round(h * 0.28),
  };
}
