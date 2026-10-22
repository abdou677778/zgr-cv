import { readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const folder = path.join(root, "public/software-icons");
const entries = [
  ["CapCut", "capcut", "www.capcut.com"], ["Leonardo AI", "leonardoai", "leonardo.ai"],
  ["HeyGen", "heygen", "www.heygen.com"], ["Grok", "grok", "grok.com"],
  ["Gamma AI", "gamma", "gamma.app"], ["CorelDRAW", "coreldraw", "www.coreldraw.com"],
  ["Cursor AI", "cursor", "cursor.com"], ["DeepL", "deepl", "www.deepl.com"],
  ["ElevenLabs", "elevenlabs", "elevenlabs.io"], ["FlutterFlow", "flutterflow", "flutterflow.io"],
  ["Genspark AI", "genspark", "www.genspark.ai"], ["Grammarly", "grammarly", "www.grammarly.com"],
  ["Hostinger", "hostinger", "www.hostinger.com"], ["Kimi", "kimi", "www.kimi.com"],
  ["Manus AI", "manus", "manus.im"], ["Midjourney", "midjourney", "www.midjourney.com"],
  ["n8n", "n8n", "n8n.io"],
  ["Autodesk Revit", "revit", "www.autodesk.com"], ["SOLIDWORKS", "solidworks", "www.solidworks.com"],
  ["CATIA", "catia", "www.3ds.com"], ["ETABS", "etabs", "www.csiamerica.com"],
  ["Oracle Primavera", "primavera", "www.oracle.com"], ["ArcGIS", "arcgis", "www.arcgis.com"],
  ["QGIS", "qgis", "qgis.org"], ["IBM SPSS Statistics", "spss", "www.ibm.com"],
  ["Stata", "stata", "www.stata.com"], ["MATLAB", "matlab", "www.mathworks.com"],
  ["RStudio", "rstudio", "posit.co"], ["Minitab", "minitab", "www.minitab.com"],
  ["Microsoft Power Query", "powerquery", "powerquery.microsoft.com"], ["Talend", "talend", "www.talend.com"],
  ["Alteryx", "alteryx", "www.alteryx.com"], ["KNIME", "knime", "www.knime.com"],
  ["Odoo", "odoo", "www.odoo.com"], ["Sage", "sage", "www.sage.com"],
  ["EBP", "ebp", "www.ebp.com"], ["Dolibarr", "dolibarr", "www.dolibarr.org"],
  ["Zoho CRM", "zohocrm", "www.zoho.com"], ["Miro", "miro", "miro.com"],
  ["Mural", "mural", "www.mural.co"], ["Visme", "visme", "www.visme.co"],
  ["Prezi", "prezi", "prezi.com"], ["Pitch", "pitch", "pitch.com"],
  ["D-ID", "did", "www.d-id.com"], ["Synthesia", "synthesia", "www.synthesia.io"],
  ["Runway", "runway", "runwayml.com"], ["Pika", "pika", "pika.art"],
  ["Luma AI", "lumaai", "lumalabs.ai"], ["Kling AI", "klingai", "klingai.com"],
  ["Suno", "suno", "suno.com"], ["Udio", "udio", "www.udio.com"],
  ["Ideogram", "ideogram", "ideogram.ai"], ["Freepik", "freepik", "www.freepik.com"],
  ["Krea AI", "krea", "www.krea.ai"], ["Napkin AI", "napkin", "www.napkin.ai"],
  ["Beautiful.ai", "beautifulai", "www.beautiful.ai"], ["Descript", "descript", "www.descript.com"],
  ["Wondershare Filmora", "filmora", "filmora.wondershare.com"], ["Camtasia", "camtasia", "www.techsmith.com"],
  ["Snagit", "snagit", "www.techsmith.com"], ["Affinity Designer", "affinitydesigner", "affinity.serif.com"],
  ["Procreate", "procreate", "procreate.com"], ["Inkscape", "inkscape", "inkscape.org"],
  ["GIMP", "gimp", "www.gimp.org"], ["Lumion", "lumion", "lumion.com"],
  ["Enscape", "enscape", "enscape3d.com"], ["Twinmotion", "twinmotion", "www.twinmotion.com"],
  ["Microsoft Project", "microsoftproject", "www.microsoft.com"], ["Microsoft Visio", "microsoftvisio", "www.microsoft.com"],
  ["Microsoft Power Automate", "powerautomate", "www.microsoft.com"], ["Microsoft Power Apps", "powerapps", "www.microsoft.com"],
  ["Adobe XD", "adobexd", "www.adobe.com"], ["Affinity Photo", "affinityphoto", "affinity.serif.com"],
  ["Affinity Publisher", "affinitypublisher", "affinity.serif.com"], ["SAP Business One", "sapbusinessone", "www.sap.com"],
];
const metadata = JSON.parse(await readFile(path.join(root, "node_modules/simple-icons/data/simple-icons.json"), "utf8"));
const available = new Map(metadata.map(item => [item.slug, item]));
const existing = JSON.parse(await readFile(path.join(folder, "manifest.json"), "utf8"));
const added = [];
async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { "User-Agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > 500000) throw new Error("Asset too large");
  const head = new TextDecoder().decode(bytes.slice(0, 300));
  const ext = bytes[0] === 137 && bytes[1] === 80 ? "png"
    : bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 ? "ico"
    : /<svg[\s>]/i.test(head) ? "svg" : null;
  if (!ext) throw new Error("Not an icon");
  return { bytes, ext };
}
const pending = entries.filter(([, slug]) => !existing.some(item => item.slug === slug && item.asset !== ""));
let next = 0;
async function processEntry([title, slug, domain]) {
  const item = available.get(slug);
  if (item) {
    await copyFile(path.join(root, `node_modules/simple-icons/icons/${slug}.svg`), path.join(folder, `${slug}.svg`));
    added.push({ title, slug, hex: item.hex, source: "Simple Icons" });
    return;
  }
  const base = `https://${domain}`;
  let candidates = [];
  if (slug === "midjourney") candidates.push("https://raw.githubusercontent.com/lobehub/lobe-icons/master/packages/static-svg/icons/midjourney.svg");
  try {
    const response = await fetch(base, { signal: AbortSignal.timeout(10000) });
    const html = await response.text();
    for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
      const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1];
      const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
      if (rel && /(?:^|\s)(?:icon|apple-touch-icon)(?:\s|$)/i.test(rel) && href) {
        const url = new URL(href.replace(/&amp;/g, "&"), response.url || base);
        if (url.protocol === "https:") candidates.push(url.href);
      }
    }
  } catch {}
  candidates.push(`${base}/favicon.ico`, `${base}/favicon.svg`, `${base}/favicon.png`);
  for (const source of [...new Set(candidates)].slice(0, 6)) {
    try {
      const asset = await download(source);
      const file = `${slug}.${asset.ext}`;
      await writeFile(path.join(folder, file), asset.bytes);
      added.push({ title, slug, hex: "555555", asset: file, source });
      return;
    } catch {}
  }
  // Keep the tool searchable; users can provide its authentic logo through R2.
  added.push({ title, slug, hex: "555555", asset: "", source: base });
}
await Promise.all(Array.from({ length: 10 }, async () => {
  while (next < pending.length) { const entry = pending[next++]; await processEntry(entry); }
}));
const replacements = new Map(added.map(item => [item.slug, item]));
const catalog = [...existing.map(item => replacements.get(item.slug) || item),
  ...added.filter(item => !existing.some(previous => previous.slug === item.slug)).sort((a,b) => a.title.localeCompare(b.title))];
await writeFile(path.join(folder, "manifest.json"), JSON.stringify(catalog, null, 2) + "\n");
await writeFile(path.join(root, "src/data/software-icon-catalog.ts"),
  `// Generated from Simple Icons and publisher website icons. Sources recorded in the manifest.\nexport type SoftwareCatalogEntry = { title: string; slug: string; hex: string; asset?: string; source?: string };\nexport const SOFTWARE_ICON_CATALOG: readonly SoftwareCatalogEntry[] = ${JSON.stringify(catalog, null, 2)} as const;\n`);
console.log(JSON.stringify({ added: added.length, total: catalog.length, needsCloudLogo: added.filter(item => item.asset === "").map(item => item.title) }));
