"""Watermark survival under crops and re-encodes, with and without crop recovery.

Put test images in imgs/ (not committed), then: python worker/crop_test.py
"""
import io, random
from pathlib import Path
from PIL import Image, ImageFilter
from stampcore import _tm, decode_stamp


def jpeg(im, q):
    buf = io.BytesIO(); im.save(buf, 'JPEG', quality=q); buf.seek(0)
    return Image.open(buf).convert('RGB')


def crop(im, keep=0.8, ax=0.5, ay=0.5):
    w, h = im.size
    cw, ch = int(w * keep), int(h * keep)
    x, y = int((w - cw) * ax), int((h - ch) * ay)
    return im.crop((x, y, x + cw, y + ch))


def screenshot(im):
    s = im.resize((int(im.width * .75), int(im.height * .75)), Image.BILINEAR)
    return jpeg(s.filter(ImageFilter.GaussianBlur(1)), 70)


ATTACKS = {
    'jpeg q40': lambda im: jpeg(im, 40),
    'resize 50%': lambda im: im.resize((im.width // 2, im.height // 2), Image.LANCZOS),
    'crop 20%': crop,
    'crop 20% corner': lambda im: crop(im, 0.8, 0, 0),
    'crop 35%': lambda im: crop(im, 0.65),
    'screenshot': screenshot,
    'crop 20% + jpeg q40': lambda im: jpeg(crop(im), 40),
    'resize + crop + jpeg': lambda im: jpeg(crop(im.resize((im.width // 2, im.height // 2))), 40),
}

paths = sorted(Path('imgs').glob('*.*'))
assert paths, 'put test images in imgs/'
hits = {name: [0, 0] for name in ATTACKS}
for p in paths:
    cover = Image.open(p).convert('RGB'); cover.thumbnail((1024, 1024))
    sid = random.getrandbits(40)
    stamped = _tm.encode(cover, format(sid, '040b'), MODE='binary').convert('RGB')
    for name, fn in ATTACKS.items():
        attacked = fn(stamped)
        hits[name][0] += int(decode_stamp(attacked, crops=False) == sid)
        hits[name][1] += int(decode_stamp(attacked) == sid)

n = len(paths)
print(f"{'attack':<22}as given  with crop recovery")
for name, (plain, robust) in hits.items():
    print(f'{name:<22}{plain}/{n}      {robust}/{n}')
    assert robust >= plain, f'crop recovery lost a stamp on {name}'
false = sum(decode_stamp(Image.open(p).convert('RGB')) is not None for p in paths)
print(f'unstamped images reporting a stamp: {false}/{n}')
assert false == 0
