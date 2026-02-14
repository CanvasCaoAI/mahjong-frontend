import type { Tile } from './types';

export const ALL_TILES: Tile[] = (() => {
  const out: Tile[] = [];
  for (const s of ['m','p','s'] as const) {
    for (let n=1; n<=9; n++) out.push(`${s}${n}` as Tile);
  }
  for (let n=1; n<=7; n++) out.push(`z${n}` as Tile);
  for (let n=1; n<=8; n++) out.push(`f${n}` as Tile);
  return out;
})();

export function tileKey(t: Tile): string {
  return `tile_${t}`;
}

export function tileUrl(t: Tile): string {
  // Use relative path so it works when the app is served under a subfolder (e.g. /majiang/).
  return `./assets/tiles/${t}.png`;
}

export function backKey(): string {
  return 'tile_back';
}

export function backUrl(): string {
  // Use relative path so it works when the app is served under a subfolder (e.g. /majiang/).
  return './assets/tiles/back.svg';
}
