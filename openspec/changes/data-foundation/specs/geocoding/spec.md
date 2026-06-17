# Spec delta: geocoding

## ADDED Requirements

### Requirement: Progressive-fallback batch geocoding bounded to Long Island
The geocoder SHALL attempt place resolution using the ordered fallback strategy from
Scaffold §9a — `"<place>, Smithtown, NY"` → `"<place>, Suffolk County, NY"` →
`"<place>, Long Island, NY"` → `"<place>, New York"` — bounded to the Long Island
viewbox `-73.35,40.75,-73.05,40.95`, honoring Nominatim's 1 request/second rate limit.
It SHALL assign `geocode_confidence` = "high" when the matched query contains
"Smithtown", "medium" for a broader match, and "low" with null `lat`/`lng` when all
strategies fail.

#### Scenario: First strategy resolves
- **WHEN** the Smithtown-scoped query returns a hit
- **THEN** `geocode_confidence` = "high" and the broader strategies are not attempted.

#### Scenario: All strategies fail
- **WHEN** no strategy returns a hit
- **THEN** `lat` and `lng` are null and `geocode_confidence` = "low".

### Requirement: Long Island gazetteer pre-resolution
Before calling Nominatim, the geocoder SHALL consult a local gazetteer of ~200
historical Smithtown place names (Scaffold §9c) keyed by normalized (lowercased) place
text. A gazetteer hit SHALL short-circuit network geocoding and assign
`geocode_confidence` = "high".

#### Scenario: Known historical place
- **WHEN** `place_text` normalizes to "main street smithtown"
- **THEN** the gazetteer returns lat 40.8559, lng -73.2007 with confidence "high"
  **AND** Nominatim is not called.
