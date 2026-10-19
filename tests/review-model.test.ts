import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyCheckFailure,
  applyCheckResult,
  clearSession,
  confirmReady,
  createReviewRecord,
  editForRecheck,
  selectCandidate,
} from "../public/review-model.js";

const timestamp = "2026-10-18T10:00:00.000Z";
const candidates = [
  { place_id: "one", formatted: "Springfield, IL", country_code: "us", confidence: 1 },
  { place_id: "two", formatted: "Springfield, MA", country_code: "us", confidence: 1 },
];

test("ambiguous candidates stay in review until selection and confirmation", () => {
  const initial = createReviewRecord("Springfield", 2, "row-1");
  const checked = applyCheckResult(initial, { candidates }, timestamp);
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
  const empty = applyCheckResult(initial, { candidates: [] }, timestamp);
  assert.equal(empty.status, "no_match");
  const failed = applyCheckFailure(initial, { message: "Service unavailable", retryable: true }, timestamp);
  assert.equal(failed.status, "check_failed");
  const corrected = editForRecheck(empty, "10 Downing Street", timestamp);
  assert.equal(corrected.workingAddress, "10 Downing Street");
  assert.equal(corrected.originalAddress, "Unknown");
  assert.equal(corrected.status, "pending");
  assert.equal(corrected.history.at(-1)?.action, "Address edited for recheck");
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
