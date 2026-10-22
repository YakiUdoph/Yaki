import { countryOptions } from "./countries.js";
import { CsvValidationError, parseCsv } from "./csv.js";
import { partitionRecords, recordsToCsv } from "./export.js";
import { AddressApiRequestError, requestAddressCheck } from "./api-client.js";
import {
  REVIEW_STATUSES,
  applyCheckFailure,
  applyCheckResult,
  beginCheck,
  clearSession,
  candidateReviewMessage,
  confirmReady,
  createReviewRecord,
  editForRecheck,
  newSessionState,
  policyAllowsConfirmation,
  reviewBlockMessages,
  reviewProgressMessage,
  selectCandidate,
} from "./review-model.js";

let state = newSessionState();
let activeFilter = "all";

const elements = {
  country: document.querySelector("#country-select"),
  singleForm: document.querySelector("#single-address-form"),
  singleAddress: document.querySelector("#single-address"),
  file: document.querySelector("#csv-file"),
  fileLabel: document.querySelector("#file-label"),
  previewPanel: document.querySelector("#csv-preview-panel"),
  addressColumn: document.querySelector("#address-column"),
  previewHead: document.querySelector("#preview-head"),
  previewBody: document.querySelector("#preview-body"),
  csvErrors: document.querySelector("#csv-errors"),
  rowCount: document.querySelector("#row-count"),
  importButton: document.querySelector("#import-button"),
  message: document.querySelector("#global-message"),
  progress: document.querySelector("#batch-progress"),
  empty: document.querySelector("#queue-empty"),
  list: document.querySelector("#record-list"),
  exportReady: document.querySelector("#export-ready"),
  exportUnresolved: document.querySelector("#export-unresolved"),
  clearButton: document.querySelector("#clear-session-button"),
  clearDialog: document.querySelector("#clear-dialog"),
  confirmClear: document.querySelector("#confirm-clear"),
};

function showMessage(text, kind = "") {
  elements.message.textContent = text;
  elements.message.className = `message ${kind}`.trim();
  elements.message.hidden = !text;
}

function replaceRecord(updated) {
  state.records = state.records.map((record) => record.id === updated.id ? updated : record);
}

function formatStatus(status) {
  return ({
    pending: "Checking",
    needs_review: "Needs review",
    ready: "Ready",
    no_match: "No match",
    check_failed: "Check failed",
  })[status] || "Needs review";
}

function matchLabel(matchType) {
  return ({
    full_match: "Full location match",
    inner_part: "Matched within a larger place",
    match_by_building: "Building-level match",
    match_by_street: "Street-level match",
    match_by_postcode: "Postcode-level match",
    match_by_city_or_disrict: "City or district match",
    match_by_country_or_state: "Country or state match",
  })[matchType] || "Match information unavailable";
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function appendRecheckForm(container, record) {
  const form = makeElement("form", "recheck-form");
  form.setAttribute("aria-label", `Correct and recheck ${record.originalAddress}`);
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 1024;
  input.required = true;
  input.value = record.workingAddress;
  input.setAttribute("aria-label", "Corrected address");
  const button = makeElement("button", "button button-secondary", "Edit and recheck");
  button.type = "submit";
  form.append(input, button);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const updated = editForRecheck(record, input.value);
      replaceRecord(updated);
      renderQueue();
      await runCheck(updated.id);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Enter a corrected address.", "error");
      input.focus();
    }
  });
  container.append(form);
}

function createGeoPreview(candidate) {
  const preview = makeElement("div", "geo-preview");
  const hasCoordinates = Number.isFinite(candidate.lon) && Number.isFinite(candidate.lat);
  preview.setAttribute(
    "aria-label",
    hasCoordinates
      ? `Geographic coordinate preview at latitude ${candidate.lat}, longitude ${candidate.lon}`
      : "Coordinates unavailable",
  );
  preview.setAttribute("role", "img");
  if (hasCoordinates) {
    const marker = makeElement("span", "geo-marker");
    marker.style.left = `${Math.max(5, Math.min(95, ((candidate.lon + 180) / 360) * 100))}%`;
    marker.style.top = `${Math.max(8, Math.min(92, ((90 - candidate.lat) / 180) * 100))}%`;
    const coordinates = makeElement(
      "span",
      "geo-coordinates",
      `${candidate.lat.toFixed(5)}, ${candidate.lon.toFixed(5)}`,
    );
    preview.append(marker, coordinates);
  } else {
    preview.append(makeElement("span", "geo-coordinates", "Coordinates unavailable"));
  }
  return preview;
}

