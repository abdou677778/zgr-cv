import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";

const DIST_DIR = resolve("dist-spa");
const MAIN_JS_GZIP_BUDGET_KIB = 310;
const html = readFileSync(resolve(DIST_DIR, "index.html"), "utf8");
const mainScript = html.match(/<script[^>]+src="\.\/(assets\/index-[^"]+\.js)"/i)?.[1];

if (!mainScript) {
  throw new Error("Bundle principal introuvable dans dist-spa/index.html.");
}

const mainBytes = readFileSync(resolve(DIST_DIR, mainScript));
const gzipKib = gzipSync(mainBytes, { level: 9 }).byteLength / 1024;
const forbiddenInitialAssets = [
  "NotoSansSC",
  "pdf.worker.min",
  "client-database-dialog",
  "client-orders-dialog",
  "ai-settings-dialog",
  "prompt-master-dialog",
  "preview-control-dock",
  "cv-experience-workspace",
  "cv-learning-workspaces",
  "document-pdf",
  "europass-xml",
];
const accidentallyPreloaded = forbiddenInitialAssets.filter((asset) => html.includes(asset));

console.log(
  `Bundle initial: ${(mainBytes.byteLength / 1024).toFixed(2)} KiB brut / ${gzipKib.toFixed(2)} KiB gzip (budget ${MAIN_JS_GZIP_BUDGET_KIB} KiB).`,
);

if (gzipKib > MAIN_JS_GZIP_BUDGET_KIB) {
  throw new Error(`Le bundle initial dépasse le budget de ${MAIN_JS_GZIP_BUDGET_KIB} KiB gzip.`);
}

if (accidentallyPreloaded.length > 0) {
  throw new Error(
    `Des ressources lourdes sont préchargées par index.html : ${accidentallyPreloaded.join(", ")}.`,
  );
}
