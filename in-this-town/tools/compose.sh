#!/bin/bash
# Joins the rendered chunks, adds glow + vignette + colour, burns in captions and adds the soundtrack.
cd "$(dirname "$0")/.." && ls build/seg/*.mp4 | sed "s#build/seg/#file 'seg/#; s#\$#'#" > build/concat.txt
OUT=${1:-in-this-town-the-bell.mp4}
ffmpeg -v error -stats -y -f concat -safe 0 -i build/concat.txt -i build/audio.wav -filter_complex \
"[0:v]format=gbrp,split[a][b];[b]curves=all='0/0 0.62/0 1/1',gblur=sigma=24[bl];[a][bl]blend=all_mode=screen:all_opacity=0.5,vignette=angle=PI/5.2,eq=saturation=1.14:contrast=1.05,ass=build/captions.ass:fontsdir=build/fonts,format=yuv420p[v]" \
-map "[v]" -map 1:a -c:v libx264 -preset medium -crf 19 -r 30 -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT" && ls -la "$OUT"
