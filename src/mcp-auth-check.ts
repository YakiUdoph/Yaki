import { getRuntimeConfig } from "./config.ts";
import { describeError, listMcpTools, type McpAuthMode } from "./geoapify.ts";

const modes: McpAuthMode[] = ["x-api-key", "authorization", "query"];

async function main(): Promise<void> {
  const config = await getRuntimeConfig();
  const outcomes: Array<Record<string, unknown>> = [];
  for (const mode of modes) {
    try {
      const tools = await listMcpTools(config.apiKey, {
        baseUrl: config.mcpBaseUrl,
        authMode: mode,
        maxRetries: 0,
      });
      outcomes.push({ mode, status: "PASS", discoveredToolCount: tools.length });
    } catch (error) {
      outcomes.push({ mode, status: "FAIL", error: describeError(error) });
    }
  }
  console.log(JSON.stringify({ apiKey: "[REDACTED]", outcomes }, null, 2));
  if (outcomes.some((outcome) => outcome.status === "FAIL")) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "MCP authentication check failed.");
  process.exitCode = 2;
});
