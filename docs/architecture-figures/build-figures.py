import base64, html
O="arch/"
def b64(f): return "data:image/png;base64,"+base64.b64encode(open(O+f,"rb").read()).decode()

# ---------- SVG primitives (AWS architecture-diagram style) ----------
C={"orange":"#ED7100","purple":"#8C4FFF","teal":"#01A88D","pink":"#E7157B","blue":"#527FFF","green":"#7AA116","red":"#DD344C","grey":"#545B64","dark":"#232F3E"}
GLYPH={
 "film":'<rect x="14" y="18" width="36" height="28" rx="2"/><path d="M14 26h36M14 38h36M22 18v28M42 18v28"/>',
 "wave":'<path d="M12 32h6l4-12 5 24 5-20 5 14 4-6h11"/>',
 "meter":'<path d="M16 44V34M24 44V28M32 44V22M40 44V30M48 44V18"/><path d="M12 48h40"/>',
 "voices":'<circle cx="24" cy="26" r="7"/><path d="M12 46c0-7 5-11 12-11s12 4 12 11"/><circle cx="42" cy="24" r="5"/><path d="M42 33c6 0 10 4 10 10"/>',
 "face":'<path d="M14 22v-8h8M42 14h8v8M14 42v8h8M42 50h8v-8"/><circle cx="32" cy="30" r="7"/><path d="M20 46c2-6 6-9 12-9s10 3 12 9"/>',
 "tag":'<path d="M16 16h10v32H16M48 16H38v32h10"/><path d="M28 36c0-5 4-7 6-7s6 2 6 7" /><path d="M32 22v14M36 22v14M30 22h8"/>',
 "merge":'<path d="M14 18h12l10 14h16M14 32h22M14 46h12l10-14"/><path d="M48 28l4 4-4 4"/>',
 "person":'<circle cx="26" cy="22" r="7"/><path d="M12 48c0-9 6-14 14-14s14 5 14 14"/><path d="M40 34l5 5 9-11"/>',
 "doc":'<path d="M18 12h20l10 10v30H18z"/><path d="M38 12v10h10M24 30h16M24 38h16M24 46h10"/>',
 "vtt":'<path d="M18 12h20l10 10v30H18z"/><path d="M38 12v10h10"/><path d="M24 34h6l3 8 3-16 3 8h9" />',
 "server":'<rect x="14" y="14" width="36" height="14" rx="2"/><rect x="14" y="36" width="36" height="14" rx="2"/><circle cx="21" cy="21" r="1.5"/><circle cx="21" cy="43" r="1.5"/>',
 "tv":'<rect x="12" y="14" width="40" height="26" rx="2"/><path d="M24 50h16M32 40v10"/>',
 "cc":'<rect x="12" y="16" width="40" height="30" rx="3"/><text x="32" y="37" font-size="15" font-weight="700" text-anchor="middle" fill="#fff" stroke="none" font-family="Arial,sans-serif">CC</text>',
 "layers":'<path d="M32 14l20 10-20 10-20-10z"/><path d="M12 32l20 10 20-10M12 40l20 10 20-10"/>',
 "clock":'<circle cx="32" cy="32" r="18"/><path d="M32 20v13l8 5"/>',
 "play":'<circle cx="32" cy="32" r="18"/><path d="M27 23l14 9-14 9z"/>',
 "probe":'<circle cx="28" cy="28" r="12"/><path d="M37 37l12 12"/><path d="M22 28a6 6 0 0 1 6-6"/>',
 "sliders":'<path d="M14 22h36M14 32h36M14 42h36"/><circle cx="24" cy="22" r="3" fill="currentColor"/><circle cx="40" cy="32" r="3" fill="currentColor"/><circle cx="30" cy="42" r="3" fill="currentColor"/>',
 "shield":'<path d="M32 12l18 6v14c0 10-8 17-18 20-10-3-18-10-18-20V18z"/><path d="M24 32l6 6 10-12"/>',
 "gear":'<circle cx="32" cy="32" r="7"/><path d="M32 12v6M32 46v6M12 32h6M46 32h6M18 18l4 4M42 42l4 4M18 46l4-4M42 22l4-4"/>',
 "lanes":'<rect x="12" y="14" width="40" height="36" rx="2"/><path d="M16 42h32M16 32h20M36 22h12" stroke-dasharray="3 2"/>',
 "eye":'<path d="M12 32c6-9 12-13 20-13s14 4 20 13c-6 9-12 13-20 13s-14-4-20-13z"/><circle cx="32" cy="32" r="5"/>',
 "check":'<circle cx="32" cy="32" r="18"/><path d="M22 32l7 7 13-14"/>',
 "text":'<path d="M16 18h32M16 28h32M16 38h20"/><rect x="12" y="12" width="40" height="40" rx="2"/>',
 "frame":'<rect x="12" y="14" width="40" height="30" rx="2"/><path d="M12 50h40"/><rect x="18" y="20" width="14" height="10"/>',
}
def tile(x,y,color,glyph,label,size=64,num=None,text_w=150):
    g=GLYPH[glyph]
    s=f'<rect x="{x}" y="{y}" width="{size}" height="{size}" rx="6" fill="{C[color]}"/>'
    s+=f'<g transform="translate({x},{y}) scale({size/64})" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color:#fff">{g}</g>'
    if num is not None:
        s+=f'<circle cx="{x+size-2}" cy="{y+2}" r="10" fill="{C["dark"]}" stroke="#fff" stroke-width="2"/><text x="{x+size-2}" y="{y+6}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">{num}</text>'
    lines=label if isinstance(label,list) else [label]
    for i,l in enumerate(lines):
        s+=f'<text x="{x+size/2}" y="{y+size+16+i*14}" text-anchor="middle" font-size="12" fill="{C["dark"]}">{html.escape(l)}</text>'
    return s
