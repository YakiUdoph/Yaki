# Direct Geoapify API versus MCP experiment plan

## Purpose

Measure whether equivalent Geoapify direct and MCP geocoding paths return materially different candidates or evidence, and whether MCP-assisted multi-step investigation adds useful human context without overstating certainty.

This file is the pre-run protocol and is retained so the eventual evidence can be compared with the plan that produced it. The first authenticated contract run has now taken place; its observed results, failures, and corrections are in [live-contract-report.md](live-contract-report.md). The broader repeated experiment described here has not been completed, so planned metrics and future artifacts below must not be read as achieved results.

## Freeze the contracts

At the start of every run, record:

- UTC timestamp and run ID
- Git commit and harness version
- SHA-256 hashes of the downloaded Forward, Reverse, Batch, combined MCP, and focused MCP OpenAPI files
- API version fields from those files
- sanitized output of MCP `initialize` and full `tools/list`
- server region (`api.geoapify.com` or `api-eu.geoapify.com`)
- protocol version (`2025-06-18` unless runtime discovery requires a documented change)
- project plan/quota/rate limits read from MyProjects, without capturing the key
- all normalization and Yaki-policy versions

## Dataset

Build a versioned JSONL/CSV fixture with synthetic or consented inputs and stable case IDs. Do not publish real customer addresses. Each case records the reason it exists and, when a reference expectation is known, the provenance of that expectation. Required strata:

1. Complete address: building number, street, locality, postcode, country.
2. Incomplete address: omit one component at a time (number, postcode, city, country).
3. Ambiguous place name: same city/street/place name in multiple countries or regions.
4. Invalid input: empty/whitespace, over 1024 characters, impossible coordinates, arbitrary non-address text, and unsupported extra MCP property.
5. Multiple-candidate case: a query known during pilot collection to return at least two plausible results; do not assume this before observing it.
6. Structured address: the same semantics represented in separate fields.
7. Reverse lookup: known coordinate and boundary/coarse-location cases.
8. Character/language case: accents, non-Latin script, abbreviations, and transliteration-sensitive input.
9. Conflict candidate: reserved stratum populated only if the paired paths produce differing top candidates or fields.

Keep a small public synthetic corpus and a separate private operational corpus. Never use a live customer's name, phone, delivery note, access code, or order ID as a geocoding query.

## Paired calls

### Free-form pair

- Direct: `GET /v1/geocode/search` with `text`, `format=json`, `limit=10`, fixed `lang`, and identical country-code restriction when used.
- MCP: `tools/call` → `geocode_address` with `query`, `limit=10`, the same `lang`, and equivalent `country_codes`.

### Structured pair

- Direct: `GET /v1/geocode/search` using only the structured address parameters, `format=json`, and `limit=10`.
- MCP: `tools/call` → `geocode_structured_address` with the same supported components and limit.

### Reverse pair

- Direct: `GET /v1/geocode/reverse` with identical `lat`, `lon`, `type`, country restriction, language, `format=json`, and `limit=10`.
- MCP: `tools/call` → `reverse_geocode_coordinates` with the equivalent arguments.

Do not use direct-only `filter` or `bias` in the paired core comparison. Set a documented neutral country bias on the direct path if needed to prevent caller-IP ranking effects, and report any inability to reproduce that setting through MCP. Test direct-specific features in a separate, clearly labeled cohort.

Randomize pair order across cases and repeat each path at least three times across separate time windows. This detects nondeterminism without pretending that repeated calls create ground truth. Send calls sequentially or at a project-approved rate; do not manufacture a rate-limit event against production.

## Normalized record

Preserve raw sanitized responses, then map both paths into:

```text
run_id, case_id, path, attempt, request_shape_hash,
http_status, protocol_error, tool_is_error, gateway_error,
latency_ms, candidate_count,
candidates[index]: {
  formatted, address_line1, address_line2,
  lon, lat, place_id, result_type,
  housenumber, street, postcode, city, county, state, country, country_code,
  confidence, confidence_city, confidence_street, confidence_building,
  match_type, bbox
},
direct_only: { parsed_query, datasource },
timestamps
```

Normalize case, whitespace, Unicode, and absent-versus-null values only in derived comparison fields. Never overwrite the raw response. Coordinates compare both exact values and haversine distance; address strings compare exact normalized values and component-level differences.

## Measurable outcomes

Report counts and distributions, never invented success percentages:

