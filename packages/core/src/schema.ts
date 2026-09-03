/**
 * Companion metadata profile: JSON Schema (draft-07 shaped, for documentation and external
 * validators) plus a hand-written validator that produces actionable, path-addressed errors.
 *
 * The validator needs the canonical cues to check cue IDs and text hashes.
 */

import type { CanonicalCue } from "./vtt.ts";
import { LANES, isLane } from "./lanes.ts";
import { hashMatches, cueTextHash } from "./hashes.ts";
import { visibleTokens, collapseRuns } from "./normalize.ts";
import { SUPPORTED_SCHEMA_VERSIONS, type CompanionProfile, type CueStatus, type ColorToken } from "./types.ts";

export const COLOR_TOKENS: readonly ColorToken[] = [
  "speaker-1", "speaker-2", "speaker-3", "speaker-4", "speaker-5", "speaker-6",
  "support-1", "support-2", "support-3", "support-4", "support-5", "support-6",
  "support-7", "support-8", "support-9", "support-10", "support-11", "support-12",
  "neutral",
];
export const CUE_STATUSES: readonly CueStatus[] = ["verified", "proposed", "rejected"];
export const SOUND_DIRECTIONS = ["left", "right", "center"] as const;
export const EMPHASIS_KINDS = ["weight", "underline"] as const;
export const LOUD_LEVELS = [-1, 0, 1, 2] as const;
export const PITCH_LEVELS = [-1, 0, 1] as const;
export const PACE_LEVELS = [-1, 0, 1] as const;
export const WIDTH_LEVELS = [-1, 0, 1] as const;

