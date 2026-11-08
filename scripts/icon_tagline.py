"""Put new words under MOVECREW on Richie's picture, in the picture's own style (Nov 7: Book ◆ Move ◆ Relax).

    python3 scripts/icon_tagline.py "Book,Move,Relax"      then      python3 scripts/make_icons.py
    (options: --src design/movecrew-icon-original.png --out design/movecrew-icon.png --font design/fonts/Montserrat-VF.ttf)

Richie's original (design/movecrew-icon-original.png, 1254 x 1254, kept as he sent it) says PEOPLE ◆ TRUCKS ◆
SOLUTIONS between the blue line and the bottom of the frame. This paints that band over from the dark background
around it, then sets the new words in Montserrat (design/fonts, SIL Open Font License: wide-spaced capitals, white at
the top shading to steel blue with a bright blue rim at the foot, a crisp shadow down and right) with the picture's cyan
diamonds between them, centred where the old words were. Up to the old line's width; longer lines close up, and a
line that still won't fit is refused. The loading screen's words (web/index.html, .sp-tag) are set by hand to match.
Needs Pillow, numpy and OpenCV (pip install pillow numpy opencv-python-headless).
"""
import argparse
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# where the old words are on the 1254 px original (measured: caps 1046-1071, words from x 199 to 1039)
BAND = (180, 1038, 1060, 1090)        # x0, y0, x1, y1: the band the old lettering and its shadow sit in
TEXT_X = (192, 1050)                  # the lettering's own columns (the frame curves in beyond them)
CAP_TOP, CAP_BOT = 1046, 1071         # the capitals' top and foot
CENTRE_X = 619                        # the old line's middle
TRACK = 5.5                           # px added between letters (the old line's spacing)
GAP = 40                              # px between a word and a diamond
MAX_W = 846                           # the old line's width (199 to 1039), with a few px to spare
DIAMOND = 27                          # the diamond's width and height
SS = 4                                # drawn 4x, then scaled down
WEIGHT = 560                          # between Medium and SemiBold: the old letters' widths and stems

# the letters' shading, top (0) to foot (1), read off the old capitals
FILL = [(0.00, (255, 255, 255)), (0.16, (251, 253, 255)), (0.32, (233, 237, 245)), (0.48, (190, 198, 212)),
        (0.64, (156, 170, 191)), (0.80, (128, 152, 182)), (0.88, (114, 146, 184)), (0.93, (100, 150, 200)),
        (1.00, (88, 172, 232))]
# the diamonds: light cyan at the top to deep blue, with a lit tip at the foot
DFILL = [(0.00, (60, 252, 255)), (0.18, (12, 236, 246)), (0.50, (0, 190, 253)), (0.80, (0, 157, 248)),
         (0.92, (0, 170, 250)), (1.00, (0, 225, 255))]


def ramp(stops, n):
    """an n x 3 colour ramp through the stops"""
    out = np.zeros((n, 3), np.float32)
    ts = np.linspace(0, 1, n)
    for k in range(3):
        out[:, k] = np.interp(ts, [s[0] for s in stops], [s[1][k] for s in stops])
    return out


