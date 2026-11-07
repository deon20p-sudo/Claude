# Writes out/stryker/shots.json (shot ranges, crossfade windows, flash, planned cuts + kicks) from story.ts for short_qa.py.
import json, re, sys, os
src = open(sys.argv[1] if len(sys.argv) > 1 else "src/videos/stryker/story.ts", encoding="utf-8").read()
total = int(re.search(r"TOTAL = (\d+)", src).group(1))
shots = [{"id": int(i), "a": int(a), "b": int(b) if b != "TOTAL" else total} for i, a, b in re.findall(r"\{ id: (\d+), a: (\d+), b: (\w+),", src)]
xf = {int(k): int(v) for k, v in re.findall(r"(\d+): (\d+)", re.search(r"XFADE[^=]*= \{([^}]*)\}", src).group(1))}
flash = int(re.search(r"FLASH_AT = (\d+)", src).group(1))
xfade = [[s["a"] - xf[s["id"]] // 2, s["a"] + xf[s["id"]] // 2] for s in shots if s["id"] in xf]
cuts = [[int(f), int(f)] for f in re.findall(r"\{ f: (\d+), cut: true", src)]
consts = {k: int(v) for k, v in re.findall(r"\b([A-Z_]+) = (\d+)\b", src)}
kicks = []
m = re.search(r"const KICKS[^=]*= \[(.*?)\];", src)
for t0 in re.findall(r"\[([\w +]+), [\d.]+\]", m.group(1)):
    expr = t0.strip()
    f0 = eval(expr, {}, consts)
    kicks.append([f0, f0 + 8])
os.makedirs("out/stryker", exist_ok=True)
json.dump({"shots": shots, "xfade": xfade, "flash": [flash, flash + 4], "planned": cuts + kicks}, open("out/stryker/shots.json", "w"), indent=1)
print(len(shots), "shots", xfade, flash, "cuts", [c[0] for c in cuts], "kicks", kicks)
