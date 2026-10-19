export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
export type SleepLike = (milliseconds: number) => Promise<void>;

export type Candidate = {
  formatted?: string;
  address_line1?: string;
  address_line2?: string;
  lon?: number;
  lat?: number;
  place_id?: string;
  result_type?: string;
  housenumber?: string;
  street?: string;
  postcode?: string;
  city?: string;
  county?: string;
  state?: string;
  country?: string;
  country_code?: string;
  confidence?: number;
  confidence_city_level?: number;
  confidence_street_level?: number;
  confidence_building_level?: number;
  match_type?: string;
};

export type DirectEvidence = {
  source: "direct";
  candidates: Candidate[];
  parsedQuery?: Record<string, unknown>;
};

export type McpEvidence = {
  source: "mcp";
  candidates: Candidate[];
  normalizedQuery?: string;
};

export type RetryOptions = {
  maxRetries?: number;
  baseDelayMs?: number;
  fetchImpl?: FetchLike;
  sleepImpl?: SleepLike;
  signal?: AbortSignal;
};

type UnknownRecord = Record<string, unknown>;

export class InputValidationError extends Error {
  override name = "InputValidationError";
}

export class NetworkRequestError extends Error {
  override name = "NetworkRequestError";
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.cause = cause;
  }
}

export class HttpResponseError extends Error {
  override name = "HttpResponseError";
  readonly status: number;
  constructor(
    status: number,
    message: string,
  ) {
    super(message);
    this.status = status;
  }
}

export class JsonRpcResponseError extends Error {
  override name = "JsonRpcResponseError";
  readonly code: number;
  constructor(
    code: number,
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}

export class McpToolResponseError extends Error {
  override name = "McpToolResponseError";
}

export function normalizeCountryCode(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z]{2}$/u.test(normalized)) {
    throw new InputValidationError(
      "The selected country must be a two-letter ISO 3166-1 alpha-2 code.",
    );
  }
  return normalized;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function redactSensitiveText(value: string): string {
  return value
    .replace(/([?&]apiKey=)[^&\s]+/giu, "$1[REDACTED]")
    .replace(/(x-api-key\s*[:=]\s*)[^\s,;]+/giu, "$1[REDACTED]")
    .replace(/(authorization\s*[:=]\s*ApiKey\s+)[^\s,;]+/giu, "$1[REDACTED]");
}

function safeErrorMessage(value: unknown, fallback: string): string {
  if (!isRecord(value)) return redactSensitiveText(fallback);
  return redactSensitiveText(asString(value.message) || asString(value.error) || fallback);
}

function retryAfterMilliseconds(response: Response, fallback: number): number {
  const raw = response.headers.get("retry-after");
  if (!raw) return fallback;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(raw);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return fallback;
}

const defaultSleep: SleepLike = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function requestJson(
  input: string | URL,
  init: RequestInit,
  options: RetryOptions = {},
): Promise<unknown> {
  const fetchImpl = options.fetchImpl || fetch;
  const sleepImpl = options.sleepImpl || defaultSleep;
  const maxRetries = options.maxRetries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 250;

  for (let attempt = 0; ; attempt += 1) {
    let response: Response;
    try {
      response = await fetchImpl(input, init);
    } catch (error) {
      if (attempt < maxRetries) {
        await sleepImpl(baseDelayMs * 2 ** attempt);
        continue;
      }
      throw new NetworkRequestError("Geoapify network request failed after bounded retries.", error);
    }

    let body: unknown = undefined;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("json")) {
      try {
        body = await response.json();
      } catch {
        body = undefined;
      }
    }

    if (response.ok) return body;

    const transient = response.status === 429 || response.status >= 500;
    if (transient && attempt < maxRetries) {
      const fallback = baseDelayMs * 2 ** attempt;
      await sleepImpl(retryAfterMilliseconds(response, fallback));
      continue;
    }

    throw new HttpResponseError(
      response.status,
      safeErrorMessage(body, `Geoapify returned HTTP ${response.status}.`),
    );
  }
}

