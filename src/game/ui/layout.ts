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
  const minDim = Math.min(w, h);

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  // Global UI scale: keep the old layout proportions, just scale them down on small screens.
  const s = clamp(minDim / 900, 0.55, 1.0);

  const margin = Math.round(clamp(w * 0.03, 10, 28));

  // Keep the original “feel” but scaled
  const handY = Math.round(h - 80 * s);

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
    handGap: Math.round(clamp(60 * s, 30, 58)),

    // Action buttons: anchor near right side (scaled)
    winY: Math.round(handY - 100 * s),
    winX: Math.round(w - margin - 220 * s),
    winGap: Math.round(clamp(110 * s, 60, 120)),

    // Opponent hands
    oppTopY: Math.round(margin + 90 * s),
    oppTopGap: Math.round(clamp(28 * s, 18, 28)),
    oppSideGap: Math.round(clamp(20 * s, 14, 20)),
    oppSideXInset: Math.round(margin + 60 * s),
    oppSideYTop: Math.round(h * 0.30),

    // Discards (scaled gaps, stable anchor bands)
    discardTileGapX: Math.round(clamp(34 * s, 22, 34)),
    discardTileGapY: Math.round(clamp(44 * s, 28, 44)),
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