def group(x,y,w,h,title,sub=None,dashed=False,tint=None):
    st=f'fill="{tint}"' if tint else 'fill="none"'
    d=' stroke-dasharray="6 4"' if dashed else ''
    s=f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{8 if dashed else 2}" {st} stroke="{C["dark"]}" stroke-width="1.2"{d}/>'
    s+=f'<text x="{x+12}" y="{y+20}" font-size="13" font-weight="600" fill="{C["dark"]}">{html.escape(title)}</text>'
    if sub: s+=f'<text x="{x+12}" y="{y+36}" font-size="11" fill="#687078">{html.escape(sub)}</text>'
    return s
def arrow(d,label=None,lx=None,ly=None,dashed=False,color=None,end=True):
    col=color or C["dark"]
    s=f'<path d="{d}" fill="none" stroke="{col}" stroke-width="1.3"{" stroke-dasharray=\"5 4\"" if dashed else ""}{" marker-end=\"url(#ah)\"" if end else ""}/>'
    if label:
        w=len(label)*5.6+8
        s+=f'<rect x="{lx-w/2}" y="{ly-8}" width="{w}" height="14" fill="#fff"/><text x="{lx}" y="{ly+3}" text-anchor="middle" font-size="10.5" font-weight="600" fill="{C["dark"]}">{html.escape(label)}</text>'
    return s
def svg(w,h,body):
    return f'<svg viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg" font-family="\'Source Sans 3\',Arial,sans-serif"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="{C["dark"]}"/></marker></defs><rect width="{w}" height="{h}" fill="#fff"/>{body}</svg>'

# ---------- Figure 1: end to end ----------
b=""
b+=group(20,20,780,600,"Authoring workstation","macOS, offline. Models run locally; no audio leaves the machine.")
b+=tile(60,280,"grey","film",["Master video +","approved WebVTT"])
steps=[("orange","wave",["Forced alignment","WhisperX"],"word timings"),("orange","meter",["Delivery measurement","librosa"],"dB, Hz, width, pace"),("purple","voices",["Voice diarization","pyannote 3.1"],"voice clusters"),("purple","face",["Active speaker + faces","YuNet, SFace, lips"],"speaker, face boxes"),("purple","tag",["Sound tagging + direction","PANNs, stereo"],"sound events")]
ys=[64,172,280,388,496]
b+=arrow("M124 312 H170",end=False)
b+=arrow("M170 96 V528",end=False)
for i,(col,gl,lab,edge) in enumerate(steps):
    y=ys[i]; b+=tile(250,y,col,gl,lab,num=i+1)
    b+=arrow(f"M170 {y+32} H250")
    b+=arrow(f"M314 {y+32} H470" + (" V312 H520" if i==2 else ""),end=(i==2))
