# Decisions: circe-mcp

## D1. Where the rules live (2026-10-07, amended the same day)

**Original decision:** Rules live in circe-mcp as a single YAML rules file. The server exports the Vale styles (`npx circe-mcp export-vale`), and circe-docs consumes that output.

**Amended decision:** Rules live in circe-mcp as a single YAML rules file. The server reads it at startup. Nothing else is generated from it, and no other project consumes it; see D14 and D15.

**Why:** Put the rules where they are edited most. Rule changes will come mostly from building and testing the server. Each rule entry can carry examples, fix data, per-token severity, and confidence. Heuristic rules name a detector in code.

**Revisit if:** the standard is adopted by others, at which point it may move to its own package.

## D2. Where "not just" belongs (2026-10-07)

**Decision:** Option A. "not just" stays in trailing contrast (CES-C-008) at error level and fails the build.

**Why:** The phrase sets up one thing to elevate another, the same move as "rather than" and "instead of." Vale already enforces it this way. The written standard will be updated to move "not just" out of the inferior baseline list.

## D3. Rule ID for inferior baseline (2026-10-07, amended the same day)

**Original decision:** Use the C (constructions) prefix with the next unused number. Expected to be CES-C-009. Confirm against the full standard before assigning.

**Amended decision (after reading CES v0.3):** No new ID. The server reports inferior baseline as **CES-V-007 with `form: inferior-baseline`**, which is where the standard files it (a recognizable form of punchy flourishes, MUST AVOID). Promoting the form to its own rule later is a rules-file change plus test renames, so nothing is lost by waiting. Options considered: CES-Q-003 (inferior baseline is a word-level modifier that implies a lesser alternative, the same shape as Q-001 hedges; would be the first MUST AVOID in the Q category) and CES-C-009 (the original intent; weakest fit, since C rules are clause patterns and "in practice" and "real" are single tokens). Either way the rules file carries a `form` field, because CES-C-001 and CES-V-003 have multiple surface forms too.

**Why:** Inferior baseline is a sentence construction, closely related to trailing contrast (CES-C-008).

**ID survey (2026-10-07):** Before the full standard was available, a published rule list named throat-clear CES-C-003, trailing bow C-004, so-what gloss C-005, pronouncement C-006, and vague perfection V-004, so C-003 through C-008 were taken and a fourth prefix, V, existed. The full standard later confirmed C-001 and C-002 as well.

## Rule inventory check (2026-10-07)

- The handoff's "In Vale today" table matched the five existing Vale rules exactly: same IDs, levels, and tokens.
- Vale's three levels map to the standard's tiers: error (MUST AVOID), warning (SHOULD AVOID), suggestion (MAY AVOID). The server's severity field includes `suggestion`.
- Vale skips fenced code blocks in Markdown. The server matches this by default (D12).

## D4. Severity for inferior baseline (2026-10-07)

**Decision:** Option C, split by ambiguity.
- Error, high confidence: "in practice", "not abstract"
- Warning, low confidence: "real"

**Why:** Matches the standard's MUST AVOID rating where the pattern is unambiguous, while avoiding failed builds on "real" as a plain adjective ("real-time", "real estate").

## D5. Missing tokens: "beyond" and "not abstract" (2026-10-07)

**Decision:**
- Add "not abstract" to inferior baseline at error level (per D4).
- Add a narrow "beyond" list to trailing contrast (CES-C-008) at warning level: "go beyond", "goes beyond", "move beyond", "far beyond", "well beyond". Bare "beyond" is not flagged.

**Why:** Bare "beyond" has many neutral uses ("beyond the scope of this guide"). The listed phrases carry the elevating move but can still be literal, so they warn without failing the build. Under D1, both additions reach Vale through the export.

**Note:** CES-C-008 now holds tokens at two severities, so the rules file supports per-token severity.

## D6. Negate-then-elevate (2026-10-07)

**Decision:** Option A. Build in Phase 1 as a warning, medium confidence. Two-sentence pattern: a negation ("not", "isn't", "no longer") followed by a short sentence restating the subject positively.

