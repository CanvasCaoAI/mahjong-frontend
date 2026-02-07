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
  const margin = Math.round(w * 0.03);

  const handY = h - 80;

  return {
    w,
    h,
    margin,

    titleX: margin,
    titleY: Math.round(margin * 0.7),
    hudX: margin,
    hudY: Math.round(margin * 0.7) + 36,
    msgX: margin,
    msgY: Math.round(margin * 0.7) + 66,

    compassX: Math.round(w / 2),
    compassY: Math.round(h / 2) - 20,

    handY,
    handGap: 62,

    // place above hand, near right side
    winY: handY - 100,
    winX: w - margin - 260,
    winGap: 135,

    oppTopY: margin + 90,
    oppTopGap: 28,
    oppSideGap: 20,
    oppSideXInset: margin + 60,
    oppSideYTop: Math.round(h * 0.30),

    discardTileGapX: 34,
    discardTileGapY: 44,
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
