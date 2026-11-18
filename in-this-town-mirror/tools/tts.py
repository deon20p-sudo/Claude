"""Narration: one clip per line with the open Kokoro voice model, then a timeline with word timings.

VOICE  Kokoro voice name (default af_heart)
SPEED  speaking speed (default 1.12)
PITCH  pitch factor, 1.06 = one semitone up (the clip is generated slower and resampled, so pace is unchanged)
FIT=1  keep the existing build/timeline.json shot timings and fit every new clip to the old clip's length,
       so the voice can be swapped without re-rendering the picture
"""
import json, re, os, numpy as np, soundfile as sf
from fractions import Fraction
from scipy import signal
from kokoro_onnx import Kokoro
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICE = os.environ.get('VOICE', 'af_heart'); SPEED = float(os.environ.get('SPEED', '1.12')); PITCH = float(os.environ.get('PITCH', '1.06'))
FIT = os.environ.get('FIT') == '1' and os.path.exists(f'{ROOT}/build/timeline.json')
script = json.load(open(f'{ROOT}/build/script.json'))
old = {s['id']: s for s in json.load(open(f'{ROOT}/build/timeline.json'))['shots']} if FIT else {}
k = Kokoro(f'{ROOT}/models/kokoro-v1.0.onnx', f'{ROOT}/models/voices-v1.0.bin')
os.makedirs(f'{ROOT}/build/vo', exist_ok=True)
SR = 24000
fr = Fraction(PITCH).limit_denominator(50)

def trim(x, thr=0.012, pad=0.03):
    idx = np.where(np.abs(x) > thr)[0]
    if len(idx) == 0: return x
    a = max(0, idx[0] - int(pad * SR)); b = min(len(x), idx[-1] + int(pad * SR * 2))
    return x[a:b]

def speak(text, speed):
    x, sr = k.create(text, voice=VOICE, speed=speed / PITCH, lang='en-us'); assert sr == SR
    x = np.asarray(x, dtype='float32')
    if PITCH != 1.0: x = signal.resample_poly(x, fr.denominator, fr.numerator).astype('float32')   # shorter + higher
    return trim(x)

def weight(word):
    core = re.sub(r"[^A-Za-z']", '', word)
    vow = len(re.findall(r'[aeiouyAEIOUY]+', core))
    w = 0.6 + 0.9 * max(1, vow) + 0.12 * len(core)
    if re.search(r'[.!?]"?$', word): w += 1.6
    elif re.search(r'[,;:]"?$', word): w += 1.0
    return w

def word_times(text, t, d):
    words = text.split(); ws = [weight(w) for w in words]; tot = sum(ws); acc = 0; out = []
    for w, g in zip(words, ws):
        a = t + 0.03 + (d - 0.06) * acc / tot; acc += g; b = t + 0.03 + (d - 0.06) * acc / tot
        out.append(dict(w=re.sub(r'["]', '', w), start=round(a, 3), end=round(b, 3)))
    return out

t = 0.35; shots = []; speeds = []
for i, s in enumerate(script):
    if s['text'] is None:
        if FIT: shots.append(old[s['id']])
        else: shots.append(dict(id=s['id'], start=round(t, 4), dur=s['dur'], words=[])); t += s['dur']
        continue
    path = f"{ROOT}/build/vo/{i:03d}_{s['id']}.wav"
    target = old[s['id']]['vo']['dur'] if FIT else None
    key = f"{VOICE}|{SPEED}|{PITCH}|{target}|{s['text']}"
    if os.path.exists(path) and os.path.exists(path + '.key') and open(path + '.key').read() == key:
        x, _ = sf.read(path, dtype='float32')
    else:
        sp = SPEED; x = speak(s['text'], sp)
        if FIT:
            # search the speaking speed until the clip is as long as the line it replaces (never noticeably longer)
            lo, hi = 0.68, 1.7; best = None; score = lambda e: e * 3 if e > 0.03 else abs(e)
            for _ in range(8):
                err = len(x) / SR - target
                if best is None or score(err) < score(best[2]): best = (x, sp, err)
                if abs(err) < 0.025: break
                if err > 0: lo = sp
                else: hi = sp
                guess = sp * (len(x) / SR) / target
                sp = guess if lo + 0.004 < guess < hi - 0.004 else (lo + hi) / 2
                if hi - lo < 0.006: break
                x = speak(s['text'], sp)
            else:
                err = len(x) / SR - target
                if score(err) < score(best[2]): best = (x, sp, err)
            x, sp, _ = best; speeds.append(sp)
        sf.write(path, x, SR); open(path + '.key', 'w').write(key)
    d = len(x) / SR
    if FIT:
        o = old[s['id']]; at = o['vo']['at']
        shots.append(dict(id=s['id'], start=o['start'], dur=o['dur'], words=word_times(s['text'], at, d), vo=dict(file=os.path.relpath(path, ROOT), at=at, dur=round(d, 4), fit=round(d - target, 3))))
    else:
        start = shots[-1]['start'] + shots[-1]['dur'] if shots else 0.0
        shots.append(dict(id=s['id'], start=round(start, 4), dur=round((t + d + s['gap']) - start, 4), words=word_times(s['text'], t, d), vo=dict(file=os.path.relpath(path, ROOT), at=round(t, 4), dur=round(d, 4))))
        t += d + s['gap']
if FIT:
    total = json.load(open(f'{ROOT}/build/timeline.json'))['total']
    errs = [abs(s['vo']['fit']) for s in shots if 'vo' in s]
    print('fit to existing timeline: worst mismatch', max(errs), 's; per-line speed', round(min(speeds), 2) if speeds else '-', 'to', round(max(speeds), 2) if speeds else '-')
else:
    total = round(t, 3); shots[0]['start'] = 0.0; shots[0]['dur'] = round(shots[1]['start'], 4)
json.dump(dict(total=total, sr=SR, voice=VOICE, pitch=PITCH, shots=shots), open(f'{ROOT}/build/timeline.json', 'w'), indent=1)
print('voice', VOICE, 'pitch', PITCH, '| total', round(total, 2), 's;', len(shots), 'shots')
