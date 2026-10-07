import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Checker } from "./check.js";
import { fixText } from "./fix.js";
import { measureText } from "./measure.js";
import { loadRules } from "./rules.js";
import type { CheckResult, Rule, RuleSet, Violation } from "./types.js";

export const SERVER_NAME = "circe-mcp";
export const SERVER_VERSION = "0.1.0";

const severity = z.enum(["error", "warning", "suggestion"]);
const confidence = z.enum(["high", "medium", "low"]);

const violationSchema = z.object({
  ruleId: z.string(),
  ruleName: z.string(),
  severity,
  confidence,
  form: z.string().optional(),
  line: z.number(),
  column: z.number(),
  endLine: z.number(),
  endColumn: z.number(),
  offset: z.number(),
  length: z.number(),
  match: z.string(),
  message: z.string(),
  suggestion: z.string(),
  fixable: z.boolean(),
  related: z
    .array(z.object({ ruleId: z.string(), severity, match: z.string(), message: z.string() }))
    .optional(),
});

const checkInput = {
  text: z.string().describe("The text to check. Markdown is understood: code blocks, inline code, URLs, and front matter are skipped."),
  severity: severity.optional().describe("Lowest level to report. 'error' reports errors only; 'warning' adds warnings. Default: everything."),
  rules: z.array(z.string()).optional().describe("Run exactly these rule IDs, such as ['CES-P-001', 'CES-C-008']. Includes optional rules when named."),
  ignore: z.array(z.string()).optional().describe("Rule IDs to skip for this call. Use it for a justified exception, such as a factual contrast under CES-C-008."),
  includeOptional: z.boolean().optional().describe("Also run the optional rules (stylistic triples, resume cliches). Default false."),
  checkCode: z.boolean().optional().describe("Lint fenced code blocks and inline code too (CES-K-003). Default false."),
};

/** Tool descriptions. They are checked against the standard in the test suite. */
export const TOOL_DESCRIPTIONS = {
  check_text:
    "Check text against the Circe Editorial Standard (CES) v0.3. Returns each violation with its rule ID, severity, confidence, line and column, the matched text, a message, and a suggested fix. Overlapping violations are reported once, with the others listed under 'related'.",
  list_rules: "List the CES rules this server enforces, with ID, name, severity, and a one-line description. Optional rules are marked.",
  explain_rule: "Show the full text of one CES rule: the pattern, why it is a tell, the replacement strategy, exceptions, a before/after example, and the tokens the checker uses.",
  fix_text:
    "Apply the safe fixes to a text: em dashes become commas, and reflexive hedges and hollow intensifiers are deleted. Returns the fixed text, the list of edits, and the violations left for the writer.",
  measure_text:
    "Report statistics about a text with no verdict: sentence lengths and rhythm per paragraph, opener echo, specificity density (CES-V-004), paragraph density (CES-S-002), and over-enthusiasm signals (CES-V-005).",
};

export interface ServerOptions {
  ruleSet?: RuleSet;
}

export function createServer(options: ServerOptions = {}): McpServer {
  const ruleSet = options.ruleSet ?? loadRules();
  const checker = new Checker(ruleSet);
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  server.registerTool(
    "check_text",
    {
      title: "Check text against the Circe Editorial Standard",
      description: TOOL_DESCRIPTIONS.check_text,
      inputSchema: checkInput,
      outputSchema: {
        violations: z.array(violationSchema),
        counts: z.object({ error: z.number(), warning: z.number(), suggestion: z.number() }),
        rulesRun: z.array(z.string()),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      const result = checker.check(args.text, args);
      return { content: [{ type: "text", text: formatReport(result) }], structuredContent: { ...result } };
    },
  );

  server.registerTool(
    "list_rules",
    {
      title: "List rules",
      description: TOOL_DESCRIPTIONS.list_rules,
      inputSchema: {
        severity: severity.optional().describe("Only rules at this level."),
      },
      outputSchema: {
        standard: z.string(),
        version: z.string(),
        rules: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            category: z.string(),
            rating: z.string(),
            severity,
            enabledByDefault: z.boolean(),
            summary: z.string(),
            forms: z.array(z.string()),
          }),
        ),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      const rules = ruleSet.rules
        .filter((r) => !args.severity || r.severity === args.severity)
        .map((r) => ({
          id: r.id,
          name: r.name,
          category: r.category,
          rating: r.rating,
          severity: r.severity,
          enabledByDefault: r.enabledByDefault,
          summary: firstSentence(r.description),
          forms: forms(r),
        }));
      const result = { standard: ruleSet.standard, version: ruleSet.version, rules };
      const text = rules
        .map((r) => `${r.id}  ${r.severity.padEnd(10)} ${r.name}${r.enabledByDefault ? "" : "  (optional)"}`)
        .join("\n");
      return { content: [{ type: "text", text: `${ruleSet.standard} v${ruleSet.version}\n\n${text}` }], structuredContent: { ...result } };
    },
  );

  server.registerTool(
    "explain_rule",
    {
      title: "Explain a rule",
      description: TOOL_DESCRIPTIONS.explain_rule,
      inputSchema: { ruleId: z.string().describe("A rule ID such as CES-C-008.") },
      outputSchema: {
        id: z.string(),
        name: z.string(),
        category: z.string(),
        rating: z.string(),
        severity,
        enabledByDefault: z.boolean(),
        description: z.string(),
        suggestion: z.string(),
        exception: z.string().optional(),
        example: z.object({ before: z.string(), after: z.string() }).optional(),
        valeName: z.string().optional(),
        detector: z.string().optional(),
        tokens: z.array(
          z.object({
            pattern: z.string(),
            kind: z.enum(["phrase", "regex"]),
            severity,
            confidence,
            fixable: z.boolean(),
            form: z.string().optional(),
            note: z.string().optional(),
          }),
        ),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ ruleId }) => {
      const rule = checker.rule(ruleId.toUpperCase());
      if (!rule) {
        return { isError: true, content: [{ type: "text", text: `Unknown rule ID: ${ruleId}. Call list_rules for the IDs in use.` }] };
      }
      const result = explain(rule);
      return { content: [{ type: "text", text: formatRule(rule) }], structuredContent: { ...result } };
    },
  );

  server.registerTool(
    "fix_text",
    {
      title: "Apply safe fixes",
      description: TOOL_DESCRIPTIONS.fix_text,
      inputSchema: {
        text: checkInput.text,
        rules: checkInput.rules,
        ignore: checkInput.ignore,
        includeOptional: checkInput.includeOptional,
      },
      outputSchema: {
        text: z.string(),
        applied: z.array(z.object({ ruleId: z.string(), line: z.number(), column: z.number(), before: z.string(), after: z.string() })),
        remaining: z.array(violationSchema),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      const result = fixText(checker, args.text, args);
      const summary = `${result.applied.length} fix(es) applied, ${result.remaining.length} violation(s) left for the writer.\n\n${result.text}`;
      return { content: [{ type: "text", text: summary }], structuredContent: { ...result } };
    },
  );

  server.registerTool(
    "measure_text",
    {
      title: "Measure text",
      description: TOOL_DESCRIPTIONS.measure_text,
      inputSchema: { text: checkInput.text },
      outputSchema: {
        wordCount: z.number(),
        sentenceCount: z.number(),
        paragraphCount: z.number(),
        meanSentenceLength: z.number(),
        exclamations: z.number(),
        stackedSuperlatives: z.number(),
        paragraphs: z.array(
          z.object({
            index: z.number(),
            line: z.number(),
            kind: z.string(),
            sentenceCount: z.number(),
            wordCount: z.number(),
            sentenceLengths: z.array(z.number()),
            meanSentenceLength: z.number(),
            sentenceLengthSpread: z.number(),
            uniformRhythm: z.boolean(),
            openerEcho: z.string().nullable(),
            specificsPer100Words: z.number(),
            lowSpecificity: z.boolean(),
            dense: z.boolean(),
          }),
        ),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ text }) => {
      const result = measureText(text);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: { ...result } };
    },
  );

  return server;
}