/** JSON Schema for tooling and documentation. The runtime uses `validateProfile`. */
export const COMPANION_PROFILE_JSON_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: `https://example.invalid/companion-profile-${SUPPORTED_SCHEMA_VERSIONS[SUPPORTED_SCHEMA_VERSIONS.length - 1]}.schema.json`,
  title: `WebVTT companion metadata profile (experimental) v${SUPPORTED_SCHEMA_VERSIONS[SUPPORTED_SCHEMA_VERSIONS.length - 1]}`,
  type: "object",
  required: ["schemaVersion"],
  additionalProperties: false,
  properties: {
    schemaVersion: { type: "string", enum: [...SUPPORTED_SCHEMA_VERSIONS] },
    canonicalTrack: { type: "string" },
    speakers: {
      type: "object",
      additionalProperties: {
        type: "object",
        required: ["label"],
        additionalProperties: false,
        properties: {
          label: { type: "string", minLength: 1 },
          genericLabel: { type: "string", minLength: 1 },
          color: { type: "string", enum: [...COLOR_TOKENS] },
          revealAtMs: { type: "integer", minimum: 0 },
          offScreen: { type: "boolean" },
        },
      },
    },
    shots: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "startMs", "endMs"],
        additionalProperties: false,
        properties: {
          id: { type: "string", minLength: 1 },
          startMs: { type: "integer", minimum: 0 },
          endMs: { type: "integer", minimum: 0 },
          status: { type: "string", enum: [...CUE_STATUSES] },
          protected: {
            type: "array",
            items: {
              type: "object",
              required: ["x", "y", "w", "h"],
              additionalProperties: false,
              properties: {
                x: { type: "number", minimum: 0, maximum: 1 },
                y: { type: "number", minimum: 0, maximum: 1 },
                w: { type: "number", minimum: 0, maximum: 1 },
                h: { type: "number", minimum: 0, maximum: 1 },
                reason: { type: "string" },
              },
            },
          },
        },
      },
    },
    cues: {
      type: "object",
      additionalProperties: {
        type: "object",
        required: ["textHash", "status"],
        additionalProperties: false,
        properties: {
          textHash: { type: "string", pattern: "^(sha256:)?[0-9a-f]{64}$" },
          status: { type: "string", enum: [...CUE_STATUSES] },
          verifiedBy: { type: "string" },
          speaker: { type: "string" },
          offScreen: { type: "boolean", description: "This cue's voice is off camera (a line over a cutaway). Italic in Detailed. Verified cues only." },
          speakerProposal: { type: "object", description: "Authoring annotation (diarization and active-speaker proposals); the runtime ignores it." },
          speakers: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 2 },
          lanes: { type: "array", items: { type: "string", enum: [...LANES] }, minItems: 1 },
          emphasis: {
            type: "array",
            items: {
              type: "object",
              required: ["tokenIndex", "kind"],
              additionalProperties: false,
              properties: {
                tokenIndex: { type: "integer", minimum: 0 },
                kind: { type: "string", enum: [...EMPHASIS_KINDS] },
              },
            },
          },
          sound: {
            type: "object",
            required: ["direction"],
            additionalProperties: false,
            properties: { direction: { type: "string", enum: [...SOUND_DIRECTIONS] } },
          },
          provenance: { type: "string" },
          words: {
            description: "Schema 0.2. One entry per timed visible token; untimed tokens render plainly.",
            type: "array",
            items: {
              type: "object",
              required: ["i", "startMs", "endMs"],
              additionalProperties: false,
              properties: {
                i: { type: "integer", minimum: 0 },
                startMs: { type: "integer", minimum: 0 },
                endMs: { type: "integer", minimum: 0 },
                loud: { type: "integer", enum: [...LOUD_LEVELS] },
                loudDb: { type: "number", minimum: -40, maximum: 40 },
                pitch: { type: "integer", enum: [...PITCH_LEVELS] },
                width: { type: "integer", enum: [...WIDTH_LEVELS] },
                caps: { type: "boolean" },
                stretch: { type: "string", minLength: 1 },
                status: { type: "string", enum: [...CUE_STATUSES] },
                verifiedBy: { type: "string" },
                score: { type: "number", minimum: 0, maximum: 1, description: "Authoring annotation: the aligner's confidence for this word. The runtime ignores it." },
                interpolated: { type: "boolean", description: "Authoring annotation: the timing was placed between verified neighbours, not measured; such a word carries no measurements." },
              },
            },
          },
          delivery: {
            description: "Schema 0.2. Cue-level delivery; manner is human-authored.",
            type: "object",
            additionalProperties: false,
            properties: {
              loud: { type: "integer", enum: [...LOUD_LEVELS] },
              loudDb: { type: "number", minimum: -40, maximum: 40 },
              width: { type: "integer", enum: [...WIDTH_LEVELS] },
              pace: { type: "integer", enum: [...PACE_LEVELS] },
              manner: { type: "string", minLength: 1 },
              status: { type: "string", enum: [...CUE_STATUSES] },
              verifiedBy: { type: "string" },
            },
          },
        },
      },
    },
    faceIdentities: { description: "Authoring annotation from active speaker detection; the runtime ignores it.", type: "object" },
    sounds: {
      description: "Schema 0.2. Sound events beside the canonical track, Detailed mode only.",
      type: "array",
      items: {
        type: "object",
        required: ["id", "startMs", "endMs", "label", "status"],
        additionalProperties: false,
        properties: {
          id: { type: "string", minLength: 1 },
          startMs: { type: "integer", minimum: 0 },
          endMs: { type: "integer", minimum: 0 },
          label: { type: "string", minLength: 1 },
          direction: { type: "string", enum: [...SOUND_DIRECTIONS] },
          directionProvenance: { type: "string", description: "Authoring annotation: how the direction was measured." },
          loudDb: { type: "number", minimum: -40, maximum: 40, description: "Measured level relative to the scene's speech; sizes the label." },
          offScreen: { type: "boolean" },
          status: { type: "string", enum: [...CUE_STATUSES] },
          provenance: { type: "string" },
          verifiedBy: { type: "string" },
        },
      },
    },
  },
} as const;

export type ValidationIssue = {
  level: "error" | "warning";
  path: string;
  message: string;
  /** What to do about it. */
  hint?: string;
};

