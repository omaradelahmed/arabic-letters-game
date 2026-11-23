"""توليد أيقونات اللعبة (PWA) — تشغيل:

    python tools/make_icons.py

المخرجات في مجلد icons/: 192, 512, maskable 512, apple-touch 180.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "icons"
OUT.mkdir(exist_ok=True)

S = 1024  # نرسم بحجم كبير ثم نصغّر (أنعم)

SKY_TOP = (150, 216, 255)
SKY_BOT = (47, 156, 240)
AMBER = (255, 206, 84)
AMBER_EDGE = (255, 183, 3)
NAVY = (18, 58, 86)
GREEN = (47, 191, 113)
WHITE = (255, 255, 255)

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\arialbd.ttf",
    r"C:\Windows\Fonts\tahomabd.ttf",
    r"C:\Windows\Fonts\segoeuib.ttf",
]


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def sky_background() -> Image.Image:
    img = Image.new("RGB", (S, S), SKY_BOT)
    draw = ImageDraw.Draw(img)
    for y in range(S):
        t = y / (S - 1)
        color = tuple(round(SKY_TOP[i] + (SKY_BOT[i] - SKY_TOP[i]) * t) for i in range(3))
        draw.line([(0, y), (S, y)], fill=color)
    return img


def rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def draw_content(scale: float = 1.0) -> Image.Image:
    """الرسم الأساسي على خلفية شفافة، مع إمكانية تصغيره للـ maskable."""
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    cx, cy = S // 2, S // 2 - 18
    r = 322

    # هالة بيضاء
    draw.ellipse([cx - r - 30, cy - r - 30, cx + r + 30, cy + r + 30], fill=WHITE)

    # دايرة العلامة
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=AMBER)
    draw.ellipse(
        [cx - r, cy - r, cx + r, cy + r],
        outline=AMBER_EDGE,
        width=18,
    )

    # الحرف
    font = load_font(560)
    glyph = "ح"
    box = draw.textbbox((0, 0), glyph, font=font)
    gw, gh = box[2] - box[0], box[3] - box[1]
    draw.text(
        (cx - gw / 2 - box[0], cy - gh / 2 - box[1] - 10),
        glyph,
        font=font,
        fill=NAVY,
    )

    # شارة صح خضراء
    bx, by, br = 786, 792, 132
    draw.ellipse([bx - br, by - br, bx + br, by + br], fill=WHITE)
    draw.ellipse([bx - br + 16, by - br + 16, bx + br - 16, by + br - 16], fill=GREEN)
    draw.line(
        [(bx - 58, by + 4), (bx - 14, by + 52), (bx + 66, by - 46)],
        fill=WHITE,
        width=30,
        joint="curve",
    )

    if scale != 1.0:
        inner = round(S * scale)
        layer = layer.resize((inner, inner), Image.LANCZOS)
        canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        off = (S - inner) // 2
        canvas.alpha_composite(layer, (off, off))
        layer = canvas

    return layer


def save(name: str, size: int, *, scale: float = 1.0, opaque: bool = True, radius: int = 0) -> None:
    base = sky_background().convert("RGBA")
    base.alpha_composite(draw_content(scale))
    img = base.convert("RGB").resize((size, size), Image.LANCZOS).convert("RGBA")

    if radius:
        img.putalpha(rounded_mask(size, radius))

    target = OUT / name
    img.save(target, format="PNG", optimize=True)
    print(f"{target.name}: {size}x{size}")


if __name__ == "__main__":
    save("icon-192.png", 192, radius=40)
    save("icon-512.png", 512, radius=104)
    save("icon-maskable-512.png", 512, scale=0.82)
    save("apple-touch-icon.png", 180, radius=0)
    save("favicon-32.png", 32, radius=6)
