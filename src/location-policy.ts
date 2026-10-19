import {
  InputValidationError,
  normalizeCountryCode,
  type Candidate,
  type DirectEvidence,
  type McpEvidence,
} from "./geoapify.ts";

export const LOCATION_CONTEXT_POLICY_VERSION = "1.0.0";

export type ProcessingMode = "single" | "batch";
export type ReviewStatus = "clarification_required" | "review_required" | "ready";

export type LocationPolicyInput = {
  processingMode: ProcessingMode;
  selectedCountryCode?: string;
  direct: DirectEvidence;
  mcp?: McpEvidence;
  selectedCandidatePlaceId?: string;
  humanConfirmed?: boolean;
};

export type LocationPolicyDecision = {
  policyVersion: string;
  status: ReviewStatus;
  readyForDispatch: boolean;
  selectedCountryCode?: string;
  reasons: string[];
  providerDisagreement: boolean;
  evidence: {
    directCandidates: Candidate[];
    mcpCandidates: Candidate[];
  };
};

export function requireSelectedCountry(
  processingMode: ProcessingMode,
  selectedCountryCode: string | undefined,
): string | undefined {
  const normalized = normalizeCountryCode(selectedCountryCode);
  if (processingMode === "batch" && !normalized) {
    throw new InputValidationError(
      "Batch address processing requires an operator-selected country.",
    );
  }
  return normalized;
}

function candidateIdentity(candidate: Candidate | undefined): string | undefined {
  if (!candidate) return undefined;
  if (candidate.place_id) return `place:${candidate.place_id}`;
  if (candidate.lat !== undefined && candidate.lon !== undefined) {
    return `coordinate:${candidate.lon},${candidate.lat}`;
  }
  return candidate.formatted ? `formatted:${candidate.formatted}` : undefined;
}

function hasMeaningfulProviderDisagreement(
  directCandidates: Candidate[],
  mcpCandidates: Candidate[],
): boolean {
  const directTop = candidateIdentity(directCandidates[0]);
  const mcpTop = candidateIdentity(mcpCandidates[0]);
  if (!directTop && !mcpTop) return false;
  return directTop !== mcpTop;
}

export function evaluateLocationPolicy(input: LocationPolicyInput): LocationPolicyDecision {
  const selectedCountryCode = requireSelectedCountry(
    input.processingMode,
    input.selectedCountryCode,
  );
  const directCandidates = [...input.direct.candidates];
  const mcpCandidates = [...(input.mcp?.candidates || [])];
  const allCandidates = [...directCandidates, ...mcpCandidates];
  const reasons: string[] = [];

  if (!selectedCountryCode) reasons.push("country_context_missing");
  if (allCandidates.length === 0) reasons.push("no_candidates");
  if (directCandidates.length > 1 || mcpCandidates.length > 1) {
    reasons.push("multiple_candidates");
  }

  const providerDisagreement = input.mcp
    ? hasMeaningfulProviderDisagreement(directCandidates, mcpCandidates)
    : false;
  if (providerDisagreement) reasons.push("provider_disagreement");

  if (
    selectedCountryCode &&
    allCandidates.some(
      (candidate) =>
        candidate.country_code !== undefined &&
        candidate.country_code.toLowerCase() !== selectedCountryCode,
    )
  ) {
    reasons.push("candidate_country_mismatch");
  }
  if (
    selectedCountryCode &&
    allCandidates.some((candidate) => candidate.country_code === undefined)
  ) {
    reasons.push("candidate_country_missing");
  }

  const selectedCandidateExists = Boolean(
    input.selectedCandidatePlaceId &&
      allCandidates.some((candidate) => candidate.place_id === input.selectedCandidatePlaceId),
  );
  if (input.selectedCandidatePlaceId && !selectedCandidateExists) {
    reasons.push("selected_candidate_not_found");
  }

  const canBeReady = Boolean(
    selectedCountryCode &&
      selectedCandidateExists &&
      input.humanConfirmed === true &&
      allCandidates.length > 0,
  );
  if (!canBeReady) reasons.push("human_confirmation_required");

  let status: ReviewStatus = "review_required";
  if (
    !selectedCountryCode ||
    allCandidates.length === 0 ||
    reasons.includes("candidate_country_mismatch") ||
    reasons.includes("candidate_country_missing")
  ) {
    status = "clarification_required";
  } else if (canBeReady) {
    status = "ready";
  }

  return {
    policyVersion: LOCATION_CONTEXT_POLICY_VERSION,
    status,
    readyForDispatch: status === "ready",
    selectedCountryCode,
    reasons,
    providerDisagreement,
    evidence: { directCandidates, mcpCandidates },
  };
}
