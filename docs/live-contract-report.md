# Yaki Phase 2 live contract report

Run date: 2026-10-18

Decision: **GO**
Scope: Geoapify direct Forward Geocoding and MCP contract verification only; no frontend was built.

Historical note: this report is the Phase 2 record. “No frontend was built” describes the scope at the time, not the current repository; Phase 3 subsequently implemented the application. Counts in this file remain Phase 2 counts and should not be substituted for the current release-candidate results in [phase4-release-report.md](phase4-release-report.md).

## Executive result

Real authenticated calls worked through both the direct API and Geoapify MCP. All three officially documented MCP authentication forms succeeded. The initial paired live run completed for four public/synthetic inputs, and its pre-remediation automated suite passed 12/12 tests. After the country-policy remediation, the final Phase 2 suite passed 19/19 tests.

The original result was **REVISE** because ambiguous-query ranking lacked an explicit country context and `.env.txt` duplicated the credential. Final remediation implemented a mandatory batch-country policy, applied the same country restriction to both provider paths, verified it with a focused live run, and confirmed that `.env.txt` is absent. Phase 2 is now **GO for review and the next approved phase**; this report does not authorize or claim a completed frontend.

| Area | Status | Evidence |
|---|---|---|
| `GEOAPIFY_API_KEY` available | **PASS** | A non-empty value loaded from `.env`; its value was never printed. |
| `.env` ignored/untracked | **PASS** | `git check-ignore` succeeds and `git ls-files -- .env` returns nothing. |
| Live direct geocoding | **PASS** | Four requests completed and returned documented response envelopes. |
| Live MCP authentication | **PASS** | `x-api-key`, `Authorization: ApiKey`, and query `apiKey` each discovered 11 tools. |
| Live MCP geocoding | **PASS** | Four `geocode_address` calls completed through JSON-RPC. |
| Equivalent-input comparison | **PASS with limitation** | Query, language, and limit match; direct neutral country bias has no MCP equivalent. |
| Ambiguous query without explicit country | **FAIL retained as evidence** | Candidate counts/rankings differed for `Springfield`; neither path is proven more accurate. |
| Country-restricted remediation | **PASS** | With operator-selected `US`, both paths returned the same five candidates in the same order. |
| Automated tests | **PASS** | 19 passed, 0 failed, 0 skipped. |
| Credential containment | **PASS** | No key in shareable files/artifacts or Git history; `.env.txt` is absent. |

## Commands and outcomes

```powershell
npm.cmd run test:mcp-auth
npm.cmd run test:live
npm.cmd run test:live-country
npm.cmd test
```

- The first sandboxed authentication attempt was **BLOCKED** by the execution environment's network restriction. This was a local environment condition, not a Geoapify response.
- The authorized network rerun of `test:mcp-auth` was **PASS** for all three authentication modes; each returned 11 tools.
- `test:live` was **PASS** and wrote [the sanitized evidence artifact](../artifacts/live-contract-results.json).
- `test:live-country` was **PASS** using two geocoding calls and wrote [country-policy evidence](../artifacts/country-policy-live-results.json).
- The final complete automated run was **PASS**: 19 passed, 0 failed, 0 cancelled, 0 skipped.

No production rate limit was deliberately triggered. Network, `429`, `500`, `401`, JSON-RPC, and MCP tool error paths were exercised with controlled mocks.

## MCP authentication and discovery

The live `tools/list` response contained these 11 names:

`geocode_address`, `geocode_structured_address`, `reverse_geocode_coordinates`, `search_places`, `list_place_categories`, `calculate_route`, `calculate_route_matrix`, `combine_geometries`, `evaluate_spatial_relation`, `measure_geometry`, and `transform_geometry`.

| Authentication mode | Live status | Tool count |
|---|---:|---:|
| `x-api-key` header | **PASS** | 11 |
| `Authorization: ApiKey ...` header | **PASS** | 11 |
| `apiKey` query parameter | **PASS** | 11 |

Yaki should continue to use `x-api-key` in its normal server-side path. Query authentication was tested only because it is documented; credential-bearing URLs have a higher logging/history exposure risk. OAuth remains undocumented/unsupported in the inspected Geoapify MCP guide.

## Actual paired live results

