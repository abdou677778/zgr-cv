import { zipSync, strToU8 } from "fflate";
import { lineTotals, type TechOrder } from "./tech-orders";
const escape = (value: unknown) =>
  String(value ?? "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
    );
const headers = [
  "ID vente",
  "Client",
  "Lien Facebook",
  "Service",
  "Début",
  "Fin / renouveler le",
  "Coût fournisseur USD",
  "Taux DA / USD",
  "Coût DA",
  "Vente DA",
  "Marge brute DA",
  "Réf. facture fournisseur",
  "Lien facture fournisseur",
  "Renouvellement de",
  "Notes",
];
const serial = (date: string) =>
  (Date.parse(`${date}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86400000;
const col = (index: number) => String.fromCharCode(65 + index);
export function techOrdersExcelRows(orders: TechOrder[]) {
  return orders.flatMap((order) =>
    order.lines.map((line) => ({
      order,
      line,
      values: [
        order.id,
        order.client,
        order.facebookUrl,
        line.name,
        serial(line.start),
        serial(line.end),
        line.priceUsd,
        line.rate,
        lineTotals(line).cost,
        line.saleDzd,
        lineTotals(line).margin,
        line.invoiceRef,
        line.invoiceUrl,
        order.renewalOf,
        order.notes,
      ],
    })),
  );
}
/** Production exporter. User text is always an inline string, never an Excel formula. */
export function buildTechOrdersXlsx(orders: TechOrder[]): Uint8Array {
  const rows = techOrdersExcelRows(orders);
  const last = Math.max(8, 7 + rows.length);
  const textCell = (ref: string, value: unknown, style = 0) =>
    `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escape(value)}</t></is></c>`;
  const numCell = (ref: string, value: number, style = 2) =>
    `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  const formula = (ref: string, value: string, cached: number) =>
    `<c r="${ref}" s="2"><f>${escape(value)}</f><v>${cached}</v></c>`;
  const total = (index: number) =>
    Math.round(rows.reduce((sum, row) => sum + Number(row.values[index]), 0) * 100) / 100;
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="7" xSplit="2" topLeftCell="C8" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><cols>${[28, 24, 30, 25, 14, 20, 24, 20, 18, 18, 20, 28, 38, 28, 40].map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join("")}</cols><sheetData>
 <row r="2" ht="26" customHeight="1">${textCell("A2", "ZGR Tech Orders", 4)}</row>
 <row r="3">${textCell("A3", "Une ligne par service vendu. Montants pour la période saisie. Marge brute hors frais et taxes.")}</row>
 <row r="4">${textCell("H4", "Totaux DA", 1)}${[8, 9, 10].map((i) => formula(`${col(i)}4`, `SUM(${col(i)}8:${col(i)}${last})`, total(i))).join("")}</row>
 <row r="7" ht="34" customHeight="1">${headers.map((h, i) => textCell(`${col(i)}7`, h, 1)).join("")}</row>
 ${rows
   .map((row, i) => {
     const r = i + 8;
     return `<row r="${r}" ht="24" customHeight="1">${row.values.map((v, c) => (c === 8 ? formula(`I${r}`, `ROUND(G${r}*H${r},2)`, Number(v)) : c === 10 ? formula(`K${r}`, `ROUND(J${r}-I${r},2)`, Number(v)) : typeof v === "number" ? numCell(`${col(c)}${r}`, v, c === 4 || c === 5 ? 3 : 2) : textCell(`${col(c)}${r}`, v))).join("")}</row>`;
   })
   .join("")}
 </sheetData><autoFilter ref="A7:O${last}"/><conditionalFormatting sqref="K8:K${last}"><cfRule type="cellIs" dxfId="0" priority="1" operator="lessThan"><formula>0</formula></cfRule></conditionalFormatting><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  const files: Record<string, string> = {
    "[Content_Types].xml":
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    "_rels/.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml":
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Ventes" sheetId="1" r:id="rId1"/></sheets><calcPr calcMode="auto" fullCalcOnLoad="1"/></workbook>',
    "xl/_rels/workbook.xml.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": sheet,
    "xl/styles.xml":
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Arial"/></font><font><b/><sz val="16"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1E3A5F"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="5"><xf fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="center"/></xf><xf fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf fontId="0" fillId="0" borderId="0" xfId="0" numFmtId="164" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf><xf fontId="0" fillId="0" borderId="0" xfId="0" numFmtId="165" applyNumberFormat="1"><alignment vertical="center"/></xf><xf fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="1"><dxf><font><color rgb="FFB91C1C"/></font><fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/><bgColor indexed="64"/></patternFill></fill></dxf></dxfs></styleSheet>',
  };
  return zipSync(
    Object.fromEntries(Object.entries(files).map(([name, content]) => [name, strToU8(content)])),
    { level: 6 },
  );
}
