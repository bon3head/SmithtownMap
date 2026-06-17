import { test, expect } from "bun:test";
// RED until src/etl/normalize.ts exists (Scaffold §3e ArchiveRecord).
import { normalizeRecord } from "../../src/etl/normalize";

test("derives date_year and date_decade from date_display", () => {
  const rec = normalizeRecord({ id: "x1", date: "circa 1923", image_url: "" });
  expect(rec.date_year).toBe(1923);
  expect(rec.date_decade).toBe("1920s");
});

test("derives has_image from a non-empty image_url", () => {
  const withImg = normalizeRecord({ id: "x2", image_url: "http://x/p.jpg" });
  const without = normalizeRecord({ id: "x3", image_url: "" });
  expect(withImg.has_image).toBe(true);
  expect(without.has_image).toBe(false);
});

test("stamps source as pastperfect_export", () => {
  const rec = normalizeRecord({ id: "x4", image_url: "" });
  expect(rec.source).toBe("pastperfect_export");
});