All normal paired calls used `limit=5` and `lang=en`. Direct calls used `bias=countrycode:none`; MCP exposes no corresponding neutral-bias argument. Coordinates below are `(longitude, latitude)`. Confidence and match fields are Geoapify geocoding evidence, not delivery certainty.

### Complete public address — PASS

Input: `200 Larkin Street, San Francisco, CA 94102, United States`

Direct and MCP returned the same two candidates, with identical `place_id` values and zero top-coordinate distance:

| Candidate | Coordinates | Result type | Confidence (overall/city/street/building) | Match type |
|---|---|---|---|---|
| Asian Art Museum of San Francisco, 200 Larkin Street, San Francisco, CA 94102, United States | `(-122.4159922, 37.780315)` | `amenity` | `1 / 1 / 1 / 1` | `inner_part` |
| Asian Art Museum Cafe, 200 Larkin Street, San Francisco, CA 94102, United States | `(-122.4160624, 37.780058)` | `amenity` | `1 / 1 / 1 / 1` | `inner_part` |

Direct parsed-query evidence: house number `200`, street `larkin street`, postcode `94102`, city `san francisco`, state `ca`, country `united states`, expected type `building`. MCP returned the normalized query but no parsed-query object. Candidate overlap was 2/2.

### Ambiguous location — FAIL for equivalence; both calls completed

Input: `Springfield`

The neutral-bias direct call returned zero candidates and parsed the input as city `springfield` with expected type `unknown`. MCP returned five candidates:

| MCP candidate | Coordinates | Result type | Confidence | Match type |
|---|---|---|---:|---|
| Springfield, VT 05156, United States | `(-72.478095, 43.296139)` | `postcode` | `1` | `full_match` |
| Springfield Reservoir Dam, Weathersfield, VT 05151, United States | `(-72.4895028, 43.3511965)` | `amenity` | `1` | `full_match` |
| Springfield Town Forest, Springfield, NH, United States | `(-72.0670475, 43.5417604)` | `amenity` | `1` | `full_match` |
| Springfield Town Forest, Springfield, VT, United States | `(-72.465398, 43.3081392)` | `amenity` | `1` | `full_match` |
| Springfield Police, 2750 Main Street, West Springfield, Springfield, NH 03284, United States | `(-72.047466, 43.4929845)` | `amenity` | `1` | `full_match` |

An additional controlled direct diagnostic using documented `bias=countrycode:auto` returned five US city candidates: Springfield, Illinois; Massachusetts; Missouri; Ohio; and Oregon. Their coordinates were `(-89.6439575, 39.7990175)`, `(-72.5886727, 42.1018764)`, `(-93.2922715, 37.2081729)`, `(-83.810138, 39.9234046)`, and `(-123.0220289, 44.0462362)` respectively.

This establishes two facts only: direct neutral bias caused the zero-candidate result, and MCP/direct ranking still differed when automatic country bias was tried. It does **not** establish which result is geographically preferable. A future experiment must supply explicit country/location context where available and treat an unqualified place name as unresolved.

### Incomplete address — PASS

Input: `10 Downing Street`

Both paths returned the same single candidate and `place_id`: `10 Downing Street, London, SW1A 2AA, United Kingdom`, at `(-0.1276965, 51.5034878)`, result type `amenity`, confidence `1 / 1 / 1 / 1`, match type `inner_part`. Top-coordinate distance was zero and overlap was 1/1.

Direct parsed-query evidence contained house number `10`, street `downing`, and expected type `building`. MCP returned the normalized query but no parsed-query object.

### Invalid/nonsense input — PASS

Input: `this-is-not-a-real-address-yaki-7f3c91`

Both paths completed without a service error and returned zero candidates. Direct parsed the token as a postcode with expected type `unknown`; MCP returned only the normalized query. Zero results are recorded as geographical/no-match evidence, not as an HTTP, JSON-RPC, or MCP tool failure.

## Country-context remediation result — PASS

The focused live run used `Springfield` with operator-selected country `US`. The direct request sent `countrycodes=us`; MCP sent `country_codes: ["us"]`. Both paths returned the same five city candidates in the same order: Springfield in Illinois, Massachusetts, Missouri, Ohio, and Oregon. Candidate overlap was 5/5, top `place_id` matched, and top-coordinate distance was zero.

All five candidates had confidence `1` and `full_match`. The Yaki policy still returned `review_required`, with reasons `multiple_candidates` and `human_confirmation_required`; `readyForDispatch` remained `false`. This demonstrates the intended boundary: country restriction improves contextual consistency but does not select the intended city or establish delivery certainty.

