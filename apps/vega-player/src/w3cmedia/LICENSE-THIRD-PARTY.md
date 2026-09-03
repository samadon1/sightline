# Third-party code in this folder

- `shakaplayer/dist/shaka-player.compiled.js` and `.d.ts`: Shaka Player 4.8.5, Copyright 2016 Google LLC, Apache-2.0, built with Amazon's Vega patches (44 patches, distributed in the AmazonAppDev/vega-video-sample repository under MIT-0). Shaka's own third-party notices: language-mapping-list (MIT), dash.js (BSD), tXml (MIT), gl-matrix (MIT).
- `ShakaPlayer.ts`, `PlayerInterface.ts`, `polyfills/*.ts`: not committed. Fetched at install by `tools/shaka/fetch-glue.sh` from the same Amazon repository, then Sightline's one change is applied (`tools/shaka/apply-sightline-changes.py`).
