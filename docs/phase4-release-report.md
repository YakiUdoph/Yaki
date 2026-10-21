# Phase 4 GitHub and Vercel release report

> **Historical snapshot:** This report records the pre-publication state on 2026-10-19. The repository and production deployment were published afterward; later release evidence supersedes its forward-looking status without changing this historical record.

Run date: 2026-10-19

Application version: `0.4.0`
Status: **release candidate prepared; publication and deployment awaiting explicit approval**

This is a release-preparation record, not a deployment announcement. Everything under “Executed local verification” was observed locally; the production behavior described under “Release architecture” is supported by source and contract tests but remains unobserved on a public URL.

## Confirmed Gata cause

The unauthorized “Gata: GPT to Earn / Monetize your AI chat data today / Connect Wallet” panel is not in Yaki. The normal Chrome profile contains Gata extension `hhibbomloleicghkgmldapmghagagfao`, version `0.7.1`, whose installed bundle contains the same three-part UI and whose manifest grants scripting and `<all_urls>` access. Clean extension-disabled Chrome renders Yaki ending at its intended footer with no Gata marker, iframe, wallet global, unexpected external request, or visible post-footer element. See [Phase 3B visual/security audit](phase3b-visual-security-audit.md).

## Release architecture

- `public/` remains the unchanged static browser application.
- `api/geocode.ts` is the production Node.js Vercel Function and uses the same application service, Geoapify client, country restriction, and no-auto-approval policy as the local server.
- `api/health.ts` exposes a non-sensitive health response.
- `vercel.json` provides routing, security headers, a 20-second function ceiling, and request cancellation support.
- `GEOAPIFY_API_KEY` is read only in the server-side function and sent to Geoapify only through `x-api-key`.

## Production controls and limits

The function enforces POST/JSON, a 16 KB body limit, address/country validation, same-origin browser requests, a 15-second upstream deadline, bounded retry, safe public errors, and a bounded 60-request/minute per-instance fallback. It logs only safe failure category/retryability metadata—not addresses, provider details, or credentials.

The limiter is deliberately documented as defense in depth. Vercel Function instances do not share process memory, so an exact global limit requires Vercel Firewall or a shared distributed store. Yaki still has no accounts, authentication, durable review history, or approval for real customer data.

## Executed local verification

| Check | Result |
| --- | --- |
| Automated unit/HTTP/Vercel contract suite | **PASS: 37 tests, 0 failures** |
| Browser end-to-end | **PASS** in a fresh extension-disabled Edge profile with explicit mock provider |
| Visual/security browser audit | **PASS** in a fresh extension-disabled Chrome profile |
| Live local application → Geoapify | **PASS** for two public addresses; both retained for human review; credential omitted |
| Initial `vercel build --prod` | **WAITING:** CLI correctly requires project settings from `vercel pull`; no Vercel project has been created without approval |

## Authenticated release targets

- GitHub: public empty repository `https://github.com/YakiUdoph/Yaki`, with this workspace configured as `origin`.
- Vercel: authenticated Hobby account `yakiudoph`; no Yaki project exists yet.

No commit, push, Vercel project creation, environment-variable upload, or deployment has been performed at this report stage. After approval, the release sequence is: commit and push the audited staged tree, create/link `yaki`, add the key as a sensitive server-side Production environment variable, pull project settings, run the Vercel production build, stage a production deployment without assigning its domain, test that exact URL, and promote only if all checks pass.

## Remaining unknowns

- Whether the Vercel project will build successfully with linked production settings.
- The final production URL and its public security headers, logs, and provider behavior.
- Whether the configured platform-level rate limit is sufficient for real traffic.
- Whether GitHub and Vercel publication will be approved without further repository changes.
