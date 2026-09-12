import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const outputDirectory = resolve("dist-spa");
const requiredFiles = [
  "index.html",
  "manifest.webmanifest",
  "icons/zgr-cv.svg",
  "icons/zgr-cv-192.png",
  "icons/zgr-cv-512.png",
  "sw.js",
];
await Promise.all(requiredFiles.map((file) => access(resolve(outputDirectory, file))));

const manifest = JSON.parse(await readFile(resolve(outputDirectory, "manifest.webmanifest"), "utf8"));
const serviceWorker = await readFile(resolve(outputDirectory, "sw.js"), "utf8");
const indexHtml = await readFile(resolve(outputDirectory, "index.html"), "utf8");

const iconSizes = new Set(manifest.icons?.map((icon) => icon.sizes));
if (
  manifest.display !== "standalone" ||
  manifest.start_url !== "./" ||
  !iconSizes.has("192x192") ||
  !iconSizes.has("512x512")
) {
  throw new Error("Le manifeste PWA n’est pas installable ou n’est pas portable.");
}
if (!indexHtml.includes('rel="manifest"') || !indexHtml.includes('name="theme-color"')) {
  throw new Error("Les métadonnées PWA sont absentes de la page.");
}
if (!serviceWorker.includes('event.data?.type === "SKIP_WAITING"')) {
  throw new Error("La mise à jour contrôlée du service worker est absente.");
}
if (!serviceWorker.includes('url.pathname.includes("/api/")')) {
  throw new Error("Le service worker ne protège pas explicitement les données API du cache.");
}
if (serviceWorker.includes('"./api/')) {
  throw new Error("Une route API privée a été ajoutée au précache.");
}

console.log("PWA vérifiée : manifeste, cache essentiel et mise à jour contrôlée sont valides.");
