#!/bin/bash
# tile build/sheet/*.jpg into contact sheets of 24 (8x3)
cd "$(dirname "$0")/.." && rm -f build/cs_*.jpg && ffmpeg -v error -y -framerate 1 -i build/sheet/%03d.jpg -vf "tile=8x3" build/cs_%02d.jpg && ls build/cs_*.jpg
