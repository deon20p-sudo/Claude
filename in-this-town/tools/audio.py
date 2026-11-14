"""Sound: narration + synthesized effects + a quiet synthesized score, mixed to build/audio.wav.
Everything is generated here with numpy - no samples or libraries of sounds are used."""
import json, os, numpy as np, soundfile as sf
from scipy import signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 44100
tl = json.load(open(f'{ROOT}/build/timeline.json')); cues = json.load(open(f'{ROOT}/build/script.json'))
TOTAL = tl['total'] + 0.05
N = int(TOTAL * SR)
rng = np.random.default_rng(7)
shots = {s['id']: s for s in tl['shots']}
start = lambda i: shots[i]['start']
bus = {k: np.zeros((N, 2), dtype=np.float32) for k in ['vo', 'sfx', 'amb', 'mus']}

def add(b, x, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N or i + len(x) <= 0: return
    if i < 0: x = x[-i:]; i = 0
    x = x[:N - i]
    if x.ndim == 1: x = np.stack([x * (1 - max(0, pan)), x * (1 + min(0, pan))], 1)
    bus[b][i:i + len(x)] += (x * gain).astype(np.float32)

def tt(d): return np.arange(int(d * SR)) / SR
def lp(x, f, o=2): return signal.sosfilt(signal.butter(o, f, 'low', fs=SR, output='sos'), x, axis=0)
def hp(x, f, o=2): return signal.sosfilt(signal.butter(o, f, 'high', fs=SR, output='sos'), x, axis=0)
def bp(x, a, b, o=2): return signal.sosfilt(signal.butter(o, [a, b], 'band', fs=SR, output='sos'), x, axis=0)
def fade(x, a=0.01, b=0.05):
    x = x.copy(); na, nb = int(a * SR), int(b * SR)
    if na: x[:na] *= np.linspace(0, 1, na)[:, None] if x.ndim == 2 else np.linspace(0, 1, na)
    if nb: x[-nb:] *= np.linspace(1, 0, nb)[:, None] if x.ndim == 2 else np.linspace(1, 0, nb)
    return x

# ---------------------------------------------------------------- effects
def bell(f0=196.0, dur=5.5, bright=1.0):
    t = tt(dur); x = np.zeros_like(t)
    for ratio, amp, tau in [(0.5, 1.0, 5.0), (1.0, 0.85, 3.8), (1.183, 0.6, 3.0), (1.506, 0.42, 2.4), (2.0, 0.6, 1.9), (2.514, 0.3 * bright, 1.4), (2.662, 0.26 * bright, 1.2), (3.011, 0.2 * bright, 1.0), (4.166, 0.14 * bright, 0.7), (5.433, 0.09 * bright, 0.5), (6.8, 0.06 * bright, 0.35)]:
        f = f0 * ratio
        x += amp * np.exp(-t / tau) * (np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) + 0.5 * np.sin(2 * np.pi * f * 1.004 * t + rng.uniform(0, 6)))
    click = bp(rng.standard_normal(int(0.03 * SR)), 900, 5000) * np.exp(-tt(0.03) * 160)
    x[:len(click)] += click * 1.2 * bright
    x *= np.minimum(1, t / 0.004)
    return fade(x / 3.2, 0, 0.4)

def thunder(dur=3.4):
    t = tt(dur); n = rng.standard_normal(len(t))
    rumble = lp(n, 140, 3) * 9 * np.exp(-t / 1.1) * (0.6 + 0.4 * np.sin(2 * np.pi * (1.3 + rng.uniform(0, 1)) * t + rng.uniform(0, 6)) ** 2)
    crack = bp(rng.standard_normal(len(t)), 300, 2600) * np.exp(-t / 0.16) * 0.9
    crack2 = np.roll(bp(rng.standard_normal(len(t)), 200, 1400) * np.exp(-t / 0.3) * 0.5, int(0.18 * SR))
    return fade(rumble + crack + crack2, 0.004, 0.6) * 0.5

