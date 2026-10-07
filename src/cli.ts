#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Checker } from "./check.js";
import { fixText } from "./fix.js";
import { measureText } from "./measure.js";
import { loadRules } from "./rules.js";
import { createServer, formatReport, SERVER_VERSION } from "./server.js";
import { SEVERITY_ORDER, type Severity } from "./types.js";

const HELP = `circe-mcp ${SERVER_VERSION}

Usage:
  circe-mcp                         Run the MCP server on stdio (for Claude Desktop, Claude Code, Cursor).
  circe-mcp http [--port 3000]      Run the MCP server over Streamable HTTP at /mcp.
  circe-mcp check <file...>         Check files. Exits 1 when any violation reaches --fail-on (default: error).
      [--fail-on error|warning|suggestion] [--include-optional] [--json]
  circe-mcp fix <file> [--write]    Print the text with safe fixes applied, or write it back.
  circe-mcp measure <file>          Print statistics for a file as JSON.
  circe-mcp --help | --version
`;

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  const flags = new Set(rest.filter((a) => a.startsWith("--")));
  const positional = rest.filter((a) => !a.startsWith("--") && !isFlagValue(rest, a));

  if (command === "--help" || command === "-h") {
    process.stdout.write(HELP);
    return 0;
  }
  if (command === "--version" || command === "-v") {
    process.stdout.write(`${SERVER_VERSION}\n`);
    return 0;
  }

  if (command === undefined || command === "stdio") {
    const server = createServer();
    await server.connect(new StdioServerTransport());
    return -1; // keep running
  }

  if (command === "http") {
    const { startHttp } = await import("./http.js");
    const port = Number(flagValue(rest, "--port") ?? process.env.PORT ?? 3000);
    const host = flagValue(rest, "--host") ?? "127.0.0.1";
    await startHttp({ port, host });
    return -1;
  }

  const checker = new Checker(loadRules());

  if (command === "check") {
    if (positional.length === 0) return usage("check needs at least one file");
    const failOn = (flagValue(rest, "--fail-on") ?? "error") as Severity;
    if (!(failOn in SEVERITY_ORDER)) return usage(`bad --fail-on value: ${failOn}`);
    let failed = false;
    const all: Record<string, unknown> = {};
    for (const file of positional) {
      const result = checker.check(readFileSync(file, "utf8"), { includeOptional: flags.has("--include-optional") });
      all[file] = result;
      if (result.violations.some((v) => SEVERITY_ORDER[v.severity] <= SEVERITY_ORDER[failOn])) failed = true;
      if (!flags.has("--json")) process.stdout.write(`${file}\n${indent(formatReport(result))}\n\n`);
    }
    if (flags.has("--json")) process.stdout.write(JSON.stringify(all, null, 2) + "\n");
    return failed ? 1 : 0;
  }

  if (command === "fix") {
    const file = positional[0];
    if (!file) return usage("fix needs a file");
    const result = fixText(checker, readFileSync(file, "utf8"));
    if (flags.has("--write")) {
      writeFileSync(file, result.text, "utf8");
      process.stderr.write(`${result.applied.length} fix(es) written to ${file}; ${result.remaining.length} violation(s) remain.\n`);
    } else process.stdout.write(result.text);
    return 0;
  }

  if (command === "measure") {
    const file = positional[0];
    if (!file) return usage("measure needs a file");
    process.stdout.write(JSON.stringify(measureText(readFileSync(file, "utf8")), null, 2) + "\n");
    return 0;
  }

  return usage(`unknown command: ${command}`);
}

function usage(message: string): number {
  process.stderr.write(`circe-mcp: ${message}\n\n${HELP}`);
  return 2;
}

function flagValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

function isFlagValue(args: string[], a: string): boolean {
  const i = args.indexOf(a);
  return i > 0 && ["--port", "--host", "--fail-on"].includes(args[i - 1]!);
}

function indent(s: string): string {
  return s
    .split("\n")
    .map((l) => `  ${l}`)
    .join("\n");
}

main(process.argv.slice(2)).then(
  (code) => {
    if (code >= 0) process.exit(code);
  },
  (err: unknown) => {
    process.stderr.write(`circe-mcp: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  },
);
