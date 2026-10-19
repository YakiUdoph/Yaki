export const REVIEW_STATUSES = Object.freeze({
  pending: "pending",
  needsReview: "needs_review",
  ready: "ready",
  noMatch: "no_match",
  checkFailed: "check_failed",
});

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
