#!/usr/bin/env python3
"""MoveCrew's icons, made from one picture: design/movecrew-icon.png (Richie's icon, Nov 6, 1254 x 1254).

    python3 scripts/make_icons.py

Writes:
- web/icons/icon-192.png, icon-512.png: the picture as it is (the website, the installed web app, and the
  Windows app, whose icon scripts/prepare_windows.py takes from icon-512.png).
- web/icons/icon-512-maskable.png: the picture smaller on its own dark colour, so a phone that cuts the icon to a
  circle keeps the name whole (the safe zone is the middle circle, 80% across).
- android/app/src/main/res/mipmap-*/ic_launcher_foreground.png: the phone app's adaptive icon (108 dp, of which the
  launcher shows the middle 72 cut to its shape: a squircle on Samsung, a circle on a Pixel). The picture fills 64% of
  it, so on a squircle its glowing frame shows whole, and on a circle MOVECREW does. The background layer is the
  colour tally_icon_bg (themes.xml), the picture's own dark corner colour.
- android/.../mipmap-*/ic_launcher.png and ic_launcher_round.png: the old square and round icons (Android before 8,
  which MoveCrew doesn't run on; kept so the names resolve).
Needs Pillow.
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'design', 'movecrew-icon.png')
BG = (8, 13, 19, 255)          # the picture's corner colour, #080D13 (tally_icon_bg)
ADAPTIVE = 0.64                # share of the 108 dp canvas the picture fills
MASKABLE = 0.76                # share of the maskable icon the picture fills

src = Image.open(SRC).convert('RGBA')


def fit(size, scale):
    canvas = Image.new('RGBA', (size, size), BG)
    s = round(size * scale)
    canvas.alpha_composite(src.resize((s, s), Image.LANCZOS), ((size - s) // 2, (size - s) // 2))
    return canvas


def save(img, *parts):
    path = os.path.join(ROOT, *parts)
    img.save(path, optimize=True)
    print('wrote', os.path.relpath(path, ROOT), img.size)


# the website and the installed web app
for n in (192, 512):
    save(src.resize((n, n), Image.LANCZOS).convert('RGB'), 'web', 'icons', 'icon-%d.png' % n)
save(fit(512, MASKABLE).convert('RGB'), 'web', 'icons', 'icon-512-maskable.png')

# the phone app
RES = os.path.join('android', 'app', 'src', 'main', 'res')
for folder, scale in (('mdpi', 1), ('hdpi', 1.5), ('xhdpi', 2), ('xxhdpi', 3), ('xxxhdpi', 4)):
    d = 'mipmap-' + folder
    fg = Image.new('RGBA', (round(108 * scale),) * 2, (0, 0, 0, 0))
    s = round(108 * scale * ADAPTIVE)
    fg.alpha_composite(src.resize((s, s), Image.LANCZOS), ((fg.size[0] - s) // 2,) * 2)
    save(fg, RES, d, 'ic_launcher_foreground.png')
    n = round(48 * scale)
    square = src.resize((n, n), Image.LANCZOS)
    save(square, RES, d, 'ic_launcher.png')
    mask = Image.new('L', (n, n), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, n - 1, n - 1), fill=255)
    round_icon = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    round_icon.paste(fit(n, 0.92), (0, 0), mask)
    save(round_icon, RES, d, 'ic_launcher_round.png')