def thump(f=58.0, gain=1.0):
    t = tt(0.34); ph = 2 * np.pi * np.cumsum(f * (1 + 1.2 * np.exp(-t * 28))) / SR
    return fade(np.sin(ph) * np.exp(-t * 13) + 0.25 * lp(rng.standard_normal(len(t)), 220) * np.exp(-t * 40), 0.002, 0.05) * gain

def heartbeat(f=58.0, gain=1.0):
    a = thump(f, gain); b = thump(f * 0.92, gain * 0.62); x = np.zeros(int(0.6 * SR)); x[:len(a)] += a; i = int(0.22 * SR); x[i:i + len(b)] += b
    return x

def growl(dur=1.5):
    t = tt(dur); f = 44 + 9 * np.sin(2 * np.pi * 1.1 * t) - 6 * t
    ph = 2 * np.pi * np.cumsum(f) / SR
    saw = sum(np.sin(ph * k) / k for k in range(1, 14))
    x = saw * (0.7 + 0.3 * np.sin(2 * np.pi * 23 * t)) + 0.6 * bp(rng.standard_normal(len(t)), 80, 600)
    return fade(lp(x, 700) * np.minimum(1, t / 0.12), 0.01, 0.5) * 0.4

def stomp():
    t = tt(1.1); ph = 2 * np.pi * np.cumsum(38 * (1 + 1.5 * np.exp(-t * 18))) / SR
    return fade(np.sin(ph) * np.exp(-t * 4.5) + lp(rng.standard_normal(len(t)), 300) * np.exp(-t * 9) * 0.8, 0.002, 0.2) * 0.9

def whoosh(dur=0.34):
    t = tt(dur); n = rng.standard_normal(len(t)); out = np.zeros_like(t); K = 8
    for i in range(K):
        a, b = i * len(t) // K, (i + 1) * len(t) // K; fc = 400 + 2600 * np.sin(np.pi * (i + 0.5) / K)
        out[a:b] = bp(n, fc * 0.6, fc * 1.5)[a:b]
    return out * np.sin(np.pi * t / dur) ** 2 * 0.3

def step():
    t = tt(0.07); return bp(rng.standard_normal(len(t)), 250, 2200) * np.exp(-t * 60) * 0.35

def chirp():
    d = rng.uniform(0.06, 0.13); t = tt(d); f0 = rng.uniform(2600, 4400)
    return np.sin(2 * np.pi * np.cumsum(f0 * (1 + 0.25 * np.sin(2 * np.pi * rng.uniform(18, 40) * t))) / SR) * np.sin(np.pi * t / d) ** 2 * 0.05

def pluck(f, dur=1.4, bright=1.0):
    t = tt(dur)
    return (np.sin(2 * np.pi * f * t) * np.exp(-t * 4.5) + 0.3 * bright * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 8) + 0.12 * bright * np.sin(2 * np.pi * 5.4 * f * t) * np.exp(-t * 26)) * np.minimum(1, t / 0.003)

def pad(freqs, dur, cutoff=900):
    t = tt(dur); x = np.zeros_like(t)
    for f in freqs:
        for det in (-0.004, 0, 0.005):
            ph = 2 * np.pi * f * (1 + det) * t + rng.uniform(0, 6)
            x += np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.18 * np.sin(3 * ph)
    env = np.minimum(1, t / (dur * 0.3)) * np.minimum(1, (dur - t) / (dur * 0.35))
    return lp(x, cutoff) * env / (len(freqs) * 3)

NOTE = lambda n: 440.0 * 2 ** ((n - 69) / 12)

# ---------------------------------------------------------------- narration
for s in tl['shots']:
    if 'vo' not in s: continue
    x, sr = sf.read(f"{ROOT}/{s['vo']['file']}", dtype='float32')
    x = signal.resample_poly(x, SR, sr).astype(np.float32)
    add('vo', fade(x, 0.004, 0.02), s['vo']['at'])
