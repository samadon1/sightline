#!/usr/bin/env python3
"""
Local review page for one scene: play the excerpt, see word timings and delivery levels, fix them,
mark verified, save. A reviewer's tool, not a product surface. No accounts, no network beyond localhost.

  python3 tools/author/review_server.py assets/tos-bridge [--port 8090]

Then open http://localhost:8090/ in a browser. The page reads captions.en.vtt and companion.en.json
from the scene directory and writes companion.en.json back on Save (a .bak copy is kept).
"""
import http.server, json, os, shutil, sys, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
scene = os.path.abspath([a for a in sys.argv[1:] if not a.startswith("--")][0])
port = int(sys.argv[sys.argv.index("--port") + 1]) if "--port" in sys.argv else 8090

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=scene, **k)

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path in ("/", "/index.html"):
            body = open(os.path.join(HERE, "review.html"), "rb").read()
            self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8"); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body); return
        if path == "/scene.json":
            files = os.listdir(scene)
            media = next((f for f in files if f.endswith(".mp4")), None)
            body = json.dumps({"dir": os.path.basename(scene), "media": media, "vtt": "captions.en.vtt", "companion": "companion.en.json" if "companion.en.json" in files else None}).encode()
            self.send_response(200); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body); return
        return super().do_GET()

    def do_POST(self):
        if urllib.parse.urlparse(self.path).path != "/save":
            self.send_response(404); self.end_headers(); return
        n = int(self.headers.get("Content-Length", "0"))
        data = json.loads(self.rfile.read(n))
        target = os.path.join(scene, "companion.en.json")
        if os.path.exists(target): shutil.copy(target, target + ".bak")
        with open(target, "w") as f: json.dump(data, f, indent=2); f.write("\n")
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(b'{"ok":true}')

    def log_message(self, fmt, *args):
        sys.stderr.write("review: " + fmt % args + "\n")

print(f"review page for {scene} at http://localhost:{port}/  (Ctrl-C to stop)")
http.server.ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
