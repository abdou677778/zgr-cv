export const TECH_LOGO_MAX_BYTES = 150 * 1024;
const types = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
export function techLogoMime(file: Pick<File, "type" | "name" | "size">) {
  if (!file.size || file.size > 4 * 1024 * 1024)
    throw Error("Choisissez un logo non vide de 4 Mo maximum.");
  if (types.includes(file.type)) return file.type;
  if (file.type === "image/jpg") return "image/jpeg";
  if (file.type === "image/x-png") return "image/png";
  // Some Android/document providers omit the MIME type. Decode still validates the image.
  if (!file.type || file.type === "application/octet-stream") {
    const ext = file.name.split(".").pop()?.toLowerCase();
    const inferred = {
      png: types[0],
      jpg: types[1],
      jpeg: types[1],
      webp: types[2],
      svg: types[3],
    }[ext || ""];
    if (inferred) return inferred;
  }
  throw Error(
    "Formats acceptés : PNG, JPG, WebP ou SVG. Les fichiers HEIC/PDF doivent être convertis en image.",
  );
}
export function pngDataBytes(value: string) {
  const data = value.split(",")[1] || "";
  return Math.floor((data.length * 3) / 4) - (data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0);
}
export async function normalizedTechLogo(file: File) {
  const mime = techLogoMime(file);
  const url = URL.createObjectURL(new Blob([file], { type: mime }));
  const image = new Image();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    image.src = url;
    await Promise.race([
      image.decode().catch(() => {
        throw Error("Image illisible. Essayez un PNG ou JPG exporté depuis votre logiciel.");
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(Error("Décodage trop long. Choisissez une image plus légère.")),
          15000,
        );
      }),
    ]);
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 32000000
    )
      throw Error("Dimensions trop importantes. Réduisez le logo avant l’import.");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Conversion du logo impossible sur cet appareil.");
    for (const size of [224, 192, 160, 128, 96]) {
      ctx.clearRect(0, 0, 256, 256);
      const scale = size / Math.max(image.naturalWidth, image.naturalHeight);
      const w = image.naturalWidth * scale,
        h = image.naturalHeight * scale;
      ctx.drawImage(image, (256 - w) / 2, (256 - h) / 2, w, h);
      const result = canvas.toDataURL("image/png");
      if (
        result.startsWith("data:image/png;base64,") &&
        pngDataBytes(result) <= TECH_LOGO_MAX_BYTES
      )
        return result;
    }
    throw Error("Image trop complexe. Essayez un logo plus simple.");
  } finally {
    clearTimeout(timer);
    image.src = "";
    URL.revokeObjectURL(url);
  }
}