v = bus['vo']; v[:] = hp(v, 70); pk = np.abs(v).max(); v /= pk
# gentle compression so every line sits at the same level
envl = np.maximum(lp(np.abs(v).max(1), 12), 1e-4); g = np.minimum(1, (0.28 / envl) ** 0.55); v *= g[:, None]
def speak_level(x, win=0.2):
    m = np.abs(x).max(1); n = int(win * SR); k = len(m) // n; r = np.sqrt((m[:k * n].reshape(k, n) ** 2).mean(1)); r = r[r > 1e-4]
    return 20 * np.log10(np.percentile(r, 75))
v *= 10 ** ((-15.0 - speak_level(v)) / 20); v[:] = np.tanh(v * 1.25) / 1.25   # speech sits at about -15 dB, peaks rounded off

# ---------------------------------------------------------------- cues from the shot list
T_NIGHT, T_STORM, T_MOVES, T_DONG, T_BUT, T_END = start('night'), start('storm'), start('moves'), start('dong2a'), start('but'), start('end')
for c in cues:
    s = shots[c['id']]; t0, d = s['start'], s['dur']
    for f in c['flash']: add('sfx', thunder(), t0 + f + 0.12, 0.85, rng.uniform(-0.4, 0.4))
    for e in c['sfx']:
        name, at = e[0], e[1]; g = e[2] if len(e) > 2 else 1.0
        if name == 'bell':
            far = c['id'] in ('nine', 'ten', 'eleven')
            x = bell(bright=0.5 if far else 1.0); x = lp(x, 1800) if far else x
            add('sfx', x, t0 + at, 0.55 * g)
        elif name == 'growl': add('sfx', growl(), t0 + at, 1.0)
        elif name == 'stomp': add('sfx', stomp(), t0 + at, 1.0)
        elif name == 'steps':
            n = int(d * g)
            for i in range(n): add('sfx', step(), t0 + i / g + rng.uniform(-0.01, 0.01), 0.14 + 0.06 * (i % 2), 0.3 * (-1) ** i)
    for key, f, gain in (('hb', 60.0, 0.9), ('hb2', 44.0, 1.25)):
        h = c[key]
        if not h: continue
        per = 60.0 / h['bpm']; k0 = int(np.ceil((t0 + h.get('t0', 0)) / per))
        k = k0
        while k * per < t0 + d - 0.05: add('sfx', heartbeat(f, gain), k * per, 0.8); k += 1
    if c['whoosh'] and c['id'] not in ('dong2a',): add('sfx', whoosh(), t0 - 0.05, 0.9, rng.uniform(-0.5, 0.5))
# the bell that the first DONG beat shows is rung in the shot before it; the day/night shot gets one too
add('sfx', bell(), start('daynight'), 0.4)
# final hit and silence
add('sfx', stomp(), T_END - 0.02, 1.5)

# ---------------------------------------------------------------- ambience by lighting state
def region(env_names):
    m = np.zeros(N, dtype=np.float32)
    for c in cues:
        if c['env'] in env_names: s = shots[c['id']]; m[int(s['start'] * SR):int((s['start'] + s['dur']) * SR)] = 1
    return lp(m, 6, 1).astype(np.float32)
noise = rng.standard_normal((N, 2)).astype(np.float32)
rain = (bp(noise, 900, 7000) * 0.05 + lp(noise, 400) * 0.04) * region(['storm', 'stormN'])[:, None]
rain += bp(noise, 500, 2500) * 0.012 * region(['stairs'])[:, None]
wind = lp(noise, 300) * (0.05 + 0.04 * np.sin(2 * np.pi * 0.13 * np.arange(N) / SR))[:, None] * region(['storm', 'stormN', 'dream'])[:, None]
bus['amb'] += (rain + wind).astype(np.float32)
day = region(['day', 'snow', 'dusk'])
t = 0.3
while t < TOTAL:
    if day[min(N - 1, int(t * SR))] > 0.5:
        for k in range(rng.integers(2, 5)): add('amb', chirp(), t + k * rng.uniform(0.09, 0.16), 1.0, rng.uniform(-0.7, 0.7))
    t += rng.uniform(0.5, 1.5)
