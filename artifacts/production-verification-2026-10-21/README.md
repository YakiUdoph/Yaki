# Production Springfield verification — 2026-10-21

This directory preserves sanitized evidence from a real browser session against
[`https://yaki-seven.vercel.app/`](https://yaki-seven.vercel.app/). The test used
the public query `Springfield` with destination country `US`.

The verification harness observed exactly one `POST /api/geocode` request. It
returned HTTP `200`, ten candidates, application status `needs_review`, and
server policy status `review_required`. `readyForDispatch` was `false`, with
`multiple_candidates` and `human_confirmation_required` reasons. No second
geocoding request or browser console error was observed.

## Files

- [`01-springfield-candidates.png`](01-springfield-candidates.png) — production
  browser screenshot after the response and before selection. Ten candidates
  are visible and the record remains **Needs review**.
- [`02-candidate-selected-awaiting-confirmation.png`](02-candidate-selected-awaiting-confirmation.png)
  — production browser screenshot with Springfield, Illinois selected. The
  confirmation box is still unchecked and Ready export remains unavailable.
- [`03-ready-after-confirmation.png`](03-ready-after-confirmation.png) —
  production browser screenshot after explicit human confirmation. The record
  is **Ready** and Ready export is enabled.
- [`yaki-ready-addresses.csv`](yaki-ready-addresses.csv) — the sanitized Ready
  CSV downloaded from that browser session. It contains one public Springfield,
  Illinois row.
- [`04-downloaded-ready-csv.png`](04-downloaded-ready-csv.png) — a separate,
  locally rendered image of the downloaded CSV. It is not a screenshot of the
  production application. The `?` in its heading is a capture-time character
  encoding artifact; the preserved CSV data is unaffected.

The PNG and CSV files are byte-for-byte copies of the original temporary
artifacts. They contain public test data and no API key, credential, private
address, browser extension content, or personal account information.

## SHA-256

| File | SHA-256 |
| --- | --- |
| `01-springfield-candidates.png` | `1bb022661b08f30fc0196115cb06cf4e7fb4d98056dbc05b280b13d03d80f7d7` |
| `02-candidate-selected-awaiting-confirmation.png` | `74e35638f234c2d9a26dc317371db4ca1b7e6963aa0182db293359771b77393c` |
| `03-ready-after-confirmation.png` | `4fdfe2610239d5e62abc08c2d7fce600256bc18d682fad20d86dd5f62fac09b7` |
| `04-downloaded-ready-csv.png` | `afaa5d7ba0735a5e6725b3c5b616ee4800e467762d3e28acec65d2b8fd339f4e` |
| `yaki-ready-addresses.csv` | `5d02b285cdabdb1235a0014cdf55728f1a658815e97e684f0e1fa6d9182473a9` |

## Evidence boundary

This session verifies one production Springfield response and the resulting
selection, explicit confirmation, and Ready-export flow at that time. It does
not verify every policy edge case, future provider results, postal
deliverability, or the exact Vercel deployment-to-commit mapping. Clarification,
candidate-change, no-result, and provider-error safeguards remain supported by
source and automated-test evidence rather than this single production session.
