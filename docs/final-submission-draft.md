# Geoapify Open Geospatial Program — Batch #2 final submission draft

> **DRAFT — DO NOT SEND YET.** Record the final documentation commit, confirm the recipient address from the acceptance email, review the complete message, and retain the honest UNKNOWN label for exact Vercel deployment/alias mapping unless that mapping is independently verified. The owner-provided acceptance email establishes the November 15, 2026 deadline.

Evidence labels used below:

- **VERIFIED:** supported by tracked source, tests, artifacts, Git history, or a fresh check.
- **USER-REPORTED:** reported by the project owner but not independently reproduced in the repository.
- **UNKNOWN / CONFIRM:** requires confirmation before submission.

## Email metadata

- **Subject:** `Geoapify Open Geospatial Program - Batch #2 Final Submission`
- **Recipient:** **CONFIRM from the Batch #2 acceptance email or current official program page before sending.** The repository records the official submission template but does not preserve the recipient address.
- **Final deadline:** November 15, 2026 (**USER-REPORTED from the owner-provided acceptance email; the email is not stored in this public repository**).
- **Internal completion target:** October 27, 2026.

The public program page provides the final-submission field template reproduced below. The owner-provided acceptance email, rather than this repository, is the authority for the November 15 deadline and should also be used to confirm the still-unknown recipient address.

---

## Submission email body

### 1. Project title and description

- **Title:** Yaki — The Last Check Before Dispatch
- **Description:** Yaki is a visual, human-review-before-dispatch application for ambiguous delivery destinations. It accepts one address or a CSV, uses Geoapify Forward Geocoding through a server-side function, preserves multiple candidate locations and match evidence, requires explicit human selection and confirmation, and exports Ready and Unresolved rows separately. It does not claim postal validation or automatic deliverability.

The central case study is `Springfield`. In a saved country-restricted experiment, direct Geoapify and Geoapify MCP both returned five US city candidates—Illinois, Massachusetts, Missouri, Ohio, and Oregon—with confidence `1`. Yaki still kept the address under review because a technically strong match does not establish sender intent.

### 2. Final deliverables

- **Public code repository URL:** https://github.com/YakiUdoph/Yaki
- **Setup and run instructions:** https://github.com/YakiUdoph/Yaki#setup-and-run
- **Demo URL:** https://yaki-seven.vercel.app/
- **Reproducible walkthrough:** https://github.com/YakiUdoph/Yaki/blob/main/docs/demo-walkthrough.md
- **Tutorial or walkthrough URL:** https://github.com/YakiUdoph/Yaki/blob/main/docs/geoapify-batch2-tutorial.md
- **Prompts, agent instructions, skills, or AI workflow used:** The repository does not preserve authentic historical Codex prompt transcripts, so none are reconstructed as history. The tutorial documents the evidence-first AI-assisted workflow supported by repository outputs and includes a clearly labeled present-day reproducible example prompt. It also links the executable MCP harnesses and saved sanitized tool evidence.

#### Quick setup

```powershell
git clone https://github.com/YakiUdoph/Yaki.git
Set-Location Yaki
npm.cmd ci
Copy-Item .env.example .env
# Add your own GEOAPIFY_API_KEY locally; never commit it.
npm.cmd start
```

Open `http://127.0.0.1:4173`.

#### Main demonstration

1. Choose **United States (US)**.
2. Enter `Springfield` and select **Add and check**.
3. Compare all returned candidates; do not treat confidence as delivery certainty.
4. Select the intended candidate.
5. Check the explicit human-confirmation statement and press **Confirm ready**.
6. Change the candidate to observe that confirmation is revoked, or export Ready and Unresolved rows separately.
7. Repeat with `examples/addresses-us.csv` to demonstrate local CSV preview and sequential review.

Provider results can change, so the demonstration should validate the workflow rather than assert a permanent candidate count.

### 3. Geoapify and AI usage

- **OpenAPI specifications, APIs, and/or MCP tools used:**
  - Geoapify Forward Geocoding API, `GET /v1/geocode/search`.
  - Explicit direct country restriction through `countrycodes`.
  - Geoapify MCP endpoint, `POST /v1/mcp`, for a separate experiment.
  - MCP `tools/list` and `tools/call` with `geocode_address`.
  - Geoapify Forward, Reverse, dedicated Batch, Generic Batch, combined MCP, and focused MCP specifications were assessed in the capability and experiment documents. Only Forward Geocoding powers the shipped address-check path.

