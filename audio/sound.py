# Soundtrack of "The Grill That Grounded a Stryker": every sound synthesized here (numpy + scipy, the skill's
# dsp.py / instruments.py kit), timed to the picture's frame constants (src/videos/stryker/story.ts, cast.ts),
# plus an original march score (Bb major; G minor tension; a soft golden explanation section) ducked under the
# voice. Standard mix: music +3 dB, SFX -6 dB against the bed levels below, voice unchanged; master to
# -14.5 LUFS integrated, true peak <= -1 dBTP, exactly TOTAL / 30 s, 48 kHz stereo 24-bit.
# Usage: python audio/sound.py   -> audio/mix.wav, audio/stem_*.wav, audio/cues.md
import os, json
import numpy as np
from scipy import signal
from dsp import (SR, TAU, ns, tt, rng, lp, hp, bp, peq, reson, pan, st, place, fades, widen, make_ir, convolve_st, dbg,
                 integrated, momentary_max, true_peak, write_wav, read_wav, smooth_noise, modal, phase)
import instruments as I

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FPS, TOTAL = 30, 1935
DUR = TOTAL / FPS
N = ns(DUR)
F = lambda f: f / FPS
CUES = []

# ---------------------------------------------------------------- SFX generators
def plus(*xs):
    n = max(len(x) for x in xs); out = np.zeros(n)
    for x in xs: out[: len(x)] += x
    return out

def env_ad(n, a, d):
    t = np.arange(n) / SR
    return (1 - np.exp(-t / max(a, 1e-4))) * np.exp(-t / d)

def engine(dur, r, base=38.0, load=0.5, rev=None):
    """diesel: firing pulses (AM at the firing rate) through body resonances + mechanical rattle"""
    n = ns(dur); t = np.arange(n) / SR
    f = base * (1 + 0.04 * smooth_noise(n, r, 1.5)) * (1 if rev is None else rev(t))
    ph = phase(f)
    puls = np.maximum(0, np.sin(ph)) ** 6
    y = lp(puls - puls.mean(), 900, 2) * 1.2
    y += 0.5 * np.sin(ph * 0.5) + 0.25 * np.sin(ph * 1.5 + 1)
    rat = bp(r.standard_normal(n), 600, 2500, 1) * (0.15 + 0.2 * load) * (0.6 + 0.4 * puls)
    y = y + rat
    y = reson(y, 120, 3) * 0.3 + y
    return y * (0.6 + 0.4 * load)

def clank(r, f0=320.0, dur=1.2, bright=1.0):
    y = modal(dur, [(f0, 1.0, 0.35), (f0 * 2.61, 0.7, 0.22), (f0 * 4.83, 0.5 * bright, 0.12), (f0 * 7.4, 0.35 * bright, 0.07), (f0 * 11.2, 0.2 * bright, 0.04)], r)
    n = len(y); t = np.arange(n) / SR
    y += hp(r.standard_normal(n), 1500) * np.exp(-t / 0.006) * 0.8
    y += lp(r.standard_normal(n), 200) * np.exp(-t / 0.04) * 1.5
    return fades(y, 0.0003, 0.05)

def thud(r, dur=0.6, f0=70.0):
    n = ns(dur); t = np.arange(n) / SR
    y = np.sin(phase(f0 * (1 + 0.8 * np.exp(-t / 0.03)))) * np.exp(-t / 0.12)
    y += lp(r.standard_normal(n), 300) * np.exp(-t / 0.05) * 0.8
    return fades(y, 0.0005, 0.05)

def creak(r, dur=1.2, f0=180.0):
    n = ns(dur); t = np.arange(n) / SR
    f = f0 * (1 + 0.25 * np.sin(TAU * 0.6 * t) + 0.08 * smooth_noise(n, r, 9))
    stick = (np.sin(phase(f)) > 0.6).astype(float) * (0.6 + 0.4 * smooth_noise(n, r, 25))
    y = reson(stick - stick.mean(), 420, 6) + reson(stick - stick.mean(), 1100, 8) * 0.5
    return fades(y * np.sin(np.pi * t / dur) ** 0.6 * 0.6, 0.01, 0.1)

