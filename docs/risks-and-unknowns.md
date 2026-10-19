# Risks and unknowns

Assessment date: 2026-10-18. Updated with application status on 2026-10-19.

This register separates risks supported by observed results from questions the project cannot answer yet. Priority combines potential user harm, program failure, and implementation uncertainty. “Resolved” means the named repository issue was corrected; it does not turn geocoding into proof of deliverability or make the application production-ready.

| Priority | Risk / unknown | Current evidence | Required mitigation or answer |
|---|---|---|---|
| Critical | Geocoding mistaken for deliverability | Geoapify documents match confidence, not postal or parcel deliverability. Competitors expose distinct validation products/verdicts. | Use review language, prohibit validity guarantees, retain raw signals, and test copy with users. |
| Critical | Secret leakage | Direct APIs allow query keys; MCP docs show query auth while OpenAPI declares header auth. Batch pending URLs may echo query-authenticated keys. | Prefer server-side header auth, redact URLs/headers, never persist returned polling URLs containing keys, and test redaction. |
| Medium | MCP authentication documentation changed during discovery | Current docs list query `apiKey`, `x-api-key`, and `Authorization: ApiKey`; earlier downloaded 1.1.0 files appeared narrower. All three forms succeeded live on 2026-10-18. | Prefer `x-api-key`, keep the runtime discovery test, and recheck official docs/specifications before release. |
| Medium | Direct/MCP ambiguity behavior can differ without explicit context | In the original live run, neutral-bias direct geocoding returned no `Springfield` candidates while MCP returned five. With an explicit US restriction in the remediation run, both returned the same five city candidates. | Implemented: batch requires operator-selected country; both paths receive the restriction; multiple candidates/disagreements require human review. Continue testing other countries. |
| Resolved | Duplicate local credential file | `.env.txt` was reported previously but was absent at final remediation. `.env` remains ignored/untracked and exact-key scans found no shareable-file copy. | Keep `.env` and `.env.*` ignored and repeat secret scans before release. |
| High | Confidence thresholds may mislead | Geoapify says low confidence can still be correct and gives only an adjustable example. | Calibrate per geography/use case, show reasons, preserve an unresolved state, and never call scores probabilities. |
| High | Multiple candidates may be superficially different | No candidate deduplication semantics are documented. | Define place-ID and coordinate/address similarity rules; show raw candidates when uncertain. |
| High | CSV contains personal or dangerous spreadsheet data | Operational address lists can contain personal data and formula payloads. | Minimize columns, validate size/encoding, isolate bad rows, escape output formulas, define retention/deletion. |
| High | Batch job loss or duplicate work | Jobs are asynchronous and generic results are documented as temporary (24 hours). | Store job metadata and row IDs, checkpoint, use idempotent local state, and copy completed sanitized results into project storage. |
| High | Service failures become false address judgments | MCP tool errors may arrive as HTTP 200; both paths can return 429/500. | Use a typed error taxonomy and never feed service failure into the uncertainty score. |
| High | Competition deadline/application status | Official page states applications close 2026-10-20 23:59 UTC; today is 2026-10-18 in the supplied context. Selection/application status is unknown. | Confirm application eligibility/status immediately. Do not represent discovery work as a finished submission. |
| Medium | Structured MCP accepts no required address field | Focused schema declares all address components optional. Runtime empty-object behavior is unknown. | Reject empty input locally and add a contract case; submit spec feedback if behavior/schema differs. |
| Medium | Direct and MCP inputs are not fully symmetric | Direct supports limit 100 and rich filters/bias; MCP geocoding limit is 10 with country filters. | Normalize paired cases to the common subset; test direct-only features separately. |
| Medium | MCP result is less detailed | Focused output omits some full direct evidence such as parsed query/datasource. | Use direct responses for production audit evidence; measure missingness in the experiment. |
| Medium | Default IP country bias affects reproducibility | Direct geocoding documentation notes `countrycode:auto` default bias. MCP equivalent control is not exposed. | Fix server/region, use explicit country filters or neutral bias when supported, and record the asymmetry. |
| Medium | Result/data drift | OSM-derived/location data, rankings, specs, and MCP tool discovery can change. | Timestamp runs, hash specs, capture tools, retain raw results, and avoid brittle golden snapshots for provider content. |
| Medium | `place_id` stability is undocumented here | The inspected geocoding contract returns `place_id` but does not promise permanence. | Do not use it as the sole durable business identifier; preserve address and coordinates too. |
| Medium | Entrance/access point is unknown | Building coordinates and route existence do not identify loading bays, gates, or legal access. | Add operator notes/manual pin only as user-provided data; label it separately from provider evidence. |
| Medium | Nearby POIs cause false corroboration | A landmark near a candidate does not prove the address. | Keep contextual MCP findings separate and require a specific reason for every extra tool call. |
| Medium | User value/distinction is untested | Competitors already offer validation, batch, candidate, and delivery tooling. | Interview small delivery operators and test whether pre-dispatch evidence/audit reduces avoidable calls or failed dispatches. |
| Medium | Costs and quotas vary by project | Official guidance says active project limits should be read in MyProjects. | Make rate, concurrency, batch strategy, and spending ceiling configurable; add usage telemetry. |
| Medium | Data residency/privacy assumptions | EU endpoint is described as EU-focused processing, but end-to-end storage/subprocessor obligations were not audited. | Review Geoapify legal/privacy terms and Yaki hosting/logging before processing customer data. |
| Low | Documentation typo/enum coupling | Published `match_by_city_or_disrict` contains that exact spelling. | Generate from the spec and tolerate only documented values; report upstream typo without silently renaming raw data. |

