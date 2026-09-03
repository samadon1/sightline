import re, sys, Vision
from Foundation import NSURL
from PIL import Image
S="/private/tmp/claude-501/-Users-mac-Downloads-Sightline/b8482812-cef5-4a8a-8b1d-7bb513b11292/scratchpad"
def read_clock(path):
    im=Image.open(path); w,h=im.size
    crop=im.crop((0,0,int(w*0.829),h)); crop.save(f"{S}/ocr-tmp.png")
    handler=Vision.VNImageRequestHandler.alloc().initWithURL_options_(NSURL.fileURLWithPath_(f"{S}/ocr-tmp.png"), None)
    req=Vision.VNRecognizeTextRequest.alloc().init(); req.setRecognitionLevel_(1); req.setUsesLanguageCorrection_(False)
    handler.performRequests_error_([req], None)
    found=[]
    for r in req.results():
        t=r.topCandidates_(1)[0].string()
        m=re.search(r"(\d\d)[:.](\d\d)[.:,](\d{3})", t)
        if m: found.append(int(m.group(1))*60000+int(m.group(2))*1000+int(m.group(3)))
        m2=re.search(r"active:\s*(c\d{3})", t)
        if m2: found.append(("active", m2.group(1)))
    return found
if __name__=="__main__":
    for p in sys.argv[1:]: print(p.split("/")[-1], read_clock(p))