- **Short summary of the architecture and AI workflow:** The browser sends `{ address, countryCode }` only to same-origin `/api/geocode`. A local Node server or Vercel Function validates the request and calls Geoapify with a server-side `x-api-key` header. The response preserves candidate evidence and a location-policy decision. Browser state remains in memory, and a row can enter Ready only after an eligible candidate is selected and a person confirms it. Coding-assistant work followed an evidence-first process: inspect machine-readable contracts, encode assumptions in tests, make minimal implementation changes, run mocked checks, then perform small public-address live experiments and save sanitized artifacts. Historical exact prompt text is unavailable and is not fabricated.

- **What worked well, and what required correction or human guidance?**
  - Geoapify's structured candidates and explicit country restriction supported a clear review workflow.
  - The saved US Springfield run made ambiguity concrete: five strong matches still required a human decision.
  - MCP tool discovery and geocoding calls were reproducible in the dated experiment, and the client learned to distinguish HTTP, JSON-RPC, and tool-level failures.
  - Human guidance was essential for product language: confidence is evidence, not a deliverability verdict.
  - The initial direct/MCP Springfield comparison had unequal implicit country context. Applying explicit equivalent US restrictions corrected the experiment design.
  - A Vercel module-loading failure required named HTTP-method exports in commit `ed4fd39`.
  - A browser/server policy mismatch allowed local selection and confirmation to outrun `clarification_required`; commit `1ec5929` gated confirmation and export on the existing server policy and added regression tests.
  - A later credentialed live test returned a safe network/502 failure. It was not reported as a successful provider call.

- **Feedback or suggestions for Geoapify OpenAPI or MCP:**
  1. Make the preferred MCP authentication method consistent and prominent across human and machine-readable documentation.
  2. Document whether MCP geocoding uses the same ranking/bias configuration as direct v1 geocoding.
  3. Expose parsed-query evidence through MCP or explicitly document the difference.
  4. Clarify structured-geocoding empty-input behavior and the canonical confidence field.
  5. Provide a documented batch-address MCP tool or clearer guidance for choosing Generic Batch versus paced direct calls.
  6. Include executable examples of HTTP 200 responses with `result.isError: true`.

### 4. Release information

- **License:** MIT
- **Version:** `0.4.0`
- **Historical Phase 5A policy-correction commit:** `1ec592963145e9c796735bee0b25b1d0fb2de7b6`
- **Phase 5B tutorial package commit:** `1805ce3ae9ca88ec7c3016419e9196e04d78d109`
- **Phase 5B publication-status commit and Phase 5C audited baseline:** `c10f984ecabc530258cb839f09db9e4865e8e63f`
- **Final documentation/evidence commit:** **RECORD FROM GIT HISTORY AFTER PHASE 5D IS PUBLISHED**
- **Release tag:** not created; optional and intentionally deferred

### 5. Notes

- **Known limitations:**
  - No authentication, accounts, multi-user isolation, or durable review history.
  - Review state is intentionally browser-memory-only and disappears on refresh or Clear session.
  - CSV rows are checked sequentially; there is no resumable asynchronous batch job.
  - No interactive street map, entrance/access validation, routing, postal deliverability, or proof of delivery.
  - In-memory serverless rate limiting is not globally consistent; production hardening needs platform or shared-state controls.
  - Formal accessibility, privacy/legal, and sustained-production operational reviews remain incomplete.
  - Provider data and ranking can change.

- **Anything else to review:**
  - **VERIFIED production behavior on October 21, 2026:** an independent browser session made exactly one `POST /api/geocode` request for public input `Springfield` and country `US`. It received HTTP `200` with ten candidates and `review_required`, selected Springfield, Illinois, required explicit confirmation, and exported one Ready CSV row without a second geocoding request or browser console error. See the [sanitized production evidence](../artifacts/production-verification-2026-10-21/README.md).
  - This production session verifies one successful selection/confirmation/export flow. Clarification-required, candidate-change, no-result, and provider-error behavior remains verified by source and automated tests, not by this one production session.
  - **USER-REPORTED historical evidence:** the project owner previously reported that commit `1ec5929` was READY in Vercel Production. The exact current production alias-to-deployment-to-commit mapping remains **UNKNOWN** because authenticated Vercel inspection was unavailable during Phase 5C.
  - Production uses the direct Geoapify API. MCP is a documented development experiment, not a production LLM or per-address MCP dependency.

---

## Evidence matrix

