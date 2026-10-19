import assert from "node:assert/strict";
import { test } from "node:test";
import { CsvValidationError, parseCsv } from "../public/csv.js";
import { partitionRecords, recordsToCsv } from "../public/export.js";

test("CSV parser handles BOM, quoted commas, quotes, and line breaks", () => {
  const parsed = parseCsv('\uFEFFid,address,note\r\n1,"10 Main St, Boston","Gate ""B"""\r\n2,"Line one\nLine two",ok\r\n');
  assert.deepEqual(parsed.headers, ["id", "address", "note"]);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].values.address, "10 Main St, Boston");
  assert.equal(parsed.rows[0].values.note, 'Gate "B"');
  assert.equal(parsed.rows[1].values.address, "Line one\nLine two");
});

test("CSV parser reports malformed rows without silently dropping the problem", () => {
  const parsed = parseCsv("id,address\n1,First\n2,Second,Unexpected\n3,Third\n");
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.errors.length, 1);
  assert.match(parsed.errors[0].message, /expected 2/u);
});

test("CSV parser rejects malformed quotes, nulls, size, and row overflow", () => {
  assert.throws(() => parseCsv('address\n"unterminated'), CsvValidationError);
  assert.throws(() => parseCsv("address\nnull\0value"), CsvValidationError);
  assert.throws(() => parseCsv("address\nlong", { maxBytes: 4 }), CsvValidationError);
  assert.throws(() => parseCsv("address\none\ntwo\n", { maxRows: 1 }), CsvValidationError);
});

test("CSV export separates ready and unresolved records and neutralizes formulas", () => {
  const candidate = {
    place_id: "selected",
    formatted: "=WEBSERVICE(\"bad\")",
    lat: 10,
    lon: 20,
    country_code: "us",
  };
  const ready = {
    originalAddress: "+SUM(A1:A2)",
    workingAddress: "@unsafe",
    status: "ready",
    candidates: [candidate],
    selectedPlaceId: "selected",
    history: [{ action: "Marked ready", timestamp: "2026-10-18T00:00:00.000Z" }],
  };
  const unresolved = { ...ready, status: "no_match", selectedPlaceId: undefined };
  const partition = partitionRecords([ready, unresolved]);
  assert.equal(partition.approved.length, 1);
  assert.equal(partition.unresolved.length, 1);
  const csv = recordsToCsv(partition.approved);
  assert.equal(csv.startsWith("\uFEFF"), true);
  assert.match(csv, /'\+SUM/u);
  assert.match(csv, /'@unsafe/u);
  assert.match(csv, /'=WEBSERVICE/u);
});
