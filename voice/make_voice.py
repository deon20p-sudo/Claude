# Narration for the Stryker short: Kokoro-82M (Apache-2.0, q8 ONNX) via kokoro-onnx, one steady male voice.
# The model weights come from the npm package `kokoro-q8-shards` and the voice tensors from `kokoro-local-runtime`
# (Hugging Face is not reachable from the render box; npm is). Every sentence is synthesized on its own, joined
# with short gaps (the reference style has almost no pauses), and word times come from the model's own phoneme
# durations are not exposed by the q8 ONNX export, so words are aligned by DTW: every word is also synthesized on its
# own (known boundaries), the isolated words are concatenated, and a log-mel DTW maps that reference onto the
# natural sentence; each word starts where its first reference frame lands.
#
# Usage: python voice/make_voice.py <dir with kokoro-q8.part*.bin> <dir with voices/*.bin>
# Writes voice/voice.wav (24 kHz mono) and voice/words.json ([{"w", "s", "e"}], seconds).
import json, os, re, sys, glob
import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(HERE, "_model")
VOICE = "am_michael"
SPEED = 1.3
GAP = 0.11          # silence between sentences (s)
LONG_GAP = 0.22     # after the hook, before "You see," and before the final beat
LEAD_IN = 0.06

# (spoken text for the TTS, script words for the timings). Numbers are spelled out so phoneme words == script words.
LINES = [
    ("The Army built a combat vehicle to fit inside a cargo plane, then gave it a grill that made it too big to fly.", LONG_GAP),
    ("It's nineteen ninety-nine, and the Army's top general wants a whole brigade anywhere on Earth in four days.", GAP),
    ("Tanks are way too heavy for that, so engineers build something lighter: eight big wheels, room for nine soldiers, and sixty miles an hour.", GAP),
    ("They name it the Stryker, after two soldiers who both earned the Medal of Honor, and weren't even related.", GAP),
    ("It squeezes into a C one-thirty with only inches to spare.", GAP),
    ("Then it rolls into Iraq, and meets rocket-propelled grenades.", GAP),
    ("So the crews wrap it in a steel cage that looks exactly like a giant barbecue grill.", GAP),
    ("Wait, a grill? Against rockets?", LONG_GAP),
    ("You see, that warhead only fires when a tiny electric signal runs from its nose to its back.", GAP),
    ("Ever stepped on a garden hose? The water stops before it reaches the end.", GAP),
    ("The bars pinch the warhead's nose the same way, so the signal never makes it.", GAP),
    ("About half the time, the rocket just bounces off as a dud.", LONG_GAP),
    ("There's just one problem. The cage adds two and a half tons, and makes the Stryker wider.", GAP),
    ("So the vehicle built around one airplane now needs a bigger one, just to carry its barbecue grill.", 0.0),
]


def prepare(shards: str, voices: str):
    os.makedirs(MODEL_DIR, exist_ok=True)
    onnx = os.path.join(MODEL_DIR, "kokoro-q8.onnx")
    if not os.path.exists(onnx):
        with open(onnx, "wb") as out:
            for i in range(6):
                out.write(open(os.path.join(shards, f"kokoro-q8.part{i}.bin"), "rb").read())
    npz = os.path.join(MODEL_DIR, "voices.npz")
    if not os.path.exists(npz):
        arrs = {os.path.basename(p)[:-4]: np.fromfile(p, dtype=np.float32).reshape(-1, 1, 256) for p in glob.glob(os.path.join(voices, "*.bin"))}
        np.savez(npz, **arrs)
    return onnx, npz


def words_of(text: str):
    return [w for w in re.findall(r"[A-Za-z0-9'\-]+", text)]


