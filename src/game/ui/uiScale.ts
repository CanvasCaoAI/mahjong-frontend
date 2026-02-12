import type Phaser from 'phaser';

// Single source of truth for UI scaling.
// All numeric UI sizes should be derived from `w` (screen width).

export const UI_BASE_W = 1100;

export type UIScale = {
  w: number;
  h: number;
  s: number; // w/UI_BASE_W

  // Common paddings
  margin: number;
  edgePad: number;

  // Tile sizing (opponents / discards)
  oppW: number;
  oppH: number;

  discardW: number;
  discardH: number;

  // Top-left wall count
  wallFont: number;
  wallPadX: number;
  wallPadY: number;

  // Center compass
  compassSize: number;

  // Score button
  scoreBtnW: number;
  scoreBtnH: number;
  scoreBtnFont: number;
};

export function uiScale(scene: Phaser.Scene): UIScale {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const s = w / UI_BASE_W;

  const margin = Math.round(w * 0.03);
  const edgePad = Math.round(w * 0.015);

  const oppW = Math.round(w * 0.025);
  const oppH = Math.round(oppW * 1.30);

  const discardW = Math.round(w * 0.03);
  const discardH = Math.round(discardW * 1.28);

  const wallFont = Math.round(w * 0.022);
  const wallPadX = Math.round(w * 0.008);
  const wallPadY = Math.round(w * 0.005);

  // Center compass: smaller to keep middle area readable
  const compassSize = Math.round(w * 0.07);

  const scoreBtnW = Math.round(w * 0.10);
  const scoreBtnH = Math.round(h * 0.05);
  const scoreBtnFont = Math.round(w * 0.016);

  return {
    w,
    h,
    s,
    margin,
    edgePad,
    oppW,
    oppH,
    discardW,
    discardH,
    wallFont,
    wallPadX,
    wallPadY,
    compassSize,
    scoreBtnW,
    scoreBtnH,
    scoreBtnFont,
  };
}
