import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const SOURCE_URL =
  "https://www.statcan.gc.ca/fr/sujets/norme/cnp/2021/indexV1/cnp-2021-v1.0-structure-classification.csv";
const OUTPUT = resolve("src/data/noc-2021-fr.ts");

function parseCsv(source) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else value += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else value += character;
  }
  if (value || row.length) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

const response = await fetch(SOURCE_URL, {
  headers: { "User-Agent": "ZGR-CV-NOC-Updater/1.0" },
});
if (!response.ok) throw new Error(`Statistique Canada a répondu ${response.status}.`);
const rows = parseCsv((await response.text()).replace(/^\uFEFF/, ""));
const entries = rows
  .slice(1)
  .filter((row) => row[0] === "5" && /^\d{5}$/.test(row[2] || ""))
  .map((row) => ({ code: row[2], title: row[3] }))
  .sort((left, right) => left.code.localeCompare(right.code, "fr"));
if (entries.length < 500) throw new Error(`Référentiel incomplet : ${entries.length} groupes.`);

const content =
  `/* eslint-disable prettier/prettier */\n// Généré depuis le CSV officiel de Statistique Canada. Ne pas modifier manuellement.\n` +
  `export const NOC_SOURCE_URL = ${JSON.stringify(SOURCE_URL)};\n` +
  `export const NOC_VERSION = "CNP 2021 v1.0" as const;\n` +
  `export const NOC_ENTRIES = ${JSON.stringify(entries, null, 2)} as const;\n`;
await mkdir(resolve("src/data"), { recursive: true });
await writeFile(OUTPUT, content, "utf8");
console.log(`CNP : ${entries.length} groupes de base écrits dans ${OUTPUT}`);
