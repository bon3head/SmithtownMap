# Design: data-foundation (Phase 1)

## Stack reconciliation (Audit supersedes Scaffold)

The Scaffold (2024 draft) names Elasticsearch, Next.js, and Leaflet. `REPORT_AUDIT.txt`
revises the stack and is authoritative. Phase 1 touches data only, so the one material
reconciliation is the search engine:

| Capability | Scaffold says | Audit (authoritative) | Phase-1 decision |
|---|---|---|---|
| Search index | Elasticsearch | **Typesense v27+** | Build the index against Typesense; preserve the Scaffold §7a field-type *intent* (full-text vs keyword vs range vs geo). |
| DB | Postgres (implied) | **Postgres 16 + PostGIS 3.4** | Load with PostGIS geometry for `lat`/`lng`. |
| Map (Phase 2) | Leaflet | MapLibre GL | Out of scope here; noted so the geocode output (`lat`/`lng` + confidence) feeds MapLibre/Supercluster later. |

A fact's label cites the **Scaffold** section for feature intent and adds an
**`[Audit: …]`** pointer where the realization differs.

## Pipeline shape

```
PastPerfect DC-XML  ──parse──▶  raw record dicts  ──normalize──▶  ArchiveRecord
        (§2a/§2b)                   (§2b)                 (§3e)        │
                                                                       ├─▶ geocode (§9a) ──▶ gazetteer fallback (§9c)
                                                                       ├─▶ AAT normalize (§3c/§3e)
                                                                       ├─▶ load → Postgres+PostGIS
                                                                       └─▶ index → Typesense (§7a field map)
```

The TypeScript ingest wrapper (`src/etl/`) orchestrates; the Python ETL (`scripts/`,
Scaffold §2b) does the heavy XML/geocode work. Phase-1 tests target the **TypeScript
contracts** (normalization, gazetteer resolution, confidence assignment, index field
map) so they run under `bun:test` deterministically without external services (Nominatim
/ Typesense / Postgres are stubbed at the seam).

## Determinism & test seams

- **Geocoding**: the Nominatim HTTP call is injected; tests assert the *fallback ordering*
  (Smithtown → Suffolk → Long Island → NY, Scaffold §9a) and confidence assignment, not
  live network results.
- **Gazetteer**: a pure in-memory lookup (Scaffold §9c) tested directly.
- **Load/Index**: tests assert the *mapping* (record → SQL row, record → Typesense doc
  field types) against fakes, not live services.

## Open questions (from the Audit — surfaced, not assumed)

1. **Image URL strategy** (proxy vs R2 mirror vs IIIF) — affects `image_url`/`thumbnail_url`
   normalization. Phase 1 stores the raw PastPerfect `image_url` and a derived
   `has_image`; the CDN decision is deferred to its own change.
2. **Monorepo layout** (single package vs workspaces for web/api/etl) — Phase 1 uses a
   single root package; revisit before Phase 2 scaffolds SvelteKit.
3. **PastPerfect export access** — Audit resolves this as available via Utilities → Export
   (Scaffold §2a); the scraping fallback (§2b note) is a contingency, not the plan.
