#!/usr/bin/env python3
"""Shrink oversized photos in place, so pages load fast.

Run by the deploy workflow (.github/workflows/hugo.yml) before every build;
it commits whatever it changed back to main. Can also be run by hand:

    python3 scripts/shrink-images.py [folder ...]    # default: content

A JPEG or PNG is shrunk when its long edge is over MAX_EDGE pixels or the file
is over MAX_BYTES. It is resized to MAX_EDGE on the long edge, turned upright
(EXIF rotation baked in), stripped of metadata (camera, GPS) but not of its
colour profile, and saved under the same name, so Markdown links still work.
The result is kept only if it is smaller than the original.
"""
import io
import sys
from pathlib import Path

from PIL import Image, ImageOps

MAX_EDGE = 2000
MAX_BYTES = 1_500_000
JPEG_QUALITY = 82


def shrink(path):
    size = path.stat().st_size
    with Image.open(path) as im:
        if max(im.size) <= MAX_EDGE and size <= MAX_BYTES:
            return None
        fmt = im.format
        icc = im.info.get("icc_profile")
        im = ImageOps.exif_transpose(im)
        im.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)

    out = io.BytesIO()
    if fmt == "JPEG":
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        im.save(out, "JPEG", quality=JPEG_QUALITY, optimize=True,
                progressive=True, icc_profile=icc)
    else:
        im.save(out, "PNG", optimize=True, icc_profile=icc)

    if out.tell() >= size:
        return None
    path.write_bytes(out.getvalue())
    return size, out.tell(), im.size


def main(folders):
    total_before = total_after = 0
    for folder in folders:
        for path in sorted(Path(folder).rglob("*")):
            if path.suffix.lower() not in (".jpg", ".jpeg", ".png") or not path.is_file():
                continue
            try:
                result = shrink(path)
            except Exception as e:  # a bad file shouldn't stop the deploy
                print(f"  skipped  {path}: {e}")
                continue
            if result:
                before, after, (w, h) = result
                total_before += before
                total_after += after
                print(f"  shrunk   {path}: {before / 1e6:.1f} MB -> {after / 1e6:.2f} MB ({w}x{h})")
    if total_before:
        print(f"Saved {(total_before - total_after) / 1e6:.1f} MB.")
    else:
        print("No oversized photos.")


if __name__ == "__main__":
    main(sys.argv[1:] or ["content"])
