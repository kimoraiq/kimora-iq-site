#!/usr/bin/env python3
"""Build KIMORA IQ public site using light WebP product images.

Preserves the original uploaded PNG artwork in the GitHub repository.
Only generated WebP files (strictly <=350,000 bytes) are published.
"""
from __future__ import annotations

import io
import shutil
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "_site"
MAX_BYTES = 350_000
PRODUCT_COUNT = 30
MAX_EDGES = (1400, 1280, 1160, 1040, 940, 840, 740, 640, 550, 460)
QUALITIES = (86, 82, 78, 74, 70, 64, 58, 52, 46, 40, 32, 24)


def make_webp(source: Path, target: Path) -> tuple[int, tuple[int, int], int]:
    with Image.open(source) as original:
        original = ImageOps.exif_transpose(original)
        mode = "RGBA" if "A" in original.getbands() else "RGB"
        image = original.convert(mode)

    for edge in MAX_EDGES:
        candidate = image.copy()
        candidate.thumbnail((edge, edge), Image.Resampling.LANCZOS)
        for quality in QUALITIES:
            buffer = io.BytesIO()
            candidate.save(buffer, "WEBP", quality=quality, method=6, exact=True)
            if buffer.tell() <= MAX_BYTES:
                data = buffer.getvalue()
                target.write_bytes(data)
                return len(data), candidate.size, quality
    raise RuntimeError(f"{source.name} could not fit the {MAX_BYTES} byte limit")


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    for name in ("index.html", "about.html", "products.html", "contact.html",
                 "admin.html", "kimora iq.png", "CNAME", ".nojekyll"):
        source = ROOT / name
        if not source.is_file():
            raise FileNotFoundError(f"Missing public site file: {name}")
        shutil.copy2(source, OUT / name)

    shutil.copytree(ROOT / "assets", OUT / "assets")
    catalog_html = (OUT / "products.html").read_text(encoding="utf-8")

    total = 0
    print("WEBP PRODUCT OPTIMIZATION (strictly <= 350,000 bytes each)")
    for number in range(1, PRODUCT_COUNT + 1):
        filename = f"{number}.webp"
        if f'src="{filename}"' not in catalog_html:
            raise RuntimeError(f"Product page does not reference {filename}")
        source = ROOT / f"{number}.png"
        if not source.is_file():
            raise FileNotFoundError(f"Missing original product image: {source.name}")
        size, dims, quality = make_webp(source, OUT / filename)
        if size > MAX_BYTES:
            raise AssertionError(f"{filename} exceeds 350 KB")
        total += size
        print(f"{filename:>8}  {size:>7,} bytes  {dims[0]}x{dims[1]}  quality={quality}")

    images = sorted(OUT.glob("*.webp"))
    assert len(images) == PRODUCT_COUNT, f"Expected {PRODUCT_COUNT} optimized images"
    assert all(0 < item.stat().st_size <= MAX_BYTES for item in images)
    assert not list(OUT.glob("[0-9]*.png")), "Original heavy PNGs must not enter public deployment"
    print(f"PASS: {len(images)} WebP product files, {total:,} bytes total, no original PNG products in deployment")


if __name__ == "__main__":
    main()
