export const CSV_LIMITS = Object.freeze({
  maxBytes: 1_048_576,
  maxRows: 500,
  maxColumns: 50,
  maxFieldLength: 4096,
});

export class CsvValidationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "CsvValidationError";
    this.code = code;
  }
}

function pushField(row, field, limits) {
  if (field.length > limits.maxFieldLength) {
    throw new CsvValidationError(
      `A CSV field exceeds the ${limits.maxFieldLength}-character limit.`,
      "field_too_long",
    );
  }
  row.push(field);
  if (row.length > limits.maxColumns) {
    throw new CsvValidationError(
      `The CSV has more than ${limits.maxColumns} columns.`,
      "too_many_columns",
    );
  }
}

export function parseCsv(text, overrides = {}) {
  const limits = { ...CSV_LIMITS, ...overrides };
  if (typeof text !== "string") {
    throw new CsvValidationError("CSV content must be text.", "not_text");
  }
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes === 0) throw new CsvValidationError("The CSV file is empty.", "empty_file");
  if (bytes > limits.maxBytes) {
    throw new CsvValidationError(
      `The CSV is larger than ${Math.floor(limits.maxBytes / 1024)} KB.`,
      "file_too_large",
    );
  }
  if (text.includes("\0")) {
    throw new CsvValidationError("The CSV contains unsupported null characters.", "null_character");
  }

  const parsedRows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let afterQuote = false;
  let line = 1;

  const finishRow = () => {
    pushField(row, field, limits);
    const isBlank = row.every((value) => value.trim() === "");
    if (!isBlank) parsedRows.push({ values: row, line });
    row = [];
    field = "";
    afterQuote = false;
    if (parsedRows.length > limits.maxRows + 1) {
      throw new CsvValidationError(
        `The CSV has more than ${limits.maxRows} data rows.`,
        "too_many_rows",
      );
    }
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
          afterQuote = true;
        }
      } else {
        field += character;
        if (character === "\n") line += 1;
      }
      continue;
    }

    if (afterQuote && character !== "," && character !== "\r" && character !== "\n") {
      if (/\s/u.test(character)) continue;
      throw new CsvValidationError(
        `Unexpected text after a closing quote near line ${line}.`,
        "malformed_quote",
      );
    }
    if (character === '"') {
      if (field.length !== 0) {
        throw new CsvValidationError(
          `Unexpected quote near line ${line}.`,
          "malformed_quote",
        );
      }
      inQuotes = true;
      continue;
    }
    if (character === ",") {
      pushField(row, field, limits);
      field = "";
      afterQuote = false;
      continue;
    }
    if (character === "\r" || character === "\n") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      finishRow();
      line += 1;
      continue;
    }
    field += character;
  }

  if (inQuotes) {
    throw new CsvValidationError("The CSV ends inside a quoted field.", "unterminated_quote");
  }
  if (field.length > 0 || row.length > 0) finishRow();
  if (parsedRows.length === 0) {
    throw new CsvValidationError("The CSV does not contain a header row.", "missing_header");
  }

  const headers = parsedRows[0].values.map((value, index) =>
    (index === 0 ? value.replace(/^\uFEFF/u, "") : value).trim(),
  );
  if (headers.some((header) => header === "")) {
    throw new CsvValidationError("Every CSV column must have a header.", "blank_header");
  }
  const normalizedHeaders = headers.map((header) => header.toLocaleLowerCase());
  if (new Set(normalizedHeaders).size !== normalizedHeaders.length) {
    throw new CsvValidationError("CSV column names must be unique.", "duplicate_header");
  }

  const errors = [];
  const rows = [];
  for (const parsed of parsedRows.slice(1)) {
    if (parsed.values.length !== headers.length) {
      errors.push({
        line: parsed.line,
        message: `Line ${parsed.line} has ${parsed.values.length} fields; expected ${headers.length}.`,
      });
      continue;
    }
    rows.push({
      line: parsed.line,
      values: Object.fromEntries(headers.map((header, index) => [header, parsed.values[index]])),
    });
  }
  if (rows.length === 0 && errors.length === 0) {
    throw new CsvValidationError("The CSV has no data rows.", "no_data_rows");
  }
  return { headers, rows, errors, bytes };
}
