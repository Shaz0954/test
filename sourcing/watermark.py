#!/usr/bin/env python3
"""Stamp the German Auto Mods logo onto product photos.

    python3 watermark.py                     # input/ -> watermarked/
    python3 watermark.py photos/ out/        # custom folders
    python3 watermark.py --position center --scale 0.45 --opacity 0.25

The logo is placed in a corner (bottom-right by default). On dark photo
areas it is laid on transparently; on light areas it sits on a black
rounded badge so the white lettering stays readable.
"""
import argparse
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageOps, ImageStat

HERE = Path(__file__).resolve().parent
LOGO = HERE / "brand" / "GAM_Logo.png"
EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def load_logo():
    """Return (transparent logo, alpha mask), cropped to the artwork."""
    rgb = Image.open(LOGO).convert("RGB")
    r, g, b = rgb.split()
    # The logo sits on black, so brightness doubles as the alpha channel.
    alpha = ImageChops.lighter(ImageChops.lighter(r, g), b).point(
        lambda v: min(255, int(v * 1.6))
    )
    box = alpha.point(lambda v: 255 if v > 40 else 0).getbbox()
    rgba = rgb.convert("RGBA")
    rgba.putalpha(alpha)
    return rgba.crop(box)


def fade(img, opacity):
    out = img.copy()
    out.putalpha(out.getchannel("A").point(lambda v: int(v * opacity)))
    return out


def stamp(photo, logo, position, scale, opacity, margin):
    photo = ImageOps.exif_transpose(photo).convert("RGBA")
    w, h = photo.size
    lw = max(60, int(min(w, h) * scale))
    lh = int(lw * logo.height / logo.width)
    mark = logo.resize((lw, lh), Image.LANCZOS)
    pad = int(lw * 0.12)
    m = int(min(w, h) * margin)
    bw, bh = lw + 2 * pad, lh + 2 * pad

    if position == "center":
        x, y = (w - bw) // 2, (h - bh) // 2
    else:
        x = m if "left" in position else w - bw - m
        y = m if "top" in position else h - bh - m

    layer = Image.new("RGBA", photo.size, (0, 0, 0, 0))
    region = photo.crop((x, y, x + bw, y + bh)).convert("L")
    if position != "center" and ImageStat.Stat(region).extrema[0][1] > 60:
        badge = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
        ImageDraw.Draw(badge).rounded_rectangle(
            (0, 0, bw - 1, bh - 1), radius=int(bw * 0.12), fill=(0, 0, 0, 255)
        )
        layer.alpha_composite(fade(badge, opacity), (x, y))
    layer.alpha_composite(fade(mark, opacity), (x + pad, y + pad))
    return Image.alpha_composite(photo, layer)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("src", nargs="?", default=HERE / "input", type=Path)
    ap.add_argument("dst", nargs="?", default=HERE / "watermarked", type=Path)
    ap.add_argument("--position", default="bottom-right",
                    choices=["bottom-right", "bottom-left", "top-right", "top-left", "center"])
    ap.add_argument("--scale", type=float, default=0.20, help="logo width as a share of the shorter side")
    ap.add_argument("--opacity", type=float, default=0.92)
    ap.add_argument("--margin", type=float, default=0.03)
    ap.add_argument("--max-side", type=int, default=2048, help="downscale larger photos (Shopify-friendly)")
    args = ap.parse_args()

    logo = load_logo()
    args.dst.mkdir(parents=True, exist_ok=True)
    files = sorted(p for p in args.src.iterdir() if p.suffix.lower() in EXTS)
    for p in files:
        im = Image.open(p)
        im.thumbnail((args.max_side, args.max_side), Image.LANCZOS)
        out = stamp(im, logo, args.position, args.scale, args.opacity, args.margin)
        flat = Image.new("RGB", out.size, (255, 255, 255))
        flat.paste(out, mask=out.getchannel("A"))
        target = args.dst / f"{p.stem}-gam.jpg"
        flat.save(target, "JPEG", quality=90, optimize=True)
        print(f"{p.name} -> {target.name}")
    print(f"{len(files)} image(s) watermarked into {args.dst}")


if __name__ == "__main__":
    main()
