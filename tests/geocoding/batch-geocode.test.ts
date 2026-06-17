import { test, expect } from "bun:test";
// RED until src/geocoding/geocode.ts exists (Scaffold §9a progressive fallback).
import { geocodeRecord } from "../../src/geocoding/geocode";

// Injected fake Nominatim: resolves only the Smithtown-scoped query.
const smithtownOnly = async (query: string) =>
  query.includes("Smithtown, NY") ? { lat: 40.85, lng: -73.2 } : null;

const neverResolves = async (_query: string) => null;

test("first (Smithtown) strategy resolving yields high confidence", async () => {
  const r = await geocodeRecord("Main Street", { nominatim: smithtownOnly });
  expect(r.geocode_confidence).toBe("high");
  expect(r.lat).toBeCloseTo(40.85, 2);
});

test("all strategies failing yields null coords and low confidence", async () => {
  const r = await geocodeRecord("Nowhere", { nominatim: neverResolves });
  expect(r.lat).toBeNull();
  expect(r.geocode_confidence).toBe("low");
});