| Organizer requirement | Status | Evidence | Remaining action |
| --- | --- | --- | --- |
| Public repository | **VERIFIED through Phase 5C** | Local `HEAD`, `origin/main`, and the public repository matched audited baseline `c10f984` | Recheck after the Phase 5D push |
| Permissive open-source license | **VERIFIED** | [`LICENSE`](../LICENSE), MIT | None |
| Runnable or reproducible result | **VERIFIED locally** | `package.json`, README, walkthrough, automated/browser tests | One clean-checkout reviewer run is recommended |
| Hosted demo | **PUBLIC FLOW VERIFIED / MAPPING UNKNOWN** | Public home and `/api/health` returned HTTP 200; one-request production Springfield selection/confirmation/export evidence is tracked | Exact Vercel READY and alias-to-deployment-to-commit mapping requires authorized Vercel evidence |
| README architecture/setup/configuration/run steps | **VERIFIED** | [`README.md`](../README.md) and successful relative-link check | Recheck public rendering after the Phase 5D push |
| Public tutorial explaining construction and Geoapify use | **VERIFIED PUBLIC THROUGH PHASE 5C** | [Public tutorial](https://github.com/YakiUdoph/Yaki/blob/main/docs/geoapify-batch2-tutorial.md) | Recheck after the Phase 5D push |
| Geoapify backlink in README and tutorial | **VERIFIED in source and public files** | README Attribution; tutorial opening; walkthrough opening | Recheck after the Phase 5D push |
| AI prompts/instructions/workflow and lessons | **PARTIAL WITH DISCLOSED GAP** | Tutorial AI workflow and present-day example | Historical exact prompts are unavailable; do not claim otherwise |
| Meaningful OpenAPI and/or MCP use | **VERIFIED** | `src/geoapify.ts`, capability docs, MCP harnesses, saved artifacts | None |
| Concrete Geoapify tooling feedback | **VERIFIED in draft** | Tutorial and submission section 3 | Editorial review before sending |
| Core flows tested | **VERIFIED with stated boundaries** | Automated and Vercel-contract suites; tracked mock browser/security evidence; one independently captured production Springfield success path | Do not generalize the one production session to every edge case |
| Private keys hidden | **VERIFIED in tracked evidence** | `.gitignore`, `.env.example`, redaction tests/artifacts | Re-run secret scan before final send |
| Architecture and known limitations | **VERIFIED** | README, architecture doc, tutorial, this draft | None |
| Correct screenshots | **VERIFIED FOR ONE PRODUCTION FLOW** | [`artifacts/production-verification-2026-10-21/`](../artifacts/production-verification-2026-10-21/README.md) distinguishes three browser screenshots from the rendered CSV image | Recheck public image rendering after the Phase 5D push |
| Final release commit/tag | **COMMIT PENDING / TAG DEFERRED** | Audited baseline `c10f984`; Phase 5D commit must be recorded after publication | Record the Phase 5D commit; no tag is required for this phase |
| Final submission recipient | **UNKNOWN / CONFIRM** | The repository intentionally does not store the acceptance-email address | Confirm from the acceptance email before sending |
| Final submission deadline | **USER-REPORTED CONFIRMED** | Owner-provided acceptance email establishes November 15, 2026; email is not public repository evidence | No repository action required |

## Pre-send checklist

- [x] Publish the tutorial at a stable public repository URL.
- [x] Record the Phase 5B tutorial package commit.
- [ ] Record the Phase 5D documentation/evidence commit after publication; do not create a tag yet.
- [ ] Confirm the recipient from the acceptance email. The owner-provided email already establishes the November 15, 2026 deadline.
- [ ] Recheck repository visibility and rendered Markdown/image links after the Phase 5D push.
- [ ] Keep exact Vercel READY and alias-to-deployment-to-commit mapping **UNKNOWN** unless independently verified with authorized evidence.
- [x] Perform the smallest justified production check: exactly one public `Springfield`/`US` request, with the selection/confirmation/export outcome recorded.
- [x] Preserve the clean Springfield selection/confirmation/Ready CSV evidence without credentials.
- [x] Complete the applicable Phase 5D quota-free checks and secret scan: TypeScript passed; 46 automated tests passed with one credential-gated live test skipped; Vercel contracts passed 4/4; documentation links and secret scan passed.
- [x] Replace the earlier USER-REPORTED production-flow claim with independently captured, narrowly scoped evidence while retaining the historical label for the earlier owner report.
- [x] Do not include API keys, payment account details, private addresses, or raw private logs.
- [ ] Send only after a human reads the complete email and linked tutorial.
