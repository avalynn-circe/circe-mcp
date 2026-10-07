/** Paragraph and sentence segmentation over masked Markdown. */

export type ParagraphKind = "text" | "heading" | "list" | "table" | "quote";

export interface Span {
  start: number;
  end: number;
  text: string;
}

export interface Paragraph extends Span {
  kind: ParagraphKind;
}

const BLOCK_LINE = /^\s{0,3}(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|\||>)/;

function kindOf(line: string): ParagraphKind {
  const t = line.trimStart();
  if (/^#{1,6}\s/.test(t)) return "heading";
  if (/^(?:[-*+]|\d+[.)])\s/.test(t)) return "list";
  if (t.startsWith("|")) return "table";
  if (t.startsWith(">")) return "quote";
  return "text";
}

/** Splits text into paragraphs. Headings, list items, and table rows each stand alone. */
export function paragraphs(text: string): Paragraph[] {
  const out: Paragraph[] = [];
  let cur: { start: number; end: number; kind: ParagraphKind } | null = null;
  let offset = 0;
  const flush = () => {
    if (cur && text.slice(cur.start, cur.end).trim().length > 0) {
      out.push({ ...cur, text: text.slice(cur.start, cur.end) });
    }
    cur = null;
  };
  for (const line of text.split("\n")) {
    const end = offset + line.length;
    if (line.trim().length === 0) flush();
    else if (BLOCK_LINE.test(line)) {
      flush();
      cur = { start: offset, end, kind: kindOf(line) };
      if (cur.kind !== "list" && cur.kind !== "quote") flush();
    } else if (cur && (cur.kind === "text" || cur.kind === "list" || cur.kind === "quote")) {
      cur.end = end;
    } else {
      cur = { start: offset, end, kind: "text" };
    }
    offset = end + 1;
  }
  flush();
  return out;
}

const ABBREVIATIONS = new Set(["e.g", "i.e", "etc", "vs", "mr", "mrs", "ms", "dr", "no", "fig", "st", "jr", "sr", "inc", "ltd", "approx"]);

/** Splits a paragraph into sentences. Ignores periods inside numbers and after abbreviations. */
export function sentences(p: Span): Span[] {
  const out: Span[] = [];
  const text = p.text;
  let start = 0;
  const re = /[.!?]+(?=\s|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const end = m.index + m[0].length;
    const before = text.slice(start, m.index);
    const lastWord = /([\w.]+)$/.exec(before)?.[1]?.toLowerCase() ?? "";
    if (m[0] === "." && (ABBREVIATIONS.has(lastWord) || /^[a-z]$/i.test(lastWord))) continue;
    const next = text.slice(end).match(/^\s*(\S)/)?.[1];
    if (m[0] === "." && next !== undefined && /[a-z]/.test(next)) continue;
    push(start, end);
    start = end;
  }
  push(start, text.length);
  return out;

  function push(s: number, e: number) {
    const raw = text.slice(s, e);
    const lead = raw.length - raw.trimStart().length;
    const trail = raw.length - raw.trimEnd().length;
    if (raw.trim().length === 0) return;
    out.push({ start: p.start + s + lead, end: p.start + e - trail, text: raw.trim() });
  }
}

/** Words in a string: runs of letters, digits, apostrophes, and hyphens. */
export function words(text: string): string[] {
  return text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
}

/** Strips Markdown list markers, heading marks, and emphasis from a sentence for word counting. */
export function plain(text: string): string {
  return text
    .replace(/^\s{0,3}(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s*)/, "")
    .replace(/[*_~]+/g, "");
}