function normalizeCandidate(value: unknown): Candidate {
  const item = isRecord(value) ? value : {};
  const rank = isRecord(item.rank) ? item.rank : {};
  return {
    formatted: asString(item.formatted),
    address_line1: asString(item.address_line1),
    address_line2: asString(item.address_line2),
    lon: asNumber(item.lon),
    lat: asNumber(item.lat),
    place_id: asString(item.place_id),
    result_type: asString(item.result_type),
    housenumber: asString(item.housenumber),
    street: asString(item.street),
    postcode: asString(item.postcode),
    city: asString(item.city),
    county: asString(item.county),
    state: asString(item.state),
    country: asString(item.country),
    country_code: asString(item.country_code),
    confidence: asNumber(rank.confidence) ?? asNumber(item.confidence),
    confidence_city_level: asNumber(rank.confidence_city_level),
    confidence_street_level: asNumber(rank.confidence_street_level),
    confidence_building_level: asNumber(rank.confidence_building_level),
    match_type: asString(rank.match_type),
  };
}

function cleanUndefined<T extends UnknownRecord>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as T;
}

export function normalizeCandidates(values: unknown): Candidate[] {
  if (!Array.isArray(values)) return [];
  return values.map((value) => cleanUndefined(normalizeCandidate(value)));
}

export async function geocodeDirect(
  query: string,
  apiKey: string,
  options: RetryOptions & {
    baseUrl?: string;
    limit?: number;
    lang?: string;
    countryBias?: "none" | "auto";
    countryCode?: string;
  } = {},
): Promise<DirectEvidence> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) throw new InputValidationError("The geocoding query must not be empty.");
  if (normalizedQuery.length > 1024) {
    throw new InputValidationError("The geocoding query must not exceed 1024 characters.");
  }
  const limit = options.limit ?? 5;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new InputValidationError("The direct geocoding limit must be an integer from 1 to 100.");
  }

  const url = new URL(`${options.baseUrl || "https://api.geoapify.com/v1"}/geocode/search`);
  url.searchParams.set("text", normalizedQuery);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("lang", options.lang || "en");
  url.searchParams.set("bias", `countrycode:${options.countryBias || "none"}`);
  const countryCode = normalizeCountryCode(options.countryCode);
  if (countryCode) url.searchParams.set("countrycodes", countryCode);

  const body = await requestJson(
    url,
    { method: "GET", headers: { "x-api-key": apiKey, accept: "application/json" }, signal: options.signal },
    options,
  );
  if (!isRecord(body)) throw new Error("Direct geocoding returned an unexpected response envelope.");
  const queryObject = isRecord(body.query) ? body.query : undefined;
  const parsed = queryObject && isRecord(queryObject.parsed) ? queryObject.parsed : undefined;
  return {
    source: "direct",
    candidates: normalizeCandidates(body.results),
    parsedQuery: parsed,
  };
}

export type McpAuthMode = "x-api-key" | "authorization" | "query";

export async function callMcp(
  request: UnknownRecord,
  apiKey: string,
  options: RetryOptions & { baseUrl?: string; authMode?: McpAuthMode } = {},
): Promise<UnknownRecord> {
  const url = new URL(options.baseUrl || "https://api.geoapify.com/v1/mcp");
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
    "MCP-Protocol-Version": "2025-06-18",
  };
  const authMode = options.authMode || "x-api-key";
  if (authMode === "x-api-key") headers["x-api-key"] = apiKey;
  if (authMode === "authorization") headers.authorization = `ApiKey ${apiKey}`;
  if (authMode === "query") url.searchParams.set("apiKey", apiKey);

  const body = await requestJson(
    url,
    { method: "POST", headers, body: JSON.stringify(request), signal: options.signal },
    options,
  );
  if (!isRecord(body)) throw new Error("MCP returned an unexpected response envelope.");
  if (isRecord(body.error)) {
    throw new JsonRpcResponseError(
      asNumber(body.error.code) ?? 0,
      redactSensitiveText(asString(body.error.message) || "MCP returned a JSON-RPC error."),
    );
  }
  if (!isRecord(body.result)) throw new Error("MCP response did not contain a result object.");
  if (body.result.isError === true) {
    throw new McpToolResponseError("MCP tool execution returned result.isError=true.");
  }
  return body;
}

