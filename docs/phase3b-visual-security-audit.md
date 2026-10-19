# Phase 3B visual and security audit

Audit date: 2026-10-19 (Atlantic/Cape_Verde)

Historical note: command results in this report describe the Phase 3B audit snapshot. Phase 4 later expanded the automated suite from 33 to 37 tests and the live application check from one public address to two; the attribution finding itself did not change.

## Decision

**REVISE — the Yaki application is clean, but the normal Chrome profile contains the extension that supplied the unauthorized Gata panel. Disable or remove that extension from the profile used for Yaki screenshots.** No Yaki production source was removed.

## Gata finding and attribution

The suspicious panel does not come from the Yaki repository or from the server-delivered page:

- A case-insensitive repository scan found none of the distinctive Gata text in Yaki source. The only occurrence is the audit's forbidden-marker assertion.
- `public/index.html` loads one same-origin module, `/app.js`, and one same-origin stylesheet. It contains no iframe, wallet code, inline script, or content after the footer other than a hidden clear-session dialog.
- A fresh temporary Chrome profile, launched with extensions disabled, rendered no Gata markers, iframe, wallet global, external request, WebSocket, console error, or visible node after the footer.
- The server returned a self-only Content Security Policy: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`.

The normal Chrome profile contains this installed extension:

- Extension ID: `hhibbomloleicghkgmldapmghagagfao`
- Name: `Gata: All-in-One AI Platform with Passive Rewards`
- Version: `0.7.1`
- Author: `gata.team`
- Permissions: `storage`, `scripting`, `declarativeNetRequest`
- Host/content-script scope: `<all_urls>`

Its installed JavaScript bundle contains the same UI sequence seen in the screenshot: `Gata: GPT to Earn`, `Monetize your Al chat data today` (the bundle spells “AI” as “Al”), and `Connect Wallet`. This exact three-part match, the extension identity, and its all-URL scripting scope determine the panel's source as the Gata Chrome extension rather than Yaki. Other installed wallet extensions contain the generic phrase “Connect Wallet,” but none of them contains the distinctive Gata title.

The extension was not disabled, removed, or otherwise changed during this audit. Chrome's current preference files confirm the Web Store extension package registration and path, but do not expose an unambiguous enabled-state field. The original screenshot session's historical network log is unavailable, so the extension's exact request sequence at capture time cannot be reconstructed after the fact.

Evidence boundary:

- **Observed:** the repository and clean-profile page lacked the panel; the installed extension bundle contained the distinctive text; its manifest allowed all-URL scripting.
- **Determined from the combined evidence:** the Gata extension supplied the screenshot panel, not Yaki source.
- **Still unknown:** the precise request sequence during the original screenshot capture and the extension's unambiguous enabled-state flag in Chrome's preference files.

## Application changes

1. At 390 px, the final two queue filters were clipped inside a horizontally scrolling row. The mobile rule now wraps the filter row so all five controls are visible without horizontal scrolling.
2. Phase 3B first repaired the hand-written DevTools connection with direct page targets, random ports, and bounded timeouts. During the final release gate, Node 24 and current Chromium stopped answering that transport reliably. The harnesses now use the pipe-backed Playwright driver with isolated contexts, which restored deterministic browser commands without changing application behavior.
3. Chromium also exposed a missing-favicon 404 as a console error. A first-party SVG favicon was added so the page-load audit is clean rather than ignoring the broken request.

No address-review, privacy, persistence, or Geoapify application logic changed.

## Browser and network evidence

The passing clean-profile evidence is in `artifacts/visual-security-audit.json` and the accompanying desktop and 390 px screenshots.

| Check | Result | Evidence |
| --- | --- | --- |
| Desktop width | PASS | viewport and scroll width both 1425 px; no clipped visible elements |
| Mobile width | PASS | viewport and scroll width both 390 px; no clipped visible elements |
| Contrast | PASS | no computed text contrast failures in the rendered initial page at either size |
| Keyboard focus | PASS | first Tab targets the skip link with a 3 px solid outline |
| Footer boundary | PASS | no visible sibling follows the footer; only the hidden clear-session dialog remains in DOM |
| Scripts/frames/wallet | PASS | one page script (`/app.js`), no iframe, no `window.ethereum` |
| Network | PASS | document plus same-origin CSS/JS modules only; no external requests or WebSockets |
| Console | PASS | no console errors |
| Gata markers | PASS | absent from source and clean-profile rendered DOM |

The browser interaction test passed country selection, address check, preservation of two ambiguous candidates, candidate selection, explicit human confirmation, ready/unresolved CSV export, CSV upload and batch checks, review history, 390 px overflow, and session clearing.

## Test and secret-audit results

- `npm.cmd test`: **33 passed, 0 failed**.
- `npm.cmd run test:browser`: **PASS** in a fresh Edge profile with extensions disabled and an explicit mock provider.
- `npm.cmd run test:security`: **PASS** in a fresh Chrome profile with extensions disabled and an explicit mock provider.
- `npm.cmd run test:app-live`: **PASS** through the local HTTP API to Geoapify; HTTP 200, two candidates retained, `needs_review`, no credential exposed, no persistence.
- Secret-value comparison: **PASS**; the configured Geoapify key value occurs only in the ignored `.env` file.
- Common token/private-key pattern scan: **PASS**.
- `git check-ignore -v .env`: **PASS**; `.env` is ignored by `.gitignore`.

## Required local follow-up

Disable or remove Chrome extension `hhibbomloleicghkgmldapmghagagfao` in the browser profile used to capture Yaki. Then recapture using a clean profile or Guest mode. This is a browser-profile remediation; no additional Yaki source change is indicated by the evidence.