def whoosh(r, dur=0.6, lo=300.0, hi=2500.0, peak=0.5):
    n = ns(dur); t = np.arange(n) / SR
    nz = r.standard_normal(n)
    c = lo * (hi / lo) ** np.clip(t / dur, 0, 1)
    y = np.zeros(n); hop = 2048
    for i in range(0, n, hop):
        seg = nz[i:i + hop + 512]
        fc = c[min(i, n - 1)]
        y[i:i + hop] = bp(seg, fc * 0.6, fc * 1.6, 1)[:min(hop, n - i)]
    e = np.where(t < peak * dur, (t / (peak * dur)) ** 2, np.exp(-(t - peak * dur) / (0.25 * dur)))
    return fades(lp(y, 6000) * e, 0.005, 0.05)

def crackle(r, dur, rate=60.0, buzz=0.0, hiss=0.3, f_lo=1500.0):
    n = ns(dur); t = np.arange(n) / SR
    imp = (r.random(n) < rate / SR).astype(float) * r.uniform(0.3, 1.0, n)
    y = hp(signal.lfilter([1], [1, -0.6], imp), f_lo) * 4
    y += hiss * hp(r.standard_normal(n), 3000) * 0.3
    if buzz: y += buzz * signal.sawtooth(TAU * 100 * t) * 0.15
    return y

def zap(r, dur):
    n = ns(dur); t = np.arange(n) / SR
    f = 220 * (1 + 0.5 * smooth_noise(n, r, 30))
    y = np.sign(np.sin(phase(f))) * 0.3 + crackle(r, dur, 120, 0, 0.2)
    return fades(bp(y, 300, 7000, 1) * (0.7 + 0.3 * smooth_noise(n, r, 12)), 0.003, 0.03)

def fizzle(r, dur=0.9):
    n = ns(dur); t = np.arange(n) / SR
    y = crackle(r, dur, 90, 0, 0.6) * np.exp(-t / (dur * 0.35))
    y += np.sin(phase(600 * np.exp(-t / 0.25))) * np.exp(-t / 0.2) * 0.2
    return fades(y, 0.002, 0.05)

def water_hiss(r, dur):
    n = ns(dur); t = np.arange(n) / SR
    y = bp(r.standard_normal(n), 900, 7000, 2) * (0.75 + 0.25 * smooth_noise(n, r, 8))
    drops = (r.random(n) < 30 / SR).astype(float)
    y += reson(signal.lfilter([1], [1, -0.5], drops), 1800, 12) * 2
    return y

def squeak(r, dur=0.25, f0=900.0):
    n = ns(dur); t = np.arange(n) / SR
    f = f0 * (1 + 0.5 * t / dur) * (1 + 0.03 * np.sin(TAU * 38 * t))
    y = np.sin(phase(f)) + 0.3 * np.sin(2 * phase(f))
    return fades(y * np.sin(np.pi * t / dur), 0.003, 0.02) * 0.5

def step(r, soft=0.5):
    n = ns(0.18); t = np.arange(n) / SR
    y = lp(r.standard_normal(n), 900) * np.exp(-t / 0.025) + hp(r.standard_normal(n), 2500) * np.exp(-t / 0.004) * 0.4
    return y * soft

def chirp_bird(r):
    n = ns(0.16); t = np.arange(n) / SR
    f = 3200 + 1800 * np.sin(np.pi * t / 0.16) * r.uniform(0.6, 1.2)
    return fades(np.sin(phase(f)) * np.sin(np.pi * t / 0.16) ** 2, 0.002, 0.01) * 0.3

def hydraulic(r, dur, up=True):
    n = ns(dur); t = np.arange(n) / SR
    f = (300 if up else 420) + (120 if up else -120) * t / dur
    y = np.sin(phase(f)) * 0.3 + bp(r.standard_normal(n), 500, 3000, 1) * 0.2
    return fades(y, 0.05, 0.08)

