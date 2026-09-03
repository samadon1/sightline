/**
 * Speaker label rules (spec §9.3, §9.4).
 *
 * Label frequency is a design hypothesis to revise after the DHH pilot, so the rule is
 * data-driven: `LabelRuleConfig` can be tuned without touching the resolver.
 */

import type { SpeakerDef } from "./types.ts";

export type LabelRuleConfig = {
  /** Show the label again when the same speaker returns after at least this gap. */
  returnGapMs: number;
  /** Always label the first cue after a shot change. */
  labelOnShotChange: boolean;
  /** Always label both cues when two speakers overlap in time. */
  labelOnOverlap: boolean;
  /** Label every cue (used for tests and for the pilot's "labels everywhere" comparison). */
  labelEveryCue: boolean;
};

export const DEFAULT_LABEL_RULES: LabelRuleConfig = {
  returnGapMs: 4000,
  labelOnShotChange: true,
  labelOnOverlap: true,
  labelEveryCue: false,
};

/** The label to show for a speaker at a given media time, honouring the reveal policy. */
export function speakerLabelAt(def: SpeakerDef, timeMs: number): { label: string; revealed: boolean } {
  const revealAt = def.revealAtMs ?? 0;
  if (timeMs >= revealAt) return { label: def.label, revealed: true };
  return { label: def.genericLabel ?? def.label, revealed: false };
}

export type LabelContext = {
  /** Speaker id of this cue (companion or <v>); undefined for sound cues or unattributed cues. */
  speakerId?: string;
  isSound: boolean;
  startMs: number;
  shotId?: string;
  /** True when this cue overlaps another dialogue cue in time. */
  overlaps: boolean;
  /** True when the speaker is off-screen / not visually identifiable (generic label in use). */
  offScreen: boolean;
  /** True when the label text differs from the label that would have been shown at the previous cue (reveal passed). */
  labelChanged: boolean;
  /** Previous non-sound cue in track order. */
  prev?: { speakerId?: string; endMs: number; shotId?: string; labelShown: boolean; fellBack: boolean };
};

/** Deterministic label decision per spec §9.3. Returns the reason for logging. */
export function shouldShowLabel(ctx: LabelContext, rules: LabelRuleConfig = DEFAULT_LABEL_RULES): { show: boolean; reason: string } {
  if (ctx.isSound || !ctx.speakerId) return { show: false, reason: "no_speaker" };
  if (rules.labelEveryCue) return { show: true, reason: "every_cue" };
  const p = ctx.prev;
  if (!p) return { show: true, reason: "first_cue" };
  if (p.speakerId !== ctx.speakerId) return { show: true, reason: "speaker_change" };
  if (rules.labelOnShotChange && ctx.shotId && p.shotId && ctx.shotId !== p.shotId) return { show: true, reason: "shot_change" };
  if (ctx.startMs - p.endMs >= rules.returnGapMs) return { show: true, reason: "return_after_gap" };
  if (rules.labelOnOverlap && ctx.overlaps) return { show: true, reason: "overlap" };
  if (ctx.offScreen) return { show: true, reason: "off_screen" };
  if (ctx.labelChanged) return { show: true, reason: "reveal" };
  if (p.fellBack) return { show: true, reason: "prior_fallback" };
  return { show: false, reason: "same_speaker_run" };
}
