import type { SoftwareSkill } from "./cv-types";
import { softwareIconUrl } from "./software-icons";
import { loadSharedSoftwareLogos } from "./shared-software-logos";

const cache = new Map<string, Promise<string>>();

export function pdfLogo(source: string, trim = false): Promise<string> {
  const cacheKey = `${trim}:${source}`;
  const existing = cache.get(cacheKey);
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
    if (trim) {
      const pixels = context.getImageData(0, 0, 128, 128).data;
      let left = 128, top = 128, right = -1, bottom = -1;
      for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
        if (pixels[(y * 128 + x) * 4 + 3] > 8) {
          left = Math.min(left, x); right = Math.max(right, x);
          top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
      }
      if (right >= left) {
        const cropped = document.createElement("canvas");
        cropped.width = right - left + 1; cropped.height = bottom - top + 1;
        const target = cropped.getContext("2d");
        if (!target) throw new Error("Conversion du logo indisponible.");
        target.drawImage(canvas, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
        return cropped.toDataURL("image/png");
      }
    }
    return canvas.toDataURL("image/png");
  })();
  cache.set(cacheKey, promise);
  promise.catch(() => cache.delete(cacheKey));
  return promise;
}

export async function prepareSoftwareIconsForPdf(items: SoftwareSkill[], trim = false) {
  await loadSharedSoftwareLogos();
  return Promise.all(items.map(async (item) => {
    const source = item.customIconDataUrl || softwareIconUrl(item.icon);
    if (!source) return item;
    try {
      return { ...item, customIconDataUrl: await pdfLogo(source, trim) };
    } catch {
      // An unavailable asset must not prevent downloading the rest of the CV.
      return { ...item, customIconDataUrl: undefined };
    }
  }));
}
