import { describe, expect, it } from "vitest";
import { Checker, loadRules, words } from "../src/index.js";
import { FIXTURES } from "./fixtures/rules.js";

describe("performance", () => {
  it("checks 10,000 words in under 200 ms", () => {
    const checker = new Checker(loadRules());
    const sample = Object.values(FIXTURES)
      .flatMap((f) => [...f.bad, ...f.good])
      .join(" ");
    let text = "";
    while (words(text).length < 10_000) text += `${sample}\n\n`;
    checker.check(text, { includeOptional: true }); // warm up
    const times: number[] = [];
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      checker.check(text, { includeOptional: true });
      times.push(performance.now() - t0);
    }
    expect(Math.min(...times)).toBeLessThan(200);
  });
});
