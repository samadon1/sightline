#!/usr/bin/env python3
"""Sightline's changes to Amazon's ShakaPlayer.ts glue, applied after fetch-glue.sh copies the original.
One change: a failed load reaches the app as a callback instead of an unhandled promise rejection."""
import re, sys
p = sys.argv[1]; s = open(p).read()
if "onLoadError" in s: print("already applied"); sys.exit(0)
s = re.sub(r'(\n\s*)load\(content:\s*any,\s*_?autoplay:\s*boolean\):\s*void\s*\{',
           r'\1/** Called when the manifest or its first segments cannot be loaded (Sightline addition). */\1onLoadError?: (e: unknown) => void;\1load(content: any, _autoplay: boolean): void {', s, count=1)
s = re.sub(r'\n(\s*)this\.internalLoad\(content\);',
           r'\n\1// A failed load must reach the app as a state, not as an unhandled rejection the global handler swallows.\n\1this.internalLoad(content).catch((e: unknown) => { console.log("shakaplayer: load failed " + String(e)); this.onLoadError?.(e); });', s, count=1)
assert "onLoadError?.(e)" in s and "onLoadError?: (e: unknown) => void" in s, "anchors not found; the upstream glue changed"
open(p, "w").write(s); print("applied")
