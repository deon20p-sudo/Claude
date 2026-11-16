# In this town, everyone has a number above their head

A vertical "In this town" story short made entirely with code, using the same engine as
`../in-this-town` (three.js scene rendered headlessly, synthesized sound, open-source narration voice).

The finished video is `in-this-town-zero.mp4` (1080x1920, 30 fps).

## The story

- **Rule:** everyone has a number above their head counting their friends.
- **The kid:** Sam's number is zero. He says hello to everyone, and does kind things at night when nobody sees.
- **But one night:** Ivy (87 friends) takes a dare in a storm and ends up hanging from the bell tower.
  Her friends step back and her number falls to zero. Only Sam runs to the tower.
- **Twist:** the number never counted the friends you have. It counts the ones who would come for you.
  By morning the mayor's 412 is 3.
- **Cliffhanger:** Sam's number finally moves, to minus one.

## What differs from the first film

- `src/shots.js` is the new story: 64 shots, with the number above every head set per shot.
- `src/engine.js` adds number tags that follow characters, a new cast (Sam, Ivy, the mayor, extra kids),
  a dog, and a basket prop. The monster is switched off.
- `tools/audio.py` adds number blips, a ticking count-down and a new score layout.

## Rebuild

`node_modules`, `models` and `.venv` are shared with `../in-this-town` (symlinks, not committed).

```bash
node tools/dump-script.mjs
VOICE=am_fenrir PITCH=1.18 SPEED=0.86 .venv/bin/python tools/tts.py
.venv/bin/python tools/audio.py
.venv/bin/python tools/captions.py
tools/render-all.sh
SPEEDUP=1.12 tools/compose.sh in-this-town-zero.mp4
```

The narration is a stock male voice pitched up the way sped-up audio is, and the whole video plays 1.12x
faster. To swap in another voice later without re-rendering the picture, run `tools/tts.py` with `FIT=1`
and a different `VOICE`, then the audio, captions and compose steps.