b+=arrow("M470 96 V528",end=False)
for i,(col,gl,lab,edge) in enumerate(steps):
    b+=arrow("M0 0",label=edge,lx=392,ly=ys[i]+32,end=False)
b+=tile(520,280,"blue","merge",["Proposal merge","propose.py, --auto gates"],num=6)
b+=arrow("M584 312 H660",label="proposals",lx=622,ly=300)
b+=tile(660,280,"green","person",["Review page","a person confirms"],num=7)
b+=arrow("M724 312 H860",label="verified",lx=800,ly=300)
b+=tile(860,280,"grey","doc",["companion.en.json","schema 0.2, per-cue status"])
b+=arrow("M60 320 H40 V606 H820 V452 H860",label="unchanged, hash-locked",lx=500,ly=606)
b+=tile(860,420,"grey","vtt",["captions.en.vtt","the approved words"])
b+=group(1000,20,170,600,"Stream origin","HLS host, or packaged")
b+=tile(1053,140,"teal","server",["HLS segments","+ manifest"])
b+=tile(1053,350,"teal","text",["VTT + companion","served beside the stream"])
b+=arrow("M924 312 H1000 V382 H1053")
b+=arrow("M924 452 H1000 V382",end=False)
b+=group(1200,20,180,600,"Fire TV","Vega OS")
b+=tile(1258,140,"orange","play",["Vega app","player + captions"],num=8)
b+=arrow("M1117 172 H1258",label="stream",lx=1188,ly=160)
b+=arrow("M1117 382 H1185 V172",label="files",lx=1150,ly=370,end=False)
b+=tile(1258,320,"grey","cc",["Fire TV caption renderer","Standard, Speaker-aware"])
b+=tile(1258,470,"pink","layers",["Detailed overlay","Caption with Intention rules"])
b+=arrow("M1258 172 H1236 V352 H1258",label="cues",lx=1236,ly=270)
b+=arrow("M1322 172 H1368 V502 H1322",label="words",lx=1368,ly=340)
FIG1=svg(1400,640,b)

# ---------- Figure 2: runtime ----------
b=""
b+=group(20,20,1110,640,"Vega app","React Native for Vega 0.83, TypeScript")
b+=group(1150,20,230,640,"Vega OS platform","Fire TV")
b+=tile(60,100,"orange","probe",["Source probe","LAN server or packaged","copy, 1.5 s"])
b+=arrow("M124 132 H220",label="manifest URI",lx=172,ly=120)
b+=tile(220,100,"teal","play",["Shaka player","HLS via MSE, file: plugin"])
b+=arrow("M284 132 H380")
b+=tile(380,100,"teal","tv",["VideoPlayer","w3cmedia"])
b+=arrow("M412 100 V70 H1232 V100",label="decode and present",lx=820,ly=70)
b+=tile(1200,100,"grey","frame",["Media pipeline"])
b+=tile(560,100,"grey","text",["Caption assets","VTT + companion, same","source, 2.5 s timeout"])
b+=arrow("M412 164 V300",label="timeupdate, seeked,",lx=412,ly=240); b+=arrow("M0 0",label="play, waiting, rate",lx=412,ly=254,end=False)
b+=tile(380,300,"blue","clock",["MediaClock","event-anchored,","holds while stalled"])
b+=arrow("M592 164 V300",label="parse, validate",lx=592,ly=247)
b+=arrow("M444 332 H560",label="media time",lx=502,ly=320)
b+=tile(560,300,"blue","gear",["CaptionController","cue eligibility,","fallback reasons"])
b+=arrow("M624 332 H740",label="eligible cues",lx=682,ly=320)
b+=tile(740,300,"blue","lanes",["Resolver pass 2","lanes, protected regions,","collisions, bottom stack"])
b+=arrow("M804 332 H920",label="placed cues",lx=862,ly=320)
b+=tile(920,300,"grey","cc",["Native TextTrack","one cue per word boundary,","colour classes, 100 ms early"])
b+=arrow("M984 332 H1200",label="cue events",lx=1092,ly=320)
b+=tile(1200,300,"grey","cc",["KeplerCaptionsView","viewer's size, font,","colours apply"])
b+=arrow("M412 364 V490",label="rAF",lx=412,ly=468)
b+=tile(380,490,"blue","clock",["Word clock","re-lays out only at a","word boundary"])
b+=arrow("M444 522 H740",label="word index",lx=592,ly=510)
b+=arrow("M772 364 V490",label="Detailed only",lx=772,ly=440)
b+=tile(740,490,"pink","layers",["Detailed overlay","size, weight, width, colour","at onset, pop, sound labels"])
b+=f'<rect x="360" y="470" width="540" height="162" rx="8" fill="none" stroke="{C["red"]}" stroke-width="1.2" stroke-dasharray="6 4"/><text x="372" y="622" font-size="11" fill="{C["red"]}">Error boundary: an overlay failure leaves the native track showing the approved words</text>'
b+=tile(60,490,"grey","sliders",["Settings store","persisted: mode, reduced","motion, word highlighting"])
b+=arrow("M124 522 H300 V434 H404 a8 8 0 0 1 16 0 H540 V352 H560",label="mode, toggles",lx=215,ly=510)
b+=tile(1200,490,"grey","sliders",["System caption","preferences","(accessibility module)"])
b+=arrow("M1200 522 H804",label="size, font, colours, motion",lx=1000,ly=510)
FIG2=svg(1400,680,b)