## D6a. Additional patterns for Phase 1 (2026-10-07)

**Decision:** Add three more rules beyond the original inventory:
1. **Pronouncement closers** (token list, warning, high confidence): "That's the power of", "And that's the point", "That's what makes", and similar closers.
2. **Rhythm check** (measurement, no verdict): flag paragraphs where sentence lengths cluster within a few words of each other. Exposed as a separate tool, `measure_text`, returning statistics only. Also report opener echo (three or more consecutive sentences starting with the same word).
3. **Trailing minimizer** (token list, warning): "alone" at clause end, "merely", "simply", "mere". From the example "grounding interface decisions in real-world usability rather than abstract standards alone."

**Overlap handling:** The example above trips inferior baseline ("real-world", "abstract") and trailing contrast ("rather than") in one clause. When violations overlap in span, report the earliest once and list the others as `related` on that violation.

**Deferred:** throat-clear openers, so-what gloss, question reveal, trailing bow, false range, bold-label lists. Candidates for Phase 1.5 after the first rules settle.

## D7. Heuristic rules (2026-10-07)

**Decision:** Negate-then-elevate and pronouncement closers are in Phase 1 (see D6, D6a). Stylistic triples: warning, low confidence, off by default; writers opt in. Remaining banned wording patterns stay deferred per D6a.

## D8. Subjective rules (2026-10-07)

**Decision:** All five groups are in the checker as warnings. Nothing is left out of the tool.
- **Resume clichés, vague perfection, over-enthusiasm:** token lists, warning, medium confidence. Shipped as an optional rule set, off by default.
- **Punchy flourishes:** warning, low confidence. Detect a fragment of three words or fewer ending in a period, following a complete sentence. Merged with trailing bow as one rule. Must respect the CES-C-007 permitted short declarative exception.
- **Sass:** warning, low confidence. Token list of signature openers: "Spoiler:", "Plot twist:", "Pro tip:", "Fun fact:", "Translation:", "Yes, really", "Wait for it".

**README note:** state that flourish and sass detection catches stock phrasing and will miss cases that need human judgment.

## D9. Exceptions (2026-10-07)

**Original decision:** Option C. Honor Vale inline comments (`<!-- vale Circe.TrailingContrast = NO -->`) and add an `ignore` parameter to `check_text` listing rule IDs to skip.

**Amended (D15):** The inline form is the server's own directive, keyed by rule ID: `<!-- ces ignore CES-C-008 -->` ... `<!-- ces end -->`, with `<!-- ces off -->` / `<!-- ces on -->` for a whole section. The `ignore` parameter stays.

## D10. `fix_text` scope (2026-10-07)

**Decision:** Option B. Auto-fix em dashes, hedges, and intensifiers. All other rules are report-only.

## D11. Project basics (2026-10-07)

**Decision:** MIT license. Package name `circe-mcp`. CES only in Phase 1. CSF follows as an optional rule set using the mechanism from D8.

---

# Amendments after reading CES v0.3 (2026-10-07)

Everything below follows from a decision above, from the standard's text, or from the D3 answer. Dates are the day each was recorded.

## Standard version

The handoff and the D1 goal say CES v0.2. The current document is v0.3 (October 2026).
The server, README, and `list_rules` output cite v0.3.

## D4/D5. "not abstract" (amended)

"Not abstract" appears nowhere in CES v0.3. The nearest text is the C-008 example "rather than abstract standards alone." Until the standard lists it, the token ships at **warning, medium confidence**, not error / high. Promote when v0.4 names it.

## D5. "beyond" export (amended, then superseded)

Mixed token severities under one rule ID were going to need two Vale files. With the Vale export removed (D15) the rules file simply carries a `severity` per token and the checker reports each token at its own level.

## D6a. Re-ID the new Phase 1 rules (amended)

