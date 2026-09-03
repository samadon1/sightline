# Architecture diagrams (September 2, 2026)

Mermaid sources for the diagrams on the architecture page; GitHub renders them. Text description: docs/architecture.md.

## The whole system

```mermaid
flowchart LR
  subgraph AUTH["Authoring (offline, on a Mac)"]
    direction TB
    V[/"Master video + approved WebVTT"/]
    A1["align.py · WhisperX forced alignment → word timings"]
    A2["delivery.py · librosa → loudness, pitch, width, pace"]
    A3["diarize.py · pyannote 3.1 → voice clusters"]
    A4["asd.py · YuNet + SFace + lip activity → on-camera speaker"]
    A5["faces.py · YuNet → protected regions per shot"]
    A6["sounds.py · PANNs → sound events · direction.py"]
    P["propose.py · merge, --auto confidence gates, colour wheel"]
    R["review page · a person confirms, verifiedBy: human"]
    V --> A1 --> A2
    V --> A3
    V --> A4
    V --> A5
    V --> A6
    A2 --> P
    A3 --> P
    A4 --> P
    A5 --> P
    A6 --> P
    P --> R
  end
  R --> C[("companion.en.json\nschema 0.2, every enhancement has a status")]
  V2[/"captions.en.vtt\nhash-locked, never rewritten"/]
  C --> PUB["Publisher: files served beside the HLS stream\n(bundled copies as fallback)"]
  V2 --> PUB
  PUB --> RT["Fire TV runtime"]
  RT --> N["Standard · Speaker-aware\nFire TV's own renderer"]
  RT --> O["Detailed\noverlay with Caption with Intention rules"]
```

## The runtime on the TV

```mermaid
flowchart TB
  L["LAN server or packaged copy\n(chosen by a 1.5 s probe)"] --> S["Shaka player (Vega patches)\nHLS via MSE · file: scheme plugin"]
  L --> F["captions.en.vtt + companion.en.json\n(same source, 2.5 s timeout, bundled fallback)"]
  S --> VP["VideoPlayer (w3cmedia)"]
  VP --> MC["MediaClock\nanchors on timeupdate / seeked / play\nholds on waiting · follows rate"]
  F --> CC["CaptionController\nparse VTT · validate companion · pass 1 eligibility"]
  MC --> CC
  CC --> P2["Resolver pass 2 · lanes, protected regions,\ncollisions, bottom stack, label rules"]
  P2 --> NT["Native TextTrack\ncue per word boundary, WebVTT colour classes,\nscheduled 100 ms early"]
  P2 --> OV["Detailed overlay\nword elements: size, weight, width, colour at onset,\nsyllables, pop, sound labels, side lanes"]
  NT --> KCV["KeplerCaptionsView\n(viewer's size, font, colours apply)"]
  MC --> WC["Word clock (rAF)\nre-lays out only at a boundary"]
  WC --> OV
  SET["Settings (persisted)\nmode · reduced motion · word highlighting · size and weight"] --> CC
  SYS["System caption preferences\n(a11y turbo module)"] --> CC
  SYS --> OV
  EB["Error boundary + global handler"] -.contains.- OV
```

## What decides what a viewer sees

```mermaid
flowchart LR
  T["Cue text (canonical)"] --> H{"hash matches\ncompanion entry?"}
  H -- no --> PLAIN["Plain caption\n(reason: canonical_mismatch)"]
  H -- yes --> ST{"status verified?"}
  ST -- no --> PLAIN2["Plain caption\n(metadata_unverified)"]
  ST -- yes --> SP{"speaker known?"}
  SP -- no --> LANEONLY["Lane only, label from &lt;v&gt; span"]
  SP -- yes --> LANE{"lane safe at this\nsize, no face, no collision?"}
  LANE -- no --> BOTTOM["Bottom lane, label kept\n(size_rejected / protected_region / collision)"]
  LANE -- yes --> WORDS{"words verified?"}
  WORDS -- no --> CUE["Cue-level colour and label"]
  WORDS -- yes --> W["Word-level colour at onset;\nsize, weight, width if the toggle is on"]
  W --> RM{"Reduced motion?"}
  RM -- on --> STILL["Colour changes, nothing moves"]
  RM -- off --> POP["Lift and scale per word"]
```

## The companion file, in one table

| Field | Produced by | Verified by | Used by |
|---|---|---|---|
| `cues[id].textHash`, `status` | propose.py from the track | human or auto rule | gate for every enhancement |
| `speaker`, `lanes` | track voice spans; diarization and face proposals | human (auto when the voice agrees with the track) | label, colour, lane, italics |
| `words[]` timing, `loudDb`, `pitch`, `width`, `caps`, `stretch` | WhisperX, librosa | auto above score 0.7, else human | native cue splitting; overlay size, weight, width, colour, syllables |
| `delivery` | librosa (measurements) | auto | cue-level size and width, manner label |
| `shots[].protected` | face detector | proposed; honoured either way (safe direction) | lane rejection |
| `sounds[]` | PANNs, stereo direction | auto above 0.8, named by a human | bracketed labels, ♫, direction markers |
| `speakers[].color` | `--assign-colours` (Caption with Intention wheel) | human override | character colour, native colour class |
