---
name: short-voice
description: Narration voice for story shorts. Use when generating, changing or matching the narrator voice, pitch or speed for a short, or when the user asks to clone a voice.
---

# Narrator voice for shorts

## The user's standing preference
A male narrator with a sped-up, higher-pitched sound (finished mix around 175-190 Hz median pitch). Not a female voice. Speeding the whole video up about 1.12x is fine.

## How to get that sound
- With the repo's open voice model: `VOICE=am_fenrir PITCH=1.18 SPEED=0.86 .venv/bin/python tools/tts.py`, then compose with `SPEEDUP=1.12`. `PITCH` raises pitch and tone together like sped-up audio without changing pace.
- With a voice tool on the user's PC (ask its name and how it is reached first): generate at normal pace, then speed up 1.2-1.3x without pitch correction.
- To swap the voice on a finished video without re-rendering: `FIT=1 VOICE=... PITCH=... tools/tts.py`, then `tools/audio.py`, `tools/captions.py`, `tools/compose.sh`.

## Check your work
You may not be able to hear audio. Measure instead: median pitch of the final mix (parselmouth), loudness near -14 LUFS, voice about 17 dB above music. Tell the user it was matched by measurement.

## Voice cloning
- Do not clone a voice from someone else's published video or from reference clips whose speaker you cannot confirm.
- The user's own voice is fine: ask for a fresh, clean 30-60 second recording with no music, or use a voice already created in their own voice-tool account.
