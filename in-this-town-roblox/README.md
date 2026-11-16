# In this town, everyone has a number above their head (Roblox Studio build)

Roblox Studio version of the story in `../in-this-town-zero`, following the stages in
`../in-this-town-master-prompt.md`.

- `script.md` : the narration, one numbered line per shot (Stage 1).
- `greybox.lua` : Stage 2 grey-box town. Paste it into the Studio command bar on an empty
  baseplate. It builds everything under `Workspace.ITT_Greybox` and can be re-run safely.

The layout is the code-rendered film's town at 3 studs per unit, centred on the origin, so the
camera positions in `../in-this-town-zero/src/shots.js` carry over by multiplying by 3.

`greybox.lua` has been syntax-checked but not yet run in Studio.
