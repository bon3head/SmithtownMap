---
name: "OPSX: Verify"
description: Local pre-archive validation gate for an OpenSpec change (CanonClaw-local; NOT CI ratification)
category: Workflow
tags: [workflow, validation, tier5, local-gate]
---

Run the **local validation gate** for an OpenSpec change, the step between `/opsx:apply` and
`/opsx:archive`. This is a CanonClaw-local command (the OpenSpec `core` profile does not ship a
`verify` workflow; the expanded profile's `verify` is global-scope, so we wire a repo-local gate here
instead). It mutates nothing canonical — it only tells you whether a change is safe to archive.

> **Verify ≠ ratify.** This gate runs **locally** and proves a change is internally consistent and
> green. It does **NOT** write canonical `.facts` and is **NOT** the Tier 5 trust boundary.
> CI ratification is a separate, post-merge step: `.github/workflows/promote-facts.yml` runs
> `scripts/ci-promote-facts.ts` under the `facts-bot[bot]` GitHub-App identity, which re-verifies every
> staged fact and rewrites it into `.facts` with an evidence block (`promoted_by: facts-bot[bot]`).
> "CI-ratified" describes that evidence-block state — it is **not** a literal tag. The literal fact
> lifecycle is `@spec → @implemented`.

**Input**: Optionally specify a change name (e.g., `/opsx:verify add-auth`). If omitted, infer from
conversation context; if only one active change exists, auto-select; if ambiguous, run
`openspec list --json` and use the AskUserQuestion tool to let the user choose. Always announce
"Verifying change: <name>" and how to override.

**Steps**

1. **Resolve the change** (as above). Read `openspec status --change "<name>" --json` to learn its
   `changeRoot` and the cluster/tag its staged facts use (the `--tags` value passed at `facts:stage`,
   per `openspec/config.yaml`).

2. **OpenSpec structural validation** (must pass):
   ```bash
   openspec validate "<name>" --strict --no-interactive
   ```
   For a whole-project sweep, use `openspec validate --all --strict --no-interactive`.
   This checks proposal/specs/design/tasks artifacts are well-formed. It does **not** touch `.facts`.

3. **Scoped facts check** (must pass): run the change's command-facts only — **never** a bare
   `facts check` (per CLAUDE.md §8.B and `facts_ledger_workflow`):
   ```bash
   bun run facts:check --tags "<cluster>"
   ```
   Manual facts (`?`) get a per-fact PASS/FAIL verdict with a one-line reason. No fact is ever removed.

4. **Full test suite** (must pass, pristine):
   ```bash
   bun test
   ```
   For a fast inner-loop subset while iterating: `bun test tests/scripts/ tests/tier5/`.

5. **Report the gate table** and a verdict:

```
## OPSX Verify — <change-name>

| Gate                | Command                                   | Result |
|---------------------|-------------------------------------------|--------|
| OpenSpec validate   | openspec validate <name> --strict         | ✅/🔴 |
| Facts (scoped)      | bun run facts:check --tags <cluster>      | ✅/🔴 |
| Test suite          | bun test                                  | ✅/🔴 |

Verdict: READY TO ARCHIVE  |  NOT READY — fix the 🔴 gate(s) above, then re-run /opsx:verify
```

**Guardrails**
- Read-only with respect to canonical `.facts` / `.facts.staging`. Never promote, never hand-edit a tag.
- Always scope the facts check by `--tags`/`--section`/`<id>` — never run it bare.
- A green verdict authorizes `/opsx:archive`; it does **not** assert CI ratification (that happens
  post-merge via the Phase 7 bot).
- If any gate is 🔴, STOP and report; do not archive a change that fails its own verify gate.