function createHistory(record) {
  const details = makeElement("details", "history");
  const summary = document.createElement("summary");
  summary.textContent = `Review history (${record.history.length})`;
  details.append(summary);
  const list = makeElement("ol", "history-list");
  for (const item of record.history) {
    const entry = document.createElement("li");
    const action = makeElement("strong", "", item.action);
    const time = document.createTextNode(
      ` — ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.timestamp))}`,
    );
    entry.append(action, time);
    if (item.selectedResult) entry.append(document.createTextNode(` — ${item.selectedResult}`));
    list.append(entry);
  }
  details.append(list);
  return details;
}

function createCandidate(record, candidate, index) {
  const label = makeElement("label", "candidate");
  const radio = document.createElement("input");
  radio.type = "radio";
  radio.name = `candidate-${record.id}`;
  radio.value = candidate.place_id || "";
  radio.checked = Boolean(candidate.place_id && record.selectedPlaceId === candidate.place_id);
  radio.disabled = !candidate.place_id;
  radio.setAttribute("aria-label", `Select candidate ${index + 1}: ${candidate.formatted || "Unnamed location"}`);
  radio.addEventListener("change", () => {
    try {
      replaceRecord(selectCandidate(record, radio.value));
      renderQueue();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Candidate could not be selected.", "error");
    }
  });

  const body = makeElement("div", "candidate-body");
  body.append(makeElement("div", "candidate-title", candidate.formatted || "Unnamed location"));
  const meta = makeElement("div", "candidate-meta");
  meta.append(makeElement("span", "", matchLabel(candidate.match_type)));
  if (typeof candidate.confidence === "number") {
    meta.append(makeElement("span", "", `Match confidence ${Math.round(candidate.confidence * 100)}% — not delivery certainty`));
  }
  if (candidate.result_type) meta.append(makeElement("span", "", `Location type: ${candidate.result_type}`));
  body.append(meta);
  if (!candidate.place_id) {
    body.append(makeElement("p", "record-note", "This result has no selectable location identifier and must remain unresolved."));
  }
  label.append(radio, body, createGeoPreview(candidate));
  return label;
}

function createRecordCard(record, index) {
  const card = makeElement("article", "record-card");
  card.dataset.status = record.status;
  const summary = makeElement("div", "record-summary");
  summary.append(makeElement("span", "record-index", String(index + 1).padStart(2, "0")));
  const address = makeElement("div", "record-address");
  address.append(makeElement("strong", "", record.workingAddress));
  const originalNote = record.workingAddress === record.originalAddress
    ? `Original address${record.sourceLine ? ` · CSV line ${record.sourceLine}` : ""}`
    : `Original: ${record.originalAddress}`;
  address.append(makeElement("small", "", originalNote));
  summary.append(address, makeElement("span", `status-badge status-${record.status}`, formatStatus(record.status)));
  card.append(summary);

  const detail = makeElement("div", "record-detail");
  if (record.status === REVIEW_STATUSES.pending) {
    detail.append(makeElement("p", "record-note", "Checking this address against the selected country…"));
  } else if (record.status === REVIEW_STATUSES.noMatch) {
    detail.append(makeElement("div", "error-box", "No matching location was returned. Check the country and address details, then edit and recheck or leave unresolved."));
    appendRecheckForm(detail, record);
  } else if (record.status === REVIEW_STATUSES.checkFailed) {
    detail.append(makeElement("div", "error-box", record.error?.message || "The address service could not complete this check."));
    if (record.error?.retryable) {
      const retry = makeElement("button", "button button-secondary", "Retry check");
      retry.type = "button";
      retry.addEventListener("click", () => runCheck(record.id));
      detail.append(retry);
    }
    appendRecheckForm(detail, record);
  } else {
    detail.append(makeElement("p", "record-note", candidateReviewMessage(record)));
    const candidates = makeElement("div", "candidate-list");
    record.candidates.forEach((candidate, candidateIndex) => {
      candidates.append(createCandidate(record, candidate, candidateIndex));
    });
    detail.append(candidates);

    if (record.status !== REVIEW_STATUSES.ready && policyAllowsConfirmation(record)) {
      const controls = makeElement("div", "review-controls");
      const confirmation = makeElement("label", "confirm-check");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.disabled = !record.selectedPlaceId;
      confirmation.append(checkbox, document.createTextNode("I reviewed the selected location and confirm it is ready for dispatch."));
      const confirm = makeElement("button", "button button-primary", "Confirm ready");
      confirm.type = "button";
      confirm.disabled = !record.selectedPlaceId;
      confirm.addEventListener("click", () => {
        try {
          replaceRecord(confirmReady(record, checkbox.checked));
          showMessage("Address marked ready after your confirmation.", "success");
          renderQueue();
        } catch (error) {
          showMessage(error instanceof Error ? error.message : "Review and confirm the selected candidate.", "error");
          checkbox.focus();
        }
      });
      controls.append(confirmation, confirm);
      detail.append(controls);
      appendRecheckForm(detail, record);
    } else if (record.status !== REVIEW_STATUSES.ready) {
      const clarification = makeElement("div", "error-box");
      clarification.append(makeElement("strong", "", "Clarification required"));
      const reasons = makeElement("ul", "validation-list");
      reviewBlockMessages(record).forEach((message) => reasons.append(makeElement("li", "", message)));
      clarification.append(reasons);
      detail.append(clarification);
      appendRecheckForm(detail, record);
    } else {
      detail.append(makeElement("p", "message success", "Ready after explicit human confirmation. The original input and selected result remain in the export."));
    }
  }
  if (record.history.length > 0) detail.append(createHistory(record));
  card.append(detail);
  return card;
}

