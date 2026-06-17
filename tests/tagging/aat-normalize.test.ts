import { test, expect } from "bun:test";
// RED until src/tagging/aat.ts exists (Scaffold §3c/§3e Getty AAT normalization).
import { normalizeSubjects } from "../../src/tagging/aat";

test("synonym resolves to a canonical AAT term with an aat_id", () => {
  const out = normalizeSubjects(["homes"]);
  const dwellings = out.aat_subjects.find((t) => t.term === "Dwellings");
  expect(dwellings).toBeDefined();
  expect(dwellings!.aat_id.length).toBeGreaterThan(0);
});

test("unmapped term is preserved as free-text subject, never dropped", () => {
  const out = normalizeSubjects(["zorble"]);
  expect(out.subject).toContain("zorble");
  expect(out.aat_subjects).toHaveLength(0);
});
