#!/usr/bin/env bash
# Render the short in frame chunks (each chunk is its own file, so an interrupted run resumes where it stopped),
# then join them losslessly. Usage: scripts/render_chunks.sh [scale] [outname]
set -u
cd "$(dirname "$0")/.."
SCALE=${1:-1}; NAME=${2:-video_1080}
CH=${CHROME:-/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell}
TOTAL=$(grep -oP 'export const TOTAL = \K\d+' src/videos/stryker/story.ts)
DIR=out/stryker/chunks_$NAME; mkdir -p "$DIR"
STEP=250
for ((a = 0; a < TOTAL; a += STEP)); do
  b=$((a + STEP - 1)); ((b >= TOTAL)) && b=$((TOTAL - 1))
  f=$(printf "%s/c_%04d.mp4" "$DIR" "$a")
  [[ -s "$f" ]] && continue
  echo "$(date +%T) chunk $a-$b"
  npx remotion render src/index.ts StrykerShort "$f.tmp.mp4" --frames=$a-$b --codec=h264 --crf=16 --concurrency=2 --gl=swangle \
    --browser-executable="$CH" --timeout=300000 --scale="$SCALE" --log=error 2>&1 | grep -v "emory\|lower amount\|docker"
  [[ -s "$f.tmp.mp4" ]] && mv "$f.tmp.mp4" "$f" || { echo "chunk $a failed"; exit 1; }
done
ls "$DIR"/c_*.mp4 | sed "s/^/file '..\/..\/..\//; s/$/'/" > "$DIR/list.txt"
sed -i "s|file '../../../|file '$(pwd)/|" "$DIR/list.txt"
ffmpeg -y -v error -f concat -safe 0 -i "$DIR/list.txt" -c copy "out/stryker/$NAME.mp4" && echo "$(date +%T) DONE out/stryker/$NAME.mp4"
