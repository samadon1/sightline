/**
 * Canonical visible-text normalization (companion profile §10.3).
 *
 * 1. Parse WebVTT cue markup.
 * 2. Remove tags while preserving visible text.
 * 3. Decode entities.
 * 4. Normalize Unicode to NFC.
 * 5. Convert line breaks and repeated whitespace to single spaces.
 * 6. Trim leading and trailing whitespace.
 * 7. Preserve case and punctuation.
 *
 * The hash is computed over the UTF-8 bytes of this string (see hashes.ts).
 */

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  lrm: "‎",
  rlm: "‏",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (m, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[body] ?? m;
  });
}

/** Remove WebVTT inline tags (<v>, <b>, <i>, <u>, <c>, <ruby>, <rt>, <lang>, timestamps). */
export function stripCueTags(payload: string): string {
  return payload.replace(/<\/?[^>]*>/g, "");
}

/** Visible text used for hashing and for display when the renderer cannot show markup. */
export function normalizeVisibleText(rawCueText: string): string {
  const noTags = stripCueTags(rawCueText);
  const decoded = decodeEntities(noTags);
  const nfc = typeof decoded.normalize === "function" ? decoded.normalize("NFC") : decoded;
  return nfc.replace(/[\s ]+/g, " ").trim();
}

/** Tokens of the visible text, split on whitespace. Emphasis indices refer to this array. */
export function visibleTokens(rawCueText: string): string[] {
  const t = normalizeVisibleText(rawCueText);
  return t.length ? t.split(" ") : [];
}

/** Collapse runs of the same letter ("Nooooo" -> "No") after lowercasing and stripping punctuation, for stretch checks. */
export function collapseRuns(word: string): string {
  const core = word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
  return core.replace(/(.)\1+/g, "$1");
}
