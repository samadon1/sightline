# Fixture: protected region

Same clock test track as `assets/prototype`, with one shot (7.0 s to 10.5 s) that declares a protected region over the lower-left of the picture (a face, in a real film). Maya's cue c003 prefers the lower-left lane; the resolver must reject that lane with `protected_region` and place the cue at the bottom, keeping the label and text. c001, also Maya, is outside the shot and keeps the lower-left lane.

Media: the scene reuses the prototype placeholder video (see apps/vega-player/src/media/config.ts).
