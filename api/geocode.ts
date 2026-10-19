import { checkAddress, publicCheckError, type AddressCheckResult } from "../src/app-service.ts";
import {
  isCheckInput,
  isCrossSiteRequest,
  jsonResponse,
  MAX_JSON_BODY_BYTES,
  MemoryRateLimiter,
  requestClientKey,
  type CheckInput,
} from "../src/request-policy.ts";

type CheckOperation = (input: CheckInput, signal: AbortSignal) => Promise<AddressCheckResult>;

const productionLimiter = new MemoryRateLimiter(60, 60_000);

async function readJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
    throw new Error("REQUEST_TOO_LARGE");
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BODY_BYTES) {
    throw new Error("REQUEST_TOO_LARGE");
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("INVALID_JSON");
  }
}

function defaultCheck(input: CheckInput, signal: AbortSignal): Promise<AddressCheckResult> {
  const apiKey = process.env.GEOAPIFY_API_KEY?.trim();
  if (!apiKey) throw new Error("MISSING_CONFIGURATION");
  const upstreamSignal = AbortSignal.any([signal, AbortSignal.timeout(15_000)]);
  return checkAddress(input, apiKey, {
    baseUrl: process.env.GEOAPIFY_API_BASE_URL?.trim() || "https://api.geoapify.com/v1",
    signal: upstreamSignal,
    maxRetries: 1,
  });
}

export function createGeocodeFunction(options: {
  check?: CheckOperation;
  limiter?: MemoryRateLimiter;
} = {}) {
  const check = options.check || defaultCheck;
  const limiter = options.limiter || productionLimiter;

  return async function fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return jsonResponse(405, { error: "Method not allowed" }, { allow: "POST" });
    }
    if (isCrossSiteRequest(request)) {
      return jsonResponse(403, {
        status: "check_failed",
        error: { category: "origin", message: "Cross-site address checks are not allowed.", retryable: false },
      });
    }
    if (!limiter.allow(requestClientKey(request))) {
      return jsonResponse(429, {
        status: "check_failed",
        error: { category: "rate_limit", message: "Too many checks. Wait a moment and retry.", retryable: true },
      }, { "retry-after": "60" });
    }
    if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
      return jsonResponse(415, {
        status: "check_failed",
        error: { category: "input", message: "Request content type must be application/json.", retryable: false },
      });
    }

    try {
      const body = await readJson(request);
      if (!isCheckInput(body)) {
        return jsonResponse(400, {
          status: "check_failed",
          error: { category: "input", message: "Enter an address and select a destination country.", retryable: false },
        });
      }
      return jsonResponse(200, await check(body, request.signal));
    } catch (error) {
      if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") {
        return jsonResponse(413, {
          status: "check_failed",
          error: { category: "input", message: "Request is too large.", retryable: false },
        });
      }
      if (error instanceof Error && error.message === "INVALID_JSON") {
        return jsonResponse(400, {
          status: "check_failed",
          error: { category: "input", message: "Request body must be valid JSON.", retryable: false },
        });
      }
      if (error instanceof Error && error.message === "MISSING_CONFIGURATION") {
        return jsonResponse(503, {
          status: "check_failed",
          error: { category: "configuration", message: "Address checking is not configured.", retryable: false },
        });
      }
      const safe = publicCheckError(error);
      console.error("Yaki geocode request failed.", {
        category: safe.error.category,
        retryable: safe.error.retryable,
      });
      return jsonResponse(502, safe);
    }
  };
}

export default { fetch: createGeocodeFunction() };
