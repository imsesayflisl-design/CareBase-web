import { inflateRawSync } from "node:zlib";

/**
 * Dependency-free spreadsheet reader.
 *
 * Supports `.csv` / `.tsv` text files and `.xlsx` workbooks (Office Open XML).
 * An `.xlsx` file is a ZIP archive of XML parts, so this module implements a
 * minimal ZIP reader (central directory + local headers) on top of Node's
 * built-in zlib and a small subset of the SpreadsheetML format that Excel
 * actually writes: shared strings, inline strings and cell values.
 *
 * The reader deliberately stops at raw cell text. Column mapping, validation
 * and business rules live in `staff-import.ts`.
 */

export const SPREADSHEET_MAX_ROWS = 5000;
export const SPREADSHEET_MAX_BYTES = 5 * 1024 * 1024;

const ZIP_LOCAL_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
const ZIP_EOCD_SIGNATURE = 0x06054b50;

type ZipEntry = {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  dataOffset: number;
};

function fail(message: string): never {
  throw new Error(message);
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minOffset = Math.max(0, buffer.length - 22 - 0xffff);
  for (let offset = buffer.length - 22; offset >= minOffset; offset--) {
    if (buffer.readUInt32LE(offset) === ZIP_EOCD_SIGNATURE) return offset;
  }
  return fail("This file is not a valid Excel (.xlsx) workbook.");
}

function readZipEntries(buffer: Buffer): ZipEntry[] {
  const eocd = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];
  let pointer = centralOffset;

  for (let index = 0; index < entryCount; index++) {
    if (buffer.readUInt32LE(pointer) !== ZIP_CENTRAL_SIGNATURE) break;
    const method = buffer.readUInt16LE(pointer + 10);
    const compressedSize = buffer.readUInt32LE(pointer + 20);
    const uncompressedSize = buffer.readUInt32LE(pointer + 24);
    const nameLength = buffer.readUInt16LE(pointer + 28);
    const extraLength = buffer.readUInt16LE(pointer + 30);
    const commentLength = buffer.readUInt16LE(pointer + 32);
    const localOffset = buffer.readUInt32LE(pointer + 42);
    const name = buffer.toString("utf8", pointer + 46, pointer + 46 + nameLength);

    if (buffer.readUInt32LE(localOffset) !== ZIP_LOCAL_SIGNATURE) {
      fail("This Excel workbook is corrupted.");
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;

    entries.push({ name, method, compressedSize, uncompressedSize, dataOffset });
    pointer += 46 + nameLength + extraLength + commentLength;
  }

  if (!entries.length) fail("This Excel workbook has no readable parts.");
  return entries;
}

function readZipEntry(buffer: Buffer, entry: ZipEntry): string {
  if (entry.compressedSize === 0xffffffff) fail("This Excel workbook is too large to process.");
  const compressed = buffer.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);
  if (entry.method === 0) return compressed.toString("utf8");
  if (entry.method !== 8) fail("This Excel workbook uses an unsupported compression method.");
  return inflateRawSync(compressed).toString("utf8");
}

function zipText(buffer: Buffer, entries: ZipEntry[], name: string): string | null {
  const entry = entries.find((item) => item.name === name);
  return entry ? readZipEntry(buffer, entry) : null;
}
function parseSharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  const strings: string[] = [];
  const itemPattern = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let item = itemPattern.exec(xml);
  while (item) {
    const textPattern = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let text = "";
    let part = textPattern.exec(item[1]);
    while (part) {
      text += decodeXmlEntities(part[1]);
      part = textPattern.exec(item[1]);
    }
    strings.push(text);
    item = itemPattern.exec(xml);
  }
  return strings;
}

function columnIndexFromRef(ref: string): number {
  const letters = ref.replace(/[^A-Z]/gi, "").toUpperCase();
  let index = 0;
  for (const letter of letters) {
    index = index * 26 + (letter.charCodeAt(0) - 64);
  }
  return index - 1;
}

