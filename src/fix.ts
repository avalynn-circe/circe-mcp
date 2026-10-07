import type { Checker } from "./check.js";
import type { CheckOptions, Violation } from "./types.js";

export interface AppliedFix {
  ruleId: string;
  line: number;
  column: number;
  before: string;
  after: string;
}

export interface FixResult {
  text: string;
  applied: AppliedFix[];
  remaining: Violation[];
}

/**
 * Applies every fixable violation and returns the result with the violations
 * that still need a writer. Only primary violations are fixed; a fixable word
 * inside a larger construction (a `related` entry) is left for the rewrite.
 */
export function fixText(checker: Checker, text: string, options: CheckOptions = {}): FixResult {
  const { violations } = checker.check(text, { ...options, severity: undefined });
  const fixable = violations.filter((v) => v.fixable).sort((a, b) => b.offset - a.offset);
  const applied: AppliedFix[] = [];
  let out = text;

  for (const v of fixable) {
    const token = findToken(checker, v);
    if (!token || typeof token.fix !== "string") continue;
    const edit = token.fix === "" ? deletion(out, v.offset, v.length) : replacement(out, v.offset, v.length, token.fix);
    applied.push({ ruleId: v.ruleId, line: v.line, column: v.column, before: out.slice(edit.start, edit.end), after: edit.text });
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  }

  const remaining = checker.check(out, options).violations;
  return { text: out, applied: applied.reverse(), remaining };
}

function findToken(checker: Checker, v: Violation) {
  const rule = checker.rule(v.ruleId);
  return rule?.tokens?.find((t) => {
    if (t.fixable !== true) return false;
    if (t.phrase) return t.phrase.toLowerCase() === v.match.toLowerCase().replace(/\s+/g, " ");
    return new RegExp(`^(?:${t.regex})$`, "iu").test(v.match);
  });
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

/**
 * Deletes a word and the punctuation or space that would dangle without it.
 * "Really, do it." becomes "Do it."; "faster, really." becomes "faster.";
 * "is actually faster" becomes "is faster".
 */
function deletion(text: string, start: number, length: number): Edit {
  let end = start + length;
  const wasCapital = /^\p{Lu}/u.test(text.slice(start, end));
  const before = text.slice(0, start);
  const atSentenceStart = /(?:^|[.!?]\s+|\n\s*)$/.test(before);
  const after = text.slice(end);

  if (atSentenceStart && /^,\s*/.test(after)) {
    end += /^,\s*/.exec(after)![0].length; // "Really, do it." -> "do it."
  } else if (/,\s*$/.test(before) && /^[.!?;:,]/.test(after)) {
    start -= /,\s*$/.exec(before)![0].length; // "faster, really." -> "faster."
  } else if (text[end] === " ") {
    end++;
  } else if (text[start - 1] === " ") {
    start--;
  }

  let replacement = "";
  if (atSentenceStart && wasCapital && /^\p{Ll}/u.test(text.slice(end))) {
    replacement = text[end]!.toUpperCase();
    end++;
  }
  return { start, end, text: replacement };
}

/** Replaces a match with punctuation, absorbing the spaces around it. */
function replacement(text: string, start: number, length: number, fix: string): Edit {
  let end = start + length;
  while (start > 0 && (text[start - 1] === " " || text[start - 1] === "\t")) start--;
  while (end < text.length && (text[end] === " " || text[end] === "\t")) end++;
  let out = fix;
  if (end >= text.length || text[end] === "\n") out = fix.trimEnd();
  if (start === 0 || text[start - 1] === "\n") out = fix.trimStart();
  return { start, end, text: out };
}
