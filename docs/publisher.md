# Serving captions for this runtime (publisher notes)

The runtime needs two files beside the stream, both fetched at load with the packaged copies as fallback:

- `captions.en.vtt`: the approved WebVTT track. Every cue needs a stable identifier line; `<v Name>` voice spans are used as a compatibility rung when no companion data exists. Nothing in the runtime rewrites this file's words.
- `companion.en.json`: the companion profile (JSON Schema in `schema/`). Speakers, shots with protected regions, per-cue speaker, lanes, word timings, delivery levels, sound events; every enhancement carries `status` and reaches a viewer only when `verified`. Text hashes lock each entry to the cue's visible text, so a re-edited track silently disables stale entries cue by cue.

Both are plain static files; serve them with CORS enabled next to the HLS manifest (the app fetches `…/<scene>/captions.en.vtt` and `…/<scene>/companion.en.json`). If the companion file is absent the track plays with Standard captions plus `<v>` labels; if the track is absent the packaged copy is used. Timeouts are short (2.5 s) so playback never waits on captions.

Authoring: `tools/author/author-scene.sh assets/<scene>` produces a proposed companion file from the audio and video; `tools/author/review_server.py` is where a person verifies it. See docs/authoring.md.