- HTTP/protocol/tool success count by path and input class
- zero-result, one-result, and multi-result counts
- exact top `place_id` agreement count when both expose it
- top-coordinate distance distribution
- top formatted-address and component agreement counts
- overlap at ranks 1, 3, and 10 using `place_id`, with coordinates as a documented fallback
- rank/confidence/match-type field agreement and missingness
- candidate-order stability across repetitions
- latency median, percentile distribution, and raw sample count, separated by server region and time window
- response payload size and number of retained evidence fields
- credit consumption from project telemetry, not inferred when telemetry is absent
- error classification counts
- human-review outcome counts using a blinded review rubric
- for MCP-assisted context, number of cases where an extra tool call produced relevant, irrelevant, contradictory, or no additional context, plus its added latency and credits

Accuracy is measured only for cases with an independently sourced reference and an explicit tolerance. Candidate agreement between two Geoapify interfaces is consistency, not accuracy.

## Uncertainty policy under test

Use a versioned, configurable policy and report each triggered reason. Candidate reasons include:

- no candidate returned;
- top result is coarser than the requested/parsed type;
- absent or low overall/component confidence under an explicitly experimental threshold;
- requested house number/street/postcode not present in the selected candidate;
- two leading candidates are both plausible under a defined closeness rule;
- paired paths disagree on top `place_id` or exceed a defined coordinate distance;
- response omits evidence needed to make a decision.

Thresholds must be calibrated on a development subset and frozen before evaluating the holdout subset. The UI/output must say “review recommended,” never “invalid,” unless an independent validation source establishes invalidity.

Policy version `1.0.0` additionally requires an operator-selected country for batch processing. Apply the same hard country restriction to direct `countrycodes` and MCP `country_codes`; do not infer it from caller IP or provider output. Missing country context, empty results, multiple candidates, and provider disagreement remain human-review conditions. Coordinates or confidence can never auto-approve dispatch; `ready` requires an explicitly selected preserved candidate and explicit human confirmation. See [location-context-policy.md](location-context-policy.md).

## Error injection and classification

| Scenario | Safe method | Classification |
|---|---|---|
| Invalid input | Use schema boundary cases | Client/contract validation, not geographic uncertainty |
| Missing/invalid key | Use a deliberately invalid test token, never a real key in logs | Authentication error |
| Network failure | Point the harness at a local fault proxy or non-routable test host; do not alter the case | Transport error |
| Timeout/reset | Local proxy injects timeout or connection reset | Transport error |
| HTTP 429 handling | Mock/replay a schema-valid 429 or use a Geoapify-provided test mechanism; do not intentionally flood production | Rate/quota error |
| HTTP 500 handling | Mock/replay a schema-valid 500 | Service error |
| MCP tool validation error | Add an unsupported property or omit required input | Tool error, even if HTTP 200 |
| JSON-RPC error | Use an unknown method/tool in a limited contract test | Protocol error |
| Zero results with successful response | Valid request returning zero candidates | Geographic/data uncertainty |
| Conflicting candidates | Compare successful normalized responses | Geographic/ranking uncertainty; not a service outage |

Retry only transient transport, `429`, and `5xx` categories, with capped exponential backoff, jitter, and `Retry-After` support if present. Do not retry invalid inputs, authentication failures, or tool-validation errors automatically. Archive every attempt and never convert an exhausted retry into “address not found.”

## MCP-assisted investigation arm

For cases still marked review-needed after the paired lookup, allow a separately recorded agent workflow to:

1. inspect candidates;
2. optionally call `list_place_categories` then `search_places` near a candidate for a specifically justified category;
3. optionally call routing from a fixed depot coordinate to compare route connectivity;
4. produce a cited evidence summary without changing the underlying candidate fields.

The agent may recommend human review but may not auto-certify a destination. Compare the agent summary with a deterministic direct-API review screen for usefulness, unsupported inferences, tool-call count, latency, credits, reproducibility, and reviewer agreement.

## Reproducibility artifacts

Future implementation must publish:

- synthetic input corpus and schema
- harness source and dependency lockfile
- setup instructions using `GEOAPIFY_API_KEY`
- redaction rules
- contract hashes and captured `tools/list`
- raw-response schema and normalized-output schema
- one command for offline mocked tests and one for credentialed live tests
- timestamped result report with failed cases included

Raw live responses need a retention period and access policy before collection.
