import { test, expect } from "bun:test";
// RED until src/search/typesense.ts exists (Scaffold §7a field map; Audit: Typesense).
import { buildCollectionSchema, toTypesenseDoc } from "../../src/search/typesense";

test("date_year is an int32 facet; title is searchable but not faceted", () => {
  const schema = buildCollectionSchema();
  const byName = Object.fromEntries(schema.fields.map((f) => [f.name, f]));
  expect(byName.date_year.type).toBe("int32");
  expect(byName.date_year.facet).toBe(true);
  expect(byName.title.type).toBe("string");
  expect(byName.title.facet).toBe(false);
});

test("lat/lng collapse into a single geopoint field", () => {
  const schema = buildCollectionSchema();
  const geo = schema.fields.find((f) => f.type === "geopoint");
  expect(geo?.name).toBe("location");
});

test("a record with null coords omits the geopoint in its document", () => {
  const doc = toTypesenseDoc({ id: "x", lat: null, lng: null });
  expect(Object.keys(doc)).not.toContain("location");
});
