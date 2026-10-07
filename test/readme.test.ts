import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Checker, loadRules } from "../src/index.js";

const checker = new Checker(loadRules());
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

describe("README", () => {
  it("passes check_text with zero errors and zero warnings", () => {
    const { violations } = checker.check(readme, { includeOptional: true });
    expect(violations.map((v) => `${v.line}:${v.column} ${v.message}`)).toEqual([]);
  });

  it("names every rule the server enforces", () => {
    for (const rule of checker.ruleSet.rules) expect(readme, rule.id).toContain(rule.id);
  });

  it("documents every tool", () => {
    for (const tool of ["check_text", "list_rules", "explain_rule", "fix_text", "measure_text"]) expect(readme).toContain(`\`${tool}\``);
  });
});