function renderCounts() {
  const counts = {
    all: state.records.length,
    needs_review: state.records.filter((record) => record.status === REVIEW_STATUSES.needsReview || record.status === REVIEW_STATUSES.pending).length,
    ready: state.records.filter((record) => record.status === REVIEW_STATUSES.ready).length,
    no_match: state.records.filter((record) => record.status === REVIEW_STATUSES.noMatch).length,
    check_failed: state.records.filter((record) => record.status === REVIEW_STATUSES.checkFailed).length,
  };
  document.querySelector("#count-all").textContent = counts.all;
  document.querySelector("#count-review").textContent = counts.needs_review;
  document.querySelector("#count-ready").textContent = counts.ready;
  document.querySelector("#count-no-match").textContent = counts.no_match;
  document.querySelector("#count-failed").textContent = counts.check_failed;
}

function renderQueue() {
  renderCounts();
  if (!state.checking && state.records.length > 0) {
    elements.progress.textContent = reviewProgressMessage(state.records);
  }
  elements.country.disabled = state.records.length > 0;
  const visible = state.records.filter((record) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "needs_review") {
      return record.status === REVIEW_STATUSES.needsReview || record.status === REVIEW_STATUSES.pending;
    }
    return record.status === activeFilter;
  });
  elements.list.replaceChildren(...visible.map((record) => createRecordCard(record, state.records.indexOf(record))));
  elements.empty.hidden = state.records.length > 0;
  elements.list.hidden = visible.length === 0;
  const partition = partitionRecords(state.records);
  elements.exportReady.disabled = partition.approved.length === 0;
  elements.exportUnresolved.disabled = partition.unresolved.length === 0;
}

async function runCheck(id) {
  const record = state.records.find((item) => item.id === id);
  if (!record) return;
  if (!state.countryCode) {
    showMessage("Select a destination country before checking addresses.", "error");
    elements.country.focus();
    return;
  }
  const checking = beginCheck(record);
  replaceRecord(checking);
  renderQueue();
  try {
    const { response, body } = await requestAddressCheck({
      address: checking.workingAddress,
      countryCode: state.countryCode,
    });
    const latest = state.records.find((item) => item.id === id);
    if (!latest) return;
    if (!response.ok || body.status === "check_failed") {
      replaceRecord(applyCheckFailure(latest, body.error || { message: "The check failed.", retryable: response.status >= 500 }));
    } else {
      replaceRecord(applyCheckResult(latest, body));
    }
  } catch (error) {
    const failure = error instanceof AddressApiRequestError
      ? error.publicError
      : {
          category: "unexpected",
          message: "Yaki could not complete the address check. Retry shortly.",
          retryable: true,
        };
    console.error("Yaki address API request failed.", error instanceof AddressApiRequestError
      ? error.diagnostics
      : { endpoint: "/api/geocode", failure: "unexpected" });
    const latest = state.records.find((item) => item.id === id);
    if (latest) {
      replaceRecord(applyCheckFailure(latest, failure));
    }
  }
  renderQueue();
}

async function runBatch(ids) {
  state.checking = true;
  elements.progress.hidden = false;
  for (let index = 0; index < ids.length; index += 1) {
    elements.progress.textContent = `Checking address ${index + 1} of ${ids.length}…`;
    await runCheck(ids[index]);
  }
  state.checking = false;
  elements.progress.textContent = reviewProgressMessage(state.records);
  window.setTimeout(() => { elements.progress.hidden = true; }, 4500);
}

