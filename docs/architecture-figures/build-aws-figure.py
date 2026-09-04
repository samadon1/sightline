#!/usr/bin/env python3
"""fig5-aws.svg: the two AWS integrations in the house style of build-figures.py (same colours, tiles and
arrows). Standalone so it runs without the authoring intermediates:  python3 build-aws-figure.py"""
import html, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))

C={"orange":"#ED7100","purple":"#8C4FFF","teal":"#01A88D","pink":"#E7157B","blue":"#527FFF","green":"#7AA116","red":"#DD344C","grey":"#545B64","dark":"#232F3E"}
GLYPH={
 "film":'<rect x="14" y="18" width="36" height="28" rx="2"/><path d="M14 26h36M14 38h36M22 18v28M42 18v28"/>',
 "meter":'<path d="M16 44V34M24 44V28M32 44V22M40 44V30M48 44V18"/><path d="M12 48h40"/>',
 "merge":'<path d="M14 18h12l10 14h16M14 32h22M14 46h12l10-14"/><path d="M48 28l4 4-4 4"/>',
 "person":'<circle cx="26" cy="22" r="7"/><path d="M12 48c0-9 6-14 14-14s14 5 14 14"/><path d="M40 34l5 5 9-11"/>',
 "doc":'<path d="M18 12h20l10 10v30H18z"/><path d="M38 12v10h10M24 30h16M24 38h16M24 46h10"/>',
 "tv":'<rect x="12" y="14" width="40" height="26" rx="2"/><path d="M24 50h16M32 40v10"/>',
 "layers":'<path d="M32 14l20 10-20 10-20-10z"/><path d="M12 32l20 10 20-10M12 40l20 10 20-10"/>',
 "bucket":'<path d="M16 18c0-4 32-4 32 0v4c0 4-32 4-32 0z"/><path d="M16 22l3 24c0 4 26 4 26 0l3-24"/><path d="M20 34c4 3 20 3 24 0"/>',
 "cdn":'<circle cx="32" cy="32" r="16"/><path d="M16 32h32M32 16c6 6 6 26 0 32M32 16c-6 6-6 26 0 32M20 22c6 3 18 3 24 0M20 42c6-3 18-3 24 0"/>',
 "mic":'<rect x="26" y="12" width="12" height="22" rx="6"/><path d="M18 28c0 8 6 14 14 14s14-6 14-14M32 42v8M24 50h16"/>',
 "wave":'<path d="M12 32h6l4-12 5 24 5-20 5 14 4-6h11"/>',
 "shield":'<path d="M32 12l18 6v14c0 10-8 17-18 20-10-3-18-10-18-20V18z"/><path d="M24 32l6 6 10-12"/>',
}
def tile(x,y,color,glyph,label,size=64,num=None,text_w=150):
    s=f'<rect x="{x}" y="{y}" width="{size}" height="{size}" rx="6" fill="{C[color]}"/>'
    s+=f'<g transform="translate({x},{y}) scale({size/64})" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">{GLYPH[glyph]}</g>'
    if num is not None:
        s+=f'<circle cx="{x+size-2}" cy="{y+2}" r="10" fill="{C["dark"]}" stroke="#fff" stroke-width="2"/><text x="{x+size-2}" y="{y+6}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">{num}</text>'
    lines=label if isinstance(label,list) else [label]
    for i,l in enumerate(lines):
        s+=f'<text x="{x+size/2}" y="{y+size+16+i*13}" text-anchor="middle" font-size="{12 if i==0 else 10.5}" font-weight="{600 if i==0 else 400}" fill="{C["dark"] if i==0 else "#687078"}">{html.escape(l)}</text>'
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
def note(x,y,lines,mono=False):
    s=""
    for i,l in enumerate(lines):
        s+=f'<text x="{x}" y="{y+i*14}" font-size="10.5" fill="#687078"{" font-family=\"Menlo,Consolas,monospace\"" if mono else ""}>{html.escape(l)}</text>'
    return s
