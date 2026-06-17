# Project guidance — SmithtownMap

Claude Code project-level guidance for **SmithtownMap**, the Smithtown Historical Society's
interactive historical-archive web app. This file is the constitution for **agent-first,
facts-gated, TDD-aligned** development. It is enforced by hooks (Layer 3) and CI (Layer 4);
it is not advisory.

The anti-hallucination workflow here was ported from the CanonClaw / ASH "Tier 5" system.
Its single mandate: **it is structurally impossible to claim work done that no test proves.**

---

## §1 — Identity & stack

- **Project:** SmithtownMap — map-first + timeline + faceted search over 3,000+ PastPerfect
  archival records. Improves on the Society's PastPerfect Online database.
- **Runtime:** Bun. **Frontend:** SvelteKit 2 + Svelte 5 Runes. **API:** Hono on Bun.
  **DB:** PostgreSQL 16 + PostGIS 3.4. **Search:** Typesense v27+. **Map:** MapLibre GL JS +
  Supercluster. **ETL:** Python + a TypeScript ingest wrapper.
- **Test framework:** `bun:test` ONLY. Never Jest/Vitest. Source: `src/<area>/`. Tests:
  `tests/<area>/<name>.test.ts`.
- **Current epic:** Phase 1 — Data Foundation (`openspec/changes/data-foundation`). All Phase-1
  facts are staged `@spec` (RED) in `.facts.staging`; none implemented yet (greenfield).

---

## §2 — Authoritative doc precedence (higher wins; resolve conflicts upward)

| Precedence | Source | Scope |
|---|---|---|
| 1 | **`REPORT_AUDIT.txt`** | Revised, authoritative stack + blocker list. **Supersedes the Scaffold** where they differ (Elasticsearch→Typesense, Next.js→SvelteKit, Leaflet→MapLibre). |
| 2 | **`SmithtownMap … Full Project Scaffold.md`** | Feature intent & domain detail. Cited verbatim as **"Scaffold §x"** in every fact label. |
| 3 | **`SmithtownMap_GapAnalysis_Checklist.md`** | Open gaps/blockers; feed into change `design.md` open-questions. |
| 4 | **`.facts`** | Post-implementation evidence ledger (CI-ratified). Authoritative for *what is actually done*. |
| 5 | **`openspec/changes/<change>/specs/*.md`** | Pre-implementation capability specs; the `--spec` back-ref target for facts. |

When the Scaffold and the Audit conflict, the **Audit wins**; a fact's label cites the Scaffold
for *intent* and adds `[Audit: …]` where the realization differs. See
`openspec/changes/data-foundation/design.md` for the worked reconciliation.

---

## §3 — The four-layer trust model (ported from Tier 5)

```
LAYER 4 — CI INTEGRITY (hard trust boundary; facts-bot identity only)
  spec-staging-lint.yml, test-quality-lint.yml, promote-facts.yml
  (the facts-bot GitHub App is the ONLY writer of canonical .facts on main)
LAYER 3 — LOCAL ENFORCEMENT (soft; bypassable; for velocity)
  .claude/hooks/* — protect-facts, tdd-guard-wrapper, post-tool-*, commit-msg audit
LAYER 2 — LEDGER PIPELINE (scripted; staging → promotion)
  .facts.staging → .facts via facts:stage / facts:promote / facts:demote + ci-promote
LAYER 1 — AUTHORING SURFACE (human + agent input)
  openspec changes, SPEC docs, tests authored RED-first
```

Layers 1–3 are soft. **Layer 4 is the hard boundary.** Only the `facts-bot[bot]` GitHub-App
identity can mutate canonical `.facts` on `main`. Nothing below it is trusted by the merge gate.
One-time bot setup: **`FACTS_BOT_SETUP.md`**.

---

## §4 — The facts-driven workflow (every change starts with a fact)

Code not described by a fact is unverifiable and treated as incorrect. See `AGENTS.md` for the
full fact-authoring contract. The loop:

1. **Propose** — `/opsx:propose "<capability>"` → `openspec/changes/<name>/{proposal,design,specs,tasks}.md`.
2. **Author RED test** — write `tests/<area>/<name>.test.ts` first; watch it fail for the right reason.
3. **Stage the fact** — `bun run facts:stage --id <id> --label "[Scaffold §x] <claim>" --command "bun test tests/<area>/<name>.test.ts" --tags "spec,<phase>,<cluster>" --spec openspec/changes/<name>/specs/<cap>/spec.md`.
4. **Implement** to green (minimal code).
5. **Local-promote** — `bun run facts:promote <id>` (re-runs the command, writes evidence `promoted_by: local-promote`).
6. **Verify** — `/opsx:verify <name>` (openspec validate + scoped `facts:check` + `bun test`).
7. **Merge** — `facts-bot` ratifies the fact into canonical `.facts` post-merge (`promoted_by: facts-bot[bot]`).
8. **Archive** — `/opsx:archive <name>`.

**Lifecycle tag:** `@spec` (`.facts.staging`) → `@implemented` (`.facts`). `[CI-RATIFIED]` is an
evidence-block *state*, not a literal tag.