- **"Pronouncement closers"** → report as **CES-C-004 (trailing bows)** for sentence-final closers ("and that's the point," "and that's what matters") and **CES-C-005 (so-what gloss)** for standalone closers ("That's what makes X work," "That's no accident"). CES-C-006 is for aphorisms ("Simplicity scales") and stays deferred.
- **Throat-clear openers** move from deferred to **Phase 1** as CES-C-003 token forms: "It's worth noting that," "Here's how I'd approach it," "The key thing is," "Prior experience backs this up:". Same difficulty as the closers.
- **"Trailing minimizer"** → report as **CES-V-008 (gratuitous trailing clauses)**, form `minimizer`. Drop "simply" from this list; it belongs to Q-001. Tokens: "alone" at clause end, "merely," "mere."
- **Negate-then-elevate** is **CES-C-001**. Seed the detector with the standard's nine surface forms; three are plain tokens ("But here's the thing nobody talks about," "What X really means is," "No X. No Y. Just Z.").

## D8. Re-ID and reclassify (amended)

- **Resume clichés** → CES-V-001, using the standard's 35-phrase list. Optional set, off by default (unchanged).
- **Sass** → **CES-V-006 (chatty asides)**. Merge D8's list ("Spoiler:", "Plot twist:", "Pro tip:", "Fun fact:", "Translation:", "Yes, really", "Wait for it") with the standard's ("let's dive in," "let's unpack this," "let's explore," "here's the thing," "the truth is," "spoiler alert," "long story short," "without further ado," "buckle up," "you might be wondering").
- **Punchy flourishes** → CES-V-007. Ships at **warning** although the standard says MUST AVOID. Recorded as a deliberate downgrade for low detector confidence. Merged with trailing bow only in the detector; violations still carry C-004 or V-007 by which test fired.
- **Vague perfection** (V-004) and **over-enthusiasm** (V-005) are **not token lists**. V-004 is a density count (specifics per 100 words). V-005 is signals: exclamation points outside dialogue, stacked superlatives, every paragraph closing positive. Both move to `measure_text` as statistics with no verdict, alongside the rhythm check and opener echo.

## D10. Fixable flag (amended)

Auto-fix stays for em dashes, hedges, and intensifiers, but only for tokens marked `fixable: true` in the rules file. The original six tokens are all fixable. When the Q-001 and Q-002 lists grow to the standard's 20 and 11 words, conditional tokens ("just" temporal, "actually" in headings, "often," "pretty," "specifically," "deeply" as emphasis) ship `fixable: false`.

## D12. Code blocks (new)

CES-K-003 (MAY) says comments inside code blocks follow all rules. The server skips fenced code blocks and inline code by default. A `checkCode: true` option on `check_text` lints code blocks too. Recorded so the skip is a decision, not an omission.

## D13. Phase 1.5 scope (new, 2026-10-07)

**Decision:** The standard's rules that no current decision covers go to Phase 1.5, after the Phase 1 rules settle.

Token-detectable:
- Q-001 and Q-002 full word lists, with the Q-001 exceptions ("just" temporal, "actually" in headings, "often" as measured frequency).
- CES-V-002 manufactured intimacy, phrase list. Overlaps C-001 on "here's the thing nobody talks about."
- CES-V-003 scene-painting: "equally at home," "the kind of person who," "when the room needs," "hands-on," "builds from scratch," "trusted advisor," "speaks both languages," "real-world." "Real-world" overlaps inferior baseline; use the `related` mechanism from D6a.
- CES-P-002 straight quotes in prose outside code.
- CES-V-005 exclamation-point signal (the one V-005 check that is a token).

Measurable (`measure_text`):
- CES-S-002 paragraph density: six or more sentences.
- CES-N-001 acronyms defined on first use.

Not planned for any phase (need human judgment or are not text rules): A-001, A-002, S-001, T-001 to T-004, L-001, L-002, N-002, N-003, K-001, K-002.

## Test fixture from Appendix B

"Onboarding is a path rather than a finish line" (the C-007 worked example) trips C-008. It is the fixture for D9 exception handling: flagged without an ignore, clean inside `<!-- ces ignore CES-C-008 -->` or with `ignore: ["CES-C-008"]`.