/** One line per violation: `line:col  level  RULE  message`. */
export function formatReport(result: CheckResult): string {
  if (result.violations.length === 0) return "No violations.";
  const lines = result.violations.map(formatViolation);
  const c = result.counts;
  lines.push("", `${c.error} error(s), ${c.warning} warning(s), ${c.suggestion} suggestion(s).`);
  return lines.join("\n");
}

export function formatViolation(v: Violation): string {
  const where = `${v.line}:${v.column}`.padEnd(8);
  const related = v.related?.length ? `  (also ${v.related.map((r) => r.ruleId).join(", ")})` : "";
  const conf = v.confidence === "high" ? "" : `  [${v.confidence} confidence]`;
  return `${where} ${v.severity.padEnd(10)} ${v.message}${conf}${related}`;
}

function explain(rule: Rule) {
  return {
    id: rule.id,
    name: rule.name,
    category: rule.category,
    rating: rule.rating,
    severity: rule.severity,
    enabledByDefault: rule.enabledByDefault,
    description: rule.description,
    suggestion: rule.suggestion,
    exception: rule.exception,
    example: rule.example,
    valeName: rule.vale ? rule.vale.name : undefined,
    detector: rule.detector,
    tokens: (rule.tokens ?? []).map((t) => ({
      pattern: t.phrase ?? t.regex!,
      kind: (t.phrase !== undefined ? "phrase" : "regex") as "phrase" | "regex",
      severity: t.severity ?? rule.severity,
      confidence: t.confidence ?? (t.phrase ? "high" : "medium"),
      fixable: t.fixable === true,
      form: t.form,
      note: t.note,
    })),
  };
}

export function formatRule(rule: Rule): string {
  const out = [`${rule.id}: ${rule.name} (${rule.rating})`, "", rule.description, "", `Replacement strategy: ${rule.suggestion}`];
  if (rule.exception) out.push("", `Exception: ${rule.exception}`);
  if (rule.example) out.push("", `Before: ${rule.example.before}`, `After:  ${rule.example.after}`);
  if (rule.tokens?.length) {
    out.push("", "Tokens:");
    for (const t of rule.tokens) {
      const level = t.severity ?? rule.severity;
      out.push(`  ${t.phrase !== undefined ? t.phrase : `/${t.regex}/`}  (${level}${t.form ? `, ${t.form}` : ""}${t.fixable ? ", fixable" : ""})`);
    }
  }
  if (rule.detector) out.push("", `Detector: ${rule.detector}`);
  if (!rule.enabledByDefault) out.push("", "Optional rule: off by default. Pass includeOptional or name it in rules.");
  return out.join("\n");
}

function forms(rule: Rule): string[] {
  const set = new Set<string>();
  for (const t of rule.tokens ?? []) if (t.form) set.add(t.form);
  if (rule.detector === "fragment-flourish") set.add("fragment");
  return [...set];
}

function firstSentence(text: string): string {
  return /^.*?[.!?](?=\s|$)/s.exec(text)?.[0] ?? text;
}
