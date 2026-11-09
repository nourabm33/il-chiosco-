"""Extract local reference panels and make surface maps. Requires Pillow and NumPy."""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image


# Rectangles and beverage ellipses are measured on 650 px reference previews.
REFERENCES = {
    "americano": ("americano.webp", (650, 571), (41, 42, 621, 534, 330, 289), None),
    "cappuccino": ("cappuchino.webp", (636, 650), (65, 71, 572, 588, 319, 324), (185, 187, 101, 98)),
    "espresso": ("espresso.jpeg", (644, 650), (67, 71, 578, 582, 323, 325), None),
    "flat-white": ("Flat White.webp", (650, 540), (41, 41, 611, 503, 326, 269), (171, 150, 96, 95)),
    "latte-macchiato": ("latte macchiato.webp", (574, 650), (32, 70, 542, 592, 288, 325), (157, 184, 99, 98)),
}
SIZE = 1024


def crop_views(image, preview, frame, output):
    x0, y0, x1, y1, mx, my = frame
    for name, box in {
        "upper-left": (x0, y0, mx - 4, my - 4),
        "upper-right": (mx + 4, y0, x1, my - 4),
        "lower-left": (x0, my + 4, mx - 4, y1),
        "lower-right": (mx + 4, my + 4, x1, y1),
    }.items():
        scaled = tuple(round(value * image.size[i % 2] / preview[i % 2]) for i, value in enumerate(box))
        image.crop(scaled).save(output / f"{name}.webp", quality=91)