function parseWorksheet(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];
  const rowPattern = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  const cellPattern = /<c\b([^>]*?)\/>|<c\b([^>]*?)>([\s\S]*?)<\/c>/g;
  let row = rowPattern.exec(xml);

  while (row) {
    const cells: string[] = [];
    cellPattern.lastIndex = 0;
    let cell = cellPattern.exec(row[1]);
    while (cell) {
      const attributes = cell[1] ?? cell[2] ?? "";
      const inner = cell[3] ?? "";
      const refMatch = /r="([A-Z]+)\d+"/i.exec(attributes);
      const typeMatch = /t="([^"]+)"/.exec(attributes);
      const index = refMatch ? columnIndexFromRef(refMatch[1]) : cells.length;
      const type = typeMatch ? typeMatch[1] : "";

      let value = "";
      if (type === "inlineStr") {
        const inlinePattern = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
        let part = inlinePattern.exec(inner);
        while (part) {
          value += decodeXmlEntities(part[1]);
          part = inlinePattern.exec(inner);
        }
      } else {
        const valueMatch = /<v>([\s\S]*?)<\/v>/.exec(inner);
        const raw = valueMatch ? decodeXmlEntities(valueMatch[1]) : "";
        if (type === "s") {
          value = sharedStrings[Number(raw)] ?? "";
        } else if (type === "b") {
          value = raw === "1" ? "TRUE" : "FALSE";
        } else {
          value = raw;
        }
      }
      cells[index] = value;
      cell = cellPattern.exec(row[1]);
    }
    for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = "";
    rows.push(cells);
    row = rowPattern.exec(xml);
  }
  return rows;
}

function firstWorksheetPath(buffer: Buffer, entries: ZipEntry[]): string {
  const workbook = zipText(buffer, entries, "xl/workbook.xml");
  const rels = zipText(buffer, entries, "xl/_rels/workbook.xml.rels");
  if (workbook && rels) {
    const sheetMatch = /<sheet\b[^>]*r:id="([^"]+)"/.exec(workbook);
    if (sheetMatch) {
      const relPattern = new RegExp('<Relationship\\b[^>]*Id="' + sheetMatch[1] + '"[^>]*?Target="([^"]+)"');
      const rel = relPattern.exec(rels);
      if (rel) {
        const target = rel[1].replace(/^\/?xl\//, "").replace(/^\//, "");
        return "xl/" + target;
      }
    }
  }
  const fallback = entries.find((entry) => /^xl\/worksheets\/sheet1\.xml$/.test(entry.name));
  return fallback ? fallback.name : fail("This Excel workbook has no worksheet.");
}

function parseXlsx(buffer: Buffer): string[][] {
  const entries = readZipEntries(buffer);
  const sharedStrings = parseSharedStrings(zipText(buffer, entries, "xl/sharedStrings.xml"));
  const worksheet = zipText(buffer, entries, firstWorksheetPath(buffer, entries));
  if (!worksheet) fail("This Excel workbook has no readable worksheet data.");
  return parseWorksheet(worksheet, sharedStrings);
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return tabs > commas ? "\t" : ",";
}

function parseDelimited(buffer: Buffer, delimiterHint?: string): string[][] {
  let text = buffer.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const delimiter = delimiterHint ?? detectDelimiter(text);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      // handled by the following \n
    } else {
      field += char;
    }
  }
  row.push(field);
  rows.push(row);

  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

/**
 * Reads a spreadsheet into a matrix of raw cell strings.
 * `fileName` selects the parser (`.xlsx` vs. delimited text).
 */
export function parseSpreadsheet(fileName: string, buffer: Buffer): string[][] {
  if (!buffer.length) fail("The uploaded file is empty.");
  if (buffer.length > SPREADSHEET_MAX_BYTES) fail("The uploaded file is larger than 5 MB.");

  const extension = (fileName.split(".").pop() ?? "").toLowerCase();
  let matrix: string[][];

  if (extension === "xlsx") {
    matrix = parseXlsx(buffer);
  } else if (extension === "tsv") {
    matrix = parseDelimited(buffer, "\t");
  } else if (extension === "csv" || extension === "txt") {
    matrix = parseDelimited(buffer, extension === "csv" ? "," : undefined);
  } else if (extension === "xls") {
    fail("Legacy .xls files are not supported. Save the sheet as .xlsx or .csv and try again.");
  } else {
    fail("Upload an Excel (.xlsx) or CSV file.");
  }

  if (matrix.length > SPREADSHEET_MAX_ROWS + 1) {
    fail("This file has too many rows. Import at most " + SPREADSHEET_MAX_ROWS + " staff at a time.");
  }
  return matrix;
}