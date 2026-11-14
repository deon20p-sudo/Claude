"""Narration: one clip per line with the open Kokoro voice model, then a timeline with word timings."""
import json, re, sys, os, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICE = os.environ.get('VOICE', 'am_michael'); SPEED = float(os.environ.get('SPEED', '1.12'))
script = json.load(open(f'{ROOT}/build/script.json'))
k = Kokoro(f'{ROOT}/models/kokoro-v1.0.onnx', f'{ROOT}/models/voices-v1.0.bin')
os.makedirs(f'{ROOT}/build/vo', exist_ok=True)
SR = 24000

def trim(x, thr=0.012, pad=0.03):
    idx = np.where(np.abs(x) > thr)[0]
    if len(idx) == 0: return x
    a = max(0, idx[0] - int(pad * SR)); b = min(len(x), idx[-1] + int(pad * SR * 2))
    return x[a:b]

def weight(word):
    core = re.sub(r"[^A-Za-z']", '', word)
    vow = len(re.findall(r'[aeiouyAEIOUY]+', core))
    w = 0.6 + 0.9 * max(1, vow) + 0.12 * len(core)
    if re.search(r'[.!?]"?$', word): w += 1.6
    elif re.search(r'[,;:]"?$', word): w += 1.0
    return w

t = 0.35; shots = []; clips = []
for i, s in enumerate(script):
    if s['text'] is None:
        shots.append(dict(id=s['id'], start=round(t, 4), dur=s['dur'], words=[])); t += s['dur']; continue
    path = f"{ROOT}/build/vo/{i:03d}_{s['id']}.wav"
    key = f"{VOICE}|{SPEED}|{s['text']}"
    if os.path.exists(path) and os.path.exists(path + '.key') and open(path + '.key').read() == key:
        x, _ = sf.read(path, dtype='float32')
    else:
        x, sr = k.create(s['text'], voice=VOICE, speed=SPEED, lang='en-us'); assert sr == SR
        x = trim(np.asarray(x, dtype='float32')); sf.write(path, x, SR); open(path + '.key', 'w').write(key)
    d = len(x) / SR
    words = s['text'].split(); ws = [weight(w) for w in words]; tot = sum(ws); acc = 0; wt = []
    for w, g in zip(words, ws):
        a = t + 0.03 + (d - 0.06) * acc / tot; acc += g; b = t + 0.03 + (d - 0.06) * acc / tot
        wt.append(dict(w=re.sub(r'["]', '', w), start=round(a, 3), end=round(b, 3)))
    # the shot starts a hair before the voice so the cut lands on the first word
    start = shots[-1]['start'] + shots[-1]['dur'] if shots else 0.0
    dur = (t + d + s['gap']) - start
    shots.append(dict(id=s['id'], start=round(start, 4), dur=round(dur, 4), words=wt, vo=dict(file=os.path.relpath(path, ROOT), at=round(t, 4), dur=round(d, 4))))
    t += d + s['gap']
shots[0]['start'] = 0.0; shots[0]['dur'] = round(shots[1]['start'], 4) if len(shots) > 1 else shots[0]['dur']
json.dump(dict(total=round(t, 3), sr=SR, voice=VOICE, shots=shots), open(f'{ROOT}/build/timeline.json', 'w'), indent=1)
print('total', round(t, 2), 's;', len(shots), 'shots; avg shot', round(t / len(shots), 2), 's')