def wind(r, dur, lo=150.0, hi=1200.0):
    n = ns(dur)
    return bp(r.standard_normal(n), lo, hi, 1) * (0.6 + 0.4 * smooth_noise(n, r, 0.3))

def sizzle(r, dur):
    n = ns(dur)
    return crackle(r, dur, 200, 0, 1.0, 2500) * (0.7 + 0.3 * smooth_noise(n, r, 3))

# ---------------------------------------------------------------- the SFX timeline
def sfx():
    r = rng(5)
    S = np.zeros((2, N))
    def add(x, t, db=0.0, p=0.0, name=""):
        place(S, pan(x, p) if np.ndim(x) == 1 else x, t, dbg(db))
        if name: CUES.append((t, name, db))
    def span(a, b): return F(a), (b - a) / FPS
    # ambiences per zone (airfield wind; desert wind; garden birds)
    for a, b, kind in [(0, 856, "air"), (856, 1305, "town"), (1305, 1424, "garden"), (1424, 1640, "town"), (1640, TOTAL, "air")]:
        t0, d = span(a, b)
        x = wind(r, d, 120, 900 if kind != "garden" else 600) if kind != "garden" else wind(r, d, 200, 700) * 0.5
        add(fades(x, 0.08, 0.08), t0, -30 if kind != "town" else -28, 0, f"ambience {kind}")
    for k in range(9): add(chirp_bird(r), F(1310) + 0.4 + k * 0.42 + r.uniform(0, 0.2), -24, r.uniform(-0.6, 0.6))
    # hook: engine, ramp clunk of the wheels, the cage hits the door frame, creak, whoosh into the flash
    add(fades(engine(r=r, dur=6.2, base=34, load=0.6), 0.3, 0.4), 0.0, -14, -0.2, "Stryker engine (hook)")
    add(clank(r, 180, 0.8, 0.5), F(56), -20, -0.1, "front wheels onto the ramp")
    add(clank(r, 260, 1.6, 1.2), F(124), -5, 0, "CLUNK: cage hits the door frame")
    add(thud(r, 0.8, 55), F(124), -6, 0)
    add(creak(r, 1.4, 160), F(127), -16, -0.3, "metal creak")
    add(whoosh(r, 0.5, 400, 3000), F(186) - 0.35, -14, 0, "whoosh into the flash")
    # general: arrows swish, calendar ticks
    for k in range(5): add(whoosh(r, 0.35, 900, 4000, 0.4), F(309 - 2 + k * 4), -22, -0.3 + 0.15 * k, "map arrow swish" if k == 0 else "")
    for k in range(4): add(I.glock(1760 * 2 ** (k / 12 * 2), 0.6, r, 0.8), F(334 + 3 * k + 3), -20, 0.3, "calendar ticks" if k == 0 else "")
    # tank: treads + engine, the plane tips (big creak + thud), dust
    add(fades(engine(r=r, dur=1.0, base=28, load=1.0), 0.05, 0.2), F(360), -12, 0.1, "tank engine")
    add(crackle(r, 0.9, 40, 0, 0.1, 400) * 0.6, F(360), -16, 0.1)
    add(creak(r, 1.6, 110), F(386), -9, 0, "plane tips: groan")
    add(thud(r, 1.0, 45), F(388), -4, 0, "tail thump")
    add(clank(r, 140, 1.2, 0.6), F(388), -10, 0)
    # hangar: wrench clinks, sparks, engine start, ramp hydraulics, boots, ramp close, 60 mph pass-by
    for k, fr in enumerate([418, 432, 447, 461]): add(clank(r, 900 + 80 * k, 0.4, 1.2), F(fr), -18, -0.3, "wrench clinks" if k == 0 else "")
    add(crackle(r, 2.0, 80, 0, 0.4) * 0.5, F(410), -22, -0.2, "sparks")
    add(fades(engine(r=r, dur=2.5, base=36, load=0.4), 0.2, 0.3), F(472), -14, 0, "engine start + roll")
    add(hydraulic(r, 0.5, True), F(500), -18, 0.3, "ramp opens")
    for k in range(18): add(step(r, 0.6), F(505) + k * 0.31 + r.uniform(0, 0.05), -16, 0.3, "boots boarding" if k == 0 else "")
    add(clank(r, 200, 0.6, 0.5), F(548), -16, 0.3, "ramp closes")
    t = tt(1.6); dop = 1.25 - 0.5 / (1 + np.exp(-(t - 0.85) * 8))
    passby = engine(r=r, dur=1.6, base=60, load=1.0, rev=lambda tt_: dop[: len(tt_)]) * np.exp(-((t - 0.85) / 0.45) ** 2)
    add(passby + whoosh(r, 1.6, 200, 1800, 0.53) * 1.4, F(574) - 0.85, -6, 0, "60 mph pass-by")
    # portraits: twinkles
    for k, fr in enumerate([688, 694]): add(I.glock(2093 * (1.5 if k else 1), 0.5, r, 1.2) + I.triangle(0.4, r, 1.2), F(fr), -18, -0.3 + 0.6 * k, "medal twinkle" if k == 0 else "")
    # squeeze: idle, scrape squeal across "inches"
    add(fades(engine(r=r, dur=3.3, base=32, load=0.35), 0.2, 0.3), F(758), -16, 0, "engine (squeeze)")
    add(squeak(r, 0.5, 700) + squeak(r, 0.5, 980) * 0.6, F(829), -14, -0.2, "scrape squeak at the door top")
    # Iraq: engine, the RPG whoosh past
    add(fades(engine(r=r, dur=3.4, base=36, load=0.6), 0.3, 0.3), F(856), -14, 0, "engine (town)")
    rk = whoosh(r, 1.1, 300, 5000, 0.35) * 1.6 + crackle(r, 1.1, 300, 0, 0.8) * 0.25
    add(np.stack([rk * np.linspace(0.3, 1.0, len(rk)), rk * np.linspace(1.0, 0.3, len(rk))]), F(902), -5, 0, "RPG whoosh R->L")
    # cage: welding crackle, the cage clang reveal, burger sizzle
    add(crackle(r, 1.5, 150, 1.0, 0.6), F(956), -14, 0.3, "welding")
    add(clank(r, 420, 1.4, 1.0), F(1000), -10, 0, "cage clang (reveal)")
    add(sizzle(r, 1.4), F(1050), -18, 0.1, "burger sizzle")
    # warhead: the electric signal runs nose -> back, a pop
    add(zap(r, (1293 - 1235) / FPS), F(1235), -16, 0.0, "electric signal")
    add(clank(r, 1200, 0.3, 1.5) * 0.6, F(1292), -14, 0, "signal arrives: pop")
    # garden: water hiss until "stops", squeak of the step, a drip
    add(fades(water_hiss(r, F(1371 - 1305)), 0.15, 0.02), F(1305), -17, 0.3, "hose water")
    add(squeak(r, 0.18, 520), F(1313), -15, -0.2, "rubber squeak (step on hose)")
    add(I.glock(1568, 0.4, r, 0.6) * 0.6, F(1404), -18, 0.1, "drip")
    # pinch: slow-motion whoosh, clank into the bars, the signal starts and fizzles
    add(whoosh(r, 0.7, 150, 900, 0.85) * 1.2, F(1441) - 0.6, -12, 0.3, "slow-mo approach")
    add(clank(r, 300, 1.4, 1.2), F(1441), -6, 0.1, "pinched in the bars")
    add(zap(r, 0.4) * np.exp(-tt(0.4) / 0.25), F(1504), -16, 0.1, "signal sputters")
    add(fizzle(r, 0.9), F(1516), -14, 0.1, "fizzle")
    # dud: drops, bounces, rolls
    add(clank(r, 500, 0.5, 0.8) * 0.6, F(1588), -18, 0.2, "dud slips off")
    add(plus(thud(r, 0.4, 90), clank(r, 620, 0.5, 0.6) * 0.5), F(1599), -10, 0.2, "dud bounce 1")
    add(plus(thud(r, 0.3, 110) * 0.6, clank(r, 700, 0.4, 0.5) * 0.3), F(1611), -15, 0.2, "dud bounce 2")
    add(crackle(r, 0.5, 30, 0, 0.1, 500) * 0.5, F(1623), -20, 0.2, "roll")
    # problem: the plane groans under the extra weight
    add(creak(r, 1.6, 95), F(1703), -9, 0, "plane sags: groan")
    add(thud(r, 0.8, 50), F(1705), -10, 0)
    # big plane: jet whine, engine up the ramp, ramp clank
    jt = tt(F(TOTAL - 1775)); jet = (np.sin(phase(3400 + 0 * jt)) * 0.05 + bp(r.standard_normal(len(jt)), 800, 6000, 1) * 0.25)
    add(fades(jet, 1.0, 0.8), F(1775), -26, -0.4, "jet idle")
    add(fades(engine(r=r, dur=4.0, base=38, load=0.7), 0.3, 0.6), F(1785), -14, 0, "Stryker drives aboard")
    add(clank(r, 200, 0.8, 0.5), F(1805), -18, 0, "wheels onto the big ramp")
    add(sizzle(r, 0.6) * np.exp(-tt(0.6) / 0.25), F(1918), -16, 0.2, "final sizzle on 'grill'")
    return S

