#!/usr/bin/env python3
"""Optional PIL placeholder for assets/ui/ui_garden_main_multi_pet.png.

The canonical reference in the repo is the pixel-art PNG aligned with
ui_garden_main.png. Use this script only to regenerate a simple layout mockup;
it does not replace the hand-authored design reference unless you explicitly
overwrite the asset.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1280, 720

# Palette aligned with doc/UI design tokens (approx)
SKY_TOP = (166, 219, 235)
SKY_BOT = (198, 238, 248)
GRASS_TOP = (168, 219, 136)
GRASS_BOT = (142, 200, 111)
PANEL = (245, 236, 215)
BORDER = (92, 64, 51)
TEXT = (61, 41, 20)
MUTED = (107, 91, 77)
PRIMARY = (123, 201, 111)
SELF_BADGE = (255, 215, 106)
OTHER_BADGE = (143, 183, 255)
WHITE = (255, 255, 255)


def try_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for name in (
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        p = Path(name)
        if p.exists():
            try:
                return ImageFont.truetype(str(p), size)
            except OSError:
                continue
    return ImageFont.load_default()


def draw_round_rect(
    dr: ImageDraw.ImageDraw,
    xy: tuple[int, int, int, int],
    fill: tuple[int, int, int],
    outline: tuple[int, int, int],
    width: int = 3,
    radius: int = 8,
) -> None:
    x0, y0, x1, y1 = xy
    dr.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill, outline=outline, width=width)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    out = root / "assets" / "ui" / "ui_garden_main_multi_pet.png"

    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):
        t = y / max(H - 1, 1)
        if y < int(H * 0.42):
            t2 = y / max(int(H * 0.42) - 1, 1)
            r = int(SKY_TOP[0] + (SKY_BOT[0] - SKY_TOP[0]) * t2)
            g = int(SKY_TOP[1] + (SKY_BOT[1] - SKY_TOP[1]) * t2)
            b = int(SKY_TOP[2] + (SKY_BOT[2] - SKY_TOP[2]) * t2)
        else:
            yg = y - int(H * 0.42)
            hg = H - int(H * 0.42)
            t2 = yg / max(hg - 1, 1)
            r = int(GRASS_TOP[0] + (GRASS_BOT[0] - GRASS_TOP[0]) * t2)
            g = int(GRASS_TOP[1] + (GRASS_BOT[1] - GRASS_TOP[1]) * t2)
            b = int(GRASS_TOP[2] + (GRASS_BOT[2] - GRASS_TOP[2]) * t2)
        for x in range(W):
            px[x, y] = (r, g, b)

    dr = ImageDraw.Draw(img)
    font_title = try_font(22)
    font_sm = try_font(15)
    font_xs = try_font(13)
    font_btn = try_font(14)

    # Simple house (pixel-ish blocks)
    hx0, hy0 = 520, 200
    dr.rectangle([hx0, hy0 + 40, hx0 + 200, hy0 + 140], fill=(240, 226, 200), outline=BORDER, width=3)
    dr.polygon(
        [(hx0 - 10, hy0 + 40), (hx0 + 100, hy0 - 5), (hx0 + 210, hy0 + 40)],
        fill=(204, 93, 83),
        outline=BORDER,
        width=3,
    )
    dr.rectangle([hx0 + 75, hy0 + 90, hx0 + 125, hy0 + 140], fill=(156, 106, 78), outline=BORDER, width=2)

    # Path
    dr.ellipse([200, 420, 520, 520], fill=(218, 182, 132), outline=BORDER, width=2)

    # Flowers
    for fx, fy, col in [(120, 480, (224, 122, 159)), (180, 510, (242, 178, 107)), (900, 500, (164, 125, 220))]:
        dr.ellipse([fx - 8, fy - 8, fx + 8, fy + 8], fill=col, outline=BORDER, width=1)
        dr.ellipse([fx - 3, fy - 3, fx + 3, fy + 3], fill=(247, 242, 216))

    def draw_pet(cx: int, cy: int, tint: tuple[int, int, int]) -> None:
        dr.ellipse([cx - 20, cy + 14, cx + 20, cy + 24], fill=(55, 48, 40))
        dr.ellipse([cx - 24, cy - 18, cx + 24, cy + 18], fill=tint, outline=BORDER, width=2)
        dr.polygon([(cx - 16, cy - 10), (cx - 8, cy - 28), (cx, cy - 12)], fill=tint, outline=BORDER, width=1)
        dr.polygon([(cx + 4, cy - 10), (cx + 14, cy - 28), (cx + 18, cy - 12)], fill=tint, outline=BORDER, width=1)
        dr.ellipse([cx - 10, cy - 4, cx - 4, cy + 2], fill=(61, 41, 20))
        dr.ellipse([cx + 4, cy - 4, cx + 10, cy + 2], fill=(61, 41, 20))

    # Three pets: self center-left, others
    draw_pet(340, 380, (242, 178, 107))  # self orange cat
    draw_pet(720, 420, (200, 200, 220))  # other (tinted cool)
    draw_pet(880, 360, (200, 200, 220))

    def nameplate(px: int, py: int, text: str, is_self: bool) -> None:
        badge = SELF_BADGE if is_self else OTHER_BADGE
        tw, th = dr.textbbox((0, 0), text, font=font_xs)[2:4]
        pad_x, pad_y = 8, 4
        bw = tw + pad_x * 2 + 18
        bh = th + pad_y * 2
        x0, y0 = int(px - bw / 2), py - bh - 36
        draw_round_rect(dr, (x0, y0, x0 + bw, y0 + bh), PANEL, BORDER, 2, 6)
        dr.rectangle([x0 + 4, y0 + 4, x0 + 16, y0 + bh - 4], fill=badge, outline=BORDER, width=1)
        star = "★" if is_self else "●"
        dr.text((x0 + 6, y0 + 2), star, fill=TEXT, font=font_xs)
        dr.text((x0 + 20, y0 + pad_y), text, fill=TEXT, font=font_xs)

    nameplate(340, 380, "咪咪（你）", True)
    nameplate(720, 420, "豆豆（花园玩家B）", False)
    nameplate(880, 360, "球球（花园玩家C）", False)

    # Remote pointers
    for px, py, label in [(580, 320, "B"), (420, 440, "C")]:
        dr.polygon([(px, py), (px + 14, py + 22), (px - 6, py + 18)], fill=(224, 122, 95), outline=BORDER, width=2)
        dr.text((px + 18, py + 4), label, fill=TEXT, font=font_xs)

    # Right HUD panel
    px0, py0 = W - 300, 16
    draw_round_rect(dr, (px0, py0, W - 16, H - 16), PANEL, BORDER, 3, 10)
    dr.text((px0 + 16, py0 + 14), "小屋里的电子宠物", fill=TEXT, font=font_title)
    dr.text((px0 + 16, py0 + 48), "游戏时间：第 15 天 · 8.25 时", fill=MUTED, font=font_xs)
    dr.text((px0 + 16, py0 + 68), "昵称 · 金币 100", fill=MUTED, font=font_xs)

    y = py0 + 100
    for lab, pct, col in [("饱腹", 62, (123, 201, 111)), ("健康", 78, (107, 154, 196)), ("情绪", 45, (224, 122, 159))]:
        dr.text((px0 + 16, y), lab, fill=TEXT, font=font_sm)
        bar_x0, bar_y = px0 + 56, y + 2
        dr.rounded_rectangle([bar_x0, bar_y, bar_x0 + 200, bar_y + 14], radius=4, outline=BORDER, width=2)
        dr.rounded_rectangle(
            [bar_x0 + 2, bar_y + 2, bar_x0 + 2 + int(196 * pct / 100), bar_y + 12],
            radius=3,
            fill=col,
        )
        dr.text((bar_x0 + 208, y), str(pct), fill=TEXT, font=font_sm)
        y += 32

    dr.text((px0 + 16, y + 8), "成长阶段 0 · 稳定度 0.55", fill=MUTED, font=font_xs)
    y += 36
    dr.text((px0 + 16, y), "活动", fill=TEXT, font=font_sm)
    y += 26
    draw_round_rect(dr, (px0 + 12, y, W - 28, y + 72), WHITE, BORDER, 2, 6)
    dr.text((px0 + 22, y + 10), "每日互动任务", fill=TEXT, font=font_xs)
    dr.text((px0 + 22, y + 32), "摸头 2/5 · 建议：先完成每日再购物", fill=MUTED, font=font_xs)

    y += 88
    for bx, label in [(0, "喂食"), (92, "抱抱"), (184, "摸头")]:
        bx0 = px0 + 16 + bx
        draw_round_rect(dr, (bx0, y, bx0 + 80, y + 36), PRIMARY, BORDER, 2, 8)
        dr.text((bx0 + 22, y + 9), label, fill=TEXT, font=font_btn)

    y += 52
    dr.text((px0 + 16, y), "多人同屏：可见他人宠物与指针（参考稿）", fill=MUTED, font=font_xs)

    # Footer note on canvas
    dr.text((24, H - 28), "ui_garden_main_multi_pet — 多宠物社交花园主界面参考", fill=MUTED, font=font_xs)

    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "PNG", optimize=True)
    print(out)


if __name__ == "__main__":
    main()
