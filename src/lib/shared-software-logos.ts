import { CLIENTS_API_ENDPOINT, getAdminSession } from "./auth-client";
import { setSharedSoftwareLogos } from "./software-icons";

const endpoint = CLIENTS_API_ENDPOINT.replace(/\/clients$/, "/software-logos");
let loading: Promise<void> | undefined;
export function loadSharedSoftwareLogos(force = false) {
  if (!loading || force) loading = (async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) throw new Error("Bibliothèque cloud indisponible.");
    const body = await response.json();
    setSharedSoftwareLogos(body.logos || {});
  })().catch(() => { loading = undefined; });
  return loading;
}

export async function replaceSharedSoftwareLogo(slug: string, file: File, target = endpoint, metadata?: { name: string; category: string }) {
  if (!/^(image\/(png|webp|jpeg|svg\+xml))$/.test(file.type) || file.size > 4 * 1024 * 1024)
    throw new Error("Choisissez un SVG, PNG, WebP ou JPG de 4 Mo maximum.");
  const url = URL.createObjectURL(file);
  let dataUrl: string;
  try {
    const image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Conversion du logo impossible.");
    const scale = 224 / Math.max(image.naturalWidth, image.naturalHeight);
    const width = image.naturalWidth * scale; const height = image.naturalHeight * scale;
    context.drawImage(image, (256 - width) / 2, (256 - height) / 2, width, height);
    dataUrl = canvas.toDataURL("image/png");
  } finally { URL.revokeObjectURL(url); }
  const response = await fetch(`${target}/${encodeURIComponent(slug)}`, {
    method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAdminSession() || ""}` },
    body: JSON.stringify({ dataUrl, ...metadata }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Enregistrement du logo impossible.");
  if (target === endpoint) await loadSharedSoftwareLogos(true);
  return dataUrl;
}
