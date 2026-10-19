# Yaki application architecture

Status: Phase 4 release candidate, version `0.4.0`.

Yaki is built around one constraint: a geocoding match is useful location evidence, but it is not a delivery-ready verdict. The application preserves the provider's candidates and asks a person to make the final decision instead of turning rank or confidence into an automatic approval.

The local path described below was exercised end to end. The Vercel path is implemented and covered by contract tests, but no public deployment URL had been created when this document was revised. Statements about deployed runtime behavior are therefore based on source and configuration unless a report explicitly labels them as live observations.

## Components

| Component | Responsibility | Data behavior |
|---|---|---|
| Browser application (`public/`) | CSV parsing/preview, queue display, candidate selection, human confirmation, history, exports, and clear-session control | Keeps imported rows and decisions in JavaScript memory only. No browser storage is used. |
| Node HTTP server (`src/app-server.ts`) | Serves local assets, validates requests, applies security headers and rate limits, and keeps the API key server-side | Does not persist requests or responses and does not log address bodies. |
| Vercel Functions (`api/`) | Implements production `POST /api/geocode` and `GET /api/health` with Web `Request`/`Response` APIs | Reads `GEOAPIFY_API_KEY` only at function runtime; does not persist or log address bodies. |
| Application service (`src/app-service.ts`) | Calls verified direct Geoapify geocoding with the selected country and maps the result to a review state | Returns sanitized candidate evidence; never returns the credential. |
| Location policy (`src/location-policy.ts`) | Enforces country context, preserves uncertainty, and prevents automatic dispatch approval | Produces `clarification_required`, `review_required`, or `ready` decisions. |
| Geoapify client (`src/geoapify.ts`) | Validated direct and MCP contracts, bounded retries, normalization, and typed errors | Uses `x-api-key` server-side for the application path. |

The production-like application performs one direct Forward Geocoding call per check. It does not call MCP for every address. MCP remains available for the documented comparison experiment and is not presented as an independent validation source.

## Request flow

1. The operator selects one destination country for the queue.
2. CSV parsing happens entirely in the browser. The file itself is never uploaded.
3. For each check, the browser sends only `{ address, countryCode }` to same-origin `POST /api/geocode`.
4. The local server or Vercel Function validates the body, applies the selected `countrycodes` restriction, and calls Geoapify with an `x-api-key` header.
5. The browser receives candidate evidence or a distinct error/no-match result.
6. A candidate remains `Needs review` until the operator selects it, checks the confirmation statement, and presses **Confirm ready**.
7. Review history and exports are produced in browser memory. **Clear session** removes that state.

## HTTP contract

### `GET /api/health`

Returns `{ "status": "ok", "persistence": "none" }`. It exposes no key or customer data.

### `POST /api/geocode`

Request:

```json
{ "address": "200 Larkin Street, San Francisco, CA 94102", "countryCode": "us" }
```

The address must contain 1–1024 characters and the country must be a two-letter ISO code. Request bodies are limited to 16 KB. The local server allows 120 requests/minute per remote address; the Vercel fallback allows 60 requests/minute per forwarded client address and rejects cross-site browser requests. Successful responses contain candidates, parsed-query evidence when returned, and policy reasons. Failures use safe user-facing messages and never reinterpret a service failure as “invalid address.”

## CSV and export boundaries

- Maximum file size: 1 MB.
- Maximum data rows: 500.
- Maximum columns: 50.
- Maximum field length: 4096 characters.
- RFC-style quoted commas, escaped quotes, CRLF/LF, embedded quoted line breaks, and UTF-8 BOM are supported.
- Duplicate/blank headers, null bytes, malformed quotes, excess fields, and configured limit violations are rejected or reported.
- Export is UTF-8 with BOM and CRLF rows.
- Cells beginning with optional whitespace followed by `=`, `+`, `-`, or `@` are prefixed with an apostrophe to reduce spreadsheet formula injection risk.

## Privacy and retention

Yaki has no database, cookies, analytics, session replay, external fonts, or browser storage. Uploaded rows, review choices, and history live only in the page's memory. They disappear on refresh, browser close, or **Clear session**. The server streams static files and processes checks in memory; it has no address persistence layer and no request-body logging.

Geoapify necessarily receives the checked address, selected country restriction, request IP/network metadata, and the API key associated with the project. Before real customer use, the operator must approve a lawful basis, retention policy, access policy, endpoint/region choice, and Geoapify privacy terms.

## Security controls

- Credential loaded from ignored `.env`; browser responses and assets contain no key.
- Header authentication for provider requests.
- Content Security Policy limited to same-origin scripts/styles/images/connections.
- `no-store`, `nosniff`, `DENY` framing, no-referrer, and restrictive Permissions Policy headers.
- Safe DOM construction with `textContent`; no user/provider content is assigned through `innerHTML`.
- Bounded JSON requests and local in-memory rate limiting.
- Explicit output escaping and CSV formula protection.
- No third-party runtime dependencies.

## Geographic preview and attribution

Candidate coordinates are rendered as a local, non-tile coordinate preview. It makes no third-party browser request and does not invent a position. Visible footer credits provide `Powered by Geoapify` and `© OpenStreetMap contributors`, consistent with the current [Geoapify attribution guidance](https://apidocs.geoapify.com/docs/maps) and [terms](https://www.geoapify.com/terms-and-conditions/). If real map tiles are added later, tile-style-specific attribution and key-delivery requirements must be reassessed.

## Deployment and abuse-control limits

Vercel terminates TLS and runs the API as stateless Node.js Functions. `GEOAPIFY_API_KEY` must be configured as a sensitive server-side Vercel environment variable. Function instances do not share the in-memory limiter, so the code-level limit is only a bounded fallback; sustained public traffic requires a Vercel Firewall rule or a shared distributed limiter. Yaki still has no authentication, multi-tenant isolation, or durable audit storage. Real customer use additionally requires an approved retention/deletion policy, accessibility review, and operational monitoring that does not capture address bodies.

## Evidence boundary

- **Observed:** local HTTP behavior, browser workflows, clean-profile network activity, provider calls using public addresses, and the recorded test artifacts.
- **Verified from source and tests:** Vercel Function request validation, routing, headers, key handling, timeout behavior, and per-instance rate limiting.
- **Not yet observed:** a public Vercel build and deployment, distributed rate-limit behavior under scale, production logs, or a real multi-user workload.
