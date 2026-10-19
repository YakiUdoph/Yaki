# Acceptance criteria

This checklist began before the application existed and deliberately preserves that larger product and experiment scope. A blank box still means “not demonstrated,” but it does not necessarily mean the current release candidate is broken: several items describe future batch APIs, durable storage, operational deployment, or research publication that version `0.4.0` intentionally does not claim.

Use the dated evidence sections near the end for the implemented local application. The earlier sections remain the original standard against which future work can be judged, rather than being retroactively rewritten to make the project look complete.

## Functional correctness

- [ ] A user can investigate one free-form address and see zero, one, or several real candidates without fabricated fallback data.
- [ ] CSV import requires an explicit preview and column mapping; malformed rows are isolated rather than silently dropped.
- [ ] Structured and free-form inputs are sent through the correct mutually exclusive request modes.
- [ ] Batch jobs preserve source-row identity, order, per-item errors, and polling state.
- [ ] A reviewer can accept a candidate, edit a dispatch address, mark unresolved, or request customer contact.
- [ ] Exports preserve original input, reviewed output, coordinates, disposition, evidence, reviewer timestamp, and error status.
- [ ] Empty results, partial results, and duplicate candidates have tested behavior.

## Direct API contract compliance

- [ ] Clients are generated or validated against the pinned official OpenAPI 3.1 specifications.
- [ ] Forward, reverse, dedicated batch, and generic batch paths and parameter types match the published contracts.
- [ ] Candidate limits, coordinate ranges, string lengths, enums, and batch size 1–1000 are validated before calls.
- [ ] JSON versus GeoJSON envelopes are parsed according to requested format.
- [ ] `200`, `202`, `400`, `401`, `404`, `429`, and `500` are handled where documented.
- [ ] Batch polling is bounded, respects the recommended interval for large jobs, and tolerates immediate `200` completion.
- [ ] Plan-specific rate/quota settings are configuration, not constants copied from examples.

## MCP contract compliance

- [ ] The client initializes, calls `tools/list`, and records the runtime tool schemas before the experiment.
- [ ] Tool names and arguments exactly match runtime discovery and the pinned focused specifications.
- [ ] `additionalProperties: false` is respected.
- [ ] The default/explicit protocol version behavior is tested.
- [ ] Header and query authentication documentation is reconciled by a recorded contract test; production uses the safer supported option.
- [ ] Code distinguishes HTTP failures, JSON-RPC `error`, and HTTP-200 `result.isError` tool failures.
- [ ] `structuredContent` is parsed; text content is not trusted as a richer independent result.
- [ ] No batch MCP capability is claimed unless later runtime discovery documents one.

## Honest uncertainty reporting

- [ ] UI and exports call results candidates/matches, not verified or deliverable addresses.
- [ ] Raw confidence, level confidence, match type, result type, candidate count, and component differences remain inspectable.
- [ ] Every Yaki review flag names the policy version and triggering signals.
- [ ] Thresholds are configurable, empirically evaluated, and never described as Geoapify guarantees.
- [ ] `full_match`, high confidence, and building result type are not presented as postal or entrance verification.
- [ ] Service, authentication, quota, and transport errors are never displayed as “address invalid” or “not found.”
- [ ] Direct/MCP agreement is reported as consistency, not ground-truth accuracy.

## Error handling and resilience

- [ ] Retries are restricted to transient categories, bounded, jittered, and honor `Retry-After` when present.
- [ ] Invalid input and authentication errors are not blindly retried.
- [ ] Interrupted CSV/batch processing can resume without duplicating completed work.
- [ ] A failed row does not fail or falsely complete the entire import.
- [ ] Raw sanitized evidence is retained for diagnosis under an approved retention policy.
- [ ] Mocked tests cover timeouts, resets, 429, 500, malformed responses, JSON-RPC errors, and tool errors.

## Security

- [ ] Private keys come from environment variables or a secret manager and never enter source control.
- [ ] Keys are redacted from logs, traces, URLs, screenshots, exceptions, exports, and fixtures.
- [ ] Server-side calls use `x-api-key` where supported; any browser key is origin/referrer-restricted and separately reviewed.
- [ ] Uploads have file-size, row-count, encoding, type, and formula-injection protections.
- [ ] Exported CSV neutralizes spreadsheet formulas beginning with `=`, `+`, `-`, or `@`.
- [ ] User-supplied text and provider fields are escaped before HTML rendering.
- [ ] Dependencies are locked and scanned; logs do not contain secrets or unnecessary personal data.

## Privacy

- [ ] Data minimization excludes customer names, phones, order contents, access codes, and delivery notes from geocoding queries.
- [ ] Consent/lawful basis, retention, deletion, and access policies are documented before real customer data is used.
- [ ] EU endpoint choice and actual processing/storage implications are reviewed rather than assumed from hostname alone.
- [ ] Public test fixtures are synthetic; private fixtures have access controls and provenance.
- [ ] The UI explains that address data is sent to Geoapify and links applicable privacy terms.

## Reproducibility and documentation

