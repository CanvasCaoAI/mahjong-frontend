import type { Tile } from './types';

export const ALL_TILES: Tile[] = (() => {
  const out: Tile[] = [];
  for (const s of ['m','p','s'] as const) {
    for (let n=1; n<=9; n++) out.push(`${s}${n}` as Tile);
  }
  for (let n=1; n<=7; n++) out.push(`z${n}` as Tile);
  return out;
})();

export function tileKey(t: Tile): string {
  return `tile_${t}`;
}

export function tileUrl(t: Tile): string {
  return `/assets/tiles/${t}.png`;
}

export function backKey(): string {
  return 'tile_back';
}

export function backUrl(): string {
  return '/assets/tiles/back.svg';
}
