# Yaki

**The last check before dispatch.** Yaki is an address-review application for delivery coordinators. It accepts one address or a CSV, requires an operator-selected destination country, retrieves real Geoapify candidates through a server-side function, and keeps every uncertain result in a human review queue.

The repository supports local development and Vercel deployment. Yaki does not claim postal validation, deliverability, entrance accuracy, or driver safety, and it is not approved for real customer data without the privacy and operational work listed below.

Public application: [https://yaki-seven.vercel.app/](https://yaki-seven.vercel.app/)

**Batch #2 tutorial:** [Which Springfield? Building Yaki, the Last Check Before Dispatch](docs/geoapify-batch2-tutorial.md) · [Live application](https://yaki-seven.vercel.app/) · [Reproducible walkthrough](docs/demo-walkthrough.md) · [Geoapify](https://www.geoapify.com/)

![Yaki desktop interface](artifacts/screenshots/yaki-desktop.png)

## Why Yaki exists

A geocoder can find a plausible point for an address without answering the question a delivery team actually has: “Is this the place we mean, and is it ready to hand to a driver?” Those are different claims. A high-confidence result may still name the wrong branch, represent a nearby amenity, omit an entrance, or return several places with the same name.

The development work exposed that distinction directly. An unrestricted search for `Springfield` produced different direct-API and MCP results depending on country bias. Adding an explicit `US` restriction made the two paths agree on five cities, but it still did not identify which Springfield the sender intended. Yaki therefore treats geocoding as evidence for a person to review, not as automatic delivery approval.

## What Yaki does

- Responsive landing page and address workspace written for nontechnical operators.
- Single-address checks and local CSV parsing with preview and explicit column selection.
- 1 MB, 500-row, 50-column, and field-length limits with malformed-input reporting.
- Mandatory country selection applied to Geoapify through `countrycodes`.
- Real server-side geocoding; the API key never enters browser code.
- Separate **Needs review**, **Ready**, **No match**, and **Check failed** outcomes.
- Multiple candidates, coordinates, match information, and original input preserved.
- Candidate selection, address correction/recheck, and explicit human confirmation.
- Local coordinate preview with no map-tile or tracking request.
- Truthful in-memory review history with real action timestamps.
- Separate ready/unresolved CSV exports with UTF-8 BOM and formula-injection protection.
- Clear loading, retry, empty, validation, and clear-session states.
- No analytics, external fonts, session replay, database, cookies, or browser storage.

A typical review starts with an address such as `200 Larkin Street, San Francisco, CA 94102`. In the recorded 2026-10-19 run, Geoapify returned the museum and café at that address, and Yaki approved neither automatically. The operator can select the intended result, confirm it explicitly, or edit and recheck the original text. CSV rows follow the same path one at a time and are exported as separate ready and unresolved files.

## Prerequisites

- Node.js 22.18 or later
- A Geoapify API key authorized for Geocoding API use

The application has no third-party runtime packages. `playwright-core` is a development-only dependency used by the browser verification scripts.

## Setup and run

```powershell
npm.cmd ci
Copy-Item .env.example .env
# Edit .env locally and replace the placeholder. Never commit the real value.
npm.cmd start
```

Open `http://127.0.0.1:4173`.

For restart-on-change development:

```powershell
npm.cmd run dev
```

Optional environment values:

```dotenv
GEOAPIFY_API_KEY=your_key_here
YAKI_PORT=4173
```

`.env` and `.env.*` are ignored while `.env.example` remains trackable.

## Deploy to Vercel

Yaki uses static files from `public/` plus Node.js Vercel Functions in `api/`. The local `app.listen()` server is not used in production.

1. Import this repository into Vercel or run `vercel.cmd link` from the repository root in PowerShell.
2. Add `GEOAPIFY_API_KEY` as a **sensitive server-side environment variable** for Production. Add a separate Preview value only if preview deployments need real checks.
3. Do not rename it to `NEXT_PUBLIC_*`, `VITE_*`, or otherwise expose it to the browser.
4. Run `vercel.cmd pull --yes --environment=production`, then `vercel.cmd build --prod` to reproduce the platform build.
5. Deploy the reviewed build. Full staged-release commands and rollback guidance are in [docs/deployment.md](docs/deployment.md).

`vercel.json` applies static routing, function duration/cancellation settings, and response security headers. `/api/geocode` accepts only same-origin JSON POST requests up to 16 KB and applies a bounded 60-request/minute in-instance fallback. Because serverless instances do not share memory, configure Vercel Firewall rate limiting for distributed enforcement before sustained public traffic.

## How to use it

1. Select the destination country. Yaki never infers it from IP address or provider ranking.
2. Enter one address or upload a CSV and choose its address column.
3. Wait while checks run sequentially.
4. Review every returned candidate. High confidence still does not mean deliverable.
5. Select one candidate and explicitly confirm it, edit and recheck, or leave it unresolved.
6. Export ready and unresolved rows separately.
7. Use **Clear session** when finished.

A reproducible public-data walkthrough is in [docs/demo-walkthrough.md](docs/demo-walkthrough.md). The sample file is [examples/addresses-us.csv](examples/addresses-us.csv).

## Architecture

The browser handles CSV files, review state, history, coordinate previews, and exports entirely in memory. It sends only one address plus the selected country to same-origin `POST /api/geocode`. Locally that route is handled by the Node development server; on Vercel it is handled by `api/geocode.ts`. Both paths validate the request and call Geoapify with an `x-api-key` header that never enters browser assets or URLs.

The normal application does not call MCP for every address. MCP is retained as a documented experiment and is not claimed to be more accurate or independent of Geoapify.

See [docs/architecture.md](docs/architecture.md) and [docs/location-context-policy.md](docs/location-context-policy.md).

## Why Geoapify

Geoapify provides documented forward-geocoding contracts, multiple candidates, structured address components, coordinates, match evidence, country restrictions, and server-side API-key authentication. Those capabilities fit Yaki's review workflow without requiring a browser-visible key. Its OpenAPI specifications and MCP tool discovery also made it possible to test the integration against published contracts rather than assume response shapes.

The integration work also established important boundaries: confidence `1` is not delivery certainty, caller-country bias can change ambiguous results, MCP exposes fewer geocoding controls and less parsed-query detail than the direct API, and MCP authentication documentation needed live contract checks. The normal application therefore uses the direct API; MCP remains a documented comparison experiment. See [Geoapify capabilities](docs/geoapify-capabilities.md), [MCP feasibility](docs/mcp-feasibility.md), and the [Phase 2 live report](docs/live-contract-report.md).

## Tests

```powershell
# Automated suite. The credential-gated live case is skipped unless
# GEOAPIFY_API_KEY is already loaded in this shell; if loaded, it uses one request.
npm.cmd test

# Real Chrome or Edge interaction through Playwright with an explicit mock; no provider quota
npm.cmd run test:browser

# Vercel Function contract tests; no provider quota
npm.cmd run test:vercel

# Two real public-address requests through the local HTTP application
npm.cmd run test:app-live

# Run the same live checks against the production deployment
$env:YAKI_BASE_URL="https://yaki-seven.vercel.app"
npm.cmd run test:app-live

# Earlier direct/MCP contract verification commands
npm.cmd run test:mcp-auth
npm.cmd run test:live-country
npm.cmd run test:live
```

Fresh quota-free outcomes (2026-10-21, Phase 5D documentation/evidence validation):

- TypeScript check: **PASS**.
- Automated suite: **46 passed, 0 failed, 1 credential-gated live test skipped** (47 discovered).
- Focused Vercel Function contracts: **4 passed, 0 failed**.

The most recent tracked mock browser E2E and clean-profile visual/security audits remain the Phase 5A **PASS** results for keyboard focus, country selection, ambiguous candidates, policy-blocked clarification, candidate-change re-confirmation, ready/unresolved export, 390px layout, clear session, and the documented security checks. Phase 5D did not rerun those scripts because they rewrite tracked evidence artifacts.

Historical live application evidence from 2026-10-19 remains **PASS** for two public addresses; candidates remained `needs_review`, with no automatic approval or credential exposure. That historical result is not evidence for the current production deployment.

A separate production browser verification on 2026-10-21 used exactly one `Springfield`/`US` request. The live application returned ten candidates, kept the row under review, required selection and explicit human confirmation, and exported one Ready CSV row without making a second geocoding request. The sanitized [production evidence](artifacts/production-verification-2026-10-21/README.md) includes three application screenshots, the downloaded CSV, and a clearly identified separate rendering of that CSV. It verifies this one production workflow, not every policy edge case or the exact Vercel deployment-to-commit mapping.

Full evidence and honest failure history are in [docs/phase3-test-report.md](docs/phase3-test-report.md). Screenshots are under `artifacts/screenshots/`.

## Privacy, security, and retention

- CSV files are parsed locally and are never uploaded as files.
- Queue data and history stay in browser memory only. Refresh, close, or **Clear session** removes them.
- The server has no address database and does not log request bodies.
- Geoapify receives each checked address, selected country, and ordinary network metadata.
- Same-origin CSP, no-store responses, no-referrer policy, restrictive permissions, body limits, local rate limiting, safe DOM construction, and protected CSV output are implemented.
- The Vercel Function rejects cross-site browser requests and uses a bounded per-instance rate limiter. This is defense in depth, not a substitute for Vercel Firewall or a shared distributed limiter.

Do not use real customer data until lawful basis, privacy notice, endpoint/region choice, access, retention, and deletion policies are approved.

## Attribution

The application visibly includes `Powered by Geoapify` and `© OpenStreetMap contributors`. Learn more at the [Geoapify website](https://www.geoapify.com/). No map tiles or OpenMapTiles-based styles are loaded. Attribution must be reassessed if the map implementation changes.

## Documentation

- [Batch #2 tutorial — Which Springfield?](docs/geoapify-batch2-tutorial.md)
- [Production Springfield verification — 2026-10-21](artifacts/production-verification-2026-10-21/README.md)
- [Architecture and data handling](docs/architecture.md)
- [Demo walkthrough](docs/demo-walkthrough.md)
- [Final submission draft](docs/final-submission-draft.md)
- [Phase 3 test report](docs/phase3-test-report.md)
- [Phase 3B visual/security audit](docs/phase3b-visual-security-audit.md)
- [Vercel deployment and release guide](docs/deployment.md)
- [Phase 4 release report](docs/phase4-release-report.md)
- [Location-context policy](docs/location-context-policy.md)
- [Geoapify capabilities](docs/geoapify-capabilities.md)
- [MCP feasibility](docs/mcp-feasibility.md)
- [Direct/MCP experiment plan](docs/experiment-plan.md)
- [Competitor audit](docs/competitor-audit.md)
- [Acceptance criteria](docs/acceptance-criteria.md)
- [Risks and unknowns](docs/risks-and-unknowns.md)
- [Phase 2 live contract report](docs/live-contract-report.md)

## Known limitations

- No authentication, accounts, or multi-user isolation.
- No durable review history; refresh intentionally clears it.
- No interactive street map, entrance/access verification, routing, or proof of delivery.
- In-memory rate limiting is not globally consistent across serverless instances; production abuse controls require Vercel Firewall or shared state.
- Formal accessibility and legal/privacy audits remain outstanding.
- Provider results and rankings can change; captured results are not an accuracy guarantee.
- The public deployment is a reviewed demonstration, not approval for real customer data; distributed abuse protection, monitoring, privacy, and operational controls still require production review.

## License

[MIT](LICENSE).