- [ ] The repository includes a permissive open-source license approved by the project owner.
- [ ] README includes architecture, prerequisites, setup, configuration, exact run commands, and troubleshooting.
- [ ] One command runs offline contract/unit tests; another explicitly runs credentialed live tests.
- [ ] OpenAPI files/URLs, versions, hashes, runtime tools, environment, and run timestamps are recorded.
- [ ] The public corpus, normalization algorithm, metrics, and all failed cases are published.
- [ ] Known limitations, unsupported claims, and unresolved questions remain visible.
- [ ] Prompts, agent instructions/tool traces, human corrections, and lessons learned are captured with secrets removed.

## Official Batch #2 requirements

Based on the [official program requirements](https://www.geoapify.com/open-geospatial-program/):

- [ ] Public code repository with meaningful Geoapify OpenAPI and/or MCP use.
- [ ] Open-source license (MIT preferred by the program, or another permissive license).
- [ ] Runnable application, script, agent, component, or reproducible workflow; hosted demo is optional.
- [ ] README with architecture, setup, configuration, and step-by-step run instructions.
- [ ] Public tutorial or walkthrough explaining construction and Geoapify use.
- [ ] Prompts, agent instructions, skills, or AI workflow, including what worked and was difficult.
- [ ] Concrete feedback and suggestions for Geoapify OpenAPI/MCP.
- [ ] Core flows tested, code readable/reusable, dependencies/build documented, and limitations/edge cases listed.
- [ ] Submission includes repository, setup/run path, demo/runnable workflow, tutorial, architecture, Geoapify usage, release license/version/tag/commit, and known limitations.
- [ ] Private keys are hidden in documentation and screenshots. A public demo key is committed only if Geoapify explicitly provides and authorizes it for that purpose.

## Release gate

- [ ] A reviewer who did not build Yaki can reproduce the core flow from a clean checkout without undocumented fixes.
- [ ] All critical criteria above pass, or the README explains a program-appropriate equivalent.
- [ ] No claim exceeds the evidence in a captured provider response or an independently sourced reference.

## Phase 2 remediation evidence

- [x] `.env` supplies the live key while remaining ignored and untracked; no value is logged.
- [x] The redundant `.env.txt` copy is absent.
- [x] Direct `countrycodes` and MCP `country_codes` restrictions are covered by automated and focused live tests.
- [x] Batch preparation rejects a missing operator-selected country before provider calls.
- [x] Empty, multiple-candidate, and conflicting-provider results have automated policy tests.
- [x] Candidate arrays and provider disagreement remain preserved in the policy decision evidence.
- [x] Confidence and coordinates cannot auto-approve dispatch.
- [x] `ready` requires explicit candidate selection and human confirmation.
- [x] Final Phase 2 automated suite passes 19 tests with no failures.

## Phase 3 local application evidence

- [x] One address or a CSV can enter a real review queue without fabricated provider data.
- [x] CSV parsing enforces 1 MB, 500-row, 50-column, and field-length limits; malformed rows are visible.
- [x] CSV column selection and five-row preview occur before checking.
- [x] Batch checking requires one operator-selected country and sends it as `countrycodes`.
- [x] Direct Geoapify calls remain server-side and preserve multiple candidates and original input.
- [x] `Needs review`, `Ready`, `No match`, and `Check failed` are distinct states.
- [x] A reviewer can select a candidate, edit/recheck, leave unresolved, or explicitly confirm ready.
- [x] Review history contains only actual actions and timestamps; no operator identity is invented.
- [x] Ready and unresolved CSV exports are separate and neutralize spreadsheet formulas.
- [x] Clear session removes country, file, records, decisions, and history from browser memory.
- [x] No analytics, session replay, external fonts, browser storage, or server address database is present.
- [x] CSP, security headers, body validation, same-origin API use, and process-local rate limiting are implemented.
- [x] Geoapify and OpenStreetMap attribution are visible.
- [x] The normal application uses one direct provider call per check; MCP remains a documented experiment.
- [x] MIT license, architecture, setup, walkthrough, genuine test evidence, and known limitations are present.
- [x] Automated suite passes 33 tests; Edge E2E and one-call live application verification pass.
- [ ] Formal WCAG/assistive-technology audit is complete.
- [ ] Public-hosting identity, TLS, distributed abuse protection, monitoring, and retention/deletion controls are approved.

## Phase 4 release-candidate evidence

- [x] Static assets and the geocoding/health routes have Vercel-compatible entry points and contract tests.
- [x] `GEOAPIFY_API_KEY` remains server-side and is documented as a sensitive Vercel environment variable without a browser-public prefix.
- [x] Automated suite passes 37 tests; browser and clean-profile security checks pass.
- [x] The current live application check covers two public addresses and keeps both in human review.
- [x] The Gata/Connect Wallet panel was attributed to a specific Chrome extension rather than Yaki source.
- [ ] A linked Vercel production build has completed.
- [ ] A public deployment URL has passed live address, secret-exposure, and clean-profile checks.
- [ ] Distributed production rate limiting and operational monitoring are configured.
