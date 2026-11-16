#!/bin/bash
# Renders the whole film in 10-second chunks, 4 at a time. Pass chunk numbers to re-render only those.
cd "$(dirname "$0")/.." && mkdir -p build/seg
TOTAL=$(python3 -c "import json;print(json.load(open('build/timeline.json'))['total'])")
FR=$(python3 -c "import math;print(math.ceil($TOTAL*30))"); N=$(( (FR + 299) / 300 ))
LIST="${@:-$(seq 0 $((N-1)))}"
echo "$LIST" | tr ' ' '\n' | xargs -P 4 -I{} bash -c 'a=$(( {} * 300 )); b=$(( a + 300 )); [ $b -gt '$FR' ] && b='$FR'; node tools/render.mjs render --from $a --to $b --out build/seg/$(printf %03d {}).mp4 > build/seg/$(printf %03d {}).log 2>&1'
ls build/seg/*.mp4 | wc -l; echo "chunks of $N done"
