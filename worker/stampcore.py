import hashlib, io, random, json
from pathlib import Path
from PIL import Image, ImageOps
import imagehash
from trustmark import TrustMark

_tm = TrustMark(verbose=False, model_type='Q', encoding_type=TrustMark.Encoding.BCH_SUPER)
MAX_HAM = 7   # 8 bands -> any distance <= 7 is guaranteed to share a band

def _band_keys(h):
    bits = h.hash.flatten().astype(int)
    return [f"{int(''.join(map(str, bits[i*8:(i+1)*8])), 2):02x}" for i in range(8)]

def uncrops(img):
    """The image as given, then padded back out as if a 10-30% crop had been taken from the center or a corner."""
    yield img
    w, h = img.size
    for keep in (0.9, 0.8, 0.7):
        W, H = int(w / keep), int(h / keep)
        for ax, ay in ((0.5, 0.5), (0, 0), (1, 0), (0, 1), (1, 1)):
            x, y = int((W - w) * ax), int((H - h) * ay)
            yield ImageOps.expand(img, border=(x, y, W - w - x, H - h - y), fill=(128, 128, 128))

def decode_stamp(img, crops=True):
    """40-bit stamp id as an int, or None."""
    for candidate in (uncrops(img) if crops else [img]):
        secret, present, _ = _tm.decode(candidate, MODE='binary')
        if present and len(secret) == 40:
            return int(secret, 2)
    return None

def stamp_image(img, stamp_id, strength=1.0):
    """Hide a 40-bit ID in the image. Returns (stamped image, record to register)."""
    img = img.convert('RGB')
    stamped = _tm.encode(img, format(stamp_id, '040b'), MODE='binary', WM_STRENGTH=strength).convert('RGB')
    buf = io.BytesIO(); stamped.save(buf, 'PNG')
    h = imagehash.phash(stamped)
    record = {'stampId': stamp_id,
              'contentHash': hashlib.sha256(buf.getvalue()).hexdigest(),
              'phash': str(h), 'bands': _band_keys(h)}
    return stamped, record

def verify_image(img, registry, use_watermark=True):
    """registry: dict of stampId -> record. Later this becomes the Envio GraphQL query."""
    img = img.convert('RGB')
    if use_watermark:                                   # Tier A
        sid = decode_stamp(img)
        if sid is not None and sid in registry:
            return {'tier': 'A', 'stampId': sid, 'label': 'Stamped: registry match'}
    h = imagehash.phash(img)                            # Tier B
    keys = _band_keys(h)
    cands = [r for r in registry.values() if any(a == b for a, b in zip(keys, r['bands']))]
    scored = [(h - imagehash.hex_to_hash(r['phash']), r) for r in cands]
    if scored:
        d, best = min(scored, key=lambda x: x[0])
        if d <= MAX_HAM:
            return {'tier': 'B', 'stampId': best['stampId'], 'distance': d,
                    'label': 'Likely derived from stamped work'}
    return {'tier': None, 'label': 'No record found'}   # never "authentic"

if __name__ == '__main__':
    def load(p):
        im = Image.open(p).convert('RGB'); im.thumbnail((1024, 1024)); return im
    def jpeg(im, q):
        buf = io.BytesIO(); im.save(buf, 'JPEG', quality=q); buf.seek(0)
        return Image.open(buf).convert('RGB')
    def crop20(im):
        w, h = im.size
        return im.crop((int(w*.1), int(h*.1), w - int(w*.1), h - int(h*.1)))

    paths = sorted(Path('imgs').glob('*.*'))
    stamped, rec = stamp_image(load(paths[0]), random.getrandbits(40))
    registry = {rec['stampId']: rec}
    Path('registry.json').write_text(json.dumps(list(registry.values()), indent=2))
    half = stamped.resize((stamped.width // 2, stamped.height // 2))

    print('--- full verify (watermark + pHash) ---')
    for name, im in {'untouched': stamped, 'JPEG q40': jpeg(stamped, 40),
                     'crop 20%': crop20(stamped), 'unrelated image': load(paths[1])}.items():
        print(f'{name:<18}', verify_image(im, registry))

    print('--- watermark switched off (tests Tier B only) ---')
    for name, im in {'resize 50%': half, 'JPEG q40': jpeg(stamped, 40),
                     'crop 20%': crop20(stamped)}.items():
        print(f'{name:<18}', verify_image(im, registry, use_watermark=False))