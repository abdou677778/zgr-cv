import type { SoftwareSkill } from "./cv-types";
import { softwareIconUrl } from "./software-icons";
import { loadSharedSoftwareLogos } from "./shared-software-logos";

const cache = new Map<string, Promise<string>>();

function pdfLogo(source: string): Promise<string> {
  const existing = cache.get(source);
  if (existing) return existing;
  const promise = (async () => {
    // Browser image decoding supports both catalogue SVGs and local SVG/PNG/WebP
    // replacements. PDF receives a self-contained PNG, never a remote URL.
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Conversion du logo indisponible.");
    const scale = Math.min(128 / image.naturalWidth, 128 / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    context.drawImage(image, (128 - width) / 2, (128 - height) / 2, width, height);
    return canvas.toDataURL("image/png");
  })();
  cache.set(source, promise);
  promise.catch(() => cache.delete(source));
  return promise;
}

export async function prepareSoftwareIconsForPdf(items: SoftwareSkill[]) {
  await loadSharedSoftwareLogos();
  return Promise.all(items.map(async (item) => {
    const source = item.customIconDataUrl || softwareIconUrl(item.icon);
    if (!source) return item;
    try {
      return { ...item, customIconDataUrl: await pdfLogo(source) };
    } catch {
      // An unavailable asset must not prevent downloading the rest of the CV.
      return { ...item, customIconDataUrl: undefined };
    }
  }));
}
