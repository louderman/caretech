"""Build a side-by-side comparison: native v1.5 reference vs RN web port.

One-off script for docs/reference. Not part of the app build.
"""
from PIL import Image, ImageDraw, ImageFont

NATIVE = "docs/reference/native-v1.5-reference.jpg"
WEB = "docs/reference/shots/web-journal-with-data-top-390x844.png"
OUT = "docs/reference/shots/side-by-side-native-vs-web.png"

LABEL_H = 36
GAP = 16

native = Image.open(NATIVE).convert("RGB")
web = Image.open(WEB).convert("RGB")

# Normalize both to the same height for a fair comparison.
target_h = max(native.height, web.height)


def scale_to_height(img, h):
    w = int(img.width * (h / img.height))
    return img.resize((w, h), Image.LANCZOS)


native_s = scale_to_height(native, target_h)
web_s = scale_to_height(web, target_h)

total_w = native_s.width + GAP + web_s.width
total_h = target_h + LABEL_H

canvas = Image.new("RGB", (total_w, total_h), "white")
draw = ImageDraw.Draw(canvas)

try:
    font = ImageFont.truetype(
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf", 20
    )
except Exception:
    font = ImageFont.load_default()

draw.text((8, 6), "Native v1.5 (Android)", fill="black", font=font)
draw.text((native_s.width + GAP + 8, 6), "RN/Expo web port", fill="black", font=font)

canvas.paste(native_s, (0, LABEL_H))
canvas.paste(web_s, (native_s.width + GAP, LABEL_H))

canvas.save(OUT)
print("wrote", OUT, canvas.size)
