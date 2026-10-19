import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { checkAddress } from "./app-service.ts";
import { createYakiServer } from "./app-server.ts";
import { getRuntimeConfig } from "./config.ts";

async function main(): Promise<void> {
  const config = await getRuntimeConfig();
  const deployedUrl = process.env.YAKI_BASE_URL?.trim().replace(/\/+$/u, "");
  const server = deployedUrl ? undefined : createYakiServer({
    check: (input) => checkAddress(input, config.apiKey, { baseUrl: config.apiBaseUrl }),
  });
  if (server) await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server?.address() as AddressInfo | undefined;
  const baseUrl = deployedUrl || `http://127.0.0.1:${address?.port}`;
  try {
    const home = await fetch(baseUrl);
    assert.equal(home.status, 200);
    const html = await home.text();
    assert.match(html, /The last check before dispatch/u);
    assert.equal(html.includes(config.apiKey), false);
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);

    const inputs = [
      {
        address: "200 Larkin Street, San Francisco, CA 94102, United States",
        countryCode: "us",
      },
      {
        address: "10 Downing Street, London SW1A 2AA, United Kingdom",
        countryCode: "gb",
      },
    ];
    const checks: Array<Record<string, any>> = [];
    for (const input of inputs) {
      const response = await fetch(`${baseUrl}/api/geocode`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const raw = await response.text();
      assert.equal(response.status, 200);
      assert.equal(raw.includes(config.apiKey), false);
      const result = JSON.parse(raw) as Record<string, any>;
      assert.equal(result.status, "needs_review");
      assert.ok(Array.isArray(result.candidates) && result.candidates.length > 0);
      assert.equal(result.policy.readyForDispatch, false);
      checks.push({
        input: { address: input.address, operatorSelectedCountryCode: input.countryCode },
        httpStatus: response.status,
        applicationStatus: result.status,
        candidateCount: result.candidates.length,
        candidates: result.candidates,
        policy: result.policy,
      });
    }

    const evidence = {
      schemaVersion: 2,
      runAt: new Date().toISOString(),
      flow: deployedUrl
        ? "public Vercel deployment to server-side Geoapify geocoding"
        : "local browser-facing HTTP server to direct Geoapify geocoding",
      baseUrl,
      checks,
      credentialExposed: false,
      persistence: "none",
    };
    await mkdir("artifacts", { recursive: true });
    await writeFile("artifacts/app-live-e2e-results.json", `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    console.log(`Live application verification passed for ${checks.length} public addresses; credential omitted.`);
  } finally {
    if (server) {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Live application verification failed.");
  process.exitCode = 1;
});
