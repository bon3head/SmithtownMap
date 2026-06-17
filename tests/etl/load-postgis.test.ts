import { test, expect } from "bun:test";
// RED until src/etl/load.ts exists (Audit: Postgres 16 + PostGIS 3.4).
import { buildUpsert } from "../../src/etl/load";

test("upsert is keyed by accession id (ON CONFLICT DO UPDATE)", () => {
  const stmt = buildUpsert({ id: "1998.12.3", lat: 40.85, lng: -73.2 });
  expect(stmt.sql).toContain("ON CONFLICT (id) DO UPDATE");
  expect(stmt.params).toContain("1998.12.3");
});

test("emits PostGIS geometry when lat/lng present", () => {
  const stmt = buildUpsert({ id: "x", lat: 40.85, lng: -73.2 });
  expect(stmt.sql).toContain("ST_SetSRID");
});

test("omits geometry when coordinates are null", () => {
  const stmt = buildUpsert({ id: "x", lat: null, lng: null });
  expect(stmt.sql.includes("ST_SetSRID")).toBe(false);
});
