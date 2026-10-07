import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import type { Rule, RuleSet, RuleToken, Severity } from "./types.js";

const SEVERITIES: Severity[] = ["error", "warning", "suggestion"];

/** Path to the bundled rules file, next to this module in src/ or dist/. */
export function defaultRulesPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "rules", "ces.yaml");
}

/** Load and validate a rules file. Throws on the first structural problem. */
export function loadRules(path: string = defaultRulesPath()): RuleSet {
  const raw = parse(readFileSync(path, "utf8")) as unknown;
  return validateRuleSet(raw, path);
}

export function validateRuleSet(raw: unknown, source = "rules"): RuleSet {
  if (!isRecord(raw)) throw new Error(`${source}: top level must be a mapping`);
  if (typeof raw.standard !== "string") throw new Error(`${source}: missing "standard"`);
  if (typeof raw.version !== "string") throw new Error(`${source}: "version" must be a string`);
  if (!Array.isArray(raw.rules)) throw new Error(`${source}: "rules" must be a list`);

  const seen = new Set<string>();
  const rules = raw.rules.map((r, i) => {
    const rule = validateRule(r, `${source}: rules[${i}]`);
    if (seen.has(rule.id)) throw new Error(`${source}: duplicate rule id ${rule.id}`);
    seen.add(rule.id);
    return rule;
  });
  return { standard: raw.standard, version: raw.version, rules };
}

function validateRule(raw: unknown, where: string): Rule {
  if (!isRecord(raw)) throw new Error(`${where}: must be a mapping`);
  const id = str(raw, "id", where);
  where = `${where} (${id})`;
  if (!/^CES-[A-Z]-\d{3}$/.test(id)) throw new Error(`${where}: id must look like CES-X-000`);

  const severity = str(raw, "severity", where) as Severity;
  if (!SEVERITIES.includes(severity)) throw new Error(`${where}: bad severity "${severity}"`);

  let vale: Rule["vale"];
  if (raw.vale === false) vale = false;
  else if (isRecord(raw.vale) && typeof raw.vale.name === "string") {
    vale = { name: raw.vale.name, nonword: raw.vale.nonword === true };
  } else throw new Error(`${where}: "vale" must be false or {name}`);

  const tokens = raw.tokens === undefined ? undefined : validateTokens(raw.tokens, where);
  const detector = raw.detector === undefined ? undefined : str(raw, "detector", where);
  if (!tokens?.length && !detector) throw new Error(`${where}: needs tokens or a detector`);

  let example: Rule["example"];
  if (raw.example !== undefined) {
    if (!isRecord(raw.example)) throw new Error(`${where}: example must be {before, after}`);
    example = { before: str(raw.example, "before", where), after: str(raw.example, "after", where) };
  }

  return {
    id,
    name: str(raw, "name", where),
    category: str(raw, "category", where),
    rating: str(raw, "rating", where),
    severity,
    enabledByDefault: raw.enabledByDefault !== false,
    vale,
    description: str(raw, "description", where).trim(),
    message: str(raw, "message", where),
    suggestion: str(raw, "suggestion", where).trim(),
    exception: typeof raw.exception === "string" ? raw.exception.trim() : undefined,
    example,
    detector,
    tokens,
  };
}

function validateTokens(raw: unknown, where: string): RuleToken[] {
  if (!Array.isArray(raw)) throw new Error(`${where}: tokens must be a list`);
  return raw.map((t, i) => {
    const w = `${where} tokens[${i}]`;
    if (!isRecord(t)) throw new Error(`${w}: must be a mapping`);
    const hasPhrase = typeof t.phrase === "string";
    const hasRegex = typeof t.regex === "string";
    if (hasPhrase === hasRegex) throw new Error(`${w}: needs exactly one of phrase or regex`);
    if (hasRegex) {
      try {
        new RegExp(t.regex as string, "giu");
      } catch (e) {
        throw new Error(`${w}: invalid regex: ${(e as Error).message}`);
      }
    }
    if (t.severity !== undefined && !SEVERITIES.includes(t.severity as Severity)) {
      throw new Error(`${w}: bad severity`);
    }
    if (t.fixable === true && typeof t.fix !== "string") {
      throw new Error(`${w}: fixable tokens need a fix string`);
    }
    return t as RuleToken;
  });
}

function str(o: Record<string, unknown>, key: string, where: string): string {
  const v = o[key];
  if (typeof v !== "string" || v.length === 0) throw new Error(`${where}: "${key}" must be a non-empty string`);
  return v;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