---

## §5 — Hard invariants (non-negotiable)

A. **Never touch `.facts` / `.facts.staging` directly.** Only `bun run facts:stage/promote/demote`
   write them. The `protect-facts` hook blocks Write/Edit/redirect/`sed -i`/`cp`/`mv`/`tee` against
   them, and blocks `git --no-verify`.
B. **Never blanket `facts check`.** Always scope: `--tags <cluster>` / `--section` / `<id>`.
C. **Every fact label MUST carry a verbatim source pointer** (`[Scaffold §x]`, `[Audit: …]`) AND a
   real `bun test` command whose file exists. A fact missing either is invalid. (`AGENTS.md` contract.)
D. **`@implemented` is a claim, not a wish.** A fact is promoted only after its command exits 0.
   Never hand-edit a tag from `spec` to `implemented`.
E. **One capability = one RED test + one staged fact**, authored test-first.
F. **Never `--no-verify`.** For a genuine hotfix use the `[skip-tdd]` commit-message marker — it is
   audited to `HOTFIX_LOG.md` by the commit-msg hook.
G. **No fact is ever removed.** Wrong facts get `facts:demote`d back to `@spec`, never deleted.
H. **Stage explicit file lists** in git — never `git add -A` / `git add .` (avoid staging `vendor/`).

---

## §6 — Active hooks (`.claude/settings.json`)

| Event | Matcher | Hook | Effect |
|---|---|---|---|
| PreToolUse | `.*` | `protect-facts.sh` | Blocks any mutation of `.facts*` outside the sanctioned scripts; blocks `git --no-verify`. **Requires `jq`** (PATH on WSL; `tools/jq.exe` vendored for Windows). |
| PreToolUse | `Write\|Edit\|MultiEdit` | `tdd-guard-wrapper.sh` | Strict one-test-at-a-time TDD. **Currently disabled** via `.claude/tdd-guard/data/config.json` = `{"guardEnabled":false}` (no test-reporter wired yet). Enable once a `bun:test`→tdd-guard reporter is in place; do not relax to advisory. |
| PostToolUse | `Write\|Edit\|MultiEdit\|NotebookEdit` | `post-tool-facts-check.sh`, `post-tool-test-quality.sh` | Advisory: re-runs `facts:check` on `.facts*` edits, `test-quality:lint` on test edits. |
| git commit-msg | (git) | `commit-msg-hotfix-audit.sh` | Logs `[skip-tdd]` commits to `HOTFIX_LOG.md`. Install with `cp .claude/hooks/commit-msg-hotfix-audit.sh .git/hooks/commit-msg && chmod +x .git/hooks/commit-msg`. |

---

## §7 — Tooling

- **`facts:check` needs a `facts` binary on PATH.** The `@avcodes/facts` npm package's postinstall is
  brittle on WSL; do NOT add it as a dep. Provision the CLI by either (a) using the Windows global
  (`npm i -g @avcodes/facts`) or (b) building the vendored Rust CLI: `cargo build --release` in
  `vendor/facts-rs/`, then put the binary on PATH. `facts:check` is an inspection convenience — **no CI
  gate or `tier5:install` depends on it** (they parse the YAML directly and re-run the `bun test`
  commands), so the workflow is fully functional without it.
- **Gates that always work:** `bun run tier5:install`, `spec:lint`, `spec:chronology`,
  `spec:contextlint`, `test-quality:lint`.
- **OpenSpec:** `bunx openspec …` (`@fission-ai/openspec@^1.4.1`); slash commands in `.claude/commands/opsx/`.
- **`vendor/`** holds upstream reference clones (`openspec-upstream`, `facts-rs`); gitignored, not the
  project's own ledger.

---

## §8 — Code safety (replaces CanonClaw's Rust/Go rules)

### TypeScript / Svelte 5
- No `any` in committed code without a `// reason:` note. Prefer discriminated unions for record states.
- Svelte 5 Runes (`$state`, `$derived`, `$effect`) — never the legacy `$:` reactive syntax in new code.
- Atomic writes for any ledger/data file: write `.tmp`, then `fs.renameSync` (the facts scripts already do this).

### Hono / Bun API
- Validate all request input at the route boundary (zod or equivalent) before it reaches a query.
- Parameterize every SQL/PostGIS query — never string-concatenate user input.

### ETL / data
- Geocoding honors Nominatim's 1 req/sec rate limit (Scaffold §9a); the gazetteer (§9c) short-circuits first.
- Loads are idempotent (upsert by accession `id`); re-running the pipeline never duplicates records.

---

## §9 — Where to look first

- **What Phase 1 is:** `openspec/changes/data-foundation/{proposal,design,tasks}.md`.
- **The fact-authoring contract:** `AGENTS.md`.
- **The per-phase success bar:** `AGENTIC_CONTRACT.md`.
- **Turning on the CI trust boundary:** `FACTS_BOT_SETUP.md`.
- **The current ledger:** `.facts.staging` (7 staged `@spec` facts) / `.facts` (empty header — greenfield).
