import { readFile } from "node:fs/promises";

export type RuntimeConfig = {
  apiKey: string;
  apiBaseUrl: string;
  mcpBaseUrl: string;
};

function parseEnvValue(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export async function loadLocalEnv(path = ".env"): Promise<void> {
  let contents: string;
  try {
    contents = await readFile(path, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return;
    throw error;
  }

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u.exec(line);
    if (!match) continue;
    const [, name, rawValue] = match;
    if (process.env[name] === undefined) process.env[name] = parseEnvValue(rawValue);
  }
}

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  await loadLocalEnv();
  const apiKey = process.env.GEOAPIFY_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "GEOAPIFY_API_KEY is unavailable. Add it to the ignored local .env file before running live tests.",
    );
  }

  return {
    apiKey,
    apiBaseUrl: process.env.GEOAPIFY_API_BASE_URL?.trim() || "https://api.geoapify.com/v1",
    mcpBaseUrl: process.env.GEOAPIFY_MCP_BASE_URL?.trim() || "https://api.geoapify.com/v1/mcp",
  };
}
