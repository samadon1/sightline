/**
 * Shared types for the caption runtime core.
 *
 * The core is framework independent: no React Native, no Vega imports. Everything here is
 * plain data so the same resolver runs in Node tests, in an HTML5 reference player, and in
 * the Vega app.
 */

import type { CanonicalCue } from "./vtt.ts";
import type { Lane, Rect } from "./lanes.ts";

export type { CanonicalCue, Lane, Rect };

/** Viewer-selectable caption mode. Standard is always available. */
export type Mode = "standard" | "speaker-aware" | "detailed";

/** Companion metadata status. Only `verified` reaches the enhanced viewer path. */
export type CueStatus = "verified" | "proposed" | "rejected";

export type SoundDirection = "left" | "right" | "center";

export type EmphasisKind = "weight" | "underline";

/**
 * Speaker palette tokens, following the Caption with Intention design system: six main-character
 * colours, twelve supporting shades between them, and a neutral. The Vega app maps tokens to
 * colours; the core never sees colours.
 */
export type ColorToken =
  | "speaker-1" | "speaker-2" | "speaker-3" | "speaker-4" | "speaker-5" | "speaker-6"
  | "support-1" | "support-2" | "support-3" | "support-4" | "support-5" | "support-6"
  | "support-7" | "support-8" | "support-9" | "support-10" | "support-11" | "support-12"
  | "neutral";

export type SpeakerDef = {
  /** Named label shown once the reveal time has passed, e.g. "MAYA". */
  label: string;
  /** Label used before `revealAtMs`, e.g. "WOMAN" or "UNKNOWN VOICE". Defaults to `label`. */
  genericLabel?: string;
  color?: ColorToken;
  /** Media time (ms) from which the named label may be shown. Default 0. */
  revealAtMs?: number;
  /** The character is not on camera for this whole track (narrator, phone, radio). Rendered italic in Detailed. */
  offScreen?: boolean;
};

export type ProtectedRegion = Rect & { reason?: string };

export type ShotDef = {
  id: string;
  startMs: number;
  endMs: number;
  protected?: ProtectedRegion[];
  /** Review state of a proposed shot (face detector output). Regions are honoured either way: a wrong region can only move a caption to the bottom. */
  status?: CueStatus;
};

export type EmphasisDef = {
  /** Index into the cue's visible text split on whitespace. */
  tokenIndex: number;
  kind: EmphasisKind;
};

/** Delivery level scales (schema 0.2). loud: -1 quiet, 0 normal, 1 loud, 2 shouted. pitch: -1 low, 0 mid, 1 high. pace: -1 slow, 0 normal, 1 fast. */
export type LoudLevel = -1 | 0 | 1 | 2;
export type PitchLevel = -1 | 0 | 1;
export type PaceLevel = -1 | 0 | 1;
/** Width level (Caption with Intention 2.3.9, driven by the voice's harmonics): -1 narrow, 0 regular, 1 wide. */
export type WidthLevel = -1 | 0 | 1;

/** Per-word timing and delivery (schema 0.2). `i` indexes the cue's visible tokens (whitespace split). */
export type WordMeta = {
  i: number;
  startMs: number;
  endMs: number;
  loud?: LoudLevel;
  /** Measured loudness relative to the scene's speech median, in dB (schema 0.2, optional). Enables continuous sizing. */
  loudDb?: number;
  pitch?: PitchLevel;
  width?: WidthLevel;
  /** Render the word in capitals (intensity). Presentation only; the canonical token is unchanged. */
  caps?: boolean;
  /** Stretched spelling of the token, e.g. "Nooooo" for "No". Must collapse back to the canonical token. */
  stretch?: string;
  /** Per-word status. Absent means not verified. */
  status?: CueStatus;
  /** Who set `verified`: "human" or a machine rule such as "score>=0.5". Machine values are reported by the validator. */
  verifiedBy?: string;
};

/** Cue-level delivery (schema 0.2). */
export type DeliveryMeta = {
  loud?: LoudLevel;
  loudDb?: number;
  width?: WidthLevel;
  pace?: PaceLevel;
  /** Human-authored manner label rendered in brackets, e.g. "whispers". Never machine-generated. */
  manner?: string;
  status?: CueStatus;
  verifiedBy?: string;
};

/** A non-speech sound event that is not in the canonical track (schema 0.2). Detailed mode only. */
export type SoundEvent = {
  id: string;
  startMs: number;
  endMs: number;
  /** Rendered as "[label]". */
  label: string;
  direction?: SoundDirection;
  /** Measured level of the event relative to the scene's speech, dB. Sizes the label (CI 2.4.4). */
  loudDb?: number;
  offScreen?: boolean;
  status: CueStatus;
  provenance?: string;
  verifiedBy?: string;
};

export type CueMeta = {
  /** "sha256:<hex>" of the canonical visible text. Mismatch means stale metadata. */
  /** This cue's voice is off camera even though the character is normally on screen (a line over a cutaway). Italic in Detailed, bottom lane by convention. */
  offScreen?: boolean;
  textHash: string;
  status: CueStatus;
  verifiedBy?: string;
  /** Key into `CompanionProfile.speakers`. */
  speaker?: string;
  /** Two speaker ids for a professionally combined dual-speaker cue ("-Line one / -Line two"). */
  speakers?: string[];
  /** Preferred lanes in order. The runtime always allows bottom_center as the final fallback. */
  lanes?: Lane[];
  emphasis?: EmphasisDef[];
  sound?: { direction: SoundDirection };
  /** Free text, e.g. "human_editor" or "automated_suggestion". */
  provenance?: string;
  /** Schema 0.2: word timings and per-word delivery. */
  words?: WordMeta[];
  /** Schema 0.2: cue-level delivery. */
  delivery?: DeliveryMeta;
};

