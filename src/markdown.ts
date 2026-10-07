/**
 * Prepares Markdown for checking. Regions that must not be linted (code, URLs,
 * comments, HTML tags) are replaced with spaces so that every offset in the
 * masked text equals the same offset in the original. Inline directives in
 * HTML comments become disabled ranges:
 *
 *   <!-- ces ignore CES-C-008 -->  ...  <!-- ces end -->      one or more rule IDs
 *   <!-- ces off -->               ...  <!-- ces on -->       every rule
 */

export interface DisabledRange {
  /** A rule ID ("CES-C-008") or "*" for every rule. */
  key: string;
  start: number;
  end: number;
}

export interface Prepared {
  original: string;
  masked: string;
  lineStarts: number[];
  disabled: DisabledRange[];
}

export interface PrepareOptions {
  /** Keep fenced code blocks and inline code in the checked text. */
  checkCode?: boolean;
}

export function prepare(text: string, options: PrepareOptions = {}): Prepared {
  const disabled: DisabledRange[] = [];
  let masked = text;

  // Each stage finds ranges on the current masked text and blanks them all at
  // once, so a later stage never sees content a previous one removed (inline
  // code inside a fenced block, a URL inside a comment).
  const stage = (find: (current: string) => Array<[number, number]>) => {
    const ranges = find(masked);
    if (ranges.length === 0) return;
    const chars = masked.split("");
    for (const [start, end] of ranges) {
      for (let i = start; i < end; i++) if (chars[i] !== "\n") chars[i] = " ";
    }
    masked = chars.join("");
  };

  // Front matter is checked: a page description is prose.

  // Fenced code blocks.
  if (!options.checkCode) {
    stage((cur) => {
      const ranges: Array<[number, number]> = [];
      const fence = /^ {0,3}(`{3,}|~{3,})[^\n]*$/gm;
      let open: RegExpExecArray | null;
      while ((open = fence.exec(cur))) {
        const marker = open[1]!;
        const closer = new RegExp(`^ {0,3}${marker[0]}{${marker.length},}[ \\t]*$`, "gm");
        closer.lastIndex = open.index + open[0].length;
        const close = closer.exec(cur);
        const end = close ? close.index + close[0].length : cur.length;
        ranges.push([open.index, end]);
        fence.lastIndex = end;
      }
      return ranges;
    });
  }

  // HTML comments, with directives.
  stage((cur) => {
    const ranges: Array<[number, number]> = [];
    const comment = /<!--([\s\S]*?)-->/g;
    const openRanges = new Map<string, number>();
    const closeRange = (key: string, end: number) => {
      const start = openRanges.get(key);
      if (start !== undefined) {
        disabled.push({ key, start, end });
        openRanges.delete(key);
      }
    };
    let c: RegExpExecArray | null;
    while ((c = comment.exec(cur))) {
      const body = c[1]!.trim();
      const after = c.index + c[0].length;
      const d = /^ces\s+(ignore|end|off|on)\b\s*(.*)$/i.exec(body);
      if (d) {
        const verb = d[1]!.toLowerCase();
        const ids = (d[2] ?? "").split(/[\s,]+/).filter(Boolean).map((id) => id.toUpperCase());
        if (verb === "ignore") for (const id of ids) openRanges.set(id, after);
        else if (verb === "end") for (const id of ids.length ? ids : [...openRanges.keys()].filter((k) => k !== "*")) closeRange(id, c.index);
        else if (verb === "off") openRanges.set("*", after);
        else closeRange("*", c.index);
      }
      ranges.push([c.index, after]);
    }
    for (const [key, start] of openRanges) disabled.push({ key, start, end: cur.length });
    return ranges;
  });

  // Inline code.
  if (!options.checkCode) {
    stage((cur) => {
      const ranges: Array<[number, number]> = [];
      const inline = /(`+)(?!`)[\s\S]*?[^`]\1(?!`)/g;
      let m: RegExpExecArray | null;
      while ((m = inline.exec(cur))) {
        if (m[0].includes("\n\n")) continue;
        ranges.push([m.index, m.index + m[0].length]);
      }
      return ranges;
    });
  }

  // Link and image destinations, autolinks, bare URLs, HTML tags.
  stage((cur) => {
    const ranges: Array<[number, number]> = [];
    const dest = /\]\(([^)\s]*(?:\s+"[^"]*")?)\)/g;
    let m: RegExpExecArray | null;
    while ((m = dest.exec(cur))) ranges.push([m.index + 2, m.index + 2 + m[1]!.length]);
    for (const re of [/<https?:\/\/[^>\s]+>/g, /https?:\/\/[^\s)>\]]+/g, /<\/?[a-zA-Z][^>\n]*>/g]) {
      while ((m = re.exec(cur))) ranges.push([m.index, m.index + m[0].length]);
    }
    return ranges;
  });

  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") lineStarts.push(i + 1);

  disabled.sort((a, b) => a.start - b.start);
  return { original: text, masked, lineStarts, disabled };
}

/** 1-based line and column for a UTF-16 offset. */
export function position(prepared: Prepared, offset: number): { line: number; column: number } {
  const { lineStarts } = prepared;
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid]! <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, column: offset - lineStarts[lo]! + 1 };
}

/** True when any disabled range for one of the keys covers the offset. */
export function isDisabled(prepared: Prepared, offset: number, keys: string[]): boolean {
  for (const r of prepared.disabled) {
    if (offset >= r.start && offset < r.end && (r.key === "*" || keys.includes(r.key))) return true;
  }
  return false;
}