# ---------- Figure 3: decision ladder ----------
def box(x,y,w,h,title,sub,fill,stroke,tcol):
    s=f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{fill}" stroke="{stroke}" stroke-width="1.3"/>'
    s+=f'<text x="{x+w/2}" y="{y+22}" text-anchor="middle" font-size="12.5" font-weight="700" fill="{tcol}">{html.escape(title)}</text>'
    for i,l in enumerate(sub): s+=f'<text x="{x+w/2}" y="{y+40+i*14}" text-anchor="middle" font-size="11" fill="{tcol}">{html.escape(l)}</text>'
    return s
checks=[("Hash matches?",["cue text vs.","companion entry"]),("Status verified?",["human or","auto rule"]),("Speaker known?",["label or","voice span"]),("Lane safe?",["size, face,","collision checks"]),("Words verified?",["per-word","timing status"]),("Motion allowed?",["Reduced motion","off, toggle on"])]
falls=[("Plain caption",["reason:","canonical_mismatch"]),("Plain caption",["reason:","metadata_unverified"]),("Lane only",["label from the","<v> span if any"]),("Bottom lane",["label kept; reason","size, face or collision"]),("Cue-level colour",["and label, no","word colouring"]),("Colour only",["words colour at onset,","nothing moves"])]
b=""
b+=f'<rect x="20" y="20" width="1360" height="110" rx="8" fill="#FFF8E6" stroke="#ED7100" stroke-dasharray="6 4"/><text x="32" y="40" font-size="12" font-weight="600" fill="#8a4b00">Checks, in order, per cue at each media tick</text>'
b+=f'<rect x="20" y="200" width="1170" height="110" rx="8" fill="#F2F3F3" stroke="#879596" stroke-dasharray="6 4"/><text x="32" y="220" font-size="12" font-weight="600" fill="#545B64">Fallbacks: the approved words always stay on screen; the reason is logged</text>'
X=40; W=160; G=30
for i,(t,sub) in enumerate(checks):
    x=X+i*(W+G); b+=box(x,50,W,70,t,sub,"#fff","#ED7100","#8a4b00")
    b+=box(x,230,W,70,*falls[i],"#fff","#879596","#232F3E")
    b+=arrow(f"M{x+W/2} 120 V230",label="no",lx=x+W/2,ly=175,dashed=True,color=C["red"])
    if i<len(checks)-1: b+=arrow(f"M{x+W} 85 H{x+W+G}",label="yes",lx=x+W+G/2,ly=72,color=C["green"])
