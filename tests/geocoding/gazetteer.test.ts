import { test, expect } from "bun:test";
// RED until src/geocoding/gazetteer.ts exists (Scaffold §9c LI gazetteer).
import { lookupGazetteer } from "../../src/geocoding/gazetteer";

test("known historical place resolves with high confidence", () => {
  const hit = lookupGazetteer("Main Street, Smithtown");
  expect(hit).not.toBeNull();
  expect(hit!.lat).toBeCloseTo(40.8559, 3);
  expect(hit!.lng).toBeCloseTo(-73.2007, 3);
  expect(hit!.geocode_confidence).toBe("high");
});

test("normalization is case- and whitespace-insensitive", () => {
  const a = lookupGazetteer("  MAIN STREET smithtown ");
  const b = lookupGazetteer("main street smithtown");
  expect(a).toEqual(b);
});

test("unknown place returns null (caller falls back to Nominatim)", () => {
  const miss = lookupGazetteer("Quahog, RI");
  expect(miss).toBeNull();
});
