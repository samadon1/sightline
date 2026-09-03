#!/usr/bin/env node --experimental-strip-types
/**
 * Write the companion metadata profile's JSON Schema to schema/companion-profile-<version>.schema.json
 * so publishers and tools can validate files without this repository's code.
 *
 *   npm run export-schema
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { COMPANION_PROFILE_JSON_SCHEMA, SUPPORTED_SCHEMA_VERSIONS } from "../packages/core/src/index.ts";

const version = SUPPORTED_SCHEMA_VERSIONS[SUPPORTED_SCHEMA_VERSIONS.length - 1];
const out = new URL(`../schema/companion-profile-${version}.schema.json`, import.meta.url).pathname;
mkdirSync(new URL("../schema/", import.meta.url).pathname, { recursive: true });
const schema = { ...COMPANION_PROFILE_JSON_SCHEMA, $id: `https://sightline.invalid/schema/companion-profile-${version}.schema.json`, title: `WebVTT companion metadata profile (experimental) v${version}` };
writeFileSync(out, JSON.stringify(schema, null, 2) + "\n");
console.log(`wrote ${out}`);