def logmel(y, sr, hop=0.01, win=0.025, nb=40):
    h, w = int(hop * sr), int(win * sr)
    n = max(1, 1 + (len(y) - w) // h)
    fr = np.stack([y[i * h:i * h + w] if i * h + w <= len(y) else np.pad(y[i * h:], (0, w - len(y[i * h:]))) for i in range(n)]) * np.hanning(w)
    spec = np.abs(np.fft.rfft(fr, 512)) ** 2
    f = np.linspace(0, sr / 2, spec.shape[1])
    mel = lambda x: 2595 * np.log10(1 + x / 700)
    edges = 700 * (10 ** (np.linspace(mel(60), mel(7600), nb + 2) / 2595) - 1)
    fb = np.stack([np.clip(np.minimum((f - edges[i]) / (edges[i + 1] - edges[i]), (edges[i + 2] - f) / (edges[i + 2] - edges[i + 1])), 0, None) for i in range(nb)])
    m = np.log(spec @ fb.T + 1e-8)
    return (m - m.mean(0)) / (m.std(0) + 1e-5)


def trim(y, thr=0.02):
    idx = np.where(np.abs(y) > thr * np.abs(y).max())[0]
    return y[idx[0]:idx[-1] + 1] if len(idx) else y


def dtw(A, B):
    n, m = len(A), len(B)
    C = np.sqrt(((A[:, None, :] - B[None, :, :]) ** 2).sum(-1))
    D = np.full((n + 1, m + 1), np.inf); D[0, 0] = 0
    for i in range(1, n + 1):
        Di, Dp, Ci = D[i], D[i - 1], C[i - 1]
        for j in range(1, m + 1):
            Di[j] = Ci[j - 1] + min(Dp[j - 1], Dp[j], Di[j - 1])
    i, j, path = n, m, []
    while i > 0 and j > 0:
        path.append((i - 1, j - 1))
        k = np.argmin([D[i - 1, j - 1], D[i - 1, j], D[i, j - 1]])
        i, j = (i - 1, j - 1) if k == 0 else (i - 1, j) if k == 1 else (i, j - 1)
    return path[::-1]


def align(k, audio, sr, sw):
    """word [start, end] in seconds inside `audio` (natural sentence) by DTW against isolated-word synthesis"""
    refs, bounds, t = [], [], 0
    for w in sw:
        a, _ = k.create(w.replace("-", " "), voice=VOICE, speed=SPEED, lang="en-us")
        a = trim(a)
        refs.append(a); bounds.append(t); t += len(a)
    R = logmel(np.concatenate(refs), sr); N = logmel(audio, sr)
    path = dtw(R, N)
    first = {}
    for i, j in path:
        first.setdefault(i, j)
    rb = [int(b / sr / 0.01) for b in bounds]
    starts = [first.get(min(b, len(R) - 1), 0) * 0.01 for b in rb]
    nz = np.where(np.abs(audio) > 0.02 * np.abs(audio).max())[0]
    speech_end = (nz[-1] + 1) / sr if len(nz) else len(audio) / sr
    starts[0] = max(starts[0], nz[0] / sr if len(nz) else 0)
    out = []
    for i, s0 in enumerate(starts):
        e0 = starts[i + 1] if i + 1 < len(starts) else speech_end
        out.append([s0, max(s0 + 0.04, e0)])
    return out


def main():
    from kokoro_onnx import Kokoro
    onnx, npz = prepare(sys.argv[1], sys.argv[2])
    k = Kokoro(onnx, npz)
    sr = 24000
    chunks, words, t = [np.zeros(int(LEAD_IN * sr), np.float32)], [], LEAD_IN
    for text, gap in LINES:
        audio, sr, tim = k.create_timed(text, voice=VOICE, speed=SPEED, lang="en-us", sentence_pause=0.12, clause_pause=0.06)
        sw = words_of(text)
        dur = len(audio) / sr
        groups = align(k, audio, sr, sw)
        for w, (s, e) in zip(sw, groups):
            words.append({"w": w, "s": round(t + s, 3), "e": round(t + e, 3)})
        chunks.append(audio.astype(np.float32))
        chunks.append(np.zeros(int(gap * sr), np.float32))
        t += dur + int(gap * sr) / sr
    y = np.concatenate(chunks)
    y = y / max(1e-6, np.abs(y).max()) * 0.89
    sf.write(os.path.join(HERE, "voice.wav"), y, sr, subtype="PCM_16")
    json.dump(words, open(os.path.join(HERE, "words.json"), "w"), indent=0)
    n = len(words)
    print(f"{n} words, {len(y) / sr:.2f} s, {n / (len(y) / sr):.2f} words/s")


if __name__ == "__main__":
    main()
