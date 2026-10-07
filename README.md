# circe-mcp

An MCP server that checks text against the [Circe Editorial Standard](https://github.com/avalynn-circe/circe-docs) (CES) v0.3 and returns each violation with its rule ID, line and column, severity, confidence, and a suggested fix. Every check is deterministic pattern matching. The server makes no LLM calls, so a check costs nothing to run and gives the same answer every time.

The standard catches the writing patterns that read as machine-generated: em dashes, hedges, hollow intensifiers, trailing contrast clauses, negate-then-elevate constructions, throat-clearing openers, and the rest. This server is the standard's automated reviewer. The same rules file also generates the Vale styles that lint the circe-docs site in CI.

## Install

The server runs with `npx`, so there is nothing to install.

**Claude Code**

```sh
claude mcp add circe-mcp -- npx -y circe-mcp
```

**Claude Desktop**

Add the server to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "circe-mcp": {
      "command": "npx",
      "args": ["-y", "circe-mcp"]
    }
  }
}
```

**Cursor, Windsurf, and other stdio clients** use the same command and arguments. For a hosted deployment, `npx circe-mcp http --port 3000` serves the same tools over Streamable HTTP at `/mcp`.

Node.js 20 or later is required.

## Tools

| Tool | Input | Output |
|---|---|---|
| `check_text` | `text`, optional `severity`, `rules`, `ignore`, `includeOptional`, `checkCode` | Violations with `ruleId`, `severity`, `confidence`, `line`, `column`, `match`, `message`, `suggestion`, and `related` overlaps. |
| `list_rules` | optional `severity` | Every rule with its ID, name, level, and a one-line summary. Optional rules are marked. |
| `explain_rule` | `ruleId` | The full rule: pattern, reasoning, replacement strategy, exceptions, a before/after example, and the tokens the checker uses. |
| `fix_text` | `text`, optional `rules`, `ignore`, `includeOptional` | The text with safe fixes applied, the list of edits, and the violations left for the writer. |
| `measure_text` | `text` | Statistics with no verdict: sentence lengths per paragraph, rhythm, opener echo, specificity density, paragraph density, and over-enthusiasm signals. |

Each tool returns a readable report as text and the full result as structured content, so a client can show one and a model can parse the other.

### An example

Input to `check_text`:

```text
It's not just code, it's craft. We built it in practice.
```

Output:

```text
1:6      error      CES-C-008: Trailing contrast clause 'not just'. End the sentence at the positive point.  (also CES-Q-001, CES-C-001)
1:45     error      CES-V-007: Flourish 'in practice'. Delete it or make the claim as a plain statement.

2 error(s), 0 warning(s), 0 suggestion(s).
```

When violations overlap, the most severe one is reported and the others are listed under `related`. The first sentence trips three rules in one span; the report shows it once.

## Rules

Severity follows the standard's tiers. MUST AVOID rules report as `error`, SHOULD AVOID rules as `warning`. Each violation also carries a confidence level, because a token match is sometimes a guess.

| Rule | Level | Default | Catches |
|---|---|---|---|
| CES-P-001 No em dashes | error | on | The em dash character (U+2014). |
| CES-Q-001 No reflexive hedges | warning | on | `just`, `actually`, `really`. |
| CES-Q-002 No hollow intensifiers | warning | on | `genuinely`, `truly`, `deeply`. |
| CES-C-001 No negate-then-elevate | warning | on | `It's not X, it's Y.`, `We don't do X. We do Y.`, `No X. No Y. Just Z.`, `What X really means is`, and related forms. |
| CES-C-002 No stylistic triple lists | warning | off | Three single words joined `A, B, and C`. Proper nouns and longer lists are skipped. |
| CES-C-003 No throat-clearing runways | warning | on | `It's worth noting that`, `The key thing is`, `Here's how I'd approach it`, and similar openers. |
| CES-C-004 No trailing bows | warning | on | `, and that's what matters`, `, which is the whole point`, and similar closers after a comma. |
| CES-C-005 No so-what gloss | warning | on | `That's no accident.`, `Which tells you everything you need to know.`, `is the same muscle as`. |
| CES-C-008 No trailing contrast clauses | error | on | `rather than`, `instead of`, `not only`, `not just`. The phrases `go beyond`, `far beyond`, and `well beyond` report as warnings. |
| CES-V-001 No resume cliches | warning | off | The standard's phrase list: `proven track record`, `hit the ground running`, `thought leader`, and 28 more. |
| CES-V-006 No chatty asides | warning | on | `Let's dive in`, `Spoiler alert`, `Pro tip:`, `Buckle up`, and similar interjections. |
| CES-V-007 No punchy-for-punchiness'-sake flourishes | error | on | Implied inferior baselines: `in practice` (error), `not abstract` and `real` (warning). Fragments of three words or fewer after a full sentence (warning, low confidence). |
| CES-V-008 No gratuitous trailing clauses | warning | on | Trailing minimizers: `alone` at the end of a clause, `merely`, `mere`. |

