# Spec delta: data-ingestion

## ADDED Requirements

### Requirement: Parse PastPerfect Dublin Core XML export
The ETL SHALL parse a PastPerfect Dublin Core XML export (Scaffold §2a/§2b
`parse_dublin_core_xml`) into a list of raw record dicts, mapping `accessno` → `id`,
`dc:title` → `title`, `dc:subject` → `subject`, `dc:creator` → `creator`,
`dc:description` → `description`, `dc:date` → `date`, `place`, `dc:format` → `medium`,
`collection`, `catalog` → `catalog_type`, `image_url`, `people`, `lexiconcategory`.

#### Scenario: Well-formed DC-XML record
- **WHEN** a `<record>` element contains `accessno` and `dc:title`
- **THEN** the parsed dict has `id` = accessno and `title` = the dc:title text
- **AND** a missing optional element yields an empty string, never a crash.

### Requirement: Normalize to the ArchiveRecord schema
The ETL SHALL map a parsed record into the normalized `ArchiveRecord` schema
(Scaffold §3e), including: `catalog_type` ∈ {photo,object,archive,library};
`date_year` (numeric, nullable) and `date_decade` (e.g. "1920s") derived from
`date_display`; `subject` as a normalized string array; `has_image` derived from a
non-empty `image_url`; `source` = "pastperfect_export".

#### Scenario: Decade derivation
- **WHEN** `date_display` is "circa 1923"
- **THEN** `date_year` = 1923 **AND** `date_decade` = "1920s".

#### Scenario: Image presence
- **WHEN** `image_url` is empty
- **THEN** `has_image` = false.

### Requirement: Idempotent load into Postgres + PostGIS
The ETL SHALL upsert normalized records into PostgreSQL 16 + PostGIS 3.4 (Audit stack)
keyed by accession `id`, so that re-running the load does not create duplicates and
`lat`/`lng` are stored as PostGIS geometry when present.

#### Scenario: Re-run is idempotent
- **WHEN** the same record `id` is loaded twice
- **THEN** exactly one row exists for that `id` with the latest field values.
