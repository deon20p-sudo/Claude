# In this town, the monster sleeps as long as the bell rings

A 2-minute vertical "In this town" story short, made entirely with code: no Roblox Studio, no Blender,
no stock footage or sound libraries. This is the "Claude-only" route from the tutorial videos:
references → style rules → a small animation engine → story → render → fix.

The finished video is `in-this-town-the-bell.mp4` (1080x1920, 30 fps).

## The story

- **Rule:** a monster sleeps on the hill as long as the bell rings every hour.
- **The kid:** Mina, who counts everything, and lies awake counting the bells.
- **But one night:** in a storm, she counts to eleven and twelve never comes.
- **Twist:** Tobias the bell-ringer is deaf. He never used the clock (stuck at ten past four for thirty
  years). He feels the monster's heartbeat through the stone with his bare feet.
- **Cliffhanger:** Mina feels two heartbeats. One on the hill, one under the town.

Three early lines pay off later: he never says hello back, he wears no shoes, the clock is stuck.

## How it is built

| Step | File | What it does |
|---|---|---|
| Shot list + script | `src/shots.js` | One entry per shot: narration line, lighting, camera move, what the actors do |
| Engine | `src/engine.js` | three.js scene: town, tower, monster rig, blocky characters, weather, lighting presets. Every frame is a pure function of time |
| Voice | `tools/tts.py` | Narration with the open Kokoro voice model, one clip per line, plus word timings |
| Sound | `tools/audio.py` | Bell, thunder, rain, heartbeats, footsteps and a quiet score, all synthesized with numpy, mixed under the voice |
| Captions | `tools/captions.py` | Word-by-word captions with the spoken word highlighted |
| Render | `tools/render.mjs`, `tools/render-all.sh` | Headless Chromium renders frames, ffmpeg encodes 10-second chunks |
| Edit | `tools/compose.sh` | Joins chunks, adds glow, vignette, colour, captions and the soundtrack |

Style rules taken from the reference videos: a new shot roughly every 1.4 seconds, the camera moves in
every shot (mostly slow push-ins, a hard snap-in on key words), about half the shots are tilted, the
rule is visible in the world (the bell, the sleeping monster, the stuck clock), low warm sun with long
shadows by day, and the look changes when the story breaks (day → storm).

## Rebuild

```bash
npm install                      # three.js + caption font
python3 -m venv .venv && .venv/bin/pip install kokoro-onnx soundfile numpy scipy
# voice model files go in models/ (kokoro-v1.0.onnx, voices-v1.0.bin from the kokoro-onnx releases)
node tools/dump-script.mjs       # script + sound cues from the shot list
.venv/bin/python tools/tts.py    # narration + timeline
.venv/bin/python tools/audio.py  # soundtrack
.venv/bin/python tools/captions.py
tools/render-all.sh              # all frames (about 45 minutes on 4 CPU cores)
tools/compose.sh                 # final mp4
```

Preview while editing shots: `node tools/render.mjs sheet && tools/sheets.sh` renders one frame per shot
into contact sheets under `build/`.

To make a different story, change the lines and staging in `src/shots.js`. To change the voice, set
`VOICE` (for example `VOICE=af_heart`) when running `tools/tts.py`.
