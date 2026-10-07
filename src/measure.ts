/**
 * measure_text: statistics with no verdict. Each signal names the rule whose
 * threshold it reports (CES-S-002, CES-V-004, CES-V-005, and the D6a rhythm
 * check). The writer decides what the numbers mean.
 */
import { prepare } from "./markdown.js";
import { paragraphs, plain, sentences, words } from "./text.js";

export interface ParagraphStats {
  index: number;
  line: number;
  kind: string;
  sentenceCount: number;
  wordCount: number;
  sentenceLengths: number[];
  meanSentenceLength: number;
  sentenceLengthSpread: number;
  /** Three or more sentences whose lengths all fall within three words of the mean. */
  uniformRhythm: boolean;
  /** Three or more consecutive sentences opening with the same word. */
  openerEcho: string | null;
  /** Numbers, proper nouns, and other specifics per 100 words (CES-V-004 heuristic). */
  specificsPer100Words: number;
  /** Fewer than two specifics per 100 words in a paragraph of 50 words or more. */
  lowSpecificity: boolean;
  /** More than six sentences (CES-S-002). */
  dense: boolean;
}

export interface Measurement {
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  meanSentenceLength: number;
  /** Exclamation marks in prose (CES-V-005 signal). */
  exclamations: number;
  /** Sentences with two or more superlatives (CES-V-005 signal). */
  stackedSuperlatives: number;
  paragraphs: ParagraphStats[];
}

export function measureText(text: string): Measurement {
  const prepared = prepare(text);
  const stats: ParagraphStats[] = [];
  let totalWords = 0;
  let totalSentences = 0;
  let exclamations = 0;
  let stackedSuperlatives = 0;

  const ps = paragraphs(prepared.masked).filter((p) => p.kind === "text" || p.kind === "quote" || p.kind === "list");
  ps.forEach((p, index) => {
    const ss = sentences(p);
    const lengths = ss.map((s) => words(plain(s.text)).length).filter((n) => n > 0);
    const wc = lengths.reduce((a, b) => a + b, 0);
    const mean = lengths.length ? wc / lengths.length : 0;
    const spread = lengths.length ? Math.sqrt(lengths.reduce((a, n) => a + (n - mean) ** 2, 0) / lengths.length) : 0;

    let echo: string | null = null;
    let run = 1;
    for (let i = 1; i < ss.length; i++) {
      const a = words(plain(ss[i - 1]!.text))[0]?.toLowerCase();
      const b = words(plain(ss[i]!.text))[0]?.toLowerCase();
      run = a && a === b ? run + 1 : 1;
      if (run >= 3 && b) echo = b;
    }

    const specifics = countSpecifics(ss.map((s) => plain(s.text)));
    const per100 = wc ? (specifics / wc) * 100 : 0;

    for (const s of ss) {
      exclamations += (s.text.match(/!/g) ?? []).length;
      const sup = s.text.match(/\b(?:most \w+|\w+est)\b/gi) ?? [];
      if (sup.length >= 2) stackedSuperlatives++;
    }

    totalWords += wc;
    totalSentences += lengths.length;
    stats.push({
      index,
      line: lineOf(prepared.lineStarts, p.start),
      kind: p.kind,
      sentenceCount: lengths.length,
      wordCount: wc,
      sentenceLengths: lengths,
      meanSentenceLength: round(mean),
      sentenceLengthSpread: round(spread),
      uniformRhythm: lengths.length >= 3 && lengths.every((n) => Math.abs(n - mean) <= 3),
      openerEcho: echo,
      specificsPer100Words: round(per100),
      lowSpecificity: wc >= 50 && per100 < 2,
      dense: lengths.length > 6,
    });
  });

  return {
    wordCount: totalWords,
    sentenceCount: totalSentences,
    paragraphCount: stats.length,
    meanSentenceLength: round(totalSentences ? totalWords / totalSentences : 0),
    exclamations,
    stackedSuperlatives,
    paragraphs: stats,
  };
}

/** Numbers plus capitalized words that do not open a sentence. */
function countSpecifics(sentenceTexts: string[]): number {
  let n = 0;
  for (const s of sentenceTexts) {
    n += (s.match(/\d[\d,.%]*/g) ?? []).length;
    const ws = words(s);
    for (let i = 1; i < ws.length; i++) if (/^\p{Lu}/u.test(ws[i]!) && !/^I$/.test(ws[i]!)) n++;
  }
  return n;
}

function lineOf(lineStarts: number[], offset: number): number {
  let line = 1;
  for (let i = 1; i < lineStarts.length && lineStarts[i]! <= offset; i++) line = i + 1;
  return line;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
