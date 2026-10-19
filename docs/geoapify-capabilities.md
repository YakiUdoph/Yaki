# Geoapify capability discovery

Assessment date: 2026-10-18.

Geoapify was selected for investigation because its geocoding interfaces expose multiple candidates, structured components, match evidence, country restrictions, machine-readable OpenAPI contracts, and server-side key authentication. Those are useful building blocks for an address-review queue. They are not a delivery-verification product, which is why Yaki keeps provider evidence separate from the human decision.

This document records what the published contracts said on the assessment date. It does not report live calls; those observations are in [live-contract-report.md](live-contract-report.md). Interpretations about how Yaki should use a field are labeled as application policy, not as Geoapify guarantees.

## Evidence and versions

The authoritative [OpenAPI catalog](https://apidocs.geoapify.com/assets/openapi/specs/index.json) lists the relevant OpenAPI 3.1 specifications below. The catalog and downloaded specifications reported these API versions on the assessment date:

| Concern | Specification | API version |
|---|---|---:|
| Free-form and structured forward geocoding | [Forward Geocoding](https://apidocs.geoapify.com/assets/openapi/specs/forward-geocoding/forward-geocoding-api-openapi-specs.json) | 1.1.1 |
| Coordinate-to-address lookup | [Reverse Geocoding](https://apidocs.geoapify.com/assets/openapi/specs/reverse-geocoding/reverse-geocoding-api-openapi-specs.json) | 1.1.1 |
| Bulk free-form forward and bulk reverse lookup | [Batch Geocoding](https://apidocs.geoapify.com/assets/openapi/specs/batch-geocoding/batch-geocoding-api-openapi-specs.json) | 1.1.1 |
| Bulk structured forward lookup | [Generic Batch](https://apidocs.geoapify.com/assets/openapi/specs/batch/batch-api-openapi-specs.json) | 1.1.1 |

Both `https://api.geoapify.com/v1` and the EU-focused `https://api-eu.geoapify.com/v1` are declared as servers. The specification describes the latter as using EU infrastructure.

## Authentication and common errors

The four direct API specifications declare either of these API-key schemes:

- Query parameter: `apiKey`
- Header: `x-api-key`

Yaki should prefer the header from a server-side component so keys do not appear in URLs, browser history, proxy logs, batch polling links, or analytics. Direct browser calls require a deliberately restricted key and a separate security review.

The geocoding operations document:

- `400`: invalid or missing parameters
- `401`: missing or invalid key
- `429`: rate limit or quota exceeded
- `500`: gateway/internal failure

Batch polling additionally documents `404` for an unknown or expired job. Error JSON is `statusCode`, `error`, and `message` (the batch `404` message may be optional).

## Forward and structured geocoding

`GET /geocode/search` (`forwardGeocode`) accepts exactly one input mode:

- Free-form: `text` (string, length 1–1024); or
- Structured: one or more of `name`, `housenumber`, `street`, `postcode`, `city`, `state`, `country` (each string, length 1–1024).

The contract explicitly says not to combine `text` with structured fields.

Other parameters:

| Parameter | Published contract |
|---|---|
| `type` | `country`, `state`, `city`, `postcode`, `street`, `amenity`, or `locality` |
| `lang` | documented language enum; default `en` |
| `limit` | integer 1–100 |
| `countrycodes` | array of up to 10 ISO 3166-1 alpha-2 codes |
| `filter` | array of hard filters matching `rect:`, `circle:`, `countrycode:`, or `place:` syntax |
| `bias` | array of ranking biases matching `proximity:`, `rect:`, `circle:`, or `countrycode:` syntax |
| `format` | `geojson` (default), `json`, or `xml` |

The documentation notes a default country bias based on the caller IP unless `countrycode:none` is used. A fair experiment must neutralize or explicitly record this behavior.

Successful formats are:

- GeoJSON: `FeatureCollection.features[]`, with each feature containing `properties`, point `geometry`, and possibly `bbox`; the collection can include `query` and parsed input.
- JSON: `{ results: [...], query?: ... }`.
- XML: a documented XML response schema.

Useful result properties include formatted address lines; address components; `lon`, `lat`; `result_type`; `place_id`; optional `bbox`, timezone and datasource data; and `rank`.

## Address matching and uncertainty evidence

There is **no separate address-matching or postal-verification endpoint in the catalog**. Address matching is represented by forward-geocoding response evidence:

- `query.parsed`: parsed components and `expected_type` for free-form input.
- `rank.confidence`: overall value documented from 0 to 1.
- `rank.confidence_city_level`, `rank.confidence_street_level`, `rank.confidence_building_level`: level-specific values from 0 to 1 when supplied.
- `rank.match_type`: `full_match`, `inner_part`, `match_by_building`, `match_by_street`, `match_by_postcode`, `match_by_city_or_disrict` (spelling as published), or `match_by_country_or_state`.
- `result_type`: published values include `unknown`, `amenity_name`, `amenity`, `building`, `street`, `postcode`, `suburb`, `district`, `city`, `county`, `state`, and `country`.

Geoapify explicitly says `match_type` describes the address level that matched, not whether all components are correct, and recommends `rank.confidence` for match evaluation. It also warns that low confidence does not necessarily mean an incorrect result. Its threshold example is application guidance, not a service guarantee. See [Working with geocoding confidence](https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/).

Therefore Yaki may derive a conservative **review-needed policy**, but must label it as Yaki policy and preserve the underlying signals. It must not call that policy a postal validity, existence, rooftop-accuracy, or deliverability verdict.

## Reverse geocoding

`GET /geocode/reverse` (`reverseGeocode`) requires:

- `lat`: number from -90 to 90
- `lon`: number from -180 to 180

Optional parameters are `limit` (1–100, default 1), `type` (`country`, `state`, `city`, `postcode`, `street`, `amenity`, `locality`, or `building`), `countrycodes` (up to 10), `lang` (default `en`), and `format` (`geojson`, `json`, or `xml`; default `geojson`). Response shapes and result properties mirror the forward contract, with a reverse-query object. Fields can be absent depending on location type.

Reverse geocoding can help an operator inspect or correct a manually moved coordinate. By itself it does not verify an original textual address or a delivery entrance.

## Batch processing

### Dedicated Batch Geocoding

The asynchronous endpoints are:

- `POST /batch/geocode/search` and `GET /batch/geocode/search?id=...`
- `POST /batch/geocode/reverse` and `GET /batch/geocode/reverse?id=...`

Forward submission body: an array of 1–1000 free-form strings. Reverse submission body: an array of 1–1000 `[lon, lat]` pairs or `{ "lon": ..., "lat": ... }` objects.

Submission may return `200` with results immediately or `202` with `{ id, status: "pending", url? }`. Polling returns `202` while pending, `200` when complete, or `404` when unavailable. JSON and CSV are documented for completed dedicated batch polling. Geoapify recommends at least a 60-second interval for large jobs, and says completed generic batch results are available for 24 hours. The application must persist its own durable audit record rather than depend on the temporary job.

The completed dedicated response is a top-level array with one normalized geocoding result object per submitted input, rather than a candidate collection per input. Each forward item includes its query/parsed input and result properties; each reverse item includes its coordinate query and result properties. Consequently, dedicated Batch Geocoding is useful for bulk normalization but does not satisfy Yaki's multiple-candidate review requirement by itself.

Dedicated forward submission parameters are shared across the job and include `lang`, optional proximity `lat`/`lon`, `filter`, `bias`, `text`, comma-separated `countrycodes`, `type`, and `priority` (0.01–1) as published in the OpenAPI contract. Because the body itself supplies address strings, unusual combinations such as the query-level `text` must be contract-tested before use rather than assumed. Reverse submission parameters are `lang`, comma-separated `countrycodes`, `type`, and `priority` (0.01–1). Both polling operations require a 32-character lowercase hexadecimal `id`; optional `format` is `json` (default) or `csv`.

### Generic Batch for structured addresses

`POST /batch` accepts an object with:

- `api`: a supported path, including `/v1/geocode/search` and `/v1/geocode/reverse`;
- `inputs`: 1–1000 objects with input-specific `params` and/or `body`, plus an optional caller `id`;
- optional shared `params` and `body`;
- optional `priority`: 0.5–1, default 0.5.

`GET /batch?id=...` retrieves the job; `id` has the same 32-character lowercase hexadecimal contract. A completed response contains `api`, `id`, optional shared parameters/body, and ordered `results[]`; each item can echo its caller ID and parameters and contains either the API result or a per-item error union. This is the documented route for up to 1000 structured addresses and is also the bulk option when Yaki needs the full forward-geocoding candidate collection for each free-form row. The dedicated batch endpoint only accepts free-form strings and normalizes each to one result.

Plan-specific request-rate and total quotas are **not fixed by these specifications**. Geoapify says they depend on the active project and should be read from MyProjects rather than hard-coded. Published credit pricing and free-plan allowances can change and are not acceptance-test constants.

## Product feasibility matrix

| Proposed capability | Status | Evidence and boundary |
|---|---|---|
| 1. Single-address lookup | **SUPPORTED** | Direct free-form and structured forward geocoding return candidates, coordinates, structured components, and confidence evidence. This is geocoding, not proof of deliverability. |
| 2. CSV address import | **PARTIALLY SUPPORTED** | Geoapify accepts API JSON, not an arbitrary user CSV upload workflow. Yaki must parse, map, validate, and sanitize CSV locally. Dedicated batch accepts free-form strings but returns one normalized result per input; Generic Batch or paced individual calls are needed when several candidates per row must be retained. Dedicated polling can return raw CSV. |
| 3. Multiple candidate locations | **SUPPORTED** | Direct forward `limit` is 1–100; MCP geocoding limits are 1–10. Candidate meaning still needs UX and deduplication rules. |
| 4. Conservative uncertainty detection | **PARTIALLY SUPPORTED** | Confidence, level confidence, match type, result type, parsed input, candidate count, and component comparisons provide signals. No official universal threshold or deliverability verdict is documented. Yaki policy requires empirical calibration. |
| 5. Human review and correction | **PARTIALLY SUPPORTED** | Geoapify supplies candidate data and reverse lookup; the review queue, selection/edit state, audit trail, map interaction, and re-check behavior are Yaki features not supplied by the API. |
| 6. Export of reviewed addresses | **PARTIALLY SUPPORTED** | Dedicated batch can return raw JSON/CSV, but exporting human decisions, original values, statuses, and audit evidence is an application responsibility. |
| 7. Direct API versus MCP comparison | **SUPPORTED** | Both publish machine-readable contracts for corresponding free-form, structured, and reverse operations. The initial ambiguous case differed without explicit country context. A focused run with the same operator-selected US restriction returned the same five candidates on both paths. Neither result establishes general accuracy; the production policy requires explicit country context and human review. |

## Unsupported interpretations

- “Validated address,” “safe to deliver,” “mail-receivable,” “occupied,” or “correct entrance” are not established by these geocoding contracts.
- A top-ranked result is not automatically the intended destination.
- `full_match` is not documented as component-perfect or deliverable.
- Confidence values are not calibrated probabilities of successful delivery.
- Reverse geocoding is not independent proof that a textual address exists.
- CSV ingestion, human decisions, and reviewed exports are not Geoapify-hosted workflows.