export async function listMcpTools(
  apiKey: string,
  options: RetryOptions & { baseUrl?: string; authMode?: McpAuthMode } = {},
): Promise<string[]> {
  const body = await callMcp(
    { jsonrpc: "2.0", id: "tools-list", method: "tools/list" },
    apiKey,
    options,
  );
  const result = body.result as UnknownRecord;
  const tools = Array.isArray(result.tools) ? result.tools : [];
  return tools
    .map((tool) => (isRecord(tool) ? asString(tool.name) : undefined))
    .filter((name): name is string => Boolean(name));
}

export async function geocodeMcp(
  query: string,
  apiKey: string,
  options: RetryOptions & {
    baseUrl?: string;
    authMode?: McpAuthMode;
    limit?: number;
    lang?: string;
    countryCode?: string;
  } = {},
): Promise<McpEvidence> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) throw new InputValidationError("The MCP geocoding query must not be empty.");
  if (normalizedQuery.length > 1024) {
    throw new InputValidationError("The MCP geocoding query must not exceed 1024 characters.");
  }
  const limit = options.limit ?? 5;
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
    throw new InputValidationError("The MCP geocoding limit must be an integer from 1 to 10.");
  }
  const countryCode = normalizeCountryCode(options.countryCode);
  const argumentsObject: UnknownRecord = {
    query: normalizedQuery,
    limit,
    lang: options.lang || "en",
  };
  if (countryCode) argumentsObject.country_codes = [countryCode];

  const body = await callMcp(
    {
      jsonrpc: "2.0",
      id: `geocode-${Date.now()}`,
      method: "tools/call",
      params: {
        name: "geocode_address",
        arguments: argumentsObject,
      },
    },
    apiKey,
    options,
  );
  const result = body.result as UnknownRecord;
  const structured = isRecord(result.structuredContent) ? result.structuredContent : {};
  return {
    source: "mcp",
    candidates: normalizeCandidates(structured.results),
    normalizedQuery: asString(structured.query),
  };
}

function radians(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceMeters(a: Candidate, b: Candidate): number | undefined {
  if (a.lat === undefined || a.lon === undefined || b.lat === undefined || b.lon === undefined) {
    return undefined;
  }
  const earthRadius = 6_371_000;
  const dLat = radians(b.lat - a.lat);
  const dLon = radians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

export function compareEvidence(direct: DirectEvidence, mcp: McpEvidence): UnknownRecord {
  const directTop = direct.candidates[0];
  const mcpTop = mcp.candidates[0];
  const directIds = new Set(direct.candidates.map((item) => item.place_id).filter(Boolean));
  const overlap = mcp.candidates.filter((item) => item.place_id && directIds.has(item.place_id)).length;
  return cleanUndefined({
    directCandidateCount: direct.candidates.length,
    mcpCandidateCount: mcp.candidates.length,
    topPlaceIdEqual:
      directTop?.place_id !== undefined && mcpTop?.place_id !== undefined
        ? directTop.place_id === mcpTop.place_id
        : undefined,
    topCoordinateDistanceMeters:
      directTop && mcpTop ? distanceMeters(directTop, mcpTop) : undefined,
    candidatePlaceIdOverlapCount: overlap,
    directHasParsedQuery: direct.parsedQuery !== undefined,
    mcpHasParsedQuery: false,
  });
}

export function describeError(error: unknown): UnknownRecord {
  if (error instanceof HttpResponseError) {
    return { category: "http", status: error.status, message: redactSensitiveText(error.message) };
  }
  if (error instanceof JsonRpcResponseError) {
    return { category: "json-rpc", code: error.code, message: redactSensitiveText(error.message) };
  }
  if (error instanceof McpToolResponseError) {
    return { category: "mcp-tool", message: error.message };
  }
  if (error instanceof InputValidationError) {
    return { category: "input", message: error.message };
  }
  if (error instanceof NetworkRequestError) {
    return { category: "network", message: error.message };
  }
  return {
    category: "unexpected",
    message: redactSensitiveText(error instanceof Error ? error.message : "Unknown error"),
  };
}
