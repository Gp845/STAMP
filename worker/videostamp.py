"""Fingerprint a video the same way as an image: a 40-bit TrustMark in the frames, plus pHash of sampled frames.

shortcut: the registry is worker/video-registry.json, not Envio. Upgrade when video stamps are written on Monad.
"""
import hashlib, json, re, shutil, subprocess, sys, tempfile
from collections import Counter
from pathlib import Path

import imagehash
from PIL import Image

from stampcore import MAX_HAM, decode_stamp, stamp_image

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = Path(__file__).with_name('video-registry.json')
# 2.0 kept the stamp through CRF 30, a 20% crop and a 50% downscale on every test clip; 1.0 lost it. Costs ~6 dB PSNR.
VIDEO_STRENGTH = 2.0
SAMPLED_FRAMES = 16

# Same ids the feed already shows.
CLIPS = {
    'neon-nights.mp4': {
        'stampId': '3fa72c91aa', 'model': 'Gemini Flash 2.0',
        'agent': '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        'creator': '0x1f9090aaE28b8a3dCeaDf281B0F12828e676c326',
        'txHash': '0xabc123', 'blockNumber': 4521000, 'timestamp': 1728370000,
    },
    'quantum-arch.mp4': {
        'stampId': 'c4a91f3b22', 'model': 'DALL-E 3',
        'agent': '0x4B0897b0513fdC7C541B6d9D7E929C4e5364D2dB',
        'creator': '0x3c5D7e9F1a2B4c6D8e0F1a3B5c7D9e1F2a4B6c8D',
        'txHash': '0xghi789', 'blockNumber': 4500000, 'timestamp': 1728210000,
    },
    'ethereal-forest.mp4': {
        'stampId': '9d2f1a8c01', 'model': 'Human',
        'agent': '0x0000000000000000000000000000000000000000',
        'creator': '0x9e8D7c6B5a4F3e2D1c0B9a8F7e6D5c4B3a2F1e0D',
        'txHash': '0xjkl012', 'blockNumber': 4490000, 'timestamp': 1728120000,
    },
    'chrome-samurai.mp4': {
        'stampId': 'a8b7c6d5e4', 'model': 'Stable Diffusion XL',
        'agent': '0xDFd5293D8e347dFe59E90eFd55b2956a1343963d',
        'creator': '0x1f9090aaE28b8a3dCeaDf281B0F12828e676c326',
        'txHash': '0xmno345', 'blockNumber': 4480000, 'timestamp': 1728030000,
    },
}


def ffmpeg():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def run(args):
    proc = subprocess.run(args, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr[-500:])


def probe(src):
    proc = subprocess.run([ffmpeg(), '-i', str(src)], capture_output=True, text=True)
    fps = re.search(r'(\d+(?:\.\d+)?) fps', proc.stderr)
    dur = re.search(r'Duration: (\d+):(\d+):(\d+(?:\.\d+)?)', proc.stderr)
    seconds = 0
    if dur:
        h, m, s = dur.groups()
        seconds = int(h) * 3600 + int(m) * 60 + float(s)
    return float(fps.group(1)) if fps else 24.0, seconds


def load_registry():
    if not REGISTRY.exists():
        return {}
    return json.loads(REGISTRY.read_text())


def save_registry(reg):
    REGISTRY.write_text(json.dumps(reg, indent=2))


def public_record(rec):
    return {k: rec[k] for k in (
        'id', 'stampId', 'contentHash', 'model', 'agent', 'creator', 'kind', 'timestamp', 'txHash', 'blockNumber',
    )}


def sample_frames(src, n=6):
    _, dur = probe(src)
    frames = []
    with tempfile.TemporaryDirectory() as tmp:
        for i in range(n):
            t = 0 if dur <= 0 else min(dur - 0.05, dur * (i + 0.5) / n)
            out = Path(tmp) / f's{i}.png'
            run([ffmpeg(), '-y', '-ss', f'{t:.3f}', '-i', str(src), '-frames:v', '1', str(out)])
            if out.exists():
                frames.append(Image.open(out).convert('RGB'))
    return frames