# ---------------------------------------------------------------- score
BEAT = 0.5   # 120 bpm
def m2f(m): return 440.0 * 2 ** ((m - 69) / 12)
THEME = [  # (beat in bar, dur in beats, midi) x 8 bars, our own march tune in Bb
    [(0, 1, 70), (1, .5, 74), (1.5, .5, 77), (2, 1, 74), (3, 1, 70)],
    [(0, 1, 72), (1, .5, 75), (1.5, .5, 79), (2, 2, 77)],
    [(0, 1, 74), (1, 1, 77), (2, .5, 82), (2.5, .5, 81), (3, 1, 79)],
    [(0, 1, 77), (1, 1, 72), (2, 2, 74)],
    [(0, 1, 70), (1, .5, 74), (1.5, .5, 77), (2, 1, 74), (3, 1, 70)],
    [(0, 1, 72), (1, .5, 75), (1.5, .5, 79), (2, 1, 77), (3, 1, 75)],
    [(0, 1, 74), (1, 1, 72), (2, 1, 69), (3, 1, 72)],
    [(0, 2, 70)],
]
ROOTS = [46, 41, 46, 41, 46, 39, 41, 46]          # Bb F Bb F Bb Eb F Bb
CHORD = {46: [58, 62, 65], 41: [57, 60, 63], 39: [58, 63, 67]}
MINOR_ROOTS = [43, 38, 43, 39, 43, 38, 41, 38]     # G minor tension

