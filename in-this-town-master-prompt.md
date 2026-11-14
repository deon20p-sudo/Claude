# "In This Town" Roblox Short — master prompt for Claude Code + Roblox Studio

Reconstructed from the Simply Azan tutorial transcript. This is not the creator's
own prompt (that one is in their free Skool community); it follows the same stages
and rules the video describes.

Before pasting: open Roblox Studio on an empty baseplate, go to
Assistant -> Manage MCP Servers -> turn on "Enable Studio as MCP server",
then Quick Connect -> Claude Code. Test with: "Put a red block in the middle
of the map and take a screenshot."

Change only the RULE line, then paste everything below into Claude Code.

---

RULE: In this town, <your one rule here>.

You are building a 2.5-3 minute vertical "In this town" Roblox story inside
Roblox Studio through the Studio MCP connection. Work through the stages below
in order. Stop where a stage says STOP and wait for my reply.

## Stage 0 - Rule (skip if RULE above is filled in)
Pitch me 10 one-line rules for a normal town where exactly one thing is
different. A good rule makes the reader ask "wait, what happens then?".
STOP and let me pick.

## Stage 1 - Script
Write the narration as numbered short lines (one line = one shot, roughly one
second of speech each, about 130 lines total). Follow this shape:
1. First line states the rule as something that should not be true, said as if
   it is completely normal.
2. Life under the rule (how the town lives with it).
3. The one kid the rule does not work for.
4. "But one day..." - something breaks.
5. The crisis.
6. A twist.
7. A cliffhanger ending that sets up part two.
Plant three small, throwaway-seeming lines in the first third; each one must
pay off at the end. Plain words, short sentences, third person narrator.
Save it as script.md. STOP and show me the script.

## Stage 2 - Grey-box layout
Build the town as plain grey boxes only: streets, building footprints, and
markers where each character stands. No detail yet.
Hard rule: build everything centred on the map origin (within ~200 studs of
0,0,0) so the camera always has the town in view.
Take screenshots from above and from street level. STOP and let me correct the
layout.

## Stage 3 - Detailed world
Replace the grey boxes with the real thing: shops, a school, houses, cars,
trees, street furniture, signs. Vary house shapes and colours. Keep parts
anchored and grouped in named Models/Folders.

## Stage 4 - Show the rule in the world
The rule must be visible in every shot with the sound off. Whatever the rule
is (a number over each head, snow, lights, a counter on a wall), attach it to
every character or location it applies to, not only the main kid.

## Stage 5 - People
Fill the town with blocky characters: a named main kid with a distinct, bright
outfit, the supporting cast the script needs, and background townspeople on
the streets so the town never looks empty. Give each a simple, readable
expression and colour.

## Stage 6 - Lighting
Set Lighting so the look matches the big channels:
- Low sun (early morning / late afternoon clock time) for long shadows
- Dark, strong shadows; shadows enabled on all key parts
- Pale sky
- Warm colour grade (ColorCorrection tint toward warm, slight saturation and
  contrast boost), light bloom, soft atmosphere haze
Take a screenshot and compare against these targets before moving on.

## Stage 7 - Shot list
Write one shot per script line into shots.json:
{ "n", "line", "subject", "start_cframe", "end_cframe", "duration", "fov",
  "roll_degrees", "move" }
Camera rules:
- A new shot about every second; the camera moves in every shot, never static
- Most shots are slow push-ins; every so often a hard snap-in on a key word
- Many shots start close on the subject and pull back
- Roughly half the shots have a slight sideways tilt (a few degrees of roll)
- Close-ups at character eye level; wide shots only to establish

## Stage 8 - Camera script (vertical trick)
Write a LocalScript that sets the camera to Scriptable and plays shots.json in
order with tweens. Rotate the camera 90 degrees around its look axis for the
whole run, so the wide Studio window records a full-height vertical frame once
the recording is rotated back. Hide the player's own character and any GUI you
can. Print the shot number and timestamp as each shot starts.

## Stage 9 - Self-check
Press Play yourself. Confirm from the output log that every shot ran, and take
screenshots at several shots to confirm the town (not empty sky) is in frame
and the rule is visible. Fix anything that failed and re-run.
Then tell me it is ready to screen-record, and save script.md and shots.json
where I can find them.