def stamp_file(src, stamp_id, meta):
    src = Path(src)
    fps, _ = probe(src)
    with tempfile.TemporaryDirectory() as tmp:
        frames = Path(tmp) / 'f'
        frames.mkdir()
        run([ffmpeg(), '-y', '-i', str(src), str(frames / 'f_%04d.png')])
        paths = sorted(frames.glob('f_*.png'))
        if not paths:
            raise RuntimeError(f'no frames in {src}')
        stored = []
        step = max(1, round(fps))
        for i, path in enumerate(paths):
            stamped, rec = stamp_image(Image.open(path), stamp_id, VIDEO_STRENGTH)
            stamped.save(path)
            if i % step == 0:
                stored.append(rec['phash'])
            if i % 24 == 0:
                print(f'{src.name} frame {i + 1}/{len(paths)}', file=sys.stderr)
        out = Path(tmp) / 'out.mp4'
        run([ffmpeg(), '-y', '-framerate', str(fps), '-start_number', '1', '-i', str(frames / 'f_%04d.png'),
             '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', str(out)])
        data = out.read_bytes()
        shutil.move(str(out), str(src))
    rec = {
        'id': meta['stampId'],
        'stampId': meta['stampId'],
        'contentHash': hashlib.sha256(data).hexdigest(),
        'model': meta['model'],
        'agent': meta['agent'],
        'creator': meta['creator'],
        'kind': 'ATTESTED',
        'timestamp': meta['timestamp'],
        'txHash': meta['txHash'],
        'blockNumber': meta['blockNumber'],
        'frames': stored,
    }
    reg = load_registry()
    reg[meta['stampId']] = rec
    save_registry(reg)
    return rec


def pick_stamp(ids, known):
    """Most common decoded id. One frame is enough for a known stamp; an unknown one needs two frames to agree."""
    votes = Counter(i for i in ids if i is not None)
    if not votes:
        return None
    sid, count = votes.most_common(1)[0]
    return sid if sid in known or count >= 2 else None


def verify_video(src):
    reg = load_registry()
    frames = sample_frames(src, SAMPLED_FRAMES)
    # shortcut: no crop recovery for video, it cost ~40s per clip; the stronger video stamp covers 20% crops instead.
    found = pick_stamp([decode_stamp(im, crops=False) for im in frames], {int(k, 16) for k in reg})
    if found is not None:
        sid = f'{found:010x}'
        rec = reg.get(sid)
        if rec:
            return {'tier': 'A', 'stampId': sid, 'record': public_record(rec),
                    'label': 'Watermark decoded from video frames'}
        return {'tier': 'A', 'stampId': sid, 'label': 'Watermark decoded but stamp not in the video registry'}
    best = None
    hashes = [imagehash.phash(im) for im in frames]
    for rec in reg.values():
        for stored in rec.get('frames', []):
            ref = imagehash.hex_to_hash(stored)
            for h in hashes:
                dist = h - ref
                if best is None or dist < best[0]:
                    best = (dist, rec)
    if best and best[0] <= MAX_HAM:
        return {'tier': 'B', 'stampId': best[1]['stampId'], 'distance': int(best[0]),
                'record': public_record(best[1]), 'label': 'Frame fingerprint matches a stamped video'}
    return {'tier': None, 'label': 'No stamp record found'}


def reencode(src, dst):
    run([ffmpeg(), '-y', '-i', str(src), '-c:v', 'libx264', '-crf', '32', '-pix_fmt', 'yuv420p', str(dst)])


def main():
    cmd = sys.argv[1]
    if cmd == 'stamp-all':
        video_dir = ROOT / 'frontend' / 'public' / 'videos'
        for name, meta in CLIPS.items():
            print(f'stamping {name}', file=sys.stderr)
            stamp_file(video_dir / name, int(meta['stampId'], 16), meta)
        sample = video_dir / 'neon-nights.mp4'
        attacked = sample.with_suffix('.attacked.mp4')
        reencode(sample, attacked)
        result = verify_video(attacked)
        attacked.unlink(missing_ok=True)
        fresh = verify_video(sample)
        print(json.dumps({'fresh': fresh, 'reencoded': result}))
        if fresh.get('stampId') != '3fa72c91aa' or result.get('stampId') != '3fa72c91aa':
            sys.exit(1)
    elif cmd == 'verify':
        print(json.dumps(verify_video(sys.argv[2])))
    else:
        sys.exit('use stamp-all or verify <file>')


assert pick_stamp([None, 5, None], {5}) == 5
assert pick_stamp([None, 5, None], set()) is None
assert pick_stamp([7, 5, 7], set()) == 7
assert pick_stamp([None, None], {5}) is None

if __name__ == '__main__':
    main()
