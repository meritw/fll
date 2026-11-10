"""Render public/brand/tie-dye.webp from the team's red tie-dye shirt swatch.

The swatch photo is too small to stretch across a hero, so this paints a larger
crumple-dye field and colors it with the swatch's own luminance ramp: every
pixel in the output is a color that appears on the real shirt.

    pip install pillow numpy
    python3 scripts/generate-tie-dye.py path/to/tshirt-tie-dye.png
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

OUT_W, OUT_H = 2400, 1500
PAD = 300
WIDTH, HEIGHT = OUT_W + 2 * PAD, OUT_H + 2 * PAD
SEED = 55900
OUT = Path(__file__).resolve().parent.parent / "public" / "brand" / "tie-dye.webp"

rng = np.random.default_rng(SEED)


def value_noise(cells: int) -> np.ndarray:
    aspect = WIDTH / HEIGHT
    grid = rng.random((cells, max(2, round(cells * aspect)))).astype(np.float32)
    img = Image.fromarray(grid, mode="F").resize((WIDTH, HEIGHT), Image.BICUBIC)
    return np.asarray(img)


def fbm(base: int, octaves: int, falloff: float = 0.5) -> np.ndarray:
    total = np.zeros((HEIGHT, WIDTH), np.float32)
    amp, norm = 1.0, 0.0
    for i in range(octaves):
        total += amp * value_noise(base * 2**i)
        norm += amp
        amp *= falloff
    return total / norm


def sample(field: np.ndarray, x: np.ndarray, y: np.ndarray) -> np.ndarray:
    x = np.clip(x, 0, WIDTH - 1.001)
    y = np.clip(y, 0, HEIGHT - 1.001)
    x0, y0 = x.astype(np.int32), y.astype(np.int32)
    fx, fy = x - x0, y - y0
    a = field[y0, x0] * (1 - fx) + field[y0, x0 + 1] * fx
    b = field[y0 + 1, x0] * (1 - fx) + field[y0 + 1, x0 + 1] * fx
    return a * (1 - fy) + b * fy


def swatch_ramp(path: str) -> np.ndarray:
    px = np.asarray(Image.open(path).convert("RGB"), np.float32).reshape(-1, 3)
    lum = px @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    px = px[np.argsort(lum)]
    # The very brightest swatch pixels are camera glare, not dye.
    px = px[: int(len(px) * 0.985)]
    edges = np.linspace(0, len(px), 257).astype(int)
    ramp = np.stack([px[a:b].mean(0) for a, b in zip(edges[:-1], edges[1:])])
    kernel = np.ones(9) / 9
    padded = np.pad(ramp, ((4, 4), (0, 0)), mode="edge")
    return np.stack([np.convolve(padded[:, c], kernel, "valid") for c in range(3)], 1)


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    ramp = swatch_ramp(sys.argv[1])

    ys, xs = np.mgrid[0:HEIGHT, 0:WIDTH].astype(np.float32)
    warp_x = (fbm(3, 4) - 0.5) * 420
    warp_y = (fbm(3, 4) - 0.5) * 420
    blotches = fbm(3, 6, 0.6)
    field = sample(blotches, xs + warp_x, ys + warp_y)

    # Crumple folds: dye pools along creases and bleeds outward.
    crease_src = 1 - np.abs(fbm(5, 4, 0.55) - 0.5) * 2
    crease = sample(crease_src, xs + warp_x * 0.6, ys + warp_y * 0.6)
    crease = np.clip((crease - 0.72) / 0.28, 0, 1) ** 1.6
    crease_img = Image.fromarray(crease.astype(np.float32), mode="F")
    small = crease_img.resize((WIDTH // 6, HEIGHT // 6), Image.BILINEAR)
    bleed = np.asarray(small.resize((WIDTH, HEIGHT), Image.BICUBIC))
    mottle = fbm(28, 3, 0.5)
    field = field - 0.10 * crease - 0.22 * bleed + 0.16 * mottle

    field = field[PAD : PAD + OUT_H, PAD : PAD + OUT_W]
    # Rank-map so the output has the swatch's exact light/dark balance.
    ranks = np.empty(field.size, np.int32)
    ranks[np.argsort(field, axis=None)] = np.arange(field.size)
    t = ranks.reshape(field.shape) / field.size
    rgb = ramp[(t * 255.999).astype(np.int32)]
    # Cotton wicks dye a few threads past every edge.
    bled = Image.fromarray(rgb.astype(np.uint8), "RGB").filter(ImageFilter.GaussianBlur(3.5))
    rgb = np.asarray(bled, np.float32)

    rgb = np.clip(rgb, 0, 255).astype(np.uint8)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgb, "RGB").save(OUT, "WEBP", quality=88, method=6)
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
