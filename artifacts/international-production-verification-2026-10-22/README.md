# Phase 5E international production verification

These files preserve the original, unedited evidence from four production browser checks performed against <https://yaki-seven.vercel.app/> on October 22, 2026. The session made exactly four `POST /api/geocode` requests: one for each public landmark below, with no retry and no additional request during selection, confirmation, or CSV export.

| Country | Public input | HTTP | Candidates | Policy before confirmation | Result |
| --- | --- | ---: | ---: | --- | --- |
| Nigeria (`NG`) | National Theatre, Lagos | 200 | 10, all `ng` | `review_required` | PASS |
| United Kingdom (`GB`) | Buckingham Palace, London | 200 | 10, all `gb` | `review_required` | PASS |
| Ghana (`GH`) | Independence Square, Accra | 200 | 1, `gh` | `review_required` | PASS |
| Canada (`CA`) | CN Tower, Toronto | 200 | 1, `ca` | `review_required` | PASS |

In each case, the application initially kept `readyForDispatch` false and required explicit human approval. A suitable candidate was selected, confirmed, and exported as one Ready CSV row without another geocoding request. No browser console error was recorded.

## What the files show

Each numbered country set has three **production browser screenshots** and one downloaded CSV:

- `*-candidates.png` shows the candidates before selection.
- `*-selected.png` shows the selected candidate while confirmation is still required.
- `*-ready.png` shows the Ready badge, confirmation success message, and enabled Ready export after explicit confirmation.
- `*-ready.csv` is the original one-row Ready export downloaded by the browser.
- `international-production-results.json` is the original machine-readable browser-run record, including request counts, response observations, candidate summaries, and local capture paths.

There are no separately rendered CSV images in this directory. Every PNG is an original browser screenshot; every CSV and the JSON file are preserved byte-for-byte. The screenshots contain only the specified public landmarks and application output. Inspection found no API key, credential, personal address, or other secret.

The Ready screenshots also honestly preserve the stale informational-copy defect observed during Phase 5E: the blue completion banner still said review was required, and the one-candidate Ghana and Canada cards still said confirmation was needed. Phase 5F corrected that source behavior and added mocked regression coverage. These pre-fix production captures do **not** prove that the Phase 5F correction was deployed.

## Scope limits

This evidence proves four successful public-landmark workflows on one date. It does not prove accuracy for every address or country, production behavior for clarification and failure paths, provider availability at another time, or an exact Vercel deployment-to-Git-commit mapping. The operator still decides whether a returned candidate is suitable.

## SHA-256 manifest

| File | SHA-256 |
| --- | --- |
| `01-ng-candidates.png` | `e0941dd8bcd0c5d610e7685dd9d67ca54f79d2ac23237cf557ee51339f78a696` |
| `01-ng-ready.csv` | `6a6079b842aedece1df3f05fbfa1aee1c166b6a19e7904294fb567bb17ac2bfb` |
| `01-ng-ready.png` | `15c28958b8ed11266653b62a049e8cd8020e11c4a972e5d0d1cfc82b85d47662` |
| `01-ng-selected.png` | `03f0f15db762eb873dc680d8a4db2185f3d3a789c0c159934ddb8ed5c554323f` |
| `02-gb-candidates.png` | `63a93340bcdae311376993d0942c046a45bda9395a91552626d4aa01f536074f` |
| `02-gb-ready.csv` | `74e9932c3b23132d3d35dd84189a13a1e947084e4c2178a9b5e0bef97d411ce3` |
| `02-gb-ready.png` | `bfe56f20b3402524142df0a0dd89c6532c00cf2aecf8ba24539bda25f60f5282` |
| `02-gb-selected.png` | `3d6fd8036874e2e6dca966ae1c0ed1a8c7063d04f0ef11af22693347eecd38ff` |
| `03-gh-candidates.png` | `0d5ba9c7fdaab0cc487f7bbf5cb9c86fb2ef090e419c5967716cb638c8460dd7` |
| `03-gh-ready.csv` | `b0ed2b27d600d022cfc74d261de81ca111283a604ec9ec8968b4d966136a89f1` |
| `03-gh-ready.png` | `5d38694a54b6d3dccb0b8207e2d1c9f00d05e2ff3a1c6acd2e7f19a42027a0e4` |
| `03-gh-selected.png` | `1dc81da62d2b442997bdb60940fed0873ee6ad016af02f38b27997489ba93d38` |
| `04-ca-candidates.png` | `1637a45960b26bbbc086e5a0215c0aab408d0484ac5eb4eb36814a6ce74fd210` |
| `04-ca-ready.csv` | `a1fd247f02833dcdbf601ab78fe0626d2d8899a549ac107109ca364f1f8935ed` |
| `04-ca-ready.png` | `df5bae9af490e05c1afe610a96fb0d47348d802d2622b048592b6bdf1c4d4ffe` |
| `04-ca-selected.png` | `090866de63429aae0fafdac26748dd828786c6c1089bf5952f2318797d060a5a` |
| `international-production-results.json` | `aa883abb33f06028edc7554a660e8f3d94dea051a2d137d31e446eacb7859b07` |
