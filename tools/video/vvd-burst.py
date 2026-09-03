"""Fast window-id capture of the Vega Virtual Device: Quartz.CGWindowListCreateImage in a loop, no
subprocess per frame. Safe like vvdshot.py (window id, never a screen region). Usage: vvdburst.py <outdir> <prefix> <seconds> [fps]"""
import Quartz, sys, time, os
from Quartz import CoreGraphics as CG
out, prefix, seconds = sys.argv[1], sys.argv[2], float(sys.argv[3]); fps = float(sys.argv[4]) if len(sys.argv) > 4 else 8
wl = Quartz.CGWindowListCopyWindowInfo(Quartz.kCGWindowListOptionOnScreenOnly | Quartz.kCGWindowListExcludeDesktopElements, Quartz.kCGNullWindowID)
wid = next((w['kCGWindowNumber'] for w in wl if 'vega virtual device' in str(w.get('kCGWindowName', '')).lower()), None)
if wid is None: print("VVD window not found"); sys.exit(1)
os.makedirs(out, exist_ok=True)
t0 = time.time(); i = 0; interval = 1.0 / fps
while time.time() - t0 < seconds:
    img = CG.CGWindowListCreateImage(CG.CGRectNull, CG.kCGWindowListOptionIncludingWindow, wid, CG.kCGWindowImageBoundsIgnoreFraming)
    if img is None: break
    url = Quartz.CFURLCreateWithFileSystemPath(None, f"{out}/{prefix}-{i:04d}.png", Quartz.kCFURLPOSIXPathStyle, False)
    dest = Quartz.CGImageDestinationCreateWithURL(url, "public.png", 1, None)
    Quartz.CGImageDestinationAddImage(dest, img, None); Quartz.CGImageDestinationFinalize(dest)
    i += 1
    nxt = t0 + i * interval; d = nxt - time.time()
    if d > 0: time.sleep(d)
print(f"{i} frames in {time.time()-t0:.1f}s = {i/(time.time()-t0):.1f} fps")
