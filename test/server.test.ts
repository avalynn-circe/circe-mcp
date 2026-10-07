import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeAll, describe, expect, it } from "vitest";
import { Checker, createServer, loadRules, TOOL_DESCRIPTIONS } from "../src/index.js";

let client: Client;

beforeAll(async () => {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
});

describe("MCP tools", () => {
  it("lists five tools", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["check_text", "explain_rule", "fix_text", "list_rules", "measure_text"]);
    for (const t of tools) expect(t.outputSchema, t.name).toBeDefined();
  });

  it("check_text returns violations as structured content and a readable report", async () => {
    const r = await client.callTool({ name: "check_text", arguments: { text: "Use it rather than that.", severity: "error" } });
    const sc = r.structuredContent as { violations: Array<{ ruleId: string; line: number; column: number }>; counts: { error: number } };
    expect(sc.violations).toMatchObject([{ ruleId: "CES-C-008", line: 1, column: 8 }]);
    expect(sc.counts.error).toBe(1);
    const text = (r.content as Array<{ type: string; text: string }>)[0]!.text;
    expect(text).toContain("1:8");
    expect(text).toContain("CES-C-008");
  });

  it("check_text rejects an unknown rule ID as a tool error", async () => {
    const r = await client.callTool({ name: "check_text", arguments: { text: "x", rules: ["CES-Z-999"] } });
    expect(r.isError).toBe(true);
  });

  it("list_rules returns every rule with a one-line summary", async () => {
    const r = await client.callTool({ name: "list_rules", arguments: {} });
    const sc = r.structuredContent as { version: string; rules: Array<{ id: string; summary: string; enabledByDefault: boolean }> };
    expect(sc.version).toBe("0.3");
    expect(sc.rules.map((x) => x.id)).toContain("CES-V-007");
    expect(sc.rules.find((x) => x.id === "CES-C-002")!.enabledByDefault).toBe(false);
    for (const rule of sc.rules) expect(rule.summary.split(/(?<=[.!?])\s/)).toHaveLength(1);
  });

  it("explain_rule returns the full rule and errors on an unknown ID", async () => {
    const ok = await client.callTool({ name: "explain_rule", arguments: { ruleId: "ces-c-008" } });
    const sc = ok.structuredContent as { id: string; example: { before: string }; tokens: Array<{ pattern: string }> };
    expect(sc.id).toBe("CES-C-008");
    expect(sc.example.before).toContain("instead of");
    expect(sc.tokens.map((t) => t.pattern)).toContain("rather than");
    const bad = await client.callTool({ name: "explain_rule", arguments: { ruleId: "CES-Z-999" } });
    expect(bad.isError).toBe(true);
  });

  it("fix_text returns the fixed text, the edits, and what remains", async () => {
    const r = await client.callTool({ name: "fix_text", arguments: { text: "It is actually built rather than bought." } });
    const sc = r.structuredContent as { text: string; applied: unknown[]; remaining: Array<{ ruleId: string }> };
    expect(sc.text).toBe("It is built rather than bought.");
    expect(sc.applied).toHaveLength(1);
    expect(sc.remaining.map((v) => v.ruleId)).toEqual(["CES-C-008"]);
  });

  it("measure_text returns statistics", async () => {
    const r = await client.callTool({ name: "measure_text", arguments: { text: "One two three. Four five six." } });
    expect(r.structuredContent).toMatchObject({ wordCount: 6, sentenceCount: 2 });
  });
});

describe("the server's own prose", () => {
  const checker = new Checker(loadRules());

  it("tool descriptions pass check_text with zero violations", () => {
    for (const [name, description] of Object.entries(TOOL_DESCRIPTIONS)) {
      expect(checker.check(description).violations, name).toEqual([]);
    }
  });

  it("rule messages and suggestions pass at error level", () => {
    for (const rule of checker.ruleSet.rules) {
      const text = `${rule.message.replace("{match}", "x")} ${rule.suggestion}`;
      expect(checker.check(text, { severity: "error" }).violations, rule.id).toEqual([]);
    }
  });
});
