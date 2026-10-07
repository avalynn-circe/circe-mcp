import { DETECTORS } from "./detectors.js";
import { isDisabled, position, prepare, type Prepared } from "./markdown.js";
import {
  SEVERITY_ORDER,
  type CheckOptions,
  type CheckResult,
  type Confidence,
  type Rule,
  type RuleSet,
  type RuleToken,
  type Severity,
  type Violation,
} from "./types.js";

interface CompiledToken {
  token: RuleToken;
  regex: RegExp;
  severity: Severity;
  confidence: Confidence;
}

interface CompiledRule {
  rule: Rule;
  keys: string[];
  tokens: CompiledToken[];
}

/** Compiles a rule set once and checks any number of texts against it. */
export class Checker {
  readonly ruleSet: RuleSet;
  private readonly compiled: CompiledRule[];

  constructor(ruleSet: RuleSet) {
    this.ruleSet = ruleSet;
    this.compiled = ruleSet.rules.map((rule) => ({
      rule,
      keys: rule.vale ? [rule.id, rule.vale.name, `${rule.vale.name}Warning`, `${rule.vale.name}Suggestion`] : [rule.id],
      tokens: (rule.tokens ?? []).map((token) => ({
        token,
        regex: compileToken(token),
        severity: token.severity ?? rule.severity,
        confidence: token.confidence ?? (token.phrase ? "high" : "medium"),
      })),
    }));
  }

  rule(id: string): Rule | undefined {
    return this.ruleSet.rules.find((r) => r.id === id);
  }

  /** Rules that run for the given options, in file order. */
  selectRules(options: CheckOptions = {}): Rule[] {
    const ignore = new Set((options.ignore ?? []).map((s) => s.toUpperCase()));
    let rules: Rule[];
    if (options.rules) {
      rules = options.rules.map((id) => {
        const r = this.rule(id.toUpperCase());
        if (!r) throw new Error(`Unknown rule ID: ${id}`);
        return r;
      });
    } else {
      rules = this.ruleSet.rules.filter((r) => r.enabledByDefault || options.includeOptional);
    }
    return rules.filter((r) => !ignore.has(r.id));
  }

  check(text: string, options: CheckOptions = {}): CheckResult {
    const prepared = prepare(text, { checkCode: options.checkCode });
    const rules = this.selectRules(options);
    const selected = new Set(rules.map((r) => r.id));
    const raw: Violation[] = [];

    for (const c of this.compiled) {
      if (!selected.has(c.rule.id)) continue;
      for (const t of c.tokens) {
        t.regex.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = t.regex.exec(prepared.masked))) {
          if (m[0].length === 0) {
            t.regex.lastIndex++;
            continue;
          }
          if (isDisabled(prepared, m.index, c.keys)) continue;
          raw.push(this.violation(prepared, c.rule, m.index, m[0].length, t.severity, t.confidence, t.token));
        }
      }
      if (c.rule.detector) {
        const detector = DETECTORS[c.rule.detector];
        if (!detector) throw new Error(`${c.rule.id}: unknown detector "${c.rule.detector}"`);
        for (const hit of detector(prepared)) {
          if (isDisabled(prepared, hit.offset, c.keys)) continue;
          raw.push(
            this.violation(prepared, c.rule, hit.offset, hit.length, hit.severity ?? c.rule.severity, hit.confidence, {
              form: hit.form,
            }),
          );
        }
      }
    }

    const merged = mergeOverlaps(raw);
    const min = options.severity ? SEVERITY_ORDER[options.severity] : Infinity;
    const violations = merged.filter((v) => SEVERITY_ORDER[v.severity] <= min);
    const counts: Record<Severity, number> = { error: 0, warning: 0, suggestion: 0 };
    for (const v of violations) counts[v.severity]++;
    return { violations, counts, rulesRun: rules.map((r) => r.id) };
  }

  private violation(
    prepared: Prepared,
    rule: Rule,
    offset: number,
    length: number,
    severity: Severity,
    confidence: Confidence,
    token: Partial<RuleToken>,
  ): Violation {
    const match = prepared.original.slice(offset, offset + length);
    const start = position(prepared, offset);
    const end = position(prepared, offset + length);
    const v: Violation = {
      ruleId: rule.id,
      ruleName: rule.name,
      severity,
      confidence,
      line: start.line,
      column: start.column,
      endLine: end.line,
      endColumn: end.column,
      offset,
      length,
      match,
      message: `${rule.id}: ${rule.message.replace("{match}", match.trim())}`,
      suggestion: rule.suggestion,
      fixable: token.fixable === true,
    };
    if (token.form) v.form = token.form;
    return v;
  }
}

/** Builds a case-insensitive, whole-word regex for a token. */
export function compileToken(token: RuleToken): RegExp {
  if (token.regex !== undefined) return new RegExp(token.regex, "gimu");
  const phrase = token.phrase!;
  let source = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/'/g, "['\u2019]").replace(/\s+/g, "\\s+");
  if (/^[\p{L}\p{N}]/u.test(phrase)) source = `\\b${source}`;
  if (/[\p{L}\p{N}]$/u.test(phrase)) source = `${source}\\b`;
  return new RegExp(source, "gimu");
}

const CONFIDENCE_ORDER: Record<Confidence, number> = { high: 0, medium: 1, low: 2 };

/**
 * Collapses violations whose spans overlap into one. The most severe wins, then
 * the most confident, then the earliest; the rest ride along as `related` (D6a).
 */
export function mergeOverlaps(violations: Violation[]): Violation[] {
  const sorted = [...violations].sort((a, b) => a.offset - b.offset || b.length - a.length);
  const clusters: Violation[][] = [];
  let clusterEnd = -1;
  for (const v of sorted) {
    if (clusters.length && v.offset < clusterEnd) {
      clusters[clusters.length - 1]!.push(v);
      clusterEnd = Math.max(clusterEnd, v.offset + v.length);
    } else {
      clusters.push([v]);
      clusterEnd = v.offset + v.length;
    }
  }
  return clusters
    .map((cluster) => {
      if (cluster.length === 1) return cluster[0]!;
      const seen = new Set<string>();
      const unique = cluster.filter((v) => {
        const key = `${v.ruleId}:${v.offset}:${v.length}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      unique.sort(
        (a, b) =>
          SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
          CONFIDENCE_ORDER[a.confidence] - CONFIDENCE_ORDER[b.confidence] ||
          a.offset - b.offset,
      );
      const [primary, ...rest] = unique;
      if (rest.length === 0) return primary!;
      return {
        ...primary!,
        related: rest.map((r) => ({ ruleId: r.ruleId, severity: r.severity, match: r.match, message: r.message })),
      };
    })
    .sort((a, b) => a.offset - b.offset);
}
