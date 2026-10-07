import { describe, expect, it } from "vitest";
import { Checker, fixText, loadRules } from "../src/index.js";

const checker = new Checker(loadRules());
const fix = (text: string) => fixText(checker, text);

describe("fix_text", () => {
  it("turns em dashes into commas and absorbs the spaces around them", () => {
    expect(fix("The release shipped on time — a rare occurrence.").text).toBe("The release shipped on time, a rare occurrence.");
    expect(fix("Three pillars—speed and scale—define it.").text).toBe("Three pillars, speed and scale, define it.");
  });

  it("deletes hedges and intensifiers with one adjacent space", () => {
    expect(fix("It is actually faster.").text).toBe("It is faster.");
    expect(fix("I am genuinely excited.").text).toBe("I am excited.");
    expect(fix("It is faster, really.").text).toBe("It is faster.");
  });

  it("re-capitalizes the next word when the deleted word opened the sentence", () => {
    expect(fix("Just do it. Really, do it.").text).toBe("Do it. Do it.");
    expect(fix("Line one.\nActually, line two.").text).toBe("Line one.\nLine two.");
  });

  it("leaves a fixable word alone when it is part of a larger construction", () => {
    const r = fix("What the metric really means is churn.");
    expect(r.text).toBe("What the metric really means is churn.");
    expect(r.applied).toEqual([]);
    expect(r.remaining.map((v) => v.ruleId)).toEqual(["CES-C-001"]);
  });

  it("reports what it applied and what remains", () => {
    const r = fix("It is actually built rather than bought.");
    expect(r.applied).toMatchObject([{ ruleId: "CES-Q-001", line: 1, column: 7, before: "actually ", after: "" }]);
    expect(r.remaining.map((v) => v.ruleId)).toEqual(["CES-C-008"]);
  });

  it("is idempotent", () => {
    const once = fix("Just say it — truly.").text;
    expect(fix(once).text).toBe(once);
  });

  it("respects ignore and Vale directives", () => {
    const text = "<!-- vale Circe.Hedges = NO -->\nIt is actually fine.";
    expect(fix(text).text).toBe(text);
    expect(fixText(checker, "It is actually fine.", { ignore: ["CES-Q-001"] }).text).toBe("It is actually fine.");
  });

  it("never edits inside code", () => {
    const text = "Run `just build` and read:\n\n```sh\njust — really\n```\n";
    expect(fix(text).text).toBe(text);
  });
});
