import { access, cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const source = resolve("cv-pro-team-clients", "dist", "client", "_next");
const target = resolve("public", "_next");

try {
  await access(source);
} catch {
  throw new Error(
    "Assets du portail absents. Exécutez d’abord `npm run build --prefix cv-pro-team-clients`.",
  );
}

await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true, force: true });
console.log("Assets client Vinext synchronisés dans public/_next.");