Policy version `1.0.0` is implemented in `src/location-policy.ts` and documented in [location-context-policy.md](location-context-policy.md). Batch calls reject missing country selection before network access. Empty results require clarification; multiple candidates and meaningful provider disagreements remain preserved; coordinates/confidence never auto-approve; `ready` requires an explicit preserved-candidate selection and human confirmation.

## Response-shape findings

- Direct JSON preserved candidates, coordinates, address components, `place_id`, `result_type`, rank confidence fields, `match_type`, and parsed-query evidence.
- MCP `structuredContent` preserved the compared candidate fields and a normalized `query`, but did not expose direct API parsed-query evidence in these calls.
- The direct complete and incomplete cases exactly matched MCP by `place_id` and coordinates.
- MCP did not provide verified enrichment beyond the direct address lookup for these cases.
- A confidence value of `1` was observed on both sensible and ambiguous candidates. It must never be presented as delivery certainty, postal validation, or proof of the correct entrance.

## Error handling

| Scenario | Method | Status/result |
|---|---|---|
| Empty query | Local validation | **PASS:** rejected before fetch. |
| Network failure | Controlled throwing fetch | **PASS:** bounded retries, then `NetworkRequestError`. |
| HTTP 429 | Controlled response | **PASS:** honored `Retry-After` through a non-sleeping test hook, then retried. |
| HTTP 500 | Controlled response | **PASS:** distinct `HttpResponseError`. |
| HTTP 401 | Controlled response | **PASS:** distinct from geographic uncertainty. |
| JSON-RPC error | Controlled JSON-RPC envelope | **PASS:** distinct `JsonRpcResponseError`. |
| MCP tool error | HTTP 200 with `result.isError=true` | **PASS:** distinct `McpToolResponseError`. |
| Live test cases | Real service | **PASS:** no HTTP, JSON-RPC, or tool errors occurred. |

## Security audit

Passed controls:

- `.env` is ignored and untracked.
- The repository has zero commits, so no credential is present in Git history.
- The exact real key does not occur in source, documentation, tests, or the live evidence artifact.
- The artifact contains no `apiKey` URL parameter, credential-bearing request header, or header value. It records only the authentication method name (`x-api-key header`).
- Console output redacted the key and did not print request URLs or headers.
- Normal live traffic used server-side `x-api-key` headers.
- Public landmarks and a synthetic nonsense string were used; no customer data was submitted.
- The live-contract harness itself uses only Node.js APIs. The repository now has one development-only package, `playwright-core`, for browser verification; it is not part of the application runtime or the Geoapify contract harness.

Final remediation:

- `.env.txt` was already absent when remediation ran. Only `.env` and `.env.example` exist. `.env` is ignored, untracked, and still contains the working key without exposing it.

Pattern-only scanner matches in tests/docs were inspected and were fake test literals or documentation syntax, not real credentials.

## Evidence and reproducibility limitations

- The raw provider response is normalized before persistence; undocumented fields and MCP text content are intentionally not retained.
- Results are a time-stamped sample, not an accuracy benchmark. Provider data and ranking can change.
- The paired direct/MCP inputs cannot be perfectly equivalent because MCP has no documented neutral-bias argument.
- No live quota exhaustion, destructive failure, batch geocoding, structured geocoding, reverse geocoding, or private operational data was tested.
- Artifact retention/access policy remains undefined; continue using only public or synthetic inputs.
- The automatic-bias diagnostic was a single additional call and was not added to the paired artifact schema.

## Remaining limitations

1. The focused country-restriction result is one public US case, not a general accuracy benchmark.
2. Extend the experiment artifact schema if automatic-bias diagnostics need repeatable retention.
3. Define artifact retention and access controls before using customer addresses.
4. At the Phase 2 gate, this report required review before frontend work. That review occurred before the later Phase 3 implementation.

## Decision

**GO.** Phase 2 contract verification and its two named remediations are complete: the redundant credential copy is absent, and the explicit country-context/human-confirmation policy is implemented, tested, documented, and focused-live-verified. GO means the findings may proceed to human review and the next approved implementation phase. It does not start frontend development, permit customer data before privacy/retention approval, establish that MCP is more accurate, or prove deliverability.