function renderCsvPreview() {
  const csv = state.csv;
  elements.previewPanel.hidden = !csv;
  if (!csv) return;
  elements.addressColumn.replaceChildren(...csv.headers.map((header) => {
    const option = document.createElement("option");
    option.value = header;
    option.textContent = header;
    return option;
  }));
  state.selectedColumn = state.selectedColumn || csv.headers[0];
  elements.addressColumn.value = state.selectedColumn;

  const headRow = document.createElement("tr");
  csv.headers.forEach((header) => headRow.append(makeElement("th", "", header)));
  elements.previewHead.replaceChildren(headRow);
  const previewRows = csv.rows.slice(0, 5).map((row) => {
    const tr = document.createElement("tr");
    csv.headers.forEach((header) => tr.append(makeElement("td", "", row.values[header])));
    return tr;
  });
  elements.previewBody.replaceChildren(...previewRows);
  elements.rowCount.textContent = `${csv.rows.length} valid ${csv.rows.length === 1 ? "row" : "rows"}`;
  elements.csvErrors.hidden = csv.errors.length === 0;
  elements.csvErrors.replaceChildren();
  if (csv.errors.length > 0) {
    elements.csvErrors.append(makeElement("strong", "", "Fix these CSV problems before importing:"));
    const list = document.createElement("ul");
    csv.errors.slice(0, 10).forEach((error) => list.append(makeElement("li", "", error.message)));
    if (csv.errors.length > 10) list.append(makeElement("li", "", `${csv.errors.length - 10} more errors not shown.`));
    elements.csvErrors.append(list);
  }
  elements.importButton.disabled = csv.errors.length > 0;
}

function downloadCsv(records, filename) {
  const blob = new Blob([recordsToCsv(records)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

for (const country of countryOptions()) {
  const option = document.createElement("option");
  option.value = country.code;
  option.textContent = `${country.name} (${country.code.toUpperCase()})`;
  elements.country.append(option);
}

elements.country.addEventListener("change", () => {
  state.countryCode = elements.country.value;
  showMessage("");
});

elements.singleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.countryCode) {
    showMessage("Select a destination country before adding an address.", "error");
    elements.country.focus();
    return;
  }
  const record = createReviewRecord(elements.singleAddress.value);
  state.records.push(record);
  elements.singleAddress.value = "";
  showMessage("");
  renderQueue();
  document.querySelector("#queue-title").scrollIntoView({ behavior: "smooth", block: "start" });
  await runBatch([record.id]);
});

elements.file.addEventListener("change", async () => {
  const file = elements.file.files?.[0];
  state.csv = undefined;
  state.selectedColumn = "";
  elements.fileLabel.textContent = file?.name || "No file selected";
  if (!file) {
    renderCsvPreview();
    return;
  }
  try {
    state.csv = parseCsv(await file.text());
    showMessage("");
  } catch (error) {
    const message = error instanceof CsvValidationError ? error.message : "The CSV could not be read.";
    showMessage(message, "error");
  }
  renderCsvPreview();
});

elements.addressColumn.addEventListener("change", () => {
  state.selectedColumn = elements.addressColumn.value;
});

elements.importButton.addEventListener("click", async () => {
  if (!state.countryCode) {
    showMessage("Select a destination country before importing addresses.", "error");
    elements.country.focus();
    return;
  }
  if (!state.csv || state.csv.errors.length > 0) return;
  const blankRows = state.csv.rows.filter((row) => !row.values[state.selectedColumn]?.trim());
  if (blankRows.length > 0) {
    showMessage(`The selected address column is blank on ${blankRows.length} ${blankRows.length === 1 ? "row" : "rows"}.`, "error");
    return;
  }
  const records = state.csv.rows.map((row) => createReviewRecord(row.values[state.selectedColumn], row.line));
  state.records.push(...records);
  renderQueue();
  document.querySelector("#queue-title").scrollIntoView({ behavior: "smooth", block: "start" });
  await runBatch(records.map((record) => record.id));
});

document.querySelectorAll(".status-tab").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll(".status-tab").forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    renderQueue();
  });
});

elements.exportReady.addEventListener("click", () => {
  downloadCsv(partitionRecords(state.records).approved, "yaki-ready-addresses.csv");
});
elements.exportUnresolved.addEventListener("click", () => {
  downloadCsv(partitionRecords(state.records).unresolved, "yaki-unresolved-addresses.csv");
});

elements.clearButton.addEventListener("click", () => elements.clearDialog.showModal());
elements.confirmClear.addEventListener("click", () => {
  state = clearSession();
  activeFilter = "all";
  elements.country.value = "";
  elements.country.disabled = false;
  elements.file.value = "";
  elements.fileLabel.textContent = "No file selected";
  elements.singleAddress.value = "";
  elements.previewPanel.hidden = true;
  elements.progress.hidden = true;
  showMessage("Session cleared. No address data remains in this browser workspace.", "success");
  document.querySelectorAll(".status-tab").forEach((item, index) => {
    item.classList.toggle("active", index === 0);
    item.setAttribute("aria-pressed", String(index === 0));
  });
  renderQueue();
});

renderQueue();

if (window.location.hash === "#workspace") {
  window.requestAnimationFrame(() => {
    document.querySelector("#workspace")?.scrollIntoView({ behavior: "instant", block: "start" });
  });
}