def smooth(lo, hi, value):
    t = np.clip((value - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def noise(rng, size, width, height=None):
    grid = np.uint8(rng.random((height or width, width)) * 255)
    return np.asarray(Image.fromarray(grid).resize(size, Image.Resampling.BICUBIC)) / 255 - 0.5


def rgb(value):
    return np.asarray(value, dtype=np.float32)


def write_rgb(array, destination, **options):
    Image.fromarray(np.uint8(np.clip(array, 0, 255))).save(destination, **options)


def surface_maps(product, photo, preview, ellipse, output, seed):
    rng = np.random.default_rng(seed)
    x, y = np.meshgrid(*[np.linspace(-1, 1, SIZE, dtype=np.float32)] * 2)
    angle = np.arctan2(y, x)
    r = np.hypot(x, y)
    fine = noise(rng, (SIZE, SIZE), 400)
    grain = noise(rng, (SIZE, SIZE), 125)
    cloud = noise(rng, (SIZE, SIZE), 16)
    waviness = 0.025 * np.sin(angle * 7 + 0.4) + 0.017 * np.cos(angle * 13 - 0.7)
    rings = np.exp(-((r - 0.927 + waviness) / 0.035)**2)

    if ellipse:
        cx, cy, rx, ry = ellipse
        sx, sy = np.asarray(photo.size) / preview
        pour = photo.transform(
            (SIZE, SIZE), Image.Transform.AFFINE,
            (2 * rx * sx / SIZE, 0, (cx - rx) * sx, 0, 2 * ry * sy / SIZE, (cy - ry) * sy),
            Image.Resampling.BICUBIC,
        )
        art = np.asarray(pour, dtype=np.float32) * rgb((1.035, 1.055, 1.08))
        ring_colors = {
            "cappuccino": (152, 83, 33),
            "flat-white": (177, 111, 52),
            "latte-macchiato": (181, 111, 40),
        }
        rim = rgb(ring_colors[product]) + (rings * 15 + grain * 24 + cloud * 19)[..., None]
        fade = smooth(0.83, 0.94, r)
        if product == "flat-white":
            # The collage title overlaps the lower-right edge of this overhead view.
            title = smooth(183, 192, cx + x*rx) * smooth(212, 221, cy + y*ry)
            fade = np.maximum(fade, title)
        fade = fade[..., None]
        color = art * (1 - fade) + rim * fade
        body = smooth(110, 232, color[:, :, 1])
        bubble_mask = 0.4 + 0.6 * (1 - body)
        roughness = 0.33 + body * 0.12
    elif product == "espresso":
        flow = np.sin(19 * r + 2.2 * angle + cloud * 1.4) * 0.5
        crescent = 0.16 * smooth(-0.55, 0.85, -np.sin(angle + 0.3))
        rim = smooth(0.72, 0.995, r + crescent + waviness + cloud * 0.09)
        marbling = smooth(-0.35, 0.36, cloud + 0.25 * flow)
        color = rgb((160, 80, 22)) + marbling[..., None] * rgb((37, 29, 12))
        color = color * (1 - rim[..., None] * 0.84) + rim[..., None] * rgb((24, 8, 3))
        color += (grain * 22 + fine * 12 + rings * 9)[..., None]
        bubble_mask = 0.65 + 0.35 * rim
        roughness = 0.32 - rim * 0.09
    else:
        edge = smooth(0.76, 0.97, r + waviness) * smooth(-0.54, 0.92, np.sin(angle + 0.8))
        rim = smooth(0.18, 0.82, edge + cloud * 0.19)
        color = rgb((29, 12, 6)) + cloud[..., None] * rgb((10, 5, 3))
        color += rim[..., None] * rgb((106, 67, 33)) + (rings * rim * 15)[..., None]
        bubble_mask = rim
        roughness = 0.275 + rim * 0.13

    bubbles = np.zeros_like(r)
    for _ in range(3600 if product == "espresso" else 2200):
        u, v = rng.integers(8, SIZE - 8, size=2)
        if r[v, u] >= 1 or rng.random() > bubble_mask[v, u]:
            continue
        radius = rng.choice((1, 2, 3, 4, 6), p=(0.25, 0.39, 0.23, 0.105, 0.025))
        if product == "americano":
            radius = min(7, radius + 1)
        left, top = u - radius, v - radius
        box = np.s_[top:v + radius + 1, left:u + radius + 1]
        di = np.hypot((x[box] - x[v, u]) * SIZE * 0.5, (y[box] - y[v, u]) * SIZE * 0.5) / radius
        bubbles[box] += -np.exp(-di**2 * 6) + np.exp(-((di - 0.76) * 6)**2) * 0.31

    color += (bubbles * (26 if product == "americano" else 17) + fine * 6)[..., None]
    height = bubbles * 0.42 + fine * 0.045 + grain * 0.04
    gy, gx = np.gradient(height)
    normal = np.stack((-gx, gy, np.ones_like(height)), axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    write_rgb(color, output / "surface.jpg", quality=92, subsampling=0, optimize=True)
    write_rgb(127.5 * (normal + 1), output / "micro-normal.png", optimize=True)
    rough = np.uint8(np.clip((roughness + grain * 0.055 + np.abs(bubbles) * 0.035) * 255, 0, 255))
    Image.fromarray(rough).save(output / "roughness.png", optimize=True)


def layer_map(product, output, seed):
    rng = np.random.default_rng(seed)
    size = (512, 512)
    u, h = np.meshgrid(np.linspace(0, 1, size[0]), np.linspace(1, 0, size[1]))
    # Horizontally seamless swirls at the transitions between milk, coffee and foam.
    swirl = (np.cos(2 * np.pi * (3 * u + h)) * 0.028
             + np.sin(2 * np.pi * (7 * u - 2 * h)) * 0.013
             + np.cos(2 * np.pi * (13 * u + h)) * 0.005)
    if product == "latte-macchiato":
        milk = rgb((240, 216, 180))
        coffee = rgb((174, 108, 51))
        t = smooth(0.20, 0.58, h + swirl)
        foam = smooth(0.80, 0.86, h + swirl * 0.24)
    else:
        milk = rgb((216, 174, 123))
        coffee = rgb((185, 131, 80))
        t = smooth(0.15, 0.95, h + swirl)
        foam = smooth(0.77, 0.86, h + swirl * 0.30)
    color = milk + t[..., None] * (coffee - milk)
    color = color * (1 - foam[..., None]) + foam[..., None] * rgb((244, 221, 185))
    if product == "flat-white":
        flutes = (np.cos(2*np.pi*56*u) * 0.031 + np.sin(2*np.pi*56*u) * 0.013)
        color *= (1 + flutes * smooth(0, 0.12, h) * (1 - smooth(0.86, 1, h)))[..., None]
    micro = noise(rng, size, 256) * 6 + noise(rng, size, 32, 48) * 4
    write_rgb(color + micro[..., None], output / "layers.jpg", quality=90, subsampling=0, optimize=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("originals", type=Path)
    parser.add_argument("workspace", type=Path)
    args = parser.parse_args()
    provenance = {}
    for index, (product, (filename, preview, frame, ellipse)) in enumerate(REFERENCES.items()):
        original = args.originals / filename
        photo = Image.open(original).convert("RGB")
        target = args.workspace / product
        panels = target / "panels"
        panels.mkdir(parents=True, exist_ok=True)
        crop_views(photo, preview, frame, panels)
        surface_maps(product, photo, preview, ellipse, target, 950 + index)
        if product in {"flat-white", "latte-macchiato"}:
            layer_map(product, target, 876 + index)
        provenance[product] = {"file": filename, "sha256": hashlib.sha256(original.read_bytes()).hexdigest()}
    (args.workspace / "references.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
