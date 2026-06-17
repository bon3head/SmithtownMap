# Change: data-foundation (Phase 1)

## Why

SmithtownMap's map, timeline, gallery, and faceted search (Phases 2–7) are all
downstream of one thing: a **clean, normalized, geocoded, searchable record set**
derived from the Smithtown Historical Society's PastPerfect Online catalog. Without a
deterministic, tested ETL → normalize → geocode → index pipeline, every later phase
builds on sand. This change establishes the data foundation as the first gated unit of
work, per Scaffold §13 "Phase 1 — Data Foundation (Weeks 1–3)".

## What Changes

- **ADDED** PastPerfect Dublin Core XML ingest (Scaffold §2a/§2b).
- **ADDED** Normalization to the `ArchiveRecord` schema (Scaffold §3e).
- **ADDED** Idempotent load into PostgreSQL 16 + PostGIS 3.4 (Audit stack).
- **ADDED** Progressive-fallback batch geocoding bounded to Long Island (Scaffold §9a).
- **ADDED** Local Long Island gazetteer pre-resolution (Scaffold §9c).
- **ADDED** AAT subject normalization (Scaffold §3c/§3e).
- **ADDED** Typesense search index built from `ArchiveRecord` with typed field mappings
  (Scaffold §7a intent; **Audit supersedes Elasticsearch → Typesense**).

## Impact

- Affected areas: `src/etl/`, `src/geocoding/`, `src/tagging/`, `src/search/`.
- New tests: `tests/etl/`, `tests/geocoding/`, `tests/tagging/`, `tests/search/`.
- Each capability is gated by a staged fact in `.facts.staging` (tag `phase1`) with a
  verbatim Scaffold/Audit source pointer and an executable `bun test` command.
- No application UI is in scope here (Phase 2+).