def score():
    r = rng(11)
    M = np.zeros((2, N))
    def put(x, t, db=0.0, p=0.0):
        if t < 0 or t >= DUR: return
        place(M, pan(x, p) if np.ndim(x) == 1 else x, t, dbg(db))
    def march(t0, t1, roots=ROOTS, melody=True, minor=False, mel_inst="glock", snare_db=-14, bar0=0):
        bar = 4 * BEAT; b = bar0
        t = t0
        while t < t1 - 0.05:
            k = b % 8; root = roots[k]
            # oompah: tuba on 1 and 3, horn chord stabs on 2 and 4
            for beat, note in [(0, root), (2, root + 7)]:
                if t + beat * BEAT < t1: put(I.brass(m2f(note - 12 if note > 50 else note), BEAT * 0.8, 0.75, r, "tuba"), t + beat * BEAT, -4, -0.1)
            ch = CHORD.get(root, [root + 12, root + 16, root + 19]) if not minor else [root + 12, root + 15, root + 19]
            for beat in (1, 3):
                if t + beat * BEAT < t1:
                    for i, n_ in enumerate(ch): put(I.brass(m2f(n_), BEAT * 0.35, 0.45, r, "stab"), t + beat * BEAT, -14, -0.3 + 0.3 * i)
            # snare: march rudiment
            for s16 in range(16):
                acc = s16 in (0, 4, 8, 12); play = acc or s16 in (6, 10, 14, 15)
                if play and t + s16 * BEAT / 4 < t1: put(I.snare(0.8 if acc else 0.45, r, 0.3), t + s16 * BEAT / 4, snare_db + (0 if acc else -4), 0.15)
            if melody and not minor:
                for (bb, d, m) in THEME[k]:
                    if t + bb * BEAT < t1:
                        x = I.glock(m2f(m + 12), 0.7, r, 1.2) if mel_inst == "glock" else I.fife(m2f(m + 12), d * BEAT * 0.9, 0.6, r)
                        put(x, t + bb * BEAT, -9 if mel_inst == "glock" else -13, 0.25)
            if minor and b % 2 == 0: put(I.timpani(m2f(root - 12 if root > 40 else root), 0.8, r, 1.6), t, -8, 0)
            t += bar; b += 1
    def stab_hit(t, db=-4):
        for i, n_ in enumerate([58, 62, 65, 70]): put(I.brass(m2f(n_), 0.25, 0.9, r, "stab"), t, db - 3, -0.3 + 0.2 * i)
        put(I.brass(m2f(34), 0.4, 0.9, r, "tuba"), t, db); put(I.cymbal(0.6, r, 1.6), t, db - 6, 0.2)
    # A: hook, hit on the clunk, wah-wah on "too big to fly"
    march(0.0, F(124), mel_inst="glock")
    stab_hit(F(124))
    for i, m in enumerate([50, 49, 48]): put(I.brass(m2f(m), 0.32, 0.7, r, "tuba", fall=-1.0 if i == 2 else 0), F(150) + i * 0.36, -5)
    # B: march (1999 .. 28.6 s), with a cymbal on "Stryker" and the tank hit
    march(F(186) - 0.05, F(860), bar0=0, mel_inst="fife")
    put(I.cymbal(0.5, r, 1.4), F(612), -14, 0.3)
    stab_hit(F(388), -7)
    # tension: G minor from Iraq through the cage, a snare roll into "Wait"
    march(F(860), F(1096), roots=MINOR_ROOTS, minor=True, snare_db=-15)
    for tt_, v in I.snare_roll(F(1060), F(1096), 0.2, 0.75, r): put(I.snare(v, r, 0.25, buzz=True), tt_, -16, 0.1)
    # "Wait, a grill? Against rockets?": two questioning tuba notes
    put(I.brass(m2f(41), 0.25, 0.6, r, "soft"), F(1101), -6); put(I.brass(m2f(46), 0.35, 0.6, r, "soft", scoop=-60), F(1110), -6)
    put(I.brass(m2f(43), 0.25, 0.6, r, "soft"), F(1124), -6); put(I.brass(m2f(48), 0.45, 0.6, r, "soft", scoop=-80), F(1134), -6)
    # C: golden explanation: pads + pizzicato + vibes; the signal = rising glock; hose = playful pizz; hiccup on "stops"
    t0 = F(1154); chords = [[58, 62, 65, 69], [55, 58, 63, 67], [60, 63, 67, 70], [57, 60, 65, 69]]
    bars = int((F(1543) - t0) / (4 * BEAT)) + 1
    for b in range(bars):
        tb = t0 + b * 4 * BEAT
        ch = chords[b % 4]
        cut = F(1371) if tb < F(1371) < tb + 2.0 else None
        d = 4 * BEAT if not cut else max(0.1, cut - tb)
        put(I.pad([m2f(n_) for n_ in ch], d, 0.55, r, att=0.3, rel=0.4), tb, -16)
        for beat in range(4):
            tp = tb + beat * BEAT
            if cut and cut <= tp < cut + 0.6: continue
            put(I.pluck(m2f(ch[0] - 24 + (7 if beat % 2 else 0)), 0.7, r, 0.6), tp, -9, -0.1)
            put(I.vibes(m2f(ch[beat % 4] + 12), 0.45, r, 1.0), tp + BEAT / 2, -18, 0.3)
    for i in range(10): put(I.glock(m2f(70 + 2 * i), 0.5, r, 0.7), F(1237) + i * 0.19, -16, 0.2)
    # D: march returns (bright), a stop on "one problem", final button on "grill"
    march(F(1543), F(1650), mel_inst="glock", bar0=0)
    put(I.brass(m2f(34), 0.6, 0.8, r, "tuba", fall=-2.0), F(1658), -4)
    march(F(1676), F(1916), mel_inst="glock", bar0=2)
    stab_hit(F(1918), -3)
    return M

