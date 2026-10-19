import {
  describeError,
  geocodeDirect,
  type Candidate,
  type FetchLike,
} from "./geoapify.ts";
import { evaluateLocationPolicy } from "./location-policy.ts";

export type AddressCheckStatus = "needs_review" | "no_match";

export type AddressCheckResult = {
  status: AddressCheckStatus;
  originalAddress: string;
  countryCode: string;
  candidates: Candidate[];
  parsedQuery?: Record<string, unknown>;
  policy: {
    version: string;
    status: string;
    readyForDispatch: false;
    reasons: string[];
  };
};

export async function checkAddress(
  input: { address: string; countryCode: string },
  apiKey: string,
  options: { baseUrl?: string; fetchImpl?: FetchLike; signal?: AbortSignal; maxRetries?: number } = {},
): Promise<AddressCheckResult> {
  const address = input.address.trim();
  const direct = await geocodeDirect(address, apiKey, {
    baseUrl: options.baseUrl,
    fetchImpl: options.fetchImpl,
    signal: options.signal,
    maxRetries: options.maxRetries,
    countryCode: input.countryCode,
    countryBias: "none",
    limit: 10,
  });
  const decision = evaluateLocationPolicy({
    processingMode: "batch",
    selectedCountryCode: input.countryCode,
    direct,
  });

  return {
    status: direct.candidates.length === 0 ? "no_match" : "needs_review",
    originalAddress: address,
    countryCode: decision.selectedCountryCode || input.countryCode.toLowerCase(),
    candidates: direct.candidates,
    parsedQuery: direct.parsedQuery,
    policy: {
      version: decision.policyVersion,
      status: decision.status,
      readyForDispatch: false,
      reasons: decision.reasons,
    },
  };
}

export function publicCheckError(error: unknown): {
  status: "check_failed";
  error: { category: string; message: string; retryable: boolean };
} {
  const described = describeError(error);
  const category = typeof described.category === "string" ? described.category : "unexpected";
  const status = typeof described.status === "number" ? described.status : undefined;
  const retryable = category === "network" || status === 429 || (status !== undefined && status >= 500);

  const messages: Record<string, string> = {
    input: "Check the address and selected country, then try again.",
    network: "The address service could not be reached. Try again shortly.",
    http: status === 429
      ? "The address service is busy or the request limit was reached. Try again shortly."
      : "The address service could not complete this check.",
  };
  return {
    status: "check_failed",
    error: {
      category,
      message: messages[category] || "The address check could not be completed.",
      retryable,
    },
  };
}
