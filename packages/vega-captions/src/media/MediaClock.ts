/**
 * One media clock for everything that needs "now" in media time: the controller's cue-event
 * measurements, the word clock, the second clock. Polled `currentTime` on Vega can be hundreds of
 * milliseconds stale (FL-027); the value carried by a `timeupdate`, `seeked` or `play` event is fresh
 * at the moment it fires. The clock anchors on those events and projects with `performance.now()`
 * while playing; while paused it holds the last anchored value.
 */
export type ClockSource = {
  addEventListener(type: string, fn: () => void): void;
  removeEventListener(type: string, fn: () => void): void;
  readonly currentTime: number;
  readonly paused: boolean;
  readonly playbackRate?: number;
};

export class MediaClock {
  private anchorWall = 0;
  private anchorMedia = 0;
  private playing = false;
  private nowFn: () => number;
  private src: ClockSource | null = null;
  private rate = 1;
  private onAnchor = () => this.anchor(true);
  private onPlay = () => { this.anchor(false); this.playing = true; };
  private onPause = () => { this.anchor(false); this.playing = false; };
  /** A stall (buffering) freezes media time: hold at the last fresh value until "playing" resumes. */
  private onStall = () => { this.anchor(false); this.playing = false; };
  private onRate = () => { this.anchor(false); this.rate = this.src?.playbackRate && this.src.playbackRate > 0 ? this.src.playbackRate : 1; };
  /** Anchor deltas since attach, for diagnostics: how far the projection had drifted at each fresh event. */
  readonly drift: { n: number; sum: number; max: number } = { n: 0, sum: 0, max: 0 };

  constructor(nowFn: () => number = () => (typeof performance !== "undefined" ? performance.now() : Date.now())) { this.nowFn = nowFn; }

  attach(src: ClockSource): void {
    this.detach();
    this.src = src;
    this.playing = !src.paused;
    this.anchorWall = this.nowFn(); this.anchorMedia = src.currentTime * 1000;
    src.addEventListener("timeupdate", this.onAnchor);
    src.addEventListener("seeked", this.onAnchor);
    src.addEventListener("play", this.onPlay);
    src.addEventListener("playing", this.onPlay);
    src.addEventListener("pause", this.onPause);
    src.addEventListener("ended", this.onPause);
    src.addEventListener("waiting", this.onStall);
    src.addEventListener("stalled", this.onStall);
    src.addEventListener("ratechange", this.onRate);
    this.rate = src.playbackRate && src.playbackRate > 0 ? src.playbackRate : 1;
  }
  detach(): void {
    const s = this.src; if (!s) return;
    for (const [t, f] of [["timeupdate", this.onAnchor], ["seeked", this.onAnchor], ["play", this.onPlay], ["playing", this.onPlay], ["pause", this.onPause], ["ended", this.onPause], ["waiting", this.onStall], ["stalled", this.onStall], ["ratechange", this.onRate]] as const) { try { s.removeEventListener(t, f); } catch { /* ignore */ } }
    this.src = null;
  }
  /** Re-anchor on a fresh value; `countDrift` only for timeupdate/seeked while playing (play/pause are state changes). */
  private anchor(countDrift: boolean): void {
    if (!this.src) return;
    const real = this.src.currentTime * 1000;
    if (countDrift && this.playing) { const d = real - this.now(); this.drift.n++; this.drift.sum += d; if (Math.abs(d) > Math.abs(this.drift.max)) this.drift.max = d; }
    this.anchorWall = this.nowFn(); this.anchorMedia = real;
  }
  /** Media time in ms, projected from the last fresh anchor while playing. */
  now(): number {
    if (!this.playing) return this.anchorMedia;
    return this.anchorMedia + (this.nowFn() - this.anchorWall) * this.rate;
  }
  /** Mean and max anchor delta so far (ms). */
  driftStats(): { mean: number; max: number; n: number } { return { mean: this.drift.n ? this.drift.sum / this.drift.n : 0, max: this.drift.max, n: this.drift.n }; }
}
