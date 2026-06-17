# AGENTS.md — SmithtownMap fact-driven workflow

This file governs how any coding agent (Claude Code, Codex, etc.) produces work in this repo.
It layers under `CLAUDE.md`. The prime directive: **every change starts with a fact, and every
fact points verbatim at the spec it came from and at the test that proves it.**

---

## The loop (list → add → implement → check → tag)

1. **`facts list` / read `.facts.staging`** — orient. Always scope; read the `## domain` block in
   `.facts` first to learn the vocabulary (record, normalized-record, geocode, gazetteer, facet, …).
2. **`facts:stage`** — write the fact(s) describing what will be true when done. You are NOT ready to
   write implementation code until the fact is staged and its RED test exists.
3. **Implement** to make the fact's command exit 0 (minimal code, TDD-green).
4. **`facts:check --tags <cluster>`** (scoped) / **`facts:promote <id>`** — verify, then promote.
5. **Tag** moves `@spec → @implemented` *only* via promote/ratify. **No fact is ever removed.**

---

## The fact-authoring contract (hard requirements)

A fact is **invalid** — and must not be staged — unless ALL of these hold:

1. **Verbatim source pointer in the label.** The label opens with a bracketed pointer to the exact
   spec section it derives from: `[Scaffold §3e]`, `[Scaffold §9a]`, `[Audit: Typesense]`, or a
   combination. The pointer is the audit trail from claim → requirement. No pointer ⇒ not a fact.
2. **A real, executable `--command`.** It is a `bun test tests/<area>/<name>.test.ts` whose file
   **exists** and **fails RED** before implementation. `spec-staging-lint` rejects a command whose test
   file is absent.
3. **An existing `--spec` back-reference.** `--spec openspec/changes/<change>/specs/<cap>/spec.md` must
   exist; it is the requirement the fact operationalizes.
4. **`--tags "spec,<phase>,<cluster>"`** — `spec` (lifecycle), the phase (`phase1`…`phase7`), and a
   capability cluster (`etl`, `geocoding`, `tagging`, `search`, `map`, `timeline`, `gallery`, `admin`).
5. **One fact = one testable claim.** Split compound claims; each gets its own test + id.

Worked example (the canonical shape — every Phase-1 fact follows it):

```
bun run facts:stage \
  --id etl-normalize \
  --label "[Scaffold §3e] ETL normalizes a parsed record into the ArchiveRecord schema (…)" \
  --command "bun test tests/etl/normalize-record.test.ts" \
  --tags "spec,phase1,etl" \
  --spec openspec/changes/data-foundation/specs/data-ingestion/spec.md
```

---

## Generating Phases 2–7 (the repeatable pattern)

Phase 1 (`data-foundation`) is the worked exemplar. For each later phase, repeat per capability:

1. `/opsx:propose "<phase-N capability>"` — create the openspec change; in `design.md`, reconcile any
   Scaffold↔Audit stack conflict (e.g. Phase 2 map: Scaffold Leaflet → **Audit MapLibre + Supercluster**).
2. For each testable capability in that change's `specs/*/spec.md`: write the RED `bun:test`, then
   `facts:stage` a fact obeying the contract above (verbatim `[Scaffold §x]` / `[Audit: …]` pointer).
3. Implement → `facts:promote` → `/opsx:verify` → PR → facts-bot ratifies → `/opsx:archive`.

Phase→section map for fact pointers: Phase 2 map (Scaffold §4, §10), Phase 3 gallery/detail (§6, §8),
Phase 4 timeline (§5), Phase 5 advanced search (§7), Phase 6 admin/community (§9b, §11), Phase 7
polish/launch (§12, §14). Always cite the **subsection** (e.g. `§4b` clustering), not just the chapter.

---

## Don'ts

- ❌ Stage a fact whose label has no `[Source §x]` pointer.
- ❌ Stage a fact whose test or spec file does not yet exist.
- ❌ Promote a fact whose command does not exit 0.
- ❌ Hand-edit `.facts` / `.facts.staging` (the hook blocks it; the discipline matters anyway).
- ❌ Remove a fact. Demote it to `@spec` if it regresses.
- ❌ Invent a stack element the Audit superseded (no Elasticsearch, Next.js, or Leaflet in new code).