export type ValidationResult = {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isInt = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/**
 * Validate a parsed companion profile against the canonical cues.
 *
 * Errors make the cue (or the whole profile, for structural problems) ineligible for enhanced
 * rendering. Warnings are advisory. The runtime never throws on invalid metadata: it ignores
 * the affected enhancement and renders the canonical cue.
 */
export function validateProfile(profile: unknown, cues: CanonicalCue[]): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const err = (path: string, message: string, hint?: string) => errors.push({ level: "error", path, message, hint });
  const warn = (path: string, message: string, hint?: string) => warnings.push({ level: "warning", path, message, hint });

  if (!isObj(profile)) {
    err("$", "Profile must be a JSON object", "The file should contain { \"schemaVersion\": \"0.1\", ... }");
    return { ok: false, errors, warnings };
  }

  const sv = profile.schemaVersion;
  if (typeof sv !== "string" || !(SUPPORTED_SCHEMA_VERSIONS as readonly string[]).includes(sv)) {
    err("$.schemaVersion", `Unsupported schemaVersion ${JSON.stringify(sv)}`, `Supported: ${SUPPORTED_SCHEMA_VERSIONS.join(", ")}. The runtime falls back to Standard for the whole track.`);
    return { ok: false, errors, warnings };
  }

  for (const key of Object.keys(profile)) {
    if (!["schemaVersion", "canonicalTrack", "speakers", "shots", "cues", "sounds", "faceIdentities"].includes(key)) warn(`$.${key}`, "Unknown top-level field is ignored");
  }

  // Canonical cue index and duplicate check.
  const byId = new Map<string, CanonicalCue>();
  for (const c of cues) {
    if (byId.has(c.id)) err(`vtt#${c.id}`, `Duplicate cue identifier "${c.id}" in the canonical track`, "Cue identifiers must be unique; the companion file is keyed by them.");
    byId.set(c.id, c);
  }
  for (const c of cues) if (!c.id || /^auto_/.test(c.id)) err(`vtt#${c.id}`, "Canonical cue has no stable identifier", "Add an identifier line above the timing line of every cue.");

  // Reading rate (advisory, BBC subtitle guidance): over 180 words per minute or under 0.3 s per word is hard to read.
  for (const c of cues) {
    const n = visibleTokens(c.rawText).length; const dur = (c.endMs - c.startMs) / 1000;
    if (n === 0 || dur <= 0) continue;
    const wpm = (n / dur) * 60;
    if (wpm > 180) warn(`vtt#${c.id}`, `Reading rate ${Math.round(wpm)} wpm exceeds 180 wpm (${n} words in ${dur.toFixed(2)} s)`, "Extend the cue or split the text; viewers cannot read this in time.");
    else if (dur / n < 0.3 && n > 1) warn(`vtt#${c.id}`, `Under 0.3 s per word (${(dur / n).toFixed(2)} s)`, "Extend the cue.");
  }

  // Speakers.
  const speakers = profile.speakers;
  const speakerIds = new Set<string>();
  if (speakers !== undefined) {
    if (!isObj(speakers)) err("$.speakers", "speakers must be an object keyed by speaker id");
    else {
      for (const [id, def] of Object.entries(speakers)) {
        const p = `$.speakers.${id}`;
        if (!isObj(def)) { err(p, "Speaker must be an object"); continue; }
        speakerIds.add(id);
        if (typeof def.label !== "string" || !def.label.trim()) err(`${p}.label`, "label is required and must be a non-empty string");
        if (def.genericLabel !== undefined && (typeof def.genericLabel !== "string" || !def.genericLabel.trim())) err(`${p}.genericLabel`, "genericLabel must be a non-empty string when present");
        if (def.color !== undefined && !(COLOR_TOKENS as readonly string[]).includes(def.color as string)) err(`${p}.color`, `Invalid color token ${JSON.stringify(def.color)}`, `Use one of ${COLOR_TOKENS.join(", ")}`);
        if (def.revealAtMs !== undefined && (!isInt(def.revealAtMs) || def.revealAtMs < 0)) err(`${p}.revealAtMs`, "revealAtMs must be a non-negative integer (milliseconds)");
        if (def.offScreen !== undefined && typeof def.offScreen !== "boolean") err(`${p}.offScreen`, "offScreen must be a boolean");
      }
    }
  }

  // Shots.
  const shots = profile.shots;
  const shotIds = new Set<string>();
  if (shots !== undefined) {
    if (!Array.isArray(shots)) err("$.shots", "shots must be an array");
    else {
      const ranges: Array<{ id: string; s: number; e: number }> = [];
      shots.forEach((sh, i) => {
        const p = `$.shots[${i}]`;
        if (!isObj(sh)) { err(p, "Shot must be an object"); return; }
        if (typeof sh.id !== "string" || !sh.id) err(`${p}.id`, "Shot id is required");
        else if (shotIds.has(sh.id)) err(`${p}.id`, `Duplicate shot id "${sh.id}"`); else shotIds.add(sh.id);
        if (!isInt(sh.startMs) || !isInt(sh.endMs) || (sh.startMs as number) < 0 || (sh.endMs as number) <= (sh.startMs as number)) err(p, "startMs/endMs must be integers with 0 <= startMs < endMs");
        if (sh.status !== undefined && !(CUE_STATUSES as readonly string[]).includes(sh.status as string)) err(`${p}.status`, `Invalid status ${JSON.stringify(sh.status)}`);
        else ranges.push({ id: String(sh.id), s: sh.startMs as number, e: sh.endMs as number });
        if (sh.protected !== undefined) {
          if (!Array.isArray(sh.protected)) err(`${p}.protected`, "protected must be an array of rectangles");
          else sh.protected.forEach((r, j) => {
            const rp = `${p}.protected[${j}]`;
            if (!isObj(r)) { err(rp, "Rectangle must be an object"); return; }
            for (const k of ["x", "y", "w", "h"]) if (!isNum(r[k]) || (r[k] as number) < 0 || (r[k] as number) > 1) err(`${rp}.${k}`, `${k} must be a number in [0, 1] (normalized viewport coordinates)`);
            if (isNum(r.x) && isNum(r.w) && (r.x as number) + (r.w as number) > 1.0001) err(rp, "Rectangle extends past the right edge (x + w > 1)");
            if (isNum(r.y) && isNum(r.h) && (r.y as number) + (r.h as number) > 1.0001) err(rp, "Rectangle extends past the bottom edge (y + h > 1)");
          });
        }
      });
      ranges.sort((a, b) => a.s - b.s);
      for (let i = 1; i < ranges.length; i++) if (ranges[i].s < ranges[i - 1].e) err(`$.shots`, `Shots "${ranges[i - 1].id}" and "${ranges[i].id}" overlap in time`);
    }
  }

  // Cues.
  const cueMeta = profile.cues;
  if (cueMeta !== undefined) {
    if (!isObj(cueMeta)) err("$.cues", "cues must be an object keyed by canonical cue id");
    else {
      for (const [id, meta] of Object.entries(cueMeta)) {
        const p = `$.cues.${id}`;
        if (!isObj(meta)) { err(p, "Cue metadata must be an object"); continue; }
        const canonical = byId.get(id);
        if (!canonical) { err(p, `No canonical cue with id "${id}"`, "Remove this entry or fix the id; metadata cannot exist without a canonical cue."); continue; }
        if (typeof meta.textHash !== "string" || !/^(sha256:)?[0-9a-f]{64}$/i.test(meta.textHash)) err(`${p}.textHash`, "textHash must be \"sha256:<64 hex>\"", `Expected ${cueTextHash(canonical.rawText)}`);
        else if (!hashMatches(meta.textHash, canonical.rawText)) err(`${p}.textHash`, "textHash does not match the canonical visible text (stale metadata)", `Canonical text is ${JSON.stringify(canonical.plainText)}; expected ${cueTextHash(canonical.rawText)}. The runtime ignores this cue's enhancement.`);
        if (!(CUE_STATUSES as readonly string[]).includes(meta.status as string)) err(`${p}.status`, `Invalid status ${JSON.stringify(meta.status)}`, `Use one of ${CUE_STATUSES.join(", ")}`);
        else if (meta.status !== "verified") warn(`${p}.status`, `Cue is "${meta.status}"; its enhancement is ignored in viewer mode`);
        if (meta.speaker !== undefined) {
          if (typeof meta.speaker !== "string") err(`${p}.speaker`, "speaker must be a string id");
          else if (!speakerIds.has(meta.speaker)) err(`${p}.speaker`, `Unknown speaker id "${meta.speaker}"`, `Declare it under $.speakers or remove it.`);
        }
        if (meta.offScreen !== undefined && typeof meta.offScreen !== "boolean") err(`${p}.offScreen`, "offScreen must be a boolean");
        if (meta.speakers !== undefined) {
          if (!Array.isArray(meta.speakers) || meta.speakers.length !== 2 || !meta.speakers.every((x) => typeof x === "string")) err(`${p}.speakers`, "speakers must be an array of exactly two speaker ids (dual-speaker cue)");
          else meta.speakers.forEach((sid, i) => { if (!speakerIds.has(sid as string)) err(`${p}.speakers[${i}]`, `Unknown speaker id "${sid}"`); });
          if (meta.speaker !== undefined) warn(`${p}.speaker`, "speaker is ignored when speakers[] is present");
        }
        if (meta.lanes !== undefined) {
          if (!Array.isArray(meta.lanes) || meta.lanes.length === 0) err(`${p}.lanes`, "lanes must be a non-empty array");
          else meta.lanes.forEach((l, i) => { if (!isLane(l)) err(`${p}.lanes[${i}]`, `Invalid lane ${JSON.stringify(l)}`, `Use one of ${LANES.join(", ")}`); });
        }
        if (meta.emphasis !== undefined) {
          const tokens = visibleTokens(canonical.rawText);
          if (!Array.isArray(meta.emphasis)) err(`${p}.emphasis`, "emphasis must be an array");
          else meta.emphasis.forEach((e, i) => {
            const ep = `${p}.emphasis[${i}]`;
            if (!isObj(e)) { err(ep, "Emphasis entry must be an object"); return; }
            if (!isInt(e.tokenIndex) || (e.tokenIndex as number) < 0 || (e.tokenIndex as number) >= tokens.length) err(`${ep}.tokenIndex`, `tokenIndex out of range (cue has ${tokens.length} tokens)`);
            if (!(EMPHASIS_KINDS as readonly string[]).includes(e.kind as string)) err(`${ep}.kind`, `Invalid emphasis kind ${JSON.stringify(e.kind)}`, `Use one of ${EMPHASIS_KINDS.join(", ")}`);
          });
        }
        if (meta.sound !== undefined) {
          if (!isObj(meta.sound) || !(SOUND_DIRECTIONS as readonly string[]).includes(meta.sound.direction as string)) err(`${p}.sound.direction`, "sound.direction must be left, right, or center");
        }
        if (meta.words !== undefined) validateWords(meta.words, canonical, p, err, warn);
        if (meta.delivery !== undefined) {
          const dp = `${p}.delivery`;
          const d = meta.delivery;
          if (!isObj(d)) err(dp, "delivery must be an object");
          else {
            if (d.loud !== undefined && !(LOUD_LEVELS as readonly number[]).includes(d.loud as number)) err(`${dp}.loud`, "loud must be -1, 0, 1 or 2");
            if (d.loudDb !== undefined && (!isNum(d.loudDb) || (d.loudDb as number) < -40 || (d.loudDb as number) > 40)) err(`${dp}.loudDb`, "loudDb must be a number between -40 and 40");
            if (d.pace !== undefined && !(PACE_LEVELS as readonly number[]).includes(d.pace as number)) err(`${dp}.pace`, "pace must be -1, 0 or 1");
            if (d.width !== undefined && !(WIDTH_LEVELS as readonly number[]).includes(d.width as number)) err(`${dp}.width`, "width must be -1, 0 or 1");
            if (d.manner !== undefined && (typeof d.manner !== "string" || !d.manner.trim() || /[\[\]]/.test(d.manner))) err(`${dp}.manner`, "manner must be a short phrase without brackets");
            if (d.status !== undefined && !(CUE_STATUSES as readonly string[]).includes(d.status as string)) err(`${dp}.status`, `Invalid status ${JSON.stringify(d.status)}`);
            if (d.status === "verified" && typeof d.verifiedBy === "string" && d.verifiedBy !== "human") machineVerified.delivery++;
            for (const key of Object.keys(d)) if (!["loud", "loudDb", "pace", "width", "manner", "status", "verifiedBy"].includes(key)) warn(`${dp}.${key}`, "Unknown field is ignored");
          }
        }
        if (meta.shot !== undefined) warn(`${p}.shot`, "Per-cue shot references are not part of the schema; shots are matched by time");
        if (meta.speakerProposal !== undefined && !isObj(meta.speakerProposal)) err(`${p}.speakerProposal`, "speakerProposal must be an object (authoring annotation; ignored by the runtime)");
        for (const key of Object.keys(meta)) if (!["textHash", "status", "speaker", "speakers", "lanes", "emphasis", "sound", "provenance", "words", "delivery", "verifiedBy", "speakerProposal", "offScreen"].includes(key)) warn(`${p}.${key}`, "Unknown field is ignored");
      }
    }
  }

  // Sound events (schema 0.2).
  const sounds = profile.sounds;
  if (sounds !== undefined) {
    if (!Array.isArray(sounds)) err("$.sounds", "sounds must be an array");
    else {
      const ids = new Set<string>();
      sounds.forEach((ev, i) => {
        const sp = `$.sounds[${i}]`;
        if (!isObj(ev)) { err(sp, "Sound event must be an object"); return; }
        if (typeof ev.id !== "string" || !ev.id) err(`${sp}.id`, "id is required");
        else if (ids.has(ev.id)) err(`${sp}.id`, `Duplicate sound id "${ev.id}"`); else ids.add(ev.id);
        if (!isInt(ev.startMs) || !isInt(ev.endMs) || (ev.startMs as number) < 0 || (ev.endMs as number) <= (ev.startMs as number)) err(sp, "startMs/endMs must be integers with 0 <= startMs < endMs");
        if (typeof ev.label !== "string" || !ev.label.trim()) err(`${sp}.label`, "label is required");
        else if (/[\[\]]/.test(ev.label)) err(`${sp}.label`, "label must not contain brackets; the renderer adds them");
        if (ev.direction !== undefined && !(SOUND_DIRECTIONS as readonly string[]).includes(ev.direction as string)) err(`${sp}.direction`, "direction must be left, right, or center");
        if (ev.offScreen !== undefined && typeof ev.offScreen !== "boolean") err(`${sp}.offScreen`, "offScreen must be a boolean");
        if (!(CUE_STATUSES as readonly string[]).includes(ev.status as string)) err(`${sp}.status`, `Invalid status ${JSON.stringify(ev.status)}`);
        else if (ev.status !== "verified") warn(`${sp}.status`, `Sound event is "${ev.status}"; it is not shown`);
        if (ev.status === "verified" && typeof ev.verifiedBy === "string" && ev.verifiedBy !== "human") machineVerified.sounds++;
        for (const key of Object.keys(ev)) if (!["id", "startMs", "endMs", "label", "direction", "directionProvenance", "loudDb", "offScreen", "status", "provenance", "verifiedBy"].includes(key)) warn(`${sp}.${key}`, "Unknown field is ignored");
      });
    }
  }

  if (machineVerified.words || machineVerified.delivery || machineVerified.sounds) {
    warn("$", `MACHINE-VERIFIED DATA: ${machineVerified.words} words, ${machineVerified.delivery} delivery entries, ${machineVerified.sounds} sound events carry status "verified" set by a rule, not a person`, "Acceptable on a development bench only. Review in the review page before any pilot, demo or submission.");
    machineVerified.words = machineVerified.delivery = machineVerified.sounds = 0;
  }
  return { ok: errors.length === 0, errors, warnings };
}

