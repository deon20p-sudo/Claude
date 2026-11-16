---
name: in-this-town-short
description: Make a vertical "In this town" Roblox-style story short from a one-line rule. Use when the user gives a rule like "In this town, X. One kid Y." or asks for a Roblox story short, a part 2, or changes to an existing one. Covers the story shape, the Roblox Studio build, the code-only fallback, voice, captions and edit.
---

# "In this town" story short

## 1. Pick the route first
- **Roblox Studio route (preferred when available):** only if Roblox Studio MCP tools are present in this session. Check your tool list. If they are missing, tell the user to open Studio, turn on Assistant -> Manage MCP Servers -> "Enable Studio as MCP server", then Quick Connect -> Claude Code. Prove the link: place a red block at the origin and take a screenshot.
- **Code-only route (fallback):** the engine in `in-this-town/` and `in-this-town-zero/` (three.js rendered headlessly, see their READMEs). Use it when Studio is not reachable. Never claim a Studio build you did not do.

## 2. Story (always)
One rule, and the one kid it does not work for. Write short lines, one shot per line (about 1.2-1.5 s each), 60-90 lines.
1. Line 1 states the rule as something impossible, said as if normal.
2. Life under the rule.
3. The kid who is different.
4. "But one day/night..." something breaks.
5. Crisis.
6. Twist that reframes the rule.
7. Cliffhanger, then a "PART 2?" card.

Plant three throwaway lines early; each must pay off at the end. Show the script to the user before building unless they said to go ahead.

## 3. Look and camera rules
- The rule is visible in every shot with the sound off (a number above every head, a bell, a counter).
- One landmark the camera keeps returning to.
- Day: low warm sun, long dark shadows, pale sky. Change the look when the story breaks (storm, night).
- Camera moves in every shot: mostly slow push-ins, a hard snap-in on key words, about half the shots tilted a few degrees.
- Faces must be readable at night: add a soft fill on characters.
- Keep the town near the map centre so the camera never shows empty sky.

## 4. Studio build order
Follow `in-this-town-master-prompt.md`: script -> grey-box layout (STOP for approval) -> detailed town -> rule made visible -> people -> lighting -> shot list (`shots.json`) -> camera script turned 90 degrees for vertical recording -> press Play and confirm every shot ran -> user screen-records.

## 5. Code-only build order
In a copy of `in-this-town-zero/`: edit `src/shots.js` (lines, staging, cameras), then
`node tools/dump-script.mjs` -> `tools/tts.py` -> `node tools/render.mjs sheet && tools/sheets.sh` (look at every shot, fix framing) -> `tools/render-all.sh` -> `tools/audio.py` -> `tools/captions.py` -> `SPEEDUP=1.12 tools/compose.sh out.mp4`. Review the final video frame by frame before sending.

## 6. Voice, captions, edit
See the `short-voice` skill for the narrator. Captions: up to three words on screen, spoken word highlighted, upper case, heavy font with outline. Sound effects only on things you can see. Music quiet, about 17 dB under the voice.

## 7. Honesty
Say plainly what you could not check (for example, you cannot hear audio) and which route you used.