# ---------------------------------------------------------------- mix
def main():
    v, sr = read_wav(os.path.join(ROOT, "voice", "voice.wav"))
    v = signal.resample_poly(v, SR, sr, axis=-1)
    v = st(v[0]); V = np.zeros((2, N)); V[:, : min(N, v.shape[1])] = v[:, :N]
    words = json.load(open(os.path.join(ROOT, "voice", "words.json")))
    M = score(); S = sfx()
    # reverb glue for music + a little for SFX
    ir = make_ir(1.1, 3, pre=0.01, hf=1.2)
    M = M + 0.18 * convolve_st(M, ir); S = S + 0.08 * convolve_st(S, ir)
    # ducking: music dips 4 dB under speech (spans from words.json, merged across short gaps)
    spans = []
    for w in words:
        if spans and w["s"] - spans[-1][1] < 0.35: spans[-1][1] = w["e"]
        else: spans.append([w["s"], w["e"]])
    duck = np.zeros(N)
    for a, b in spans: duck[max(0, ns(a - 0.08)): ns(b + 0.12)] = 1
    duck = signal.lfilter([1 - np.exp(-1 / (0.08 * SR))], [1, -np.exp(-1 / (0.08 * SR))], duck)
    M = M * dbg(-4 * duck)[None, :]
    # levels: music bed ~ -10 LU under the voice (+3 dB standard), SFX at -6 dB against the voice-relative level
    Lv = integrated(V)
    M *= dbg((Lv - 13 + 3) - integrated(M))
    S *= dbg((Lv - 6 - 6) - momentary_max(S) + 6)
    mix = V + M + S
    g = dbg(-14.5 - integrated(mix)); mix *= g; V *= g; M *= g; S *= g
    # look-ahead peak limiter to -1.2 dBTP
    ceil = dbg(-1.4)
    peak = np.maximum.reduce([np.abs(mix[0]), np.abs(mix[1])])
    look = ns(0.003)
    gr = np.minimum(1, ceil / np.maximum(peak, 1e-9))
    gr = np.minimum.reduce([np.roll(gr, -k) for k in range(0, look, max(1, look // 8))])
    a = np.exp(-1 / (0.08 * SR)); out = np.empty(N); g0 = 1.0
    for i in range(N):
        g0 = gr[i] if gr[i] < g0 else a * g0 + (1 - a) * gr[i]
        out[i] = g0
    mix *= out[None, :]
    mix = fades(mix, 0.002, 0.25)
    write_wav(os.path.join(HERE, "mix.wav"), mix); write_wav(os.path.join(HERE, "stem_voice.wav"), V); write_wav(os.path.join(HERE, "stem_music.wav"), M); write_wav(os.path.join(HERE, "stem_sfx.wav"), S)
    lines = [f"# Sound cues: The Grill That Grounded a Stryker\n", f"mix: {integrated(mix):.2f} LUFS integrated, true peak {true_peak(mix):.2f} dBTP, {N / SR:.3f} s\n",
             f"voice {integrated(V):.1f} / music {integrated(M):.1f} / sfx {integrated(S):.1f} LUFS (stems at mix gain)\n", "| time (s) | frame | event | dB |", "|---|---|---|---|"]
    for t_, name, db in sorted(CUES): lines.append(f"| {t_:.2f} | {round(t_ * FPS)} | {name} | {db} |")
    open(os.path.join(HERE, "cues.md"), "w").write("\n".join(lines) + "\n")
    print("\n".join(lines[:4]))

if __name__ == "__main__":
    main()