type Reporter = (path: string, message: string, hint?: string) => void;

/** Words: indexes in range and unique, times inside the cue and non-decreasing, levels in range, stretch collapses to the token. */
const machineVerified = { words: 0, delivery: 0, sounds: 0 };

function validateWords(words: unknown, canonical: CanonicalCue, p: string, err: Reporter, warn: Reporter): void {
  const wp = `${p}.words`;
  if (!Array.isArray(words)) { err(wp, "words must be an array"); return; }
  const tokens = visibleTokens(canonical.rawText);
  const seen = new Set<number>();
  let lastStart = -1;
  words.forEach((w, k) => {
    const q = `${wp}[${k}]`;
    if (!isObj(w)) { err(q, "Word entry must be an object"); return; }
    if (!isInt(w.i) || (w.i as number) < 0 || (w.i as number) >= tokens.length) { err(`${q}.i`, `i out of range (cue has ${tokens.length} tokens)`); return; }
    const i = w.i as number;
    if (seen.has(i)) err(`${q}.i`, `Token ${i} is timed twice`); else seen.add(i);
    if (!isInt(w.startMs) || !isInt(w.endMs) || (w.startMs as number) < 0 || (w.endMs as number) < (w.startMs as number)) err(q, "startMs/endMs must be integers with startMs <= endMs");
    else {
      if ((w.startMs as number) < canonical.startMs - 50 || (w.endMs as number) > canonical.endMs + 50) err(q, `Word timing lies outside the cue (${canonical.startMs}-${canonical.endMs} ms)`, "Word timings are relative to the media, not the cue, and must stay inside it (50 ms tolerance).");
      if ((w.startMs as number) < lastStart) warn(q, "Word starts before the previous timed word; entries should be in token order");
      lastStart = w.startMs as number;
    }
    if (w.loud !== undefined && !(LOUD_LEVELS as readonly number[]).includes(w.loud as number)) err(`${q}.loud`, "loud must be -1, 0, 1 or 2");
    if (w.loudDb !== undefined && (!isNum(w.loudDb) || (w.loudDb as number) < -40 || (w.loudDb as number) > 40)) err(`${q}.loudDb`, "loudDb must be a number between -40 and 40 (dB relative to the scene's speech median)");
    if (w.pitch !== undefined && !(PITCH_LEVELS as readonly number[]).includes(w.pitch as number)) err(`${q}.pitch`, "pitch must be -1, 0 or 1");
    if (w.width !== undefined && !(WIDTH_LEVELS as readonly number[]).includes(w.width as number)) err(`${q}.width`, "width must be -1, 0 or 1");
    if (w.caps !== undefined && typeof w.caps !== "boolean") err(`${q}.caps`, "caps must be a boolean");
    if (w.stretch !== undefined) {
      if (typeof w.stretch !== "string" || !w.stretch.trim()) err(`${q}.stretch`, "stretch must be a non-empty string");
      else if (collapseRuns(w.stretch) !== collapseRuns(tokens[i])) err(`${q}.stretch`, `stretch ${JSON.stringify(w.stretch)} does not collapse to the canonical token ${JSON.stringify(tokens[i])}`, "Only repeated letters may be added; nothing else may change.");
    }
    if (w.status !== undefined && !(CUE_STATUSES as readonly string[]).includes(w.status as string)) err(`${q}.status`, `Invalid status ${JSON.stringify(w.status)}`);
    if (w.status === "verified" && typeof w.verifiedBy === "string" && w.verifiedBy !== "human") machineVerified.words++;
    for (const key of Object.keys(w)) if (!["i", "startMs", "endMs", "loud", "loudDb", "pitch", "width", "caps", "stretch", "status", "verifiedBy", "score", "interpolated"].includes(key)) warn(`${q}.${key}`, "Unknown field is ignored");
  });
}

/** Human-readable report for the CLI. */
export function formatValidation(result: ValidationResult): string {
  const lines: string[] = [];
  for (const e of result.errors) lines.push(`error    ${e.path}: ${e.message}${e.hint ? `\n           ${e.hint}` : ""}`);
  for (const w of result.warnings) lines.push(`warning  ${w.path}: ${w.message}${w.hint ? `\n           ${w.hint}` : ""}`);
  lines.push(result.ok ? `OK (${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"})` : `FAILED (${result.errors.length} error${result.errors.length === 1 ? "" : "s"}, ${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"})`);
  return lines.join("\n");
}
