# AGENTIC_CONTRACT.md — SmithtownMap

The per-phase contract for declaring work complete. Layers under `CLAUDE.md` / `AGENTS.md`.

---

## Per-phase loop (both must hold)

1. **TDD GREEN PASS** — tests written RED-first (watched fail for the right reason), then minimal
   implementation to green. Full suite still green; output pristine.
2. **`.facts` ALIGNMENT** — scoped `facts:check --tags <cluster>` run; the phase's command-facts pass;
   manual facts verified with a per-fact PASS/FAIL verdict; phase facts promoted `@spec → @implemented`.

---

## Major-phase gate

After each major phase (Phase 1 data, Phase 2 map, … Phase 7 launch), **dispatch an independent
subagent review** before continuing to the next phase. The reviewer checks: every phase fact is
`@implemented` and its command genuinely green, no trivially-passing tests, no fact promoted by an
identity other than the bot on `main`.

---

## Three non-negotiables for declaring SUCCESS (in order)

1. **`superpowers:verification-before-completion`** — final evidence pass; run the commands, show output.
2. **Full test suite GREEN** — `bun test` end-to-end AND unit; pristine.
3. **All facts accomplished** — every phase fact `@implemented` / verified; **no fact ever removed**.

Never declare a phase "done", "fixed", or "passing" without pasting fresh command output. "Tests pass"
without evidence is unacceptable.

---

## Success metric (the bar this whole system exists to guarantee)

> Over the life of the project, zero `@implemented` facts in `.facts` whose command (a) points at a
> non-existent test file, (b) is a trivially-passing assertion detectable by `test-quality:lint`, or
> (c) was promoted by an identity other than the `facts-bot[bot]` CI on `main`.

If any of those is ever true, the ledger is lying and the trust model has failed — fix it before any
further feature work.
