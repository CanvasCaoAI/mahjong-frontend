#!/usr/bin/env python3
from __future__ import annotations

import os
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
TILES_DIR = ROOT / "public" / "assets" / "tiles"
SRC = TILES_DIR / "all.jpg"

# Target output size matches existing assets (approx)
OUT_W = 63
OUT_H = 99

# Grid in the source image
COLS = 9
ROWS = 5

# Per-cell crop inset (remove shadows/borders a bit before resize)
# Tuned by feel; adjust if tiles look clipped.
INSET_X_FRAC = 0.06
INSET_Y_FRAC = 0.06


def cell_box(w: int, h: int, r: int, c: int):
    step_x = w / COLS
    step_y = h / ROWS
    left = round(c * step_x)
    right = round((c + 1) * step_x)
    top = round(r * step_y)
    bottom = round((r + 1) * step_y)
    return left, top, right, bottom


def crop_tile(img: Image.Image, r: int, c: int) -> Image.Image:
    w, h = img.size
    l, t, rr, bb = cell_box(w, h, r, c)
    cell = img.crop((l, t, rr, bb))

    cw, ch = cell.size
    ix = int(round(cw * INSET_X_FRAC))
    iy = int(round(ch * INSET_Y_FRAC))
    cell = cell.crop((ix, iy, cw - ix, ch - iy))

    # Resize to standard tile asset size
    cell = cell.resize((OUT_W, OUT_H), Image.Resampling.LANCZOS)
    return cell


def save_png(tile: Image.Image, name: str):
    out = TILES_DIR / f"{name}.png"
    tile.save(out, format="PNG", optimize=True)


def main():
    if not SRC.exists():
        raise SystemExit(f"Missing source image: {SRC}")

    img = Image.open(SRC).convert("RGB")

    # Row mapping in all.jpg
    # row0: dots => p1..p9
    # row1: bamboo => s1..s9
    # row2: characters => m1..m9
    # row3: honors => z1..z7 (col0..6)
    # row4: flowers => f1..f8 (col0..7)

    for n in range(1, 10):
        save_png(crop_tile(img, 0, n - 1), f"p{n}")
    for n in range(1, 10):
        save_png(crop_tile(img, 1, n - 1), f"s{n}")
    for n in range(1, 10):
        save_png(crop_tile(img, 2, n - 1), f"m{n}")

    for n in range(1, 8):
        save_png(crop_tile(img, 3, n - 1), f"z{n}")

    for n in range(1, 9):
        save_png(crop_tile(img, 4, n - 1), f"f{n}")

    print("OK: wrote p1..p9, s1..s9, m1..m9, z1..z7, f1..f8")


if __name__ == "__main__":
    main()
