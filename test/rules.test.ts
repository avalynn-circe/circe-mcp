import { describe, expect, it } from "vitest";
import { Checker, loadRules, validateRuleSet } from "../src/index.js";
import { FIXTURES } from "./fixtures/rules.js";

const ruleSet = loadRules();
const checker = new Checker(ruleSet);

describe("rules file", () => {
  it("loads and names the standard", () => {
    expect(ruleSet.standard).toContain("Circe Editorial Standard");
    expect(ruleSet.version).toBe("0.3");
    expect(ruleSet.rules.length).toBeGreaterThanOrEqual(13);
  });

  it("gives every rule an example and a Vale name or an explicit opt-out", () => {
    for (const rule of ruleSet.rules) {
      expect(rule.example, rule.id).toBeDefined();
      expect(rule.vale === false || typeof rule.vale.name === "string", rule.id).toBe(true);
    }
  });

  it("has a fixture for every rule and a rule for every fixture", () => {
    const ids = ruleSet.rules.map((r) => r.id).sort();
    expect(Object.keys(FIXTURES).sort()).toEqual(ids);
  });

  it("rejects a rule without tokens or a detector", () => {
    expect(() =>
      validateRuleSet({
        standard: "x",
        version: "1",
        rules: [{ id: "CES-X-001", name: "n", category: "c", rating: "r", severity: "error", vale: false, description: "d", message: "m", suggestion: "s" }],
      }),
    ).toThrow(/tokens or a detector/);
  });

  it("rejects duplicate IDs, bad severities, and fixable tokens without a fix", () => {
    const base = { name: "n", category: "c", rating: "r", vale: false, description: "d", message: "m", suggestion: "s" };
    expect(() =>
      validateRuleSet({ standard: "x", version: "1", rules: [{ ...base, id: "CES-X-001", severity: "error", tokens: [{ phrase: "a" }] }, { ...base, id: "CES-X-001", severity: "error", tokens: [{ phrase: "b" }] }] }),
    ).toThrow(/duplicate/);
    expect(() => validateRuleSet({ standard: "x", version: "1", rules: [{ ...base, id: "CES-X-001", severity: "fatal", tokens: [{ phrase: "a" }] }] })).toThrow(/severity/);
    expect(() => validateRuleSet({ standard: "x", version: "1", rules: [{ ...base, id: "CES-X-001", severity: "error", tokens: [{ phrase: "a", fixable: true }] }] })).toThrow(/fix string/);
  });
});

describe.each(Object.entries(FIXTURES))("%s fixtures", (ruleId, fixture) => {
  const hits = (text: string) => {
    const { violations } = checker.check(text, { rules: [ruleId] });
    return violations.filter((v) => v.ruleId === ruleId || v.related?.some((r) => r.ruleId === ruleId));
  };

  it.each(fixture.bad)("flags: %s", (text) => {
    expect(hits(text).length).toBeGreaterThan(0);
  });

  it.each(fixture.good)("passes: %s", (text) => {
    expect(hits(text)).toEqual([]);
  });

  it("flags its own before example and passes its after example", () => {
    const rule = checker.rule(ruleId)!;
    const before = checker.check(rule.example!.before, { rules: [ruleId] }).violations;
    const after = checker.check(rule.example!.after, { rules: [ruleId] }).violations;
    expect(before.length, `before: ${rule.example!.before}`).toBeGreaterThan(0);
    expect(after, `after: ${rule.example!.after}`).toEqual([]);
  });
});
