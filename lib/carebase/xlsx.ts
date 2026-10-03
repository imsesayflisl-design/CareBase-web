import { deflateRawSync, crc32 } from "node:zlib";

/**
 * Dependency-free `.xlsx` (Office Open XML) writer.
 *
 * An `.xlsx` file is a ZIP archive of XML parts. This module writes a minimal
 * but valid workbook — content types, relationships, workbook, styles and a
 * worksheet with inline strings — on top of Node's built-in zlib, mirroring the
 * hand-rolled ZIP reader in `spreadsheet.ts`.
 *
 * Cells may be styled with the exported `BOLD` / `HEADER` style ids.
 */

export const BOLD = 1;
export const HEADER = 2;

export type CellValue = string | number | boolean | null | undefined;
export type Cell = CellValue | { value: CellValue; style?: number };
export type Sheet = { name: string; rows: Cell[][] };

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/[\r\n\t]+/g, " ");
}

function columnName(index: number): string {
  let name = "";
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function normalize(cell: Cell): { value: CellValue; style: number } {
  if (cell !== null && typeof cell === "object") {
    return { value: cell.value ?? null, style: cell.style ?? 0 };
  }
  return { value: cell as CellValue, style: 0 };
}

function cellXml(reference: string, cell: Cell): string {
  const { value, style } = normalize(cell);
  if (value === null || value === undefined || value === "") {
    return style ? `<c r="${reference}" s="${style}"/>` : `<c r="${reference}"/>`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${reference}" s="${style}"><v>${value}</v></c>`;
  }
  if (typeof value === "boolean") {
    return `<c r="${reference}" s="${style}" t="b"><v>${value ? 1 : 0}</v></c>`;
  }
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(
    String(value)
  )}</t></is></c>`;
}

function worksheetXml(rows: Cell[][]): string {
  const body = rows
    .map((cells, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cellsXml = cells
        .map((cell, columnIndex) => cellXml(columnName(columnIndex) + rowNumber, cell))
        .join("");
      return `<row r="${rowNumber}">${cellsXml}</row>`;
    })
    .join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${body}</sheetData>` +
    "</worksheet>"
  );
}

const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF1260C7"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="3">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf>' +
  "</cellXfs>" +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  "</styleSheet>";

function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/** Writes entries into a ZIP archive (deflate, no compression descriptors). */
function zip(entries: { name: string; data: Buffer }[]): Buffer {
  const { time, date } = dosDateTime(new Date());
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.data) >>> 0;
    const compressed = deflateRawSync(entry.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(Buffer.concat([central, name]));

    offset += local.length + name.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

function contentTypesXml(partNames: string[]): string {
  const overrides = partNames
    .map((name) => {
      const type =
        name === "xl/workbook.xml"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"
          : name === "xl/styles.xml"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml";
      return `<Override PartName="/${name}" ContentType="${type}"/>`;
    })
    .join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    overrides +
    "</Types>"
  );
}

function workbookXml(sheets: Sheet[]): string {
  const items = sheets
    .map(
      (sheet, index) =>
        `<sheet name="${escapeXml((sheet.name || "Sheet" + (index + 1)).slice(0, 31))}" sheetId="${
          index + 1
        }" r:id="rId${index + 1}"/>`
    )
    .join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets>${items}</sheets>` +
    "</workbook>"
  );
}

function workbookRelsXml(sheetCount: number): string {
  const rels = Array.from(
    { length: sheetCount },
    (_, index) =>
      `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${
        index + 1
      }.xml"/>`
  ).join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    rels +
    '<Relationship Id="rId' +
    (sheetCount + 1) +
    '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    "</Relationships>"
  );
}

/** Builds a complete `.xlsx` workbook from one or more sheets. */
export function buildXlsx(sheets: Sheet[]): Buffer {
  if (!sheets.length) throw new Error("An export needs at least one worksheet.");

  const parts: { name: string; data: Buffer }[] = [];
  const sheetNames = sheets.map((_, index) => `xl/worksheets/sheet${index + 1}.xml`);

  parts.push({
    name: "[Content_Types].xml",
    data: Buffer.from(contentTypesXml(["xl/workbook.xml", ...sheetNames, "xl/styles.xml"]), "utf8"),
  });
  parts.push({
    name: "_rels/.rels",
    data: Buffer.from(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        "</Relationships>",
      "utf8"
    ),
  });
  parts.push({ name: "xl/workbook.xml", data: Buffer.from(workbookXml(sheets), "utf8") });
  parts.push({ name: "xl/_rels/workbook.xml.rels", data: Buffer.from(workbookRelsXml(sheets.length), "utf8") });
  parts.push({ name: "xl/styles.xml", data: Buffer.from(STYLES_XML, "utf8") });

  sheets.forEach((sheet, index) => {
    parts.push({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: Buffer.from(worksheetXml(sheet.rows), "utf8"),
    });
  });

  return zip(parts);
}
