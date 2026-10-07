/**
 * Heuristic detectors for rules that no token list can express. Each takes the
 * prepared text and returns candidate hits. The checker turns hits into
 * violations with the rule's metadata.
 */
import type { Prepared } from "./markdown.js";
import { paragraphs, plain, sentences, words } from "./text.js";
import type { Confidence, Severity } from "./types.js";

export interface DetectorHit {
  offset: number;
  length: number;
  confidence: Confidence;
  severity?: Severity;
  form?: string;
}

export type Detector = (prepared: Prepared) => DetectorHit[];

/**
 * CES-C-002. Three single words joined "A, B, and C" or "A, B and C".
 * Capitalized items (proper nouns) are skipped unless the first one opens the
 * sentence, as are items with digits and lists of four or more.
 */
const stylisticTriples: Detector = (prepared) => {
  const hits: DetectorHit[] = [];
  const re = /\b([A-Za-z][a-z-]*), ([a-z][a-z-]*),? (?:and|or) ([a-z][a-z-]*)\b/g;
  for (const p of paragraphs(prepared.masked)) {
    if (p.kind === "table") continue;
    for (const s of sentences(p)) {
      let m: RegExpExecArray | null;
      re.lastIndex = 0;
      while ((m = re.exec(s.text))) {
        const prefix = s.text.slice(0, m.index);
        if (/\w,\s*$/.test(prefix)) continue; // part of a longer list
        if (/^[A-Z]/.test(m[1]!) && m.index !== 0) continue; // proper noun, not a sentence opener
        hits.push({ offset: s.start + m.index, length: m[0].length, confidence: "low" });
      }
    }
  }
  return hits;
};

/**
 * CES-V-007, fragment form. A sentence of three words or fewer, ending in a
 * period, right after a sentence of eight words or more in the same paragraph.
 */
const fragmentFlourish: Detector = (prepared) => {
  const hits: DetectorHit[] = [];
  for (const p of paragraphs(prepared.masked)) {
    if (p.kind !== "text" && p.kind !== "quote") continue;
    const ss = sentences(p);
    for (let i = 1; i < ss.length; i++) {
      const cur = ss[i]!;
      const prev = ss[i - 1]!;
      if (!cur.text.endsWith(".")) continue;
      const n = words(plain(cur.text)).length;
      if (n === 0 || n > 3) continue;
      if (words(plain(prev.text)).length < 8) continue;
      hits.push({
        offset: cur.start,
        length: cur.end - cur.start,
        confidence: "low",
        severity: "warning",
        form: "fragment",
      });
    }
  }
  return hits;
};

export const DETECTORS: Record<string, Detector> = {
  "stylistic-triples": stylisticTriples,
  "fragment-flourish": fragmentFlourish,
};