Two rules are off by default because they guess more than the others. Pass `includeOptional: true` to run them, or name them in `rules`.

The sub-forms of a rule come back in the `form` field. An inferior baseline reports as `CES-V-007` with `form: inferior-baseline`, which is where the standard files it.

### What it misses

Pattern matching catches stock phrasing. It cannot judge whether a short declarative is a pronouncement or the one line that states a paragraph's point (CES-C-007), whether a contrast carries facts the reader needs, or whether a paragraph is vague perfection (CES-V-004). The flourish and sass detectors catch the signature phrases and will miss cases that need a reader. `measure_text` reports the numbers behind the judgment calls and leaves the call to the writer.

Rules that need a human stay out of `check_text`: the deletion test for CES-C-003 through CES-C-007 beyond their stock forms, manufactured intimacy (CES-V-002), scene-painting (CES-V-003), and the sections of the standard that cover factual accuracy, document structure, and typography.

## Exceptions

A contrast that carries facts the reader needs is allowed under CES-C-008, such as a migration from one database to another. Mark a justified exception the way circe-docs does, with a Vale inline comment:

```markdown
<!-- vale Circe.TrailingContrast = NO -->
The team moved the reports from MS Access to SQL Server rather than rewriting them.
<!-- vale Circe.TrailingContrast = YES -->
```

The server honors the style name, the rule ID (`<!-- vale CES-C-008 = NO -->`), and `<!-- vale off -->` / `<!-- vale on -->`. For a single call, pass the rule IDs to skip in the `ignore` parameter.

## Markdown

Fenced code blocks, inline code, link destinations, HTML tags, and comments are skipped. Front matter is checked, as Vale checks it, because a page description is prose. Pass `checkCode: true` to lint code comments too (CES-K-003). Line and column numbers refer to the original text.

## Fixes

`fix_text` applies the fixes that have one safe answer. An em dash becomes a comma, with the spaces around it absorbed. A hedge or hollow intensifier is deleted along with one adjacent space, and the next word is capitalized when the deleted word opened the sentence. A fixable word inside a larger construction is left in place, because the construction needs a rewrite, not a deletion. Review an em dash fix that joins two independent clauses; the standard allows a semicolon or a new sentence there, and the fixer cannot tell which.

Every other rule is report-only.

## The rules file and Vale

`rules/ces.yaml` is the single source of truth. Each rule carries its ID, severity, description, message, suggestion, exception, a before/after example, and its tokens with per-token severity and confidence. The server loads it at startup.

The same file generates the Vale style that circe-docs runs in CI:

```sh
npx circe-mcp export-vale path/to/circe-docs/styles/Circe --readme-table
```

The export writes one `.yml` file per rule. A rule whose tokens have mixed severities, such as CES-C-008, gets a second file with a level suffix (`TrailingContrastWarning.yml`), because a Vale rule carries one level. Heuristic rules that Vale cannot express are skipped. The flag prints a Markdown table for the circe-docs README, so that copy stays in step too.

Vale lints `real` inside `real-time`; the server skips the hyphenated form. Vale reports overlapping hits separately; the server merges them. The test suite runs Vale on the exported styles when a `vale` binary is available and confirms both tools flag the same rules on the same lines.

## Command line

```sh
circe-mcp                        # MCP server on stdio
circe-mcp http --port 3000       # MCP server over Streamable HTTP
circe-mcp check README.md docs/  # lint files; exit 1 on an error-level hit
circe-mcp fix draft.md --write   # apply the safe fixes in place
circe-mcp measure draft.md       # statistics as JSON
circe-mcp export-vale styles/Circe
```

`check` takes `--fail-on warning` to make warnings fail too, `--include-optional` to run the optional rules, and `--json` for machine-readable output.

## Development

```sh
npm install
npm test             # Vitest: fixtures per rule, positions, exceptions, fixes, export, MCP round trip
npm run typecheck
npm run build        # compiles to dist/; the server reads rules/ces.yaml from the package root
npm run check        # typecheck, test, build
```

Every rule has at least one fixture that it flags and one that it passes, and its own before/after example from the standard is tested the same way. The README and the tool descriptions are checked against the standard in the test suite and in CI, so this file passes `check_text` with zero violations, optional rules included. A 10,000-word check completes in under 200 ms.

`DECISIONS.md` records the design decisions and the reasoning behind them, including where each rule's ID comes from and why two rules ship off by default.

## License

MIT. See `LICENSE`.