def svg(w,h,body):
    return f'<svg viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg" font-family="\'Source Sans 3\',Arial,sans-serif"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="{C["dark"]}"/></marker></defs><rect width="{w}" height="{h}" fill="#fff"/>{body}</svg>'

W,H=1400,660; b=""
# ---- left: authoring workstation
b+=group(30,40,450,590,"Authoring workstation","tools/author, tools/aws",dashed=True)
b+=tile(60,90,"grey","film",["Scene master","film + approved VTT"],num=1)
b+=tile(200,90,"orange","meter",["Measure","timing, loudness,","faces, sounds"],num=2)
b+=tile(340,90,"orange","merge",["Propose","one file of proposals"],num=3)
b+=arrow("M124 122h72"); b+=arrow("M264 122h72")
b+=tile(340,260,"green","person",["Review","a person confirms"],num=5)
b+=arrow("M356 158v98",label="proposals",lx=300,ly=210)
b+=tile(60,400,"teal","mic",["Second opinion","transcribe_aws.py"],num=4)
b+=arrow("M92 158v238",label="audio-16k.wav",lx=150,ly=280)
b+=arrow("M110 396V380H388V328",dashed=True,label="proposed timings + speaker turns",lx=210,ly=368)
b+=tile(340,520,"blue","doc",["Verified companion","+ captions.en.vtt + HLS"],num=6)
b+=arrow("M356 328v188")
b+=note(60,552,["Transcribe never writes caption text.","Only timing and speaker labels carry","over, and always as proposals. Where","WhisperX and Transcribe agree a person","confirms fast; where they disagree the","cue goes to the top of the review queue."])

# ---- middle: AWS
b+=group(530,40,500,590,"AWS, us-east-1","one account, three services, cents a month",tint="#F7F8FA")
b+=tile(620,120,"green","bucket",["Amazon S3","private bucket"],num=7)
b+=tile(850,120,"purple","cdn",["Amazon CloudFront","origin access control, HTTPS only"],num=8)
b+=tile(680,400,"teal","wave",["Amazon Transcribe","speaker labels, en-US,","reads the audio from the bucket"],num=9)
b+=arrow("M684 152h162",label="OAC read",lx=765,ly=140)
b+=note(615,250,["<scene>/captions.en.vtt","<scene>/companion.en.json","<scene>/hls/<name>.m3u8, .m4s","transcribe/<scene>.wav"],mono=True)
b+=note(850,238,["cache-control 60 s for text,","one day for segments;","invalidated on every publish"])
# workstation -> S3 publish (route left of the bucket); workstation <-> Transcribe (two straight lines)
b+=arrow("M404 552H590V152H616",label="publish-media.sh",lx=500,ly=540)
b+=arrow("M124 428H676",label="StartTranscriptionJob",lx=240,ly=428)
b+=arrow("M676 448H124",dashed=True,label="result JSON",lx=240,ly=448)

# ---- right: Fire TV
b+=group(1080,40,290,590,"Fire TV (Vega OS)","apps/vega-player",dashed=True)
b+=tile(1140,120,"dark","tv",["Sightline app","devHost = the distribution"],num=10)
b+=arrow("M914 152h222",label="GET at load",lx=1025,ly=140)
b+=tile(1140,340,"grey","layers",["Packaged copy","plays if no answer in 1.5 s"],num=11)
b+=arrow("M1172 186V336",dashed=True,label="fallback",lx=1172,ly=262)
b+=tile(1260,340,"green","shield",["Only verified data","is ever drawn"])
b+=note(1100,470,["Fetched from the distribution at load:","the HLS manifest and segments,","captions.en.vtt, companion.en.json.","","Device log, September 4:"])
b+=note(1100,545,["[player] source=server","  host=https://dezgz...cloudfront.net","[assets] source=remote vtt=1275B","  companion=yes in 901 ms"],mono=True)

open("fig5-aws.svg","w").write(svg(W,H,b)); print("fig5-aws.svg")
try:
    import cairosvg; cairosvg.svg2png(url="fig5-aws.svg", write_to="fig5-aws.png", output_width=2100); print("fig5-aws.png")
except Exception as e: print("png skipped:", e)