x=X+6*(W+G); b+=arrow(f"M{x-G} 85 H{x}",label="yes",lx=x-G/2,ly=72,color=C["green"])
b+=box(x,50,W,70,"Full treatment",["word colour, size,","weight, width, pop"],"#E6F4EA","#7AA116","#2f5a12")
FIG3=svg(1400,330,b)

# ---------- Figure: palette ----------
mains=[("E5E517","Character 1"),("17E5E5","Character 2"),("FF3B3B","Character 3 (red lifted for contrast)"),("E58017","Character 4"),("17E517","Character 5"),("E517E5","Character 6")]
b='<rect x="0" y="0" width="1400" height="250" fill="#111"/>'
for i,(hx,lab) in enumerate(mains):
    x=60+i*220; b+=f'<rect x="{x}" y="40" width="180" height="70" rx="6" fill="#{hx}"/><text x="{x+90}" y="130" text-anchor="middle" font-size="12" fill="#eee">{html.escape(lab)}</text><text x="{x+90}" y="146" text-anchor="middle" font-size="11" fill="#999">#{hx}</text>'
    if i<3: b+=f'<path d="M{x+90} 152 V{166+i*6} H{x+90+3*220} V152" fill="none" stroke="#666" stroke-dasharray="4 3"/>'
b+='<text x="60" y="200" font-size="12" fill="#bbb">Assignment order follows cue count per character; opposite pairs (dashed) go to characters who share scenes most. Twelve supporting shades sit between these; minor roles take pastel HSB(h, 30%, 90%). White 90% is the read-ahead line.</text>'
b+='<text x="60" y="222" font-size="12" fill="#bbb">The viewer\'s own caption colour always wins over all of this on the native path.</text>'
FIGPAL=svg(1400,250,b)

