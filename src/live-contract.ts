import { mkdir, writeFile } from "node:fs/promises";
import { getRuntimeConfig } from "./config.ts";
import {
  compareEvidence,
  describeError,
  geocodeDirect,
  geocodeMcp,
  listMcpTools,
  type DirectEvidence,
  type McpEvidence,
} from "./geoapify.ts";

const cases = [
  {
    id: "complete-public-address",
    kind: "complete",
    query: "200 Larkin Street, San Francisco, CA 94102, United States",
  },
  { id: "ambiguous-location", kind: "ambiguous", query: "Springfield" },
  { id: "incomplete-address", kind: "incomplete", query: "10 Downing Street" },
  {
    id: "invalid-address",
    kind: "invalid",
    query: "this-is-not-a-real-address-yaki-7f3c91",
  },
] as const;

type CaseResult = {
  id: string;
  kind: string;
  query: string;
  direct?: DirectEvidence;
  directError?: Record<string, unknown>;
  mcp?: McpEvidence;
  mcpError?: Record<string, unknown>;
  comparison?: Record<string, unknown>;
};

async function main(): Promise<void> {
  const config = await getRuntimeConfig();
  const startedAt = new Date().toISOString();
  const toolNames = await listMcpTools(config.apiKey, { baseUrl: config.mcpBaseUrl });
  const results: CaseResult[] = [];

  for (const testCase of cases) {
    const result: CaseResult = { ...testCase };
    try {
      result.direct = await geocodeDirect(testCase.query, config.apiKey, {
        baseUrl: config.apiBaseUrl,
        limit: 5,
      });
    } catch (error) {
      result.directError = describeError(error);
    }

    try {
      result.mcp = await geocodeMcp(testCase.query, config.apiKey, {
        baseUrl: config.mcpBaseUrl,
        authMode: "x-api-key",
        limit: 5,
      });
    } catch (error) {
      result.mcpError = describeError(error);
    }

    if (result.direct && result.mcp) {
      result.comparison = compareEvidence(result.direct, result.mcp);
    }
    results.push(result);
  }

  const evidence = {
    schemaVersion: 1,
    startedAt,
    completedAt: new Date().toISOString(),
    keySource: ".env:GEOAPIFY_API_KEY (value intentionally omitted)",
    directAuthentication: "x-api-key header",
    mcpAuthentication: "x-api-key header",
    protocolVersion: "2025-06-18",
    mcpToolNames: toolNames,
    confidenceDisclaimer:
      "Geoapify confidence and match fields are geocoding evidence, not delivery certainty.",
    cases: results,
  };

  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/live-contract-results.json",
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8",
  );
  console.log(
    `Live contract run completed for ${results.length} public test cases. Evidence written without credentials.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Live contract run failed.");
  process.exitCode = 2;
});