def clear_band(img):
    """paint the old words out. The band's dark background is modelled from the pixels clear of any lettering (each
    row's colour plus each column's lean), and the lettering, its shadow and glow are filled from that model with the
    background's own grain copied in from beside each letter, so no smooth patch shows where a letter was."""
    a = np.asarray(img).astype(np.float32)
    x0, y0, x1, y1 = BAND
    sub = a[y0:y1, x0:x1]
    R, G, B = sub[..., 0], sub[..., 1], sub[..., 2]
    L = (R * 299 + G * 587 + B * 114) / 1000
    rowL = np.median(L, axis=1)[:, None]
    ink = (L > rowL + 9) | ((B - R > 45) & (G > 40)) | (L < rowL - 3)
    xs = np.broadcast_to(np.arange(x0, x1)[None, :], L.shape)
    ink &= (xs >= TEXT_X[0]) & (xs <= TEXT_X[1])            # never the frame's curves at the ends
    ink = ink.astype(np.uint8) * 255
    k = np.ones((3, 3), np.uint8)
    core = cv2.dilate(ink, k, iterations=2)
    near = cv2.dilate(core, k, iterations=4) > 0           # kept out of the model
    bgpix = ~near
    rows = np.zeros((sub.shape[0], 3), np.float32)
    for y in range(sub.shape[0]):
        m = bgpix[y]
        rows[y] = np.median(sub[y][m], axis=0) if m.sum() > 20 else np.nan
    for c in range(3):                                      # rows with too few clear pixels: from their neighbours
        ok = ~np.isnan(rows[:, c])
        rows[:, c] = np.interp(np.arange(len(rows)), np.where(ok)[0], rows[ok, c])
    resid = sub - rows[:, None, :]
    cols = np.zeros((sub.shape[1], 3), np.float32)
    for x in range(sub.shape[1]):
        m = bgpix[:, x]
        cols[x] = np.median(resid[:, x][m], axis=0) if m.sum() > 3 else np.nan
    for c in range(3):
        ok = ~np.isnan(cols[:, c])
        cols[:, c] = np.interp(np.arange(len(cols)), np.where(ok)[0], cols[ok, c])
        cols[:, c] = np.convolve(np.pad(cols[:, c], 12, mode='edge'), np.ones(25) / 25, mode='valid')
    model = rows[:, None, :] + cols[None, :, :]
    grain = sub - model                                     # the background's own grain, where it's clear
    # anything that stands out of the grain (the frame's curve near the ends) is neither copied nor painted over
    sig = 1.4826 * np.median(np.abs(grain[bgpix]), axis=0)
    struct = (np.abs(grain) > 4 * np.maximum(sig, 1.0)).any(axis=2) & bgpix
    struct = (cv2.dilate(struct.astype(np.uint8), k, iterations=1) > 0) & bgpix
    inside = (xs >= TEXT_X[0]) & (xs <= TEXT_X[1])
    source = bgpix & ~struct & inside
    fill = model.copy()
    for y in range(sub.shape[0]):
        clear = np.where(source[y])[0]
        if not len(clear):
            continue
        for x in np.where(~bgpix[y])[0]:
            # the clear pixel nearest to 40 px left (or right) of this one: a letter's width away, so it's background
            want = x - 40 if x - 40 >= clear[0] else x + 40
            j = clear[np.argmin(np.abs(clear - want))]
            fill[y, x] = model[y, x] + grain[y, j]
    # blend: the lettering itself fully replaced, a soft edge a few pixels out
    alpha = cv2.GaussianBlur(cv2.dilate(core, k, iterations=2).astype(np.float32) / 255, (0, 0), 1.5)
    alpha = np.maximum(alpha, core.astype(np.float32) / 255)
    alpha[struct] = 0
    alpha = alpha[..., None]
    out = a.copy()
    out[y0:y1, x0:x1] = np.clip(fill * alpha + sub * (1 - alpha), 0, 255)
    mask = np.zeros(a.shape[:2], np.uint8)
    mask[y0:y1, x0:x1] = core
    return Image.fromarray(np.round(out).astype(np.uint8)), mask


def font_at(path, px_cap):
    """Montserrat (weight WEIGHT) sized so its capitals are px_cap tall"""
    f = ImageFont.truetype(path, 400)
    f.set_variation_by_axes([WEIGHT])
    size = 400 * px_cap / ink_box(f, 'H')[3]
    f = ImageFont.truetype(path, int(round(size)))
    f.set_variation_by_axes([WEIGHT])
    return f


