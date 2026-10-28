import {
  TECH_CATALOG_TITLE,
  TECH_CATALOG_COMMERCIAL_LINES,
  techCatalogPages,
  publicTechArabicText,
  publicTechPrice,
  publicTechCatalogPeriod,
  type PublicTechService,
} from "./tech-service-catalog";

export const TECH_CATALOG_CANVAS_WIDTH = 1080;
export const techCatalogImageHeight = (count: number) => 220 + Math.ceil(count / 3) * 234 + 170;
export function wrapTechCatalogName(text: string, measure: (text: string) => number, max: number) {
  const lines: string[] = [];
  let current = "";
  for (const word of text.trim().split(/\s+/)) {
    if (measure(word) > max) {
      if (current) {
        lines.push(current);
        current = "";
      }
      for (const character of Array.from(word)) {
        if (current && measure(current + character) > max) {
          lines.push(current);
          current = character;
        } else current += character;
      }
    } else if (current && measure(`${current} ${word}`) > max) {
      lines.push(current);
      current = word;
    } else current = current ? `${current} ${word}` : word;
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
}
async function imageSource(src: string): Promise<HTMLImageElement | null> {
  if (!src) return null;
  const image = new Image();
  image.crossOrigin = "anonymous";
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      image.src = "";
      resolve(null);
    }, 8000);
    image.onload = () => {
      clearTimeout(timer);
      resolve(image.naturalWidth > 0 && image.naturalHeight > 0 ? image : null);
    };
    image.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    image.src = src;
  });
}
function contain(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  size: number,
) {
  const ratio = Math.min(size / image.naturalWidth, size / image.naturalHeight);
  const w = image.naturalWidth * ratio,
    h = image.naturalHeight * ratio;
  ctx.drawImage(image, x + (size - w) / 2, y + (size - h) / 2, w, h);
}
/** Canvas-native branded layout. Images and text are exported, never rendered client HTML. */
export async function drawTechCatalogPage(
  items: PublicTechService[],
  logo: (id: string) => string,
  page: number,
  totalPages: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = TECH_CATALOG_CANVAS_WIDTH;
  canvas.height = techCatalogImageHeight(items.length);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("Export image indisponible sur cet appareil.");
  const missing: string[] = [];
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, canvas.width, 176);
  ctx.fillStyle = "#facc15";
  ctx.fillRect(0, 176, canvas.width, 5);
  const brand = await imageSource("/branding/zgr-tech-logo.jpg");
  if (brand) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(90, 86, 46, 0, Math.PI * 2);
    ctx.clip();
    contain(ctx, brand, 44, 40, 92);
    ctx.restore();
  }
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 43px Arial";
  ctx.fillText(TECH_CATALOG_TITLE, 158, 83);
  ctx.font = "22px Arial";
  ctx.fillStyle = "#e2e8f0";
  ctx.fillText("Abonnements et services numériques", 158, 122);
  const images = await Promise.all(items.map((item) => imageSource(logo(item.id))));
  for (let i = 0; i < items.length; i++) {
    const item = items[i],
      x = 30 + (i % 3) * 342,
      y = 212 + Math.floor(i / 3) * 234,
      w = 324;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#dbe3ef";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, 216, 18);
    ctx.fill();
    ctx.stroke();
    const image = images[i];
    if (image) contain(ctx, image, x + 18, y + 19, 42);
    else {
      missing.push(item.name);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 19px Arial";
      ctx.fillText("Z", x + 27, y + 48);
    }
    let fontSize = 23,
      nameLines: string[];
    do {
      ctx.font = `bold ${fontSize}px Arial`;
      nameLines = wrapTechCatalogName(item.name, (text) => ctx.measureText(text).width, 235);
      if (nameLines.length <= 4 || fontSize <= 11) break;
      fontSize--;
    } while (fontSize >= 11);
    ctx.fillStyle = "#0f172a";
    ctx.direction = "ltr";
    ctx.textAlign = "left";
    nameLines.forEach((line, index) => ctx.fillText(line, x + 76, y + 31 + index * (fontSize + 3)));
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    ctx.fillStyle = "#047857";
    ctx.font = "bold 29px Arial";
    ctx.fillText(publicTechPrice(item), x + w - 18, y + 150);
    ctx.fillStyle = "#64748b";
    ctx.font = "20px Arial";
    ctx.fillText(publicTechCatalogPeriod(item), x + w - 18, y + 181);
    if (item.invoiceAvailable) {
      ctx.fillStyle = "#4338ca";
      ctx.font = "15px Arial";
      ctx.fillText("فاتورة رسمية متاحة بعد التأكيد", x + w - 18, y + 203);
    }
    ctx.direction = "ltr";
    ctx.textAlign = "left";
  }
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.font = "18px Arial";
  ctx.fillStyle = "#0f172a";
  TECH_CATALOG_COMMERCIAL_LINES.forEach((line, index) =>
    ctx.fillText(line, 1035, canvas.height - 147 + index * 23),
  );
  ctx.direction = "ltr";
  ctx.textAlign = "left";
  ctx.font = "18px Arial";
  ctx.fillText(`ZGR Tech  ·  ${page} / ${totalPages}`, 35, canvas.height - 35);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(Error("Image non générée."))),
      "image/png",
    ),
  );
  return { blob, missing };
}
export function saveTechCatalogBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export async function exportTechCatalog(items: PublicTechService[], logo: (id: string) => string) {
  if (!items.length) throw Error("Aucun service public disponible.");
  const { zipSync, strToU8 } = await import("fflate");
  const pages = techCatalogPages(items),
    files: Record<string, Uint8Array> = {};
  const missing: string[] = [];
  for (let i = 0; i < pages.length; i++) {
    const result = await drawTechCatalogPage(pages[i], logo, i + 1, pages.length);
    files[`Services-ZGR-Tech-${String(i + 1).padStart(2, "0")}.png`] = new Uint8Array(
      await result.blob.arrayBuffer(),
    );
    missing.push(...result.missing);
  }
  files["Services-ZGR-Tech-ar.txt"] = strToU8(publicTechArabicText(items));
  saveTechCatalogBlob(
    new Blob([new Uint8Array(zipSync(files, { level: 0 }))], { type: "application/zip" }),
    "Services-ZGR-Tech.zip",
  );
  return { pages: pages.length, missing };
}
