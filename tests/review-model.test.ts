import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyCheckFailure,
  applyCheckResult,
  clearSession,
  confirmReady,
  createReviewRecord,
  editForRecheck,
  isReadyForExport,
  selectCandidate,
} from "../public/review-model.js";

const timestamp = "2026-10-18T10:00:00.000Z";
const candidates = [
  { place_id: "one", formatted: "Springfield, IL", country_code: "us", confidence: 1 },
  { place_id: "two", formatted: "Springfield, MA", country_code: "us", confidence: 1 },
];

const reviewPolicy = {
  version: "1.0.0",
  status: "review_required",
  readyForDispatch: false,
  reasons: ["multiple_candidates", "human_confirmation_required"],
};

test("ambiguous candidates stay in review until selection and confirmation", () => {
  const initial = createReviewRecord("Springfield", 2, "row-1");
  const checked = applyCheckResult(initial, { candidates, policy: reviewPolicy }, timestamp);
  assert.equal(checked.status, "needs_review");
  assert.equal(checked.candidates.length, 2);
  assert.throws(() => confirmReady(checked, true), /Select a candidate/u);
  const selected = selectCandidate(checked, "one", timestamp);
  assert.throws(() => confirmReady(selected, false), /Human confirmation/u);
  const ready = confirmReady(selected, true, timestamp);
  assert.equal(ready.status, "ready");
  assert.equal(ready.history.at(-1)?.action, "Marked ready after human confirmation");
});

test("empty results, failure, and correction remain distinct", () => {
  const initial = createReviewRecord("Unknown", undefined, "row-2");
  const empty = applyCheckResult(initial, {
    candidates: [],
    policy: {
      version: "1.0.0",
      status: "clarification_required",
      readyForDispatch: false,
      reasons: ["no_candidates", "human_confirmation_required"],
    },
  }, timestamp);
  assert.equal(empty.status, "no_match");
  const failed = applyCheckFailure(initial, { message: "Service unavailable", retryable: true }, timestamp);
  assert.equal(failed.status, "check_failed");
  const corrected = editForRecheck(empty, "10 Downing Street", timestamp);
  assert.equal(corrected.workingAddress, "10 Downing Street");
  assert.equal(corrected.originalAddress, "Unknown");
  assert.equal(corrected.status, "pending");
  assert.equal(corrected.history.at(-1)?.action, "Address edited for recheck");
});

test("missing candidate country keeps the record blocked and out of ready export", () => {
  const checked = applyCheckResult(createReviewRecord("Unknown country", undefined, "missing-country"), {
    candidates: [{ place_id: "unknown", formatted: "Unknown country" }],
    policy: {
      version: "1.0.0",
      status: "clarification_required",
      readyForDispatch: false,
      reasons: ["candidate_country_missing", "human_confirmation_required"],
    },
  }, timestamp);
  const selected = selectCandidate(checked, "unknown", timestamp);
  assert.throws(() => confirmReady(selected, true), /did not provide country information/u);
  assert.equal(isReadyForExport({ ...selected, status: "ready" }), false);
});

test("candidate country mismatch cannot be confirmed", () => {
  const checked = applyCheckResult(createReviewRecord("Springfield", undefined, "country-mismatch"), {
    candidates: [{ place_id: "springfield-ca", formatted: "Springfield, Canada", country_code: "ca" }],
    policy: {
      version: "1.0.0",
      status: "clarification_required",
      readyForDispatch: false,
      reasons: ["candidate_country_mismatch", "human_confirmation_required"],
    },
  }, timestamp);
  const selected = selectCandidate(checked, "springfield-ca", timestamp);
  assert.throws(() => confirmReady(selected, true), /outside the selected destination country/u);
});

test("clarification-required response remains unresolved even if its status is tampered with", () => {
  const checked = applyCheckResult(createReviewRecord("Blocked", undefined, "blocked"), {
    candidates: [{ place_id: "blocked-place", formatted: "Blocked place", country_code: "us" }],
    policy: {
      version: "1.0.0",
      status: "clarification_required",
      readyForDispatch: false,
      reasons: ["candidate_country_mismatch"],
    },
  }, timestamp);
  assert.equal(isReadyForExport({ ...checked, status: "ready" }), false);
});

test("valid policy still permits explicit candidate confirmation and ready export", () => {
  const checked = applyCheckResult(createReviewRecord("Springfield", undefined, "valid"), {
    candidates,
    policy: reviewPolicy,
  }, timestamp);
  const ready = confirmReady(selectCandidate(checked, "one", timestamp), true, timestamp);
  assert.equal(ready.status, "ready");
  assert.equal(isReadyForExport(ready), true);
});

test("candidate changes revoke ready state and require confirmation again", () => {
  const checked = applyCheckResult(createReviewRecord("Springfield", undefined, "reselection"), {
    candidates,
    policy: reviewPolicy,
  }, timestamp);
  const firstReady = confirmReady(selectCandidate(checked, "one", timestamp), true, timestamp);
  const changed = selectCandidate(firstReady, "two", timestamp);
  assert.equal(changed.status, "needs_review");
  assert.equal(isReadyForExport(changed), false);
  assert.throws(() => confirmReady(changed, false), /Human confirmation/u);
  assert.equal(confirmReady(changed, true, timestamp).status, "ready");
});

test("clear session removes country, records, imported data, and review state", () => {
  assert.deepEqual(clearSession(), {
    countryCode: "",
    records: [],
    csv: undefined,
    selectedColumn: "",
    checking: false,
  });
});
