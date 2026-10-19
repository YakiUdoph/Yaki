# GitHub and Vercel release guide

This is an operator guide for a future public release. As of 2026-10-19, the GitHub target exists as a public empty repository, no Yaki Vercel project or production URL has been created, and only local and contract-test results are available. Follow the checks in order; do not turn a configured target into a claim that deployment succeeded.

## Release targets

- GitHub repository: `https://github.com/YakiUdoph/Yaki`
- Vercel project name: `yaki`
- Production branch: `main`
- Runtime: Node.js Vercel Functions plus static files from `public/`

Do not publish `.env`, `.vercel/`, browser profiles, CLI credentials, or any file containing the Geoapify key.

## Environment variable

Create `GEOAPIFY_API_KEY` in Vercel Project Settings → Environment Variables as a **Sensitive** value scoped to Production. Use a separate restricted key for Preview if real preview checks are required. The name must not have a browser-public prefix such as `NEXT_PUBLIC_` or `VITE_`.

From PowerShell, add it at the CLI's secure prompt without placing the value in command history:

```powershell
vercel.cmd env add GEOAPIFY_API_KEY production --sensitive
```

Enter the value only at the secure prompt. Do not use `--value`, echo the key, or place it in a URL. After adding or changing the variable, redeploy; environment changes do not alter an existing deployment.

## Reproducible verification

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run test:browser
npm.cmd run test:security
npm.cmd run test:app-live

vercel.cmd pull --yes --environment=production
vercel.cmd build --prod
```

`test:browser` and `test:security` use Playwright with clean, isolated browser contexts and extensions disabled. `test:app-live` uses real public addresses and consumes Geoapify quota.

Expected local release-candidate result: 37 automated tests pass; both browser checks report `PASS`; the live application check records two public addresses as `needs_review` without exposing the credential. `vercel build --prod` has no valid expected result until `vercel pull` has obtained project settings from a linked Vercel project.

## Staged production release

After the Git commit and Vercel project/environment are reviewed:

```powershell
git push -u origin main
vercel.cmd pull --yes --environment=production
vercel.cmd build --prod
vercel.cmd deploy --prebuilt --prod --skip-domain
```

Capture the staged URL, then run:

```powershell
$env:YAKI_BASE_URL="https://staged-deployment.vercel.app"
npm.cmd run test:app-live

$env:YAKI_AUDIT_BASE_URL="https://staged-deployment.vercel.app"
npm.cmd run test:security
```

Only promote the same tested production build:

```powershell
vercel.cmd promote https://staged-deployment.vercel.app
```

Do not promote a preview deployment; promotion would rebuild it with production variables rather than release the tested artifact. Roll back with `vercel.cmd rollback <deployment-url-or-id>` if post-release checks fail.

## Production checks

1. `GET /` returns the Yaki page and the expected security headers.
2. `GET /api/health` returns `status: ok`, `persistence: none`, and `runtime: vercel-function`.
3. `POST /api/geocode` with public addresses in at least two countries returns candidates while `readyForDispatch` remains false.
4. HTML, JavaScript, JSON responses, deployment logs, and repository files contain no Geoapify key.
5. The clean-profile page ends at the Yaki footer with no Gata panel, iframe, wallet global, unexpected external request, clipping, or horizontal overflow.
6. Runtime error logs contain no address bodies or credentials.

## Rate limiting and abuse protection

The function enforces a 16 KB JSON limit, validates address/country fields, blocks cross-site browser requests, times out provider work, and applies a bounded 60-request/minute per-instance fallback. Serverless instances scale independently and do not share that memory, so the effective global limit can be higher.

Before sustained public traffic, add a Vercel Firewall rate-limit rule for `POST /api/geocode`, monitor Geoapify quota, and consider a shared limiter if exact global enforcement is required. Avoid logging request bodies because they contain addresses.

## GitHub publication audit

Before every public push:

```powershell
git status --short
git diff --cached --check
git diff --cached --stat
git ls-files
git check-ignore -v .env .vercel
```

Compare the configured key value against every staged text file without printing it, scan for common token/private-key formats, inspect screenshots and JSON artifacts, and confirm claims match executed results. The MIT license, Geoapify/OpenStreetMap attribution, setup, screenshots, tests, Gata finding, privacy boundary, and known limitations must remain present.
