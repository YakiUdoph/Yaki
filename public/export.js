import { isReadyForExport } from "./review-model.js";

const FORMULA_PREFIX = /^[\t\r ]*[=+\-@]/u;

export function protectSpreadsheetCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  return FORMULA_PREFIX.test(text) ? `'${text}` : text;
}

export function encodeCsvCell(value) {
  const protectedValue = protectSpreadsheetCell(value);
  return /[",\r\n]/u.test(protectedValue)
    ? `"${protectedValue.replaceAll('"', '""')}"`
    : protectedValue;
}

export function recordsToCsv(records) {
  const headers = [
    "original_address",
    "reviewed_address",
    "status",
    "selected_result",
    "latitude",
    "longitude",
    "country_code",
    "last_action",
    "last_action_at",
  ];
  const lines = [headers.join(",")];
  for (const record of records) {
    const selected = record.candidates.find((candidate) => candidate.place_id === record.selectedPlaceId);
    const latest = record.history.at(-1);
    lines.push([
      record.originalAddress,
      record.workingAddress,
      record.status,
      selected?.formatted,
      selected?.lat,
      selected?.lon,
      selected?.country_code,
      latest?.action,
      latest?.timestamp,
    ].map(encodeCsvCell).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function partitionRecords(records) {
  return {
    approved: records.filter(isReadyForExport),
    unresolved: records.filter((record) => !isReadyForExport(record)),
  };
}
