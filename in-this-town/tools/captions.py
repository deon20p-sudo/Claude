"""Word-by-word captions (ASS): up to three words on screen, the spoken one highlighted, with a small pop."""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tl = json.load(open(f'{ROOT}/build/timeline.json'))
YEL, RED, WHITE = '&H4AE1FF&', '&H3850FF&', '&HFFFFFF&'
RED_FROM = 'two'          # the cliffhanger lines highlight in red
def ts(t): t = max(0, t); h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60; return f'{h}:{m:02d}:{s:05.2f}'
def clean(w): return re.sub(r'[",.;:]', '', w).upper()
head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Montserrat Black,106,&H00FFFFFF,&H00FFFFFF,&H00101010,&H96000000,0,0,0,0,100,100,0,0,1,8,4,5,40,40,40,1
Style: End,Montserrat Black,150,&H003850FF,&H00FFFFFF,&H00101010,&H96000000,0,0,0,0,100,100,2,0,1,9,0,5,40,40,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
ev = []; red = False
shots = tl['shots']
for si, s in enumerate(shots):
    if s['id'] == RED_FROM: red = True
    ws = s['words']
    if not ws: continue
    # chunks of <= 3 words and <= 14 characters
    chunks = []; cur = []
    for w in ws:
        txt = clean(w['w'])
        if cur and (len(cur) >= 3 or len(' '.join(clean(x['w']) for x in cur)) + 1 + len(txt) > 13): chunks.append(cur); cur = []
        cur.append(w)
    if cur: chunks.append(cur)
    line_end = s['start'] + s['dur']
    flat = [(c, i) for c in chunks for i in range(len(c))]
    for n, (c, i) in enumerate(flat):
        w = c[i]; a = w['start']
        b = flat[n + 1][0][flat[n + 1][1]]['start'] if n + 1 < len(flat) else min(line_end, w['end'] + 0.12)
        parts = [('{\\c%s}%s{\\c%s}' % (RED if red else YEL, clean(x['w']), WHITE)) if j == i else clean(x['w']) for j, x in enumerate(c)]
        ev.append(f"Dialogue: 0,{ts(a)},{ts(b)},Cap,,0,0,0,,{{\\pos(540,1310)\\fscx112\\fscy112\\t(0,90,\\fscx100\\fscy100)}}" + ' '.join(parts))
end = next(s for s in shots if s['id'] == 'end')
ev.append(f"Dialogue: 0,{ts(end['start'] + 0.3)},{ts(end['start'] + end['dur'] + 1)},End,,0,0,0,,{{\\pos(540,930)\\fad(120,0)\\fscx80\\fscy80\\t(0,160,\\fscx100\\fscy100)}}PART 2?")
open(f'{ROOT}/build/captions.ass', 'w').write(head + '\n'.join(ev) + '\n')
print(len(ev), 'caption events')