night = region(['night', 'late'])
cr = np.sin(2 * np.pi * 4300 * np.arange(N) / SR) * (np.sin(2 * np.pi * 34 * np.arange(N) / SR) > 0.2) * (np.sin(2 * np.pi * 1.6 * np.arange(N) / SR) > -0.2) * 0.006
bus['amb'] += (np.stack([cr, cr * 0.7], 1) * night[:, None]).astype(np.float32)

# ---------------------------------------------------------------- score
# 1) daytime: a small plucked pattern, A minor, 104 bpm
beat = 60 / 104
prog = [(57, [57, 60, 64]), (53, [53, 57, 60]), (48, [55, 60, 64]), (55, [55, 59, 62])]   # Am F C G
t = 0.0; bar = 0
while t < T_NIGHT - 0.5:
    root, ch = prog[bar % 4]
    add('mus', pluck(NOTE(root - 12), 2.2, 0.6), t, 0.2)
    for i, n in enumerate([ch[0], ch[2], ch[1] + 12, ch[2], ch[0] + 12, ch[2], ch[1] + 12, ch[2]]):
        add('mus', pluck(NOTE(n + 12), 1.2), t + i * beat / 2, 0.075 if i % 2 else 0.11, 0.5 * (-1) ** i)
    t += beat * 4; bar += 1
# 2) night: slow pad
t = T_NIGHT
for ch in [[45, 52, 57, 60], [41, 48, 53, 57], [45, 52, 57, 64]]:
    d = (T_STORM - T_NIGHT) / 3 + 1.2; add('mus', pad([NOTE(n) for n in ch], d, 800), t - 0.6, 0.5); t += (T_STORM - T_NIGHT) / 3
for i in range(int((T_STORM - T_NIGHT) / (beat * 2))): add('mus', pluck(NOTE([69, 72, 76, 72, 67, 72][i % 6]), 1.8, 0.6), T_NIGHT + i * beat * 2, 0.06, 0.4 * (-1) ** i)
# 3) storm: low drone, then a pulse that tightens until the bell
d = T_DONG - T_STORM; tx = tt(d)
drone = (np.sin(2 * np.pi * 55 * tx) + 0.6 * np.sin(2 * np.pi * 82.4 * tx + 1) + 0.4 * np.sin(2 * np.pi * 110.3 * tx)) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.21 * tx)) * np.minimum(1, tx / 3)
add('mus', fade(drone, 0.5, 0.15), T_STORM, 0.11)
for ch, a, b in [([45, 52, 56], T_STORM, T_MOVES + 2), ([44, 51, 57], T_MOVES, start('top') + 1), ([45, 50, 53], start('top'), start('thump') + 1), ([43, 50, 55], start('thump'), start('racing') + 1), ([45, 51, 57], start('racing'), T_DONG)]:
    add('mus', pad([NOTE(n) for n in ch], b - a + 0.8, 1100), a - 0.4, 0.42)
def stab(f, d=0.16):
    q = tt(d); ph = 2 * np.pi * f * q
    return lp(sum(np.sin(ph * k) / k for k in range(1, 9)), 1400) * np.exp(-q * 16) * np.minimum(1, q / 0.004)
t = T_MOVES; step8 = 60 / 132 / 2; i = 0
while t < T_DONG - 0.05:
    prog_ = (t - T_MOVES) / (T_DONG - T_MOVES)
    calm = shots['notonce']['start'] <= t < shots['how']['start'] or shots['stirs']['start'] <= t < shots['racing']['start']
    if not calm: add('mus', stab(NOTE([33, 33, 40, 33, 36, 33, 40, 39][i % 8])), t, 0.16 + 0.3 * prog_, 0.2 * (-1) ** i)
    t += step8; i += 1
