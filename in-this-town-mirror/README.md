# In this town, your reflection waves back one second late

A complete vertical "In this town" short (no part 2), made with the same code engine as
`../in-this-town-zero`. Finished video: `in-this-town-mirror.mp4` (1080x1920, 30 fps).

## Story
- **Rule:** everyone's reflection waves back one second late. The whole town checks in the bakery window every morning.
- **The kid:** Leo's reflection waves a second *early*. He learned to follow it.
- **Plants:** the bakery sign hangs by one chain; his reflection has never looked scared; his little sister Pip copies everything he does.
- **Crisis:** on a windy morning his reflection looks scared, looks up at the sign, and throws itself sideways. Leo is too far from Pip, but he follows his reflection, and Pip follows him, out from under the falling sign.
- **Ending:** his reflection never saw the future, it was just one second braver than him. Now he has caught up, and for the first time it waves at the same time he does.

## How the reflections work
The shop window is a real three.js mirror (`Reflector`). Before each frame, `mirrorPass` in `src/engine.js`
re-poses every character at the time their reflection should show (one second earlier for the town,
one second later for Leo), renders the mirror, then restores the real poses. Per-shot overrides are
`lags` in `src/shots.js` (for example `{ leo: 0 }` in the ending).

## Rebuild
Same steps as `../in-this-town-zero/README.md` (`node_modules`, `models`, `.venv` are shared symlinks):
`node tools/dump-script.mjs`, `VOICE=am_fenrir PITCH=1.18 SPEED=0.86 .venv/bin/python tools/tts.py`,
`tools/audio.py`, `tools/captions.py`, `tools/render-all.sh`, `SPEEDUP=1.12 tools/compose.sh in-this-town-mirror.mp4`.
