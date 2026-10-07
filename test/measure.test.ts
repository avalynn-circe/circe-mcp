import { describe, expect, it } from "vitest";
import { measureText } from "../src/index.js";

describe("measure_text", () => {
  it("counts words, sentences, and paragraphs", () => {
    const m = measureText("One two three. Four five.\n\nSix seven eight nine.");
    expect(m).toMatchObject({ wordCount: 9, sentenceCount: 3, paragraphCount: 2, meanSentenceLength: 3 });
    expect(m.paragraphs[0]).toMatchObject({ line: 1, sentenceLengths: [3, 2] });
    expect(m.paragraphs[1]).toMatchObject({ line: 3, sentenceLengths: [4] });
  });

  it("flags uniform rhythm and opener echo", () => {
    const m = measureText("We ship on time. We test every path. We write the docs.");
    expect(m.paragraphs[0]).toMatchObject({ uniformRhythm: true, openerEcho: "we" });
    const varied = measureText("We ship. We test every path and every branch before merge. Docs follow.");
    expect(varied.paragraphs[0]!.uniformRhythm).toBe(false);
    expect(varied.paragraphs[0]!.openerEcho).toBeNull();
  });

  it("reports specificity density and the CES-V-004 low-specificity signal", () => {
    const vague = measureText(
      "Built impactful solutions across multiple industries with extensive experience in various technologies and a strong technical background that delivers value for stakeholders at every level of the organization through collaboration and leadership while maintaining focus on quality and outcomes, always striving to exceed expectations and drive meaningful results for the business and its customers.",
    );
    expect(vague.paragraphs[0]!.lowSpecificity).toBe(true);
    const specific = measureText(
      "Built systems for healthcare (Walden), payments (Littlepay), and conference management (Xerxes) between 2019 and 2024, shipping 14 releases of the Xerxes portal to 200,000 SKUs across Amazon, eBay, and Shopify for KiOui while reducing the dispatcher workflow from 8 people to 1.",
    );
    expect(specific.paragraphs[0]!.lowSpecificity).toBe(false);
    expect(specific.paragraphs[0]!.specificsPer100Words).toBeGreaterThan(10);
  });

  it("flags dense paragraphs (CES-S-002) and counts CES-V-005 signals", () => {
    const m = measureText("One. Two. Three. Four. Five. Six. Seven. Wow! It is the most powerful, most flexible tool!");
    expect(m.paragraphs[0]!.dense).toBe(true);
    expect(m.exclamations).toBe(2);
    expect(m.stackedSuperlatives).toBe(1);
  });

  it("ignores headings, tables, and code", () => {
    const m = measureText("# A heading with words\n\n| a | b |\n|---|---|\n| c | d |\n\n```\ncode words here\n```\n\nOne real paragraph.");
    expect(m.paragraphCount).toBe(1);
    expect(m.wordCount).toBe(3);
  });
});
