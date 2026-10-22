import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconRoot = path.join(root, "node_modules", "simple-icons", "icons");
const output = path.join(root, "public", "software-icons");
const dataOutput = path.join(root, "src", "data", "software-icon-catalog.ts");
const priority = [
  "openai", "anthropic", "googlegemini", "google", "googlecloud", "googledrive", "googledocs", "googlesheets", "googleslides", "googlechrome", "androidstudio", "canva", "figma", "adobephotoshop", "adobeillustrator", "adobeindesign", "adobepremierepro", "adobeaftereffects", "adobelightroom", "adobeacrobatreader", "microsoftword", "microsoftexcel", "microsoftpowerpoint", "microsoftoutlook", "microsoftteams", "microsoftonedrive", "microsoftsharepoint", "microsoftaccess", "microsoftazure", "windows", "apple", "macos", "notion", "slack", "discord", "zoom", "whatsapp", "telegram", "linkedin", "facebook", "instagram", "tiktok", "youtube", "x", "github", "gitlab", "bitbucket", "visualstudiocode", "visualstudio", "jetbrains", "intellijidea", "pycharm", "webstorm", "sublimetext", "vim", "neovim", "docker", "kubernetes", "terraform", "ansible", "jenkins", "githubactions", "git", "npm", "pnpm", "yarn", "bun", "nodejs", "deno", "python", "java", "kotlin", "php", "ruby", "go", "rust", "cplusplus", "csharp", "dotnet", "react", "nextdotjs", "vue", "angular", "svelte", "astro", "vite", "tailwindcss", "bootstrap", "wordpress", "shopify", "wix", "webflow", "framer", "postgresql", "mysql", "sqlite", "mongodb", "redis", "supabase", "firebase", "prisma", "oracle", "sap", "tableau", "powerbi", "looker", "jupyter", "pandas", "numpy", "tensorflow", "pytorch", "scikitlearn", "huggingface", "ollama", "perplexity", "mistral", "n8n", "zapier", "make", "airtable", "asana", "trello", "clickup", "monday", "calendly", "mailchimp", "hubspot", "salesforce", "stripe", "paypal", "quickbooks", "xero", "dropbox", "box", "mega", "protonmail", "thunderbird", "obsstudio", "blender", "autodesk", "autocad", "sketchup", "unity", "unrealengine", "davinciresolve", "audacity", "vlcmediaplayer", "linux", "ubuntu", "debian", "fedora", "cloudflare", "amazonaws", "digitalocean", "vercel", "netlify", "render", "railway", "heroku", "twilio", "sendgrid", "postman", "insomnia", "swagger", "openapi", "graphql", "elasticsearch", "kibana", "nginx", "apache", "wordpress", "woocommerce", "elementor", "prestashop", "magento", "canva", "grammarly", "deepl", "chatbot", "googlegemini", "githubcopilot", "cursor", "windsurf", "bolt", "replit", "codesandbox", "stackblitz", "lovable"
];
const manualBadges = [
  { title: "Microsoft Word", slug: "microsoftword", hex: "2B579A", letter: "W" },
  { title: "Microsoft Excel", slug: "microsoftexcel", hex: "217346", letter: "X" },
  { title: "Microsoft PowerPoint", slug: "microsoftpowerpoint", hex: "D24726", letter: "P" },
  { title: "Adobe Photoshop", slug: "adobephotoshop", hex: "31A8FF", letter: "Ps" },
  { title: "Adobe Illustrator", slug: "adobeillustrator", hex: "FF9A00", letter: "Ai" },
  { title: "Adobe InDesign", slug: "adobeindesign", hex: "FF3366", letter: "Id" },
  { title: "Google AI Studio", slug: "googlestudio", hex: "4285F4", letter: "AI" },
  { title: "Lovable", slug: "lovable", hex: "FF4D8D", letter: "L" },
  { title: "Bolt", slug: "bolt", hex: "6D5DFB", letter: "B" },
];

const metadata = JSON.parse(await readFile(path.join(root, "node_modules", "simple-icons", "data", "simple-icons.json"), "utf8"));
const bySlug = new Map(metadata.map((icon) => [icon.slug, icon]));
const selected = [];
for (const icon of manualBadges) selected.push(icon);
for (const slug of priority) {
  const icon = bySlug.get(slug);
  if (icon && !selected.some((entry) => entry.slug === slug)) selected.push(icon);
}
for (const icon of [...metadata].sort((a, b) => a.title.localeCompare(b.title))) {
  if (selected.length >= 320) break;
  if (!selected.some((entry) => entry.slug === icon.slug)) selected.push(icon);
}

// Keep publisher assets added by extend-software-icons.mjs across catalogue syncs.
let extensions = [];
try { extensions = JSON.parse(await readFile(path.join(output, "manifest.json"), "utf8")).filter(item => item.source); } catch {}
for (const item of extensions) if (!selected.some(entry => entry.slug === item.slug)) selected.push(item);
await mkdir(output, { recursive: true });
for (const icon of selected) {
  if (icon.source) continue;
  const destination = path.join(output, `${icon.slug}.svg`);
  if (manualBadges.some((badge) => badge.slug === icon.slug)) {
    await writeFile(destination, `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img"><title>${icon.title}</title><rect width="64" height="64" rx="12" fill="#${icon.hex}"/><text x="32" y="39" text-anchor="middle" fill="#fff" font-family="Arial, sans-serif" font-size="${icon.letter.length > 1 ? "23" : "30"}" font-weight="700">${icon.letter}</text></svg>`);
  } else {
    await cp(path.join(iconRoot, `${icon.slug}.svg`), destination);
  }
}
await writeFile(path.join(output, "manifest.json"), `${JSON.stringify(selected, null, 2)}\n`);
await mkdir(path.dirname(dataOutput), { recursive: true });
await writeFile(
  dataOutput,
  `// Generated from Simple Icons and publisher icons.\nexport type SoftwareCatalogEntry = { title: string; slug: string; hex: string; asset?: string; source?: string };\nexport const SOFTWARE_ICON_CATALOG: readonly SoftwareCatalogEntry[] = ${JSON.stringify(selected, null, 2)} as const;\n`,
);
console.log(`Synced ${selected.length} software logos to public/software-icons.`);