# ---------- page ----------
_n=[0]
def nextn(): _n[0]+=1; return _n[0]
def fig(n,svgs,cap): n=nextn(); return f'<figure class="fig"><div class="svgwrap">{svgs}</div><figcaption><b>Figure {n}.</b> {cap}</figcaption></figure>'
def img(n,f,cap,cls=""): n=nextn(); return f'<figure class="fig {cls}"><img src="{b64(f)}" alt="{html.escape(cap)}"><figcaption><b>Figure {n}.</b> {cap}</figcaption></figure>'
page=f'''<title>Sightline Architecture</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&display=swap">
<style>
:root{{--bg:#ffffff;--ink:#16191f;--muted:#545b64;--rule:#d5dbdb;--accent:#ED7100;--card:#fafafa}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--bg:#16191f;--ink:#f2f3f3;--muted:#aab7b8;--rule:#414750;--card:#232f3e}}}}
:root[data-theme="dark"]{{--bg:#16191f;--ink:#f2f3f3;--muted:#aab7b8;--rule:#414750;--card:#232f3e}}
body{{background:var(--bg);color:var(--ink);font-family:"Source Sans 3",system-ui,Arial,sans-serif;font-size:17px;line-height:1.55;margin:0}}
main{{max-width:72rem;margin:0 auto;padding:2.5rem 1.25rem 5rem}}
h1{{font-size:2rem;font-weight:700;line-height:1.15;margin:0 0 .4rem;text-wrap:balance}}
h2{{font-size:1.35rem;font-weight:700;margin:2.8rem 0 .6rem;text-wrap:balance}}
.eyebrow{{font-size:.78rem;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);font-weight:700}}
.lede{{color:var(--muted);font-size:1.05rem;margin:0 0 1rem;max-width:48rem}}
p,ul{{max-width:48rem}}li{{margin:.3rem 0}}
code{{font-family:ui-monospace,Menlo,monospace;font-size:.86em;background:var(--card);border:1px solid var(--rule);padding:.02em .3em;border-radius:3px}}
.fig{{margin:1.2rem 0 1.6rem}}
.svgwrap{{background:#fff;border:1px solid var(--rule);border-radius:4px;overflow-x:auto}}
.svgwrap svg{{display:block;width:100%;min-width:900px;height:auto}}
.fig img{{display:block;width:100%;height:auto;max-width:60rem;border:1px solid var(--rule);border-radius:4px;background:#fff}}
figcaption{{font-size:.92rem;color:var(--muted);margin-top:.5rem;max-width:60rem}}
.grid2{{display:grid;grid-template-columns:1fr 1fr;gap:1.2rem}}
@media (max-width:820px){{.grid2{{grid-template-columns:1fr}}}}
.tablewrap{{overflow-x:auto;margin:1rem 0}}
table{{border-collapse:collapse;width:100%;font-size:.93rem}}
th,td{{text-align:left;vertical-align:top;padding:.5rem .6rem;border-bottom:1px solid var(--rule)}}
th{{font-size:.76rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}}
.legend{{display:flex;flex-wrap:wrap;gap:.6rem 1.2rem;font-size:.85rem;color:var(--muted);margin:.4rem 0 0}}
.legend span::before{{content:"";display:inline-block;width:.8em;height:.8em;border-radius:2px;margin-right:.35em;vertical-align:-.05em;background:var(--c)}}
.foot{{margin-top:3rem;color:var(--muted);font-size:.85rem;border-top:1px solid var(--rule);padding-top:1rem}}
</style>
<main>
<div class="eyebrow">Sightline (working title) · architecture · 2 September 2026</div>
<h1>Expressive captions on Fire TV: how the pieces fit</h1>
<p class="lede">An offline authoring pipeline measures the film and proposes metadata; a person confirms it; a runtime on the TV renders it through Fire TV's own caption renderer or its own overlay. One file carries everything between the two, and every enhancement can fall back to the approved words on its own.</p>

<h2>1. End to end</h2>
{fig(1,FIG1,"Numbered steps 1 to 5 run per scene on the workstation. Step 6 merges their proposals and auto-verifies only above confidence thresholds; step 7 is the human exception queue. The caption track itself is copied through unchanged and hash-locked, so the companion can only add to it.")}
<div class="legend"><span style="--c:#ED7100">signal measurement</span><span style="--c:#8C4FFF">machine-learning model</span><span style="--c:#527FFF">runtime logic</span><span style="--c:#7AA116">human step</span><span style="--c:#01A88D">media delivery</span><span style="--c:#E7157B">overlay rendering</span><span style="--c:#545B64">files, platform pieces</span></div>

<h2>2. What the authoring models actually see</h2>
<div class="grid2">
{img(2,"spectrogram.png","Step 1. WhisperX aligns the approved words against the audio; each span is a word with a confidence score. Bridge scene, cues 1 and 2. Grey spans fall below the auto-verify threshold and wait for a person.")}
{img(3,"delivery.png","Step 2. Per-word loudness relative to the speaker's own baseline and pitch from pyin. These numbers drive type size, weight and width under the Caption with Intention rules; nothing is classified as an emotion.")}
</div>
{img(4,"segmentation.png","Step 3, raw. pyannote's segmentation model on one 10 s window: waveform, log-probability of each powerset class (silence, one speaker, two speakers together), and the resulting per-speaker activity. Cue 1 is credited to Celia in the approved track, but the model hears the same voice through cues 1 to 3. The merge step flags that disagreement instead of picking a side; the review page shows both.")}
{img(0,"rules.png","How measurements become type. Left: the size function in packages/core, anchored on Caption with Intention's 3, 5 and 12 percent. Right: cues 1 and 2 set with their own numbers; pitch band picks the Roboto Flex weight, spectral width picks the width instance. Off-camera words would be italic.")}
<div class="grid2">
{img(5,"timeline.png","Steps 3 to 5 over the whole bridge scene, after clustering. Voice clusters, on-camera face identity, face boxes and sound events each come from a different model; the merge step lines them up against the approved cues.")}
{img(6,"faces.png","Step 4 at 11 seconds. A face box becomes a protected region for the shot; the resolver rejects any lane that would overlap it and falls back to the bottom lane, which is always allowed.")}
</div>
{img(0,"asd.png","Step 4, active speaker. YuNet face boxes and landmarks on three cue midpoints; SFace matches faces across shots into identities; frame-to-frame mouth change gives a lip-activity score, and the most active identity while a cue is on screen is the proposed on-camera speaker. Confidence is the margin over the next face, so two faces with one talking scores 0.5.")}

<h2>3. The runtime on the TV</h2>
{fig(7,FIG2,"Speaker-aware never leaves the platform renderer: cues are split at word boundaries and coloured with WebVTT classes, scheduled 100 ms early to cancel the measured event lag. Detailed hides the native track and draws from the same clock. The system's own caption preferences and the app's settings feed both paths.")}
<div class="grid2">
{img(0,"split.png","How Speaker-aware colours words on a renderer that ignores karaoke tags. The controller splits the approved cue at verified word boundaries and schedules each native cue 100 ms early; the platform then fires them a median 6 ms after the word.")}
{img(0,"sync.png","Timing as measured, from the device logs summarised in docs/sync-report.md. Each dot is one boundary crossing. The native path lands within about 20 ms at the median with a p95 near 125 ms; the overlay's own clock tracks boundaries within a frame.")}
</div>
<div class="grid2">
{img(8,"cap-native.png","Speaker-aware on the virtual device: Fire TV's renderer showing a cyan speaker label and colour, viewer's font size applied.")}
{img(9,"cap-detailed.png","Detailed on the virtual device: read-ahead line in white, words taking the character colour at onset, size and weight from the measurements.")}
</div>

<h2>4. What decides what a viewer sees</h2>
{fig(10,FIG3,"The fallback ladder, evaluated per cue. Each red branch is a safe stop that keeps the approved words on screen and records why. Colour never appears without a label or a lane.")}

<h2>5. Colour</h2>
{fig(0,FIGPAL,"The six main character colours from Caption with Intention V1.0, as the app ships them. Colour is never the only cue: a label or a lane always accompanies it.")}

<h2>6. The companion file</h2>
<div class="tablewrap"><table>
<tr><th>Field</th><th>Produced by</th><th>Verified by</th><th>Used by</th></tr>
<tr><td><code>cues[id].textHash</code>, <code>status</code></td><td>propose.py from the track</td><td>human, or an auto rule</td><td>gate for every enhancement</td></tr>
<tr><td><code>speaker</code>, <code>lanes</code></td><td>voice spans in the track; diarization and face proposals</td><td>human (auto when the voice cluster agrees with the track)</td><td>label, colour, lane, italics</td></tr>
<tr><td><code>words[]</code> timing, <code>loudDb</code>, <code>pitch</code>, <code>width</code>, <code>caps</code>, <code>stretch</code></td><td>WhisperX, librosa</td><td>auto above score 0.7, else human</td><td>native cue splitting; overlay size, weight, width, colour, syllables</td></tr>
<tr><td><code>delivery</code></td><td>librosa</td><td>auto (measurements, not judgements)</td><td>cue-level size and width, manner label</td></tr>
<tr><td><code>shots[].protected</code></td><td>YuNet face detector</td><td>proposed; honoured either way, it only removes options</td><td>lane rejection</td></tr>
<tr><td><code>sounds[]</code></td><td>PANNs, stereo level difference</td><td>auto above 0.8, named by a human</td><td>bracketed labels, ♫, direction markers</td></tr>
<tr><td><code>speakers[].color</code></td><td>Caption with Intention colour wheel</td><td>human override</td><td>character colour, native colour class</td></tr>
</table></div>

<h2>7. Timing, measured four ways</h2>
<ul>
<li><b>A, native event.</b> Media time read inside the cue-event handler against the true boundary; the 100 ms lead comes from this.</li>
<li><b>B, frame clock.</b> First animation frame past a word boundary: p95 about 7 ms.</li>
<li><b>R, render.</b> Clock decision to React commit: p50 2 ms.</li>
<li><b>C, camera-equivalent.</b> OCR of window captures, burned-in clock against composited captions: the overlay lands within one frame on the virtual device.</li>
<li><b>Replay tests.</b> 45 core and 20 app tests run the resolver, clock, layout rules and controller in Node without a device.</li>
</ul>
<p class="foot">Repository: packages/core (resolver, schema, tests), apps/vega-player/src (runtime), tools/author (pipeline), docs/architecture.md, docs/sync-report.md. Film frames from Tears of Steel, Blender Foundation, CC BY 3.0.</p>
</main>
'''
open("architecture.html","w").write(page); print(len(page)//1024,"KB")
