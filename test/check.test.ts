import { describe, expect, it } from "vitest";
import { Checker, loadRules, prepare } from "../src/index.js";

const checker = new Checker(loadRules());

describe("positions", () => {
  it("reports 1-based line and column across multi-line Markdown", () => {
    const text = "# Title\n\nFirst paragraph is clean.\n\nSecond one is actually hedged.\n";
    const [v] = checker.check(text).violations;
    expect(v).toMatchObject({ ruleId: "CES-Q-001", line: 5, column: 15, endLine: 5, endColumn: 23, match: "actually" });
    expect(text.slice(v!.offset, v!.offset + v!.length)).toBe("actually");
  });

  it("points at the exact slice for every violation in a mixed document", () => {
    const text = [
      "---",
      "title: Page",
      "description: a description that goes beyond the brief",
      "---",
      "",
      "Em dashes — like this one — are errors.",
      "",
      "- A list item that is truly a list item.",
      "- Another, [linked](https://example.com/rather-than) and `instead of` coded.",
      "",
      "> A quote. It's not X, it's Y.",
    ].join("\n");
    const { violations } = checker.check(text);
    expect(violations.length).toBeGreaterThan(3);
    const lines = text.split("\n");
    for (const v of violations) {
      const fromLine = lines[v.line - 1]!.slice(v.column - 1, v.column - 1 + v.length);
      expect(fromLine).toBe(v.match);
    }
  });
});

describe("Markdown handling", () => {
  it("skips fenced code blocks, inline code, link destinations, and HTML comments", () => {
    const text = [
      "Prose.",
      "",
      "```js",
      "// rather than — genuinely",
      "```",
      "",
      "~~~",
      "instead of",
      "~~~",
      "",
      "Inline `rather than` and [text](https://x.example/not-just \"really\") and <!-- actually --> here.",
    ].join("\n");
    expect(checker.check(text).violations).toEqual([]);
  });

  it("lints code when checkCode is set", () => {
    const text = "```js\n// rather than\n```\n";
    expect(checker.check(text, { checkCode: true }).violations.map((v) => v.ruleId)).toEqual(["CES-C-008"]);
  });

  it("checks front matter, because a page description is prose", () => {
    const text = "---\ndescription: this is rather than that\n---\n\nBody.\n";
    expect(checker.check(text).violations.map((v) => v.ruleId)).toEqual(["CES-C-008"]);
  });

  it("keeps offsets stable under masking", () => {
    const text = "a `b` c <!-- d --> e";
    const p = prepare(text);
    expect(p.masked.length).toBe(text.length);
    expect(p.masked).toBe("a     c            e");
  });
});

describe("exceptions", () => {
  const sentence = "Moved the reports from MS Access to SQL Server rather than rewriting them.";

  it("honors an ignore block for one rule", () => {
    const text = `<!-- ces ignore CES-C-008 -->\n${sentence}\n<!-- ces end -->\n\nStill flagged rather than ignored.`;
    const ids = checker.check(text).violations.map((v) => `${v.ruleId}@${v.line}`);
    expect(ids).toEqual(["CES-C-008@5"]);
  });

  it("accepts several rule IDs, any case, and runs to the end of the text without an end marker", () => {
    expect(checker.check(`<!-- ces ignore ces-c-008, CES-Q-001 -->\n${sentence} It is actually fine.`).violations).toEqual([]);
  });

  it("closes only the named rule when end names one", () => {
    const text = `<!-- ces ignore CES-C-008 CES-Q-001 -->\n<!-- ces end CES-Q-001 -->\n${sentence} It is actually fine.`;
    expect(checker.check(text).violations.map((v) => v.ruleId)).toEqual(["CES-Q-001"]);
  });

  it("honors ces off / ces on", () => {
    const text = `<!-- ces off -->\n${sentence} It is actually fine.\n<!-- ces on -->\nBut this is actually flagged.`;
    expect(checker.check(text).violations.map((v) => v.line)).toEqual([4]);
  });

  it("ignores comments that are not directives", () => {
    expect(checker.check(`<!-- TODO: rewrite -->\n${sentence}`).violations.map((v) => v.ruleId)).toEqual(["CES-C-008"]);
  });

  it("honors the ignore parameter", () => {
    const { violations } = checker.check(sentence, { ignore: ["CES-C-008"] });
    expect(violations).toEqual([]);
  });

  it("does not let a directive for one rule silence another", () => {
    const text = `<!-- ces ignore CES-C-008 -->\n${sentence} It is actually fine.`;
    expect(checker.check(text).violations.map((v) => v.ruleId)).toEqual(["CES-Q-001"]);
  });
});

