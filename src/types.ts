/** Severity levels, matching Vale's three levels. */
export type Severity = "error" | "warning" | "suggestion";

export const SEVERITY_ORDER: Record<Severity, number> = {
  error: 0,
  warning: 1,
  suggestion: 2,
};

export type Confidence = "high" | "medium" | "low";

export interface RuleToken {
  phrase?: string;
  regex?: string;
  severity?: Severity;
  confidence?: Confidence;
  fixable?: boolean;
  fix?: string;
  form?: string;
  vale?: string | false;
  note?: string;
}

export interface ValeExport {
  name: string;
  nonword?: boolean;
}

export interface RuleExample {
  before: string;
  after: string;
}

export interface Rule {
  id: string;
  name: string;
  category: string;
  rating: string;
  severity: Severity;
  enabledByDefault: boolean;
  vale: ValeExport | false;
  description: string;
  message: string;
  suggestion: string;
  exception?: string;
  example?: RuleExample;
  detector?: string;
  tokens?: RuleToken[];
}

export interface RuleSet {
  standard: string;
  version: string;
  rules: Rule[];
}

/** A rule violation with its position in the original text. */
export interface Violation {
  ruleId: string;
  ruleName: string;
  severity: Severity;
  confidence: Confidence;
  /** Sub-form of the rule, such as "inferior-baseline" for CES-V-007. */
  form?: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  offset: number;
  length: number;
  match: string;
  message: string;
  suggestion: string;
  fixable: boolean;
  /** Violations whose span overlaps this one. Reported here once (D6a). */
  related?: RelatedViolation[];
}

export interface RelatedViolation {
  ruleId: string;
  severity: Severity;
  match: string;
  message: string;
}

export interface CheckOptions {
  /** Minimum severity to report. "warning" reports errors and warnings. */
  severity?: Severity;
  /** Run exactly these rule IDs, including optional ones. */
  rules?: string[];
  /** Skip these rule IDs for this call (D9). */
  ignore?: string[];
  /** Also run rules with enabledByDefault: false. */
  includeOptional?: boolean;
  /** Lint fenced code blocks and inline code too (CES-K-003). Default false. */
  checkCode?: boolean;
}

export interface CheckResult {
  violations: Violation[];
  counts: Record<Severity, number>;
  rulesRun: string[];
}
