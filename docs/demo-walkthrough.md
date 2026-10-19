# Reproducible Yaki walkthrough

This walkthrough starts from a clean checkout and uses public addresses. It demonstrates the distinction Yaki is designed around: Geoapify can return a strong location match, but only a person can decide that the selected candidate is ready for this delivery workflow.

Provider data can change. Candidate text, order, and count below are examples from the recorded 2026-10-19 run, not fixed assertions for future runs.

## Prerequisites

- Node.js 22.18 or later
- A Geoapify API key authorized for the Geocoding API
- PowerShell for the commands as written

Run every command from the repository root.

## Configure and start the application

```powershell
node --version
Copy-Item .env.example .env
```

Edit `.env` so it contains your real key locally:

```dotenv
GEOAPIFY_API_KEY=replace_with_your_geoapify_key
YAKI_PORT=4173
```

Do not commit `.env`. Start Yaki:

```powershell
npm.cmd start
```

Expected console output includes `Yaki is available at http://127.0.0.1:4173`. In a second PowerShell window, check the local API:

```powershell
Invoke-RestMethod http://127.0.0.1:4173/api/health | ConvertTo-Json
```

Expected shape:

```json
{
  "status": "ok",
  "persistence": "none"
}
```

Open `http://127.0.0.1:4173`. If the port is already in use, change `YAKI_PORT` in `.env` and use that port in the commands above.

## Review one address

1. Choose **United States (US)**. The country is locked once the queue contains a record; clear the session before starting a queue for another country.
2. Enter `200 Larkin Street, San Francisco, CA 94102, United States`.
3. Press **Add and check**.
4. Expect a **Needs review** result. The captured run returned two candidates for the same street address: the Asian Art Museum and its café. A future provider response may differ.
5. Compare the formatted address, components, match evidence, and coordinate preview for every candidate.
6. Select the intended candidate. This enables the confirmation step but does not approve the row yet.
7. Check the confirmation statement and press **Confirm ready**.
8. Expand **Review history**. It should contain the real check, selection, and confirmation actions with timestamps.

The important outcome is the state transition, not a particular candidate count: a provider result remains under review until a candidate is selected and confirmed.

## Review a CSV

1. Press **Clear session**, confirm the dialog, and choose **United States (US)** again.
2. Upload `examples/addresses-us.csv`.
3. Select the `address` column and inspect the five-row preview.
4. Press **Add rows and check**. Yaki sends one row at a time to avoid a request burst.
5. Confirm that candidate results remain **Needs review**, a successful zero-result response becomes **No match**, and provider or network failures become **Check failed**. The sample's exact live candidates may change.
6. Correct an address in its edit field and press **Edit and recheck**, or leave it unresolved.
7. Export **Ready** and **Unresolved** records separately.
8. Open the CSVs in a text editor. Each exported row should preserve the original value, reviewed value, status, selected result, coordinates, country, action, and timestamp. Spreadsheet-formula prefixes are neutralized.

## Check the privacy boundary

1. Open the browser's storage tools. Yaki should create no local-storage, session-storage, or cookie entry.
2. Press **Clear session**, confirm the dialog, and verify that the queue, history, file selection, and country disappear.
3. Refresh the page. No previous address should return.
4. In the Network panel, address checks should go only to same-origin `/api/geocode`; the Geoapify key must not appear in browser requests or responses.

## Run the reproducible checks

```powershell
# Offline unit and HTTP integration suite
npm.cmd ci
npm.cmd test

# Real Chrome or Edge interaction through Playwright with a deliberate mock provider
npm.cmd run test:browser

# Vercel Function contract tests
npm.cmd run test:vercel

# Two real public-address requests; consumes Geoapify quota
npm.cmd run test:app-live
```

Expected results from the recorded 2026-10-19 release-candidate run:

- `npm.cmd test`: `37` passed, `0` failed.
- `npm.cmd run test:browser`: `PASS`, including keyboard focus, CSV upload/export, explicit confirmation, and no horizontal overflow at 390 px.
- `npm.cmd run test:vercel`: `4` passed, `0` failed.
- `npm.cmd run test:app-live`: two HTTP `200` responses, both retained as `needs_review`, with `credentialExposed: false` and `persistence: none` in the artifact.

The browser test uses an explicit mock and consumes no Geoapify quota. The live test writes sanitized evidence to `artifacts/app-live-e2e-results.json`.

To check an actual deployment after one exists:

```powershell
$env:YAKI_BASE_URL="https://your-project.vercel.app"
npm.cmd run test:app-live
```

Replace the placeholder with the exact deployment URL. No public Yaki deployment had been verified when this walkthrough was revised, so a deployed result must not be inferred from the local evidence.

## Captured evidence

- `artifacts/screenshots/yaki-desktop.png`
- `artifacts/screenshots/yaki-mobile.png`
- `artifacts/screenshots/yaki-workspace.png`
- `artifacts/browser-e2e-results.json`
- `artifacts/app-live-e2e-results.json`

These files show what was observed in the recorded run. They do not establish general address accuracy, delivery success, or future provider behavior.
