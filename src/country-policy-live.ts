import { mkdir, writeFile } from "node:fs/promises";
import { getRuntimeConfig } from "./config.ts";
import { compareEvidence, geocodeDirect, geocodeMcp } from "./geoapify.ts";
import { evaluateLocationPolicy, requireSelectedCountry } from "./location-policy.ts";

async function main(): Promise<void> {
  const config = await getRuntimeConfig();
  const query = "Springfield";
  const selectedCountryCode = requireSelectedCountry("batch", "us");
  if (!selectedCountryCode) throw new Error("A selected country was required but unavailable.");

  const direct = await geocodeDirect(query, config.apiKey, {
    baseUrl: config.apiBaseUrl,
    countryCode: selectedCountryCode,
    countryBias: "none",
    limit: 5,
  });
  const mcp = await geocodeMcp(query, config.apiKey, {
    baseUrl: config.mcpBaseUrl,
    authMode: "x-api-key",
    countryCode: selectedCountryCode,
    limit: 5,
  });
  const policy = evaluateLocationPolicy({
    processingMode: "batch",
    selectedCountryCode,
    direct,
    mcp,
  });

  const evidence = {
    schemaVersion: 1,
    runAt: new Date().toISOString(),
    query,
    operatorSelectedCountryCode: selectedCountryCode,
    appliedRestrictions: {
      direct: "countrycodes=us",
      mcp: { country_codes: ["us"] },
    },
    direct,
    mcp,
    comparison: compareEvidence(direct, mcp),
    policy,
    security: "Credential and request headers intentionally omitted.",
  };

  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/country-policy-live-results.json",
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
  );
  console.log(
    "Country-restricted live verification completed with two geocoding calls; credential omitted.",
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Country-policy live verification failed.");
  process.exitCode = 2;
});