describe("rule selection", () => {
  it("runs only default rules unless includeOptional is set", () => {
    const text = "Fast, scalable, and reliable.";
    expect(checker.check(text).violations).toEqual([]);
    expect(checker.check(text, { includeOptional: true }).violations.map((v) => v.ruleId)).toEqual(["CES-C-002"]);
  });

  it("runs exactly the named rules, including optional ones", () => {
    const text = "Fast, scalable, and reliable, and actually impactful.";
    const r = checker.check(text, { rules: ["CES-V-001"] });
    expect(r.rulesRun).toEqual(["CES-V-001"]);
    expect(r.violations.map((v) => v.ruleId)).toEqual(["CES-V-001"]);
  });

  it("rejects unknown rule IDs in rules and tolerates them in ignore", () => {
    expect(() => checker.check("x", { rules: ["CES-Z-999"] })).toThrow(/Unknown rule ID/);
    expect(() => checker.check("x", { ignore: ["CES-Z-999"] })).not.toThrow();
  });

  it("filters by minimum severity", () => {
    const text = "It is actually faster — and that is that.";
    expect(checker.check(text, { severity: "error" }).violations.map((v) => v.ruleId)).toEqual(["CES-P-001"]);
    expect(checker.check(text, { severity: "warning" }).violations).toHaveLength(2);
  });
});

describe("overlapping violations", () => {
  it("reports the most severe once and lists the others as related", () => {
    const { violations } = checker.check("It's not just code, it's craft.");
    expect(violations).toHaveLength(1);
    const [v] = violations;
    expect(v!.ruleId).toBe("CES-C-008");
    expect(v!.related?.map((r) => r.ruleId).sort()).toEqual(["CES-C-001", "CES-Q-001"]);
  });

  it("keeps the error visible under a severity filter even when a warning starts earlier", () => {
    const { violations } = checker.check("It's not just code, it's craft.", { severity: "error" });
    expect(violations.map((v) => v.ruleId)).toEqual(["CES-C-008"]);
  });

  it("prefers the more confident hit among equals", () => {
    const text = "I built operational reporting in SSRS for three years. That's no accident.";
    const [v] = checker.check(text).violations;
    expect(v!.ruleId).toBe("CES-C-005");
    expect(v!.related?.map((r) => r.ruleId)).toEqual(["CES-V-007"]);
  });

  it("does not merge violations that merely sit in the same sentence", () => {
    const { violations } = checker.check("It is actually built on real projects.");
    expect(violations.map((v) => v.ruleId)).toEqual(["CES-Q-001", "CES-V-007"]);
  });
});

describe("messages", () => {
  it("prefixes the rule ID and fills in the match", () => {
    const [v] = checker.check("Use it rather than that.").violations;
    expect(v!.message).toBe("CES-C-008: Trailing contrast clause 'rather than'. End the sentence at the positive point.");
    expect(v!.suggestion).toBe("End the sentence at the positive point.");
  });

  it("carries the form for sub-forms of a rule", () => {
    const [v] = checker.check("It works in practice.").violations;
    expect(v).toMatchObject({ ruleId: "CES-V-007", form: "inferior-baseline", severity: "error" });
  });
});
