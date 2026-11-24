#!/usr/bin/env python3
"""Produce the GitHub Pages deployment, converting uploaded product PNGs to <=350KB WebP."""
from __future__ import annotations
import io
import shutil
from pathlib import Path
from PIL import Image, ImageOps
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"_site"
MAX_BYTES=350_000
EDGES=(1400,1280,1160,1040,940,840,740,640,550,460)
QUALITIES=(86,82,78,74,70,64,58,52,46,40,32,24)
def make_webp(source,target):
    with Image.open(source) as im:
        oriented=ImageOps.exif_transpose(im)
        image=oriented.convert("RGBA" if "A" in oriented.getbands() else "RGB")
    for edge in EDGES:
        variant=image.copy()
        variant.thumbnail((edge,edge),Image.Resampling.LANCZOS)
        for quality in QUALITIES:
            out=io.BytesIO()
            variant.save(out,"WEBP",quality=quality,method=6,exact=True)
            if out.tell()<=MAX_BYTES:
                target.write_bytes(out.getvalue())
                return out.tell()
    raise RuntimeError(f"{source.name} could not be compressed below {MAX_BYTES} bytes")
def main():
    if OUT.exists():shutil.rmtree(OUT)
    OUT.mkdir()
    for file in ("index.html","about.html","products.html","contact.html","admin.html",
                 "404.html","robots.txt","sitemap.xml","kimora iq.png","CNAME",".nojekyll"):
        path=ROOT/file
        if not path.is_file():raise FileNotFoundError(str(path))
        shutil.copy2(path,OUT/file)
    for folder in ("about","products","contact","admin"):
        source=ROOT/folder
        if not (source/"index.html").is_file():raise FileNotFoundError(str(source/"index.html"))
        shutil.copytree(source,OUT/folder)
    shutil.copytree(ROOT/"assets",OUT/"assets")
    catalog=(OUT/"products"/"index.html").read_text(encoding="utf-8")
    total=0
    for number in range(1,31):
        file=f"{number}.webp"
        if f'src="/{file}"' not in catalog:raise RuntimeError(f"Missing {file} gallery entry")
        size=make_webp(ROOT/f"{number}.png",OUT/file)
        assert 0<size<=MAX_BYTES
        total+=size
        print(f"IMAGE {file} = {size:,} bytes")
    assert len(list(OUT.glob("*.webp")))==30
    assert not list(OUT.glob("[0-9]*.png"))
    print(f"PASS 30 optimized product images, total {total:,} bytes; clean URLs available")
if __name__=="__main__":main()
