#!/usr/bin/env node --experimental-strip-types
/**
 * Validate a canonical WebVTT track and its optional companion metadata profile.
 *
 *   npm run validate -- assets/the-envelope/captions.en.vtt assets/the-envelope/sightline.en.json
 *   npm run validate -- assets/the-envelope/captions.en.vtt            (VTT only)
 *   npm run validate -- --hashes assets/the-envelope/captions.en.vtt   (print cue hashes for authoring)
 *
 * Exit code 0 when valid, 1 on errors, 2 on usage/IO problems.
 */

import { readFileSync } from "node:fs";
import { parseVtt, validateProfile, formatValidation, cueTextHash } from "../packages/core/src/index.ts";

const args = process.argv.slice(2);
const printHashes = args.includes("--hashes");
const files = args.filter((a) => !a.startsWith("--"));
if (files.length < 1) {
  console.error("usage: validate [--hashes] <captions.vtt> [companion.json]");
  process.exit(2);
}

let vttText: string;
try { vttText = readFileSync(files[0], "utf8"); } catch (e) { console.error(`cannot read ${files[0]}: ${String(e)}`); process.exit(2); }

const parsed = parseVtt(vttText);
for (const w of parsed.warnings) console.log(`warning  vtt: ${w}`);
console.log(`vtt: ${parsed.cues.length} cue${parsed.cues.length === 1 ? "" : "s"} parsed from ${files[0]}`);

if (printHashes) {
  for (const c of parsed.cues) console.log(`${c.id}\t${cueTextHash(c.rawText)}\t${c.voice ?? "-"}\t${c.plainText}`);
}

if (files.length < 2) {
  const dupes = parsed.cues.length !== new Set(parsed.cues.map((c) => c.id)).size;
  if (dupes) { console.log("error    vtt: duplicate cue identifiers"); process.exit(1); }
  console.log(parsed.warnings.length ? `OK with ${parsed.warnings.length} warning(s)` : "OK");
  process.exit(0);
}

let profile: unknown;
try { profile = JSON.parse(readFileSync(files[1], "utf8")); } catch (e) { console.log(`error    ${files[1]}: not valid JSON (${String(e)})`); process.exit(1); }

const result = validateProfile(profile, parsed.cues);
console.log(formatValidation(result));
process.exit(result.ok ? 0 : 1);
