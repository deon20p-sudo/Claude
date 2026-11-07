# The Grill That Grounded a Stryker

An original 64.5 s vertical (9:16) cartoon short about the U.S. Army's M1126 Stryker. It was made with the
**cartoon-3d-short** skill: flat 2D cartoon characters in a painted 3D world, rendered with three.js inside Remotion.

> The Army built a combat vehicle to fit inside a cargo plane, then gave it a grill that made it too big to fly.

The script, the sources for every fact and the voice-over text are in [`SCRIPT.md`](SCRIPT.md).

## Layout
| Path | What it is |
|---|---|
| `src/videos/stryker/story.ts` | Shot list timed to the voice, vehicle paths, cameras, kicks, depth of field |
| `src/videos/stryker/build.ts` | Models (Stryker with slat cage, C-130-style plane, big jet, tank, RPG) and the sets (airfield + hangar, desert town + motor pool, garden) |
| `src/videos/stryker/world.ts` | Scene: sky, camera-relative sun, fog, clouds, posing, the card placement loop |
| `src/videos/stryker/cast.ts`, `toon.ts`, `fx.ts` | The cast as lit 2D cards (soldiers, general, engineers, loadmaster, kid, parent) and the 2D effects |
| `src/videos/stryker/ink.ts`, `lensblur.ts`, `grade.ts`, `shade.ts`, `cardshade.ts`, `lights.ts`, `paint.ts` | The skill's look: ink outlines, lens blur, colour grade, two-tone shading, painted textures |
| `voice/make_voice.py` | Narration: Kokoro-82M (Apache-2.0) from npm-hosted weights, with DTW word alignment into `words.json` |
| `audio/sound.py` | Synthesized SFX, an original march score and the mix (−14.5 LUFS, ≤ −1 dBTP) |
| `scripts/` | `stills.mjs` (look checks), `shots_json.py` + `short_qa.py` (frame-by-frame QA), `sbs_sheet.py` |

## Rebuild
```sh
npm install
python voice/make_voice.py <kokoro-q8-shards package dir> <kokoro-local-runtime voices dir>   # voice + word times
python audio/sound.py                                                                        # SFX + score + mix
node scripts/stills.mjs out/stryker/x_ 40,400,1000 0.5                                       # look-check stills
npx remotion render src/index.ts StrykerShort out/stryker/video.mp4 --codec=h264 --crf=16 --gl=swangle
ffmpeg -i out/stryker/video.mp4 -i audio/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k out/stryker/final.mp4
```
On a machine without a GPU, pass `--gl=swangle` and `--browser-executable` pointing at a local Chromium.
