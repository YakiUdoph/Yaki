export const REVIEW_STATUSES = Object.freeze({
  pending: "pending",
  needsReview: "needs_review",
  ready: "ready",
  noMatch: "no_match",
  checkFailed: "check_failed",
});

const CONFIRMABLE_POLICY_STATUSES = new Set(["review_required", "ready"]);

const CLARIFICATION_MESSAGES = Object.freeze({
  country_context_missing: "Choose a destination country, then check the address again.",
  no_candidates: "No matching location was returned. Correct the address or country, then check again.",
  candidate_country_mismatch: "A returned location is outside the selected destination country. Correct the address or country, then check again.",
  candidate_country_missing: "Geoapify did not provide country information for a returned location. Correct the address and check again before dispatch.",
  selected_candidate_not_found: "The selected location is no longer available. Select a current candidate and review it again.",
});

export function policyAllowsConfirmation(record) {
  return CONFIRMABLE_POLICY_STATUSES.has(record.policy?.status);
}

export function reviewBlockMessages(record) {
  if (record.policy?.status === "clarification_required") {
    const messages = (record.policy.reasons || [])
      .map((reason) => CLARIFICATION_MESSAGES[reason])
      .filter(Boolean);
    return [...new Set(messages.length > 0
      ? messages
      : ["This address needs clarification. Correct it and check again before dispatch."])];
  }
  if (!policyAllowsConfirmation(record)) {
    return ["The address review policy is unavailable. Check the address again before dispatch."];
  }
  return [];
}

export function isReadyForExport(record) {
  return record.status === REVIEW_STATUSES.ready && policyAllowsConfirmation(record);
}

function event(action, timestamp, selectedResult) {
  return {
    action,
    timestamp: timestamp || new Date().toISOString(),
    ...(selectedResult ? { selectedResult } : {}),
  };
}

export function createReviewRecord(originalAddress, sourceLine, id) {
  const address = String(originalAddress || "").trim();
  if (!address) throw new Error("Address must not be empty.");
  return {
    id: id || crypto.randomUUID(),
    sourceLine,
    originalAddress: address,
    workingAddress: address,
    status: REVIEW_STATUSES.pending,
    candidates: [],
    selectedPlaceId: undefined,
    error: undefined,
    history: [],
  };
}

export function beginCheck(record, timestamp) {
  return {
    ...record,
    status: REVIEW_STATUSES.pending,
    candidates: [],
    selectedPlaceId: undefined,
    error: undefined,
    history: [...record.history, event("Address check started", timestamp)],
  };
}

export function applyCheckResult(record, result, timestamp) {
  const candidates = Array.isArray(result.candidates) ? [...result.candidates] : [];
  const status = candidates.length === 0 ? REVIEW_STATUSES.noMatch : REVIEW_STATUSES.needsReview;
  return {
    ...record,
    status,
    candidates,
    selectedPlaceId: undefined,
    error: undefined,
    policy: result.policy,
    history: [
      ...record.history,
      event(candidates.length === 0 ? "No matching candidate found" : "Candidates received", timestamp),
    ],
  };
}

export function applyCheckFailure(record, error, timestamp) {
  return {
    ...record,
    status: REVIEW_STATUSES.checkFailed,
    candidates: [],
    selectedPlaceId: undefined,
    error,
    history: [...record.history, event("Address check failed", timestamp)],
  };
}

export function selectCandidate(record, placeId, timestamp) {
  const candidate = record.candidates.find((item) => item.place_id === placeId);
  if (!candidate) throw new Error("Selected candidate is not part of this address check.");
  return {
    ...record,
    selectedPlaceId: placeId,
    status: REVIEW_STATUSES.needsReview,
    history: [
      ...record.history,
      event("Candidate selected", timestamp, candidate.formatted || placeId),
    ],
  };
}

export function editForRecheck(record, address, timestamp) {
  const workingAddress = String(address || "").trim();
  if (!workingAddress) throw new Error("Corrected address must not be empty.");
  return {
    ...record,
    workingAddress,
    status: REVIEW_STATUSES.pending,
    candidates: [],
    selectedPlaceId: undefined,
    error: undefined,
    history: [...record.history, event("Address edited for recheck", timestamp)],
  };
}

export function confirmReady(record, explicitlyConfirmed, timestamp) {
  const blocked = reviewBlockMessages(record);
  if (blocked.length > 0) throw new Error(blocked[0]);
  if (explicitlyConfirmed !== true) throw new Error("Human confirmation is required.");
  const candidate = record.candidates.find((item) => item.place_id === record.selectedPlaceId);
  if (!candidate) throw new Error("Select a candidate before marking this address ready.");
  return {
    ...record,
    status: REVIEW_STATUSES.ready,
    history: [
      ...record.history,
      event("Marked ready after human confirmation", timestamp, candidate.formatted || candidate.place_id),
    ],
  };
}

export function newSessionState() {
  return {
    countryCode: "",
    records: [],
    csv: undefined,
    selectedColumn: "",
    checking: false,
  };
}

export function clearSession() {
  return newSessionState();
}