def ink_box(f, ch):
    """the drawn pixels of one letter: left, top (from the draw point), width, height"""
    w = int(f.size * 2)
    im = Image.new('L', (w, w), 0)
    ImageDraw.Draw(im).text((w // 4, w // 4), ch, font=f, fill=255)
    a = np.asarray(im) > 127
    xs, ys = np.where(a.any(0))[0], np.where(a.any(1))[0]
    return xs.min() - w // 4, ys.min() - w // 4, xs.max() - xs.min() + 1, ys.max() - ys.min() + 1


def layout(words, font, s, gap=GAP, track=TRACK):
    """each piece: ('w', text, x, width) or ('d', None, x, width), x from 0, all at scale s"""
    pieces, x = [], 0.0
    for i, w in enumerate(words):
        if i:
            x += gap * s
            pieces.append(('d', None, x, DIAMOND * s))
            x += DIAMOND * s + gap * s
        wx = x
        for j, ch in enumerate(w):
            if j:
                x += track * s
            x += font.getlength(ch)
        pieces.append(('w', w, wx, x - wx))
    return pieces, x


def fit(words, font, s):
    """the old line's spacing, closed up (the gaps round the diamonds first, then the letters) to keep a longer line
    within the old one's width"""
    gap, track = GAP, TRACK
    pieces, total = layout(words, font, s, gap, track)
    while total > MAX_W * s and gap > 28:
        gap -= 0.5
        pieces, total = layout(words, font, s, gap, track)
    while total > MAX_W * s and track > 3:
        track -= 0.25
        pieces, total = layout(words, font, s, gap, track)
    if total > MAX_W * s:
        sys.exit('those words are too long for the line under MOVECREW (%d px of %d); try shorter ones'
                 % (round(total / s), MAX_W))
    return pieces, total, track


def draw_line(img, words, font_path):
    words = [w.strip().upper() for w in words if w.strip()]
    s = SS
    cap = (CAP_BOT - CAP_TOP + 1) * s
    font = font_at(font_path, cap)
    pieces, total, track = fit(words, font, s)
    # the left edge of the line on the big canvas: centred on the old line's middle
    W, H = img.size[0] * s, (CAP_BOT - CAP_TOP + 40) * s
    oy = (CAP_TOP - 20) * s                       # canvas top, in big-picture pixels
    left = CENTRE_X * s - total / 2
    text = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(text)
    htop = ink_box(font, 'H')[1]
    for kind, w, x, wid in pieces:
        if kind != 'w':
            continue
        cx = left + x
        for j, ch in enumerate(w):
            d.text((cx, 20 * s - htop), ch, font=font, fill=255)
            cx += font.getlength(ch) + track * s
    dia = Image.new('L', (W, H), 0)
    dd = ImageDraw.Draw(dia)
    mid = 20 * s + cap / 2
    for kind, w, x, wid in pieces:
        if kind != 'd':
            continue
        cx, r = left + x + wid / 2, wid / 2
        dd.polygon([(cx, mid - r), (cx + r, mid), (cx, mid + r), (cx - r, mid)], fill=255)
    # shading
    ys = np.arange(H, dtype=np.float32)
    t = np.clip((ys - 20 * s) / cap, 0, 1)
    fill = ramp(FILL, 1024)[(t * 1023).astype(int)]
    td = np.clip((ys - (mid - DIAMOND * s / 2)) / (DIAMOND * s), 0, 1)
    dfill = ramp(DFILL, 1024)[(td * 1023).astype(int)]
    lay = np.zeros((H, W, 4), np.float32)
    ta = np.asarray(text, np.float32) / 255
    da = np.asarray(dia, np.float32) / 255
    lay[..., :3] = fill[:, None, :] * ta[..., None] + dfill[:, None, :] * da[..., None]
    lay[..., 3] = np.maximum(ta, da)
    # the crisp shadow: down 2 and right 2, nearly black
    sh = Image.fromarray(np.uint8(np.maximum(ta, da) * 255)).filter(ImageFilter.GaussianBlur(0.8 * s))
    sh = np.asarray(sh, np.float32) / 255
    sh = np.roll(np.roll(sh, 2 * s, axis=0), 2 * s, axis=1) * 0.92
    # a soft cyan glow round the diamonds
    glow = Image.fromarray(np.uint8(da * 255)).filter(ImageFilter.GaussianBlur(5 * s))
    glow = np.asarray(glow, np.float32) / 255 * 0.45
    base = np.zeros((H, W, 4), np.float32)
    # glow (cyan), then shadow (black), then the letters and diamonds
    glow_rgba = np.zeros((H, W, 4), np.float32)
    glow_rgba[..., 0], glow_rgba[..., 1], glow_rgba[..., 2], glow_rgba[..., 3] = 0, 175, 255, glow
    shadow_rgba = np.zeros((H, W, 4), np.float32)
    shadow_rgba[..., 3] = sh

    def over(dst, src):
        a = src[..., 3:4]
        out = dst.copy()
        out[..., :3] = src[..., :3] * a + dst[..., :3] * (1 - a)
        out[..., 3:4] = a + dst[..., 3:4] * (1 - a)
        return out
    # composite on the cleaned picture's band, scaled up
    band = img.crop((0, oy // s, img.size[0], oy // s + H // s)).resize((W, H), Image.BICUBIC)
    base[..., :3] = np.asarray(band, np.float32)
    base[..., 3] = 1
    out = over(over(over(base, glow_rgba), shadow_rgba), lay)
    small = Image.fromarray(np.uint8(np.clip(out[..., :3], 0, 255))).resize((img.size[0], H // s), Image.LANCZOS)
    res = img.copy()
    # only the band's rows change; blend them in through a mask of what was drawn (so nothing else moves)
    m = Image.fromarray(np.uint8(np.clip(np.maximum.reduce([lay[..., 3], sh, glow]) * 255, 0, 255)))
    m = m.filter(ImageFilter.MaxFilter(5)).resize((img.size[0], H // s), Image.LANCZOS)
    res.paste(small, (0, oy // s), m)
    return res, pieces, left / s, total / s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('words', help='the words, comma-separated, e.g. "Book,Pack,Move,Relax"')
    ap.add_argument('--src', default=os.path.join(ROOT, 'design', 'movecrew-icon-original.png'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'design', 'movecrew-icon.png'))
    ap.add_argument('--font', default=os.path.join(ROOT, 'design', 'fonts', 'Montserrat-VF.ttf'))
    a = ap.parse_args()
    img = Image.open(a.src).convert('RGB')
    assert img.size == (1254, 1254), 'expected the 1254 px original, got %r' % (img.size,)
    clean, _ = clear_band(img)
    out, pieces, left, total = draw_line(clean, a.words.split(','), a.font)
    out.save(a.out, optimize=True)
    print('wrote %s: %s (x %d to %d of 1254)' % (a.out, ' ◆ '.join(w.strip().upper() for w in a.words.split(',')),
                                                  round(left), round(left + total)))


if __name__ == '__main__':
    main()