## D14. Independence from circe-docs (2026-10-07)

**Decision:** circe-mcp is a standalone project. It does not read from, write to, link to, or name circe-docs anywhere in its code, rules, tests, or README. The Vale export is a generic feature for any Vale user; wiring it into a particular site's CI is that site's business.

**Why:** The two projects share an author and a standard, nothing else. A portfolio piece should stand on its own, and a reader of circe-mcp should not need a second repository to understand it.

**Consequence:** The handoff's release step "add a page to circe-docs" is dropped from this project's plan.

## D15. No Vale export (2026-10-07)

**Decision:** Remove `export-vale`, the `vale` fields on rules and tokens, the Vale cross-check test, and the Vale inline-comment syntax. The server is the only consumer of the rules file. Exceptions use the server's own directives (see D9, amended).

**Why:** The `check` command already gates CI with more than a Vale export could carry: heuristic detectors, per-token severity, overlap merging, and lookaround regexes. Keeping the export taxed every new token with an RE2-safe second pattern and kept a second output format alive only because of D1's original wording. The Vale cross-check was redundant with the per-rule fixtures.

**Cost:** Teams that lint with Vale and want the standard in CI have no drop-in style. That is reach for the standard, not for the server, and can be a separate tool later if the standard finds other adopters.

## Implementation notes from the Phase 1 build (2026-10-07)

Choices made while building that the decisions above did not settle. Each is small enough to reverse.

- **Overlap precedence.** D6a says to report the earliest violation in an overlapping span and list the rest as `related`. Implemented as most severe first, then most confident, then earliest. Reason: in "It's not just code, it's craft" the CES-C-001 warning starts one word before the CES-C-008 error, and earliest-first would hide the error from a `severity: error` filter.
- **Front matter is checked.** A page description is prose, and most Markdown linters check it too.
- **Severity filter** is a minimum level: `severity: "warning"` returns errors and warnings.
- **`rules` versus `includeOptional`.** `rules` runs exactly the named rules, optional ones included, and rejects unknown IDs. `ignore` tolerates unknown IDs, because a writer may carry an ignore list across standard versions.
- **Directive keys.** Directives take rule IDs in any case, several per comment, separated by spaces or commas. `<!-- ces end -->` with no IDs closes every open ignore; with IDs it closes only those.
- **`real` skips hyphenated forms** (`real-time`) via a lookahead, so the token is one JavaScript regex with no second pattern for another engine.
- **CES-C-005 example.** The standard's before example ("That's analytics-adjacent.") has no stock form to match, so the rules file uses "That's no accident.", which is one of the standard's listed surface forms, and the test suite requires every rule's own example to trip the rule.
- **Fragment detector** (CES-V-007, form `fragment`) runs only on text and quote paragraphs, never on headings, list items, or table cells, and requires the preceding sentence to have eight or more words.
- **`fix_text` deletions** also remove a dangling comma: "Really, do it." becomes "Do it." and "faster, really." becomes "faster."
- **`measure_text` ships in Phase 1** with the D6a rhythm check and opener echo, plus the CES-V-004 density count, the CES-V-005 signals, and the CES-S-002 sentence count per paragraph. All are numbers and booleans against the standard's stated thresholds; none is a violation.
- **Stack.** TypeScript 5.9, Node 20+, `@modelcontextprotocol/sdk` 1.32 (`McpServer.registerTool` with zod 4 schemas), Vitest 5. Stdio by default; `circe-mcp http` serves stateless Streamable HTTP. Tool results carry a readable text report and the full result as `structuredContent`.

---

## Next project idea (noted 2026-10-07)

A skill or MCP server for customizable voices: define your own writing style, or several named voices, and have text checked or shaped against the chosen one. circe-mcp's rules file format and optional rule sets are the likely foundation. Not started.

First test case: Avalynn's "soda cracker" voice. Bland, accessible, comfortable. Unlike CES, which removes patterns, a voice is a positive target to shape toward.