## Outstanding questions for Geoapify

1. Which MCP authentication mechanisms are contractually supported now: query `apiKey`, header `x-api-key`, or both, and which should browser/non-browser clients prefer?
2. Is an empty `geocode_structured_address` argument object intentionally valid? If so, what result/error is promised?
3. Are the top-level MCP result `confidence` and `rank.confidence` always identical? Which is canonical?
4. What stability, if any, is promised for geocoding `place_id` values?
5. Can the default country/IP bias be explicitly disabled through MCP for reproducible comparisons?
6. Does the MCP geocoding wrapper call the same underlying endpoint/version/ranking configuration as direct v1 geocoding?
7. Are per-tool MCP rate limits identical to the underlying API project limits?
8. What retention policy applies to MCP request content and batch job inputs/results on each server region?
9. Is there a documented way to retrieve parsed-query evidence through MCP?
10. Are dedicated batch `priority` semantics (0.01–1) intentionally different from generic batch (0.5–1)?

## Outstanding product questions

1. Which countries and address systems matter to the first users?
2. What error costs more operationally: reviewing too many good addresses or dispatching to one bad destination?
3. Which evidence can a nontechnical dispatcher understand and act on quickly?
4. Should manual edits be re-geocoded automatically, only on request, or never without confirmation?
5. Must reviewed coordinates be editable on a map, and how will user-set pins be distinguished from provider results?
6. What audit retention is necessary, and who may access or delete it?
7. What CSV schemas, encodings, row volumes, and locale formats occur in reality?
8. Is MCP part of the shipped workflow or only the competition experiment? Current evidence favors direct API for the production MVP and MCP as an optional investigation arm.

## Historical decision gates before Phase 3 implementation

These were the gates recorded before the frontend was built. The key, country policy, wording, and synthetic/public test-data gates were addressed during Phases 2 and 3. Competition status, production privacy approval, and a broader pilot remain unresolved.

- Confirm competition/application status and licensing plan.
- Obtain an authorized test key and project quota details.
- Preserve the verified MCP authentication behavior in regression tests and prefer `x-api-key`.
- Approve product wording that avoids validation/deliverability claims.
- Approve a privacy model and synthetic test corpus.
- Run the contract harness and a small pilot before designing the full frontend.

## Phase 3 application risk update

The local application now mitigates the country-context, secret-in-browser, silent-approval, CSV formula, and default-persistence risks through executable controls and tests. Remaining deployment risks are explicit:

- The server has no authentication or multi-user isolation and must remain local until a hosting/security design is approved.
- Rate limiting is in-memory and per process; it is not a distributed public abuse control.
- Review history intentionally disappears on refresh. A future durable audit store requires a retention, access, and deletion model before implementation.
- Automated semantic, focus, responsive, and keyboard-path checks passed, but no formal WCAG or assistive-technology audit was performed.
- The coordinate preview is not an entrance map, road-access assessment, or proof of deliverability.
- Sequential CSV checks do not resume after refresh and can be slow near the 500-row limit.
- Geoapify receives address queries; legal basis, privacy notice, endpoint/region, and processor terms require approval before customer data.
