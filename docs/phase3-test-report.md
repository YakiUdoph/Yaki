# Phase 3 implementation and test report

Run date: 2026-10-18

Application version: `0.3.0`
Decision: **GO for local judging and continued review; not production-ready**

Historical note: this report captures version `0.3.0`. Its 33-test count and one-address live check are accurate for that run; version `0.4.0` later expanded the suite to 37 tests and the live application check to two public addresses. See [phase4-release-report.md](phase4-release-report.md) for the newer release-candidate snapshot.

## Executed results

| Area | Command/method | Outcome |
|---|---|---|
| Full automated suite | `npm.cmd test` | **PASS:** 33 tests, 0 failures after fixes. |
| Browser end-to-end | `npm.cmd run test:browser` | **PASS:** real Edge, explicit mock provider, no quota consumed. |
| Live application path | `npm.cmd run test:app-live` | **PASS:** one real provider request through browser-facing HTTP API; 2 candidates, `needs_review`, not ready. |
| Desktop visual inspection | Edge headless, 1440×1100 | **PASS:** homepage rendered; screenshot retained. |
| Compact visual inspection | Edge headless, 500×900 plus 390px emulation test | **PASS after responsive fix:** no horizontal overflow at emulated 390px. |
| Workspace inspection | Edge headless, 1440×3000 | **PASS after hidden-state fix:** CSV preview stays hidden until a file is selected. |
| Credential scan | Exact in-memory key comparison | **PASS:** zero matches outside ignored `.env`. |

## Coverage

Automated tests cover:

- CSV BOM/quoting/embedded newlines, malformed rows, nulls, file-size and row limits;
- country restriction and missing-country rejection;
- ambiguous candidates, zero candidates, provider failures, bounded retry/rate behavior;
- candidate selection and explicit human confirmation;
- edit/recheck while preserving the original address;
- truthful timestamped history actions;
- separate ready/unresolved exports, UTF-8 BOM, quoting, and formula-injection protection;
- key redaction and absence from browser-facing responses;
- CSP/security headers, request limits, and no persistence endpoint contract;
- clear-session state reset;
- semantic controls, skip link, focus styling, responsive CSS, and safe DOM rendering;
- real Edge interaction across country selection, check, candidate selection, confirmation, history, clear session, keyboard first-focus, and a 390px viewport overflow assertion.

## Live result

The controlled live application request checked the public Asian Art Museum address with operator-selected country `US`. HTTP returned `200`, the application returned `needs_review`, and two real candidates were preserved. Policy reasons were `multiple_candidates` and `human_confirmation_required`; `readyForDispatch` was `false`. The API key did not appear in the response or artifact. Evidence is in `artifacts/app-live-e2e-results.json`.

This is a contract and workflow result, not an accuracy percentage or delivery guarantee.

## Failures found and fixed

1. The first 33-test run had one false-positive assertion because visible “No analytics” copy matched the word `analytics`. The test was corrected to inspect actual external script/stylesheet URLs. Final result: 33/33.
2. Initial compact capture clipped the layout under the Windows headless browser's narrow-window behavior. Grid minimum sizing was constrained, and the browser E2E test then verified a true emulated 390px viewport has no horizontal overflow.
3. The workspace capture showed the generic `.panel` rule overriding HTML's `hidden` state, exposing an empty CSV preview. A global `[hidden]` rule and regression assertion fixed it.

## Security and compliance result

- No third-party analytics, fonts, scripts, map tiles, or session replay.
- No server-side address persistence or browser storage.
- No credential in browser assets, responses, tests, docs, logs, or artifacts.
- Geoapify and OpenStreetMap attribution are visible.
- MIT license added.
- Existing MCP comparison remains documented and outside the per-address application path.

## Remaining limitations

- Formal assistive-technology/WCAG audit was not performed; automated semantic and keyboard checks are not a substitute.
- The local coordinate preview is not an interactive street map and does not show entrances or access routes.
- CSV checks run sequentially and cannot resume after a page refresh.
- There is no authentication, multi-user isolation, durable audit history, or public-hosting hardening.
- The in-memory rate limit is single-process and not suitable as the only public abuse control.
- Only one controlled live application case was executed to minimize quota use.
- Privacy/legal review is still required before real customer addresses are processed.

## Decision

**GO for local judging and the next reviewed development step.** The required local workflow is functional and evidence-backed. **REVISE before public or production deployment** because identity, durable retention/deletion, distributed abuse controls, formal accessibility, operations, and legal/privacy review are intentionally out of scope.