# riser into the bell
rd = 2.6; q = tt(rd); ris = bp(rng.standard_normal(len(q)), 500, 5000) * (q / rd) ** 3 * 0.3 + np.sin(2 * np.pi * np.cumsum(180 + 900 * (q / rd) ** 2) / SR) * (q / rd) ** 2 * 0.12
add('mus', ris, T_DONG - rd, 0.7)
# 4) after the bell: relief, then the second heart
add('mus', pad([NOTE(n) for n in [45, 52, 57, 61]], T_BUT - T_DONG - 1.5, 900), T_DONG + 1.8, 0.5)
add('mus', pad([NOTE(n) for n in [44, 51, 56, 59]], T_END - T_BUT + 0.4, 1500), T_BUT - 0.2, 0.55)
rd = T_END - start('underneath'); q = tt(rd); ris = np.sin(2 * np.pi * np.cumsum(70 + 500 * (q / rd) ** 3) / SR) * (q / rd) ** 2 * 0.2 + bp(rng.standard_normal(len(q)), 300, 4000) * (q / rd) ** 4 * 0.25
add('mus', ris, start('underneath'), 0.8)
# hard silence for music and ambience at the cut to black
cut = int(T_END * SR)
for k in ('mus', 'amb'): bus[k][cut:] = 0; bus[k][cut - 400:cut] *= np.linspace(1, 0, 400)[:, None]

# ---------------------------------------------------------------- mix: duck everything under the voice
def active_rms(x, win=0.2):
    m = np.abs(x).max(1) if x.ndim == 2 else np.abs(x); n = int(win * SR); k = len(m) // n
    r = np.sqrt((m[:k * n].reshape(k, n) ** 2).mean(1)); r = r[r > 10 ** (-60 / 20)]
    return 20 * np.log10(np.percentile(r, 75) + 1e-9) if len(r) else -99
ref = active_rms(bus['vo'])
# target levels relative to the voice while it is speaking (dB): music -17, ambience -21, effects by peak
G = {'mus': 10 ** ((ref - 17 - active_rms(bus['mus'])) / 20), 'amb': 10 ** ((ref - 21 - active_rms(bus['amb'])) / 20), 'sfx': 0.9 / max(1e-6, np.abs(bus['sfx']).max())}
vo_env = lp(np.abs(bus['vo']).max(1), 5, 1); duck = 1 - 0.35 * np.clip(vo_env / 0.25, 0, 1)
mix = bus['vo'] + bus['sfx'] * G['sfx'] + bus['amb'] * (G['amb'] * duck)[:, None] + bus['mus'] * (G['mus'] * duck)[:, None]
mix = np.tanh(mix * 1.05) / np.tanh(1.05)
mix = mix / max(1.0, np.abs(mix).max()) * 0.85
mix[:int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))[:, None]; mix[-int(0.3 * SR):] *= np.linspace(1, 0, int(0.3 * SR))[:, None]
sf.write(f'{ROOT}/build/audio.wav', mix.astype(np.float32), SR)
print('audio', round(TOTAL, 2), 's | voice (while speaking)', round(ref, 1), 'dB | gains', {k: round(float(v), 3) for k, v in G.items()})
for k in bus: print(' ', k, 'active rms', round(active_rms(bus[k] * (G.get(k, 1))), 1), 'peak', round(20 * np.log10(np.abs(bus[k] * G.get(k, 1)).max() + 1e-9), 1))
def pk(name, a, b): x = bus['sfx'][int(a * SR):int(b * SR)] * G['sfx']; return name + ' ' + str(round(20 * np.log10(np.abs(x).max() + 1e-9), 1))
print('  sfx peaks:', pk('bell1', start('rule4') + 1.0, start('dong1') + 1), pk('thunder', start('nothing'), start('nothing') + 1), pk('heart', start('thump'), start('thump') + 1.7), pk('bell2', T_DONG, T_DONG + 1), pk('steps', start('dark') + 0.9, start('dark') + 1.2), pk('heart2', start('thatone'), start('thatone') + 0.8))