/** Experimental WebVTT companion metadata profile, schema versions 0.1 and 0.2. */
export type CompanionProfile = {
  schemaVersion: string;
  canonicalTrack?: string;
  speakers?: Record<string, SpeakerDef>;
  shots?: ShotDef[];
  cues?: Record<string, CueMeta>;
  /** Schema 0.2: sound events beside the canonical track. */
  sounds?: SoundEvent[];
};

export const SUPPORTED_SCHEMA_VERSIONS = ["0.1", "0.2"] as const;

/** What the viewer chose. */
export type ViewerPreferences = {
  mode: Mode;
  reducedMotion: boolean;
  /** Detailed only: words take the speaker colour as they are spoken. Default true. */
  wordHighlight?: boolean;
  /** Detailed only: size and weight follow measured loudness and pitch. Default true. */
  deliveryTypography?: boolean;
};

/** Subset of Vega `CaptioningProps` the core cares about. Strings mirror the platform enums. */
export type SystemCaptionPreferences = {
  textSize?: "very_small" | "small" | "normal" | "large" | "very_large" | string;
  textColor?: string;
  textFont?: string;
  textEdgeStyle?: string;
  textOpacity?: string;
  textBackgroundColor?: string;
  textBackgroundOpacity?: string;
  windowBackgroundColor?: string;
  windowBackgroundOpacity?: string;
};

/** What the host renderer can do. The Vega native path cannot colour or emphasise text. */
export type RuntimeCapabilities = {
  /** Renderer honours per-cue position settings (lanes). */
  positionedCues: boolean;
  /** Renderer can show a per-speaker colour token. */
  speakerColor: boolean;
  /** Renderer can render static emphasis (weight/underline) inside a cue. */
  staticEmphasis: boolean;
  /** Renderer can colour words individually against a media clock (schema 0.2). */
  wordTiming?: boolean;
  /** Renderer can vary size and weight per cue or word (schema 0.2). */
  deliveryTypography?: boolean;
};

export type FallbackReason =
  | "metadata_missing"
  | "metadata_unverified"
  | "canonical_mismatch"
  | "speaker_unknown"
  | "speaker_unavailable"
  | "label_suppressed_by_rule"
  | "canonical_id_present"
  | "reveal_pending"
  | "no_safe_lane"
  | "lane_unavailable"
  | "protected_region"
  | "collision"
  | "size_rejected"
  | "color_unsupported"
  | "emphasis_unsupported"
  | "emphasis_invalid"
  | "sound_direction_unverified"
  | "reduced_motion"
  | "mode_standard"
  | "word_timing_unsupported"
  | "word_timing_off"
  | "words_invalid"
  | "words_unverified"
  | "delivery_unsupported"
  | "delivery_off"
  | "delivery_unverified"
  | "resolver_exception";

export type AppliedFeature =
  | "speaker_label"
  | "speaker_color"
  | "lane"
  | "static_emphasis"
  | "sound_direction"
  | "word_timing"
  | "word_caps"
  | "word_stretch"
  | "delivery";

/** Pass 1 output: what a cue is eligible for, before layout against the active set. */
export type EligibleCue = {
  cueId: string;
  startMs: number;
  endMs: number;
  text: string;
  /** Speaker id from the companion profile (verified) or the <v> span (canonical). */
  speakerId?: string;
  speakerLabel?: string;
  /** Label withheld by the frequency rule; pass 2 restores it if colour would otherwise stand alone. */
  suppressedLabel?: string;
  speakerToken?: ColorToken;
  /** Lanes to try in order; bottom_center is appended when missing. */
  candidateLanes: Lane[];
  staticEmphasis?: EmphasisDef[];
  soundDirection?: SoundDirection;
  isSound: boolean;
  /** Voice is off camera (speaker flag or generic/unrevealed label). Detailed renders it italic. */
  offScreen?: boolean;
  shotId?: string;
  /** Verified, validated word entries (Detailed only). Words not listed render plainly. */
  words?: ResolvedWord[];
  /** Verified cue-level delivery (Detailed only). */
  delivery?: { loud: LoudLevel; loudDb?: number; pace: PaceLevel; width?: WidthLevel; manner?: string };
  appliedFeatures: AppliedFeature[];
  fallbackReasons: FallbackReason[];
};

/** A word the renderer may colour, size, capitalise or stretch. `display` is the text to draw. */
export type ResolvedWord = {
  i: number;
  startMs: number;
  endMs: number;
  loud: LoudLevel;
  loudDb?: number;
  pitch: PitchLevel;
  width?: WidthLevel;
  display: string;
};

/** Pass 2 output: the final presentation of one active cue. */
export type ResolvedCaption = {
  cueId: string;
  text: string;
  speakerLabel?: string;
  speakerToken?: ColorToken;
  lane: Lane;
  /** Order within a bottom stack (0 = topmost). Undefined for single-lane cues. */
  stackIndex?: number;
  staticEmphasis?: EmphasisDef[];
  soundDirection?: SoundDirection;
  offScreen?: boolean;
  words?: ResolvedWord[];
  delivery?: { loud: LoudLevel; loudDb?: number; pace: PaceLevel; width?: WidthLevel; manner?: string };
  appliedFeatures: AppliedFeature[];
  fallbackReasons: FallbackReason[];
};
