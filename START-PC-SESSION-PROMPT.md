# Prompt to start the PC session

Start a new Claude Code session in the Claude desktop app that runs **on this computer** in the `claude`
folder (branch `ccr-b751c87e-80ys9i`), with Roblox Studio open and its MCP server enabled
(Assistant -> Manage MCP Servers -> "Enable Studio as MCP server", then connect Claude Code). Paste:

```
Use the in-this-town-short and short-voice skills in .claude/skills.
First, list your tools and tell me whether the Roblox Studio MCP tools are connected. If not, tell me exactly what to click, then test the link by placing a red block at the origin and taking a screenshot.
Then follow roblox-director-prompt.md exactly, step by step, stopping at every STOP, with:

IDEA: In this town, your reflection waves back one second late. One kid's waves first.
LENGTH: full (2 to 2:45)

The story must be complete, with no part 2 and no cliffhanger: end when the kid and the reflection finally wave at the same moment.
For the reflections, use a large shop window or mirror that the shots return to.
When the footage is recorded, ask me the name of my voice tool for the narration (male, sped-up, higher pitch).
Tell me plainly anything you could not do or could not check.
```

To make a different short, change the IDEA and LENGTH lines.
