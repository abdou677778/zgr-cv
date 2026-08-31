import type { ProfilePhoto } from "./cv-types";

export const PROFILE_PHOTO_MAX_BYTES = 150 * 1024;
export const PROFILE_PHOTO_MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const PROFILE_PHOTO_MIN_EDGE = 160;
const PROFILE_PHOTO_INITIAL_MAX_EDGE = 1200;
const PROFILE_PHOTO_MIN_OUTPUT_EDGE = 280;
const PROFILE_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const pdfPhotoCache = new Map<string, string>();

function blobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Lecture de l’image impossible."));
    reader.readAsDataURL(blob);
  });
}

function canvasAsBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Ce navigateur ne peut pas encoder la photo en WebP.")),
      type,
      quality,
    );
  });
}

async function loadBitmap(blob: Blob) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(blob, { imageOrientation: "from-image" });
  }
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("La photo ne peut pas être décodée."));
      image.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function imageDimensions(image: ImageBitmap | HTMLImageElement) {
  return "naturalWidth" in image
    ? { width: image.naturalWidth, height: image.naturalHeight }
    : { width: image.width, height: image.height };
}

function closeBitmap(image: ImageBitmap | HTMLImageElement) {
  if ("close" in image && typeof image.close === "function") image.close();
}

function renderImage(
  image: ImageBitmap | HTMLImageElement,
  sourceWidth: number,
  sourceHeight: number,
  maxEdge: number,
) {
  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Canvas 2D indisponible pour traiter la photo.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

export async function processProfilePhoto(file: File): Promise<ProfilePhoto> {
  if (!PROFILE_PHOTO_TYPES.has(file.type)) {
    throw new Error("Formats acceptés : JPG, PNG ou WebP.");
  }
  if (file.size > PROFILE_PHOTO_MAX_SOURCE_BYTES) {
    throw new Error("La photo source ne doit pas dépasser 12 Mo.");
  }

  const image = await loadBitmap(file);
  try {
    const source = imageDimensions(image);
    if (source.width < PROFILE_PHOTO_MIN_EDGE || source.height < PROFILE_PHOTO_MIN_EDGE) {
      throw new Error("La photo doit mesurer au moins 160 × 160 pixels.");
    }
    if (source.width > 10_000 || source.height > 10_000) {
      throw new Error("Les dimensions de la photo sont trop grandes.");
    }

    let maxEdge = Math.min(PROFILE_PHOTO_INITIAL_MAX_EDGE, Math.max(source.width, source.height));
    while (maxEdge >= PROFILE_PHOTO_MIN_OUTPUT_EDGE) {
      const canvas = renderImage(image, source.width, source.height, maxEdge);
      for (let quality = 0.94; quality >= 0.58; quality -= 0.04) {
        const blob = await canvasAsBlob(canvas, "image/webp", Number(quality.toFixed(2)));
        if (blob.type !== "image/webp") {
          throw new Error("L’encodage WebP n’est pas pris en charge par ce navigateur.");
        }
        if (blob.size <= PROFILE_PHOTO_MAX_BYTES) {
          return {
            dataUrl: await blobAsDataUrl(blob),
            name: "photo-profil.webp",
            width: canvas.width,
            height: canvas.height,
            sizeBytes: blob.size,
            mimeType: "image/webp",
            updatedAt: new Date().toISOString(),
          };
        }
      }
      maxEdge = Math.floor(maxEdge * 0.82);
    }
    throw new Error("La photo ne peut pas être réduite sous 150 Ko avec une qualité suffisante.");
  } finally {
    closeBitmap(image);
  }
}

export function normalizeProfilePhoto(value: unknown): ProfilePhoto | undefined {
  if (!value || typeof value !== "object") return undefined;
  const photo = value as Partial<ProfilePhoto>;
  const dataUrl = typeof photo.dataUrl === "string" ? photo.dataUrl : undefined;
  const r2Key = typeof photo.r2Key === "string" ? photo.r2Key : undefined;
  if (dataUrl && !dataUrl.startsWith("data:image/webp;base64,")) return undefined;
  if (dataUrl) {
    const payload = dataUrl.slice("data:image/webp;base64,".length);
    if (payload.length > Math.ceil(PROFILE_PHOTO_MAX_BYTES / 3) * 4 + 4) return undefined;
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(payload)) return undefined;
  }
  const sizeBytes = Math.max(0, Math.floor(Number(photo.sizeBytes) || 0));
  if (sizeBytes > PROFILE_PHOTO_MAX_BYTES || (!dataUrl && !r2Key)) return undefined;
  return {
    ...(dataUrl ? { dataUrl } : {}),
    ...(r2Key ? { r2Key } : {}),
    name:
      typeof photo.name === "string" && photo.name.trim()
        ? photo.name.slice(0, 120)
        : "photo-profil.webp",
    width: Math.max(1, Math.floor(Number(photo.width) || 1)),
    height: Math.max(1, Math.floor(Number(photo.height) || 1)),
    sizeBytes,
    mimeType: "image/webp",
    updatedAt:
      typeof photo.updatedAt === "string" && photo.updatedAt
        ? photo.updatedAt.slice(0, 40)
        : new Date(0).toISOString(),
  };
}

export async function profilePhotoBlob(photo: ProfilePhoto) {
  if (!photo.dataUrl?.startsWith("data:image/webp;base64,")) {
    throw new Error("Les données WebP de la photo sont absentes.");
  }
  const response = await fetch(photo.dataUrl);
  const blob = await response.blob();
  if (blob.type !== "image/webp" || blob.size > PROFILE_PHOTO_MAX_BYTES) {
    throw new Error("La photo WebP dépasse 150 Ko ou son format est invalide.");
  }
  return blob;
}

export async function blobToProfilePhotoDataUrl(blob: Blob) {
  if (blob.type !== "image/webp" || blob.size > PROFILE_PHOTO_MAX_BYTES) {
    throw new Error("La photo R2 n’est pas un WebP valide de 150 Ko maximum.");
  }
  return blobAsDataUrl(blob);
}

/** pdfmake accepts JPEG/PNG reliably; convert the stored WebP only in memory for PDF rendering. */
export async function profilePhotoDataUrlForPdf(photo: ProfilePhoto) {
  if (!photo.dataUrl) throw new Error("Photo de profil indisponible.");
  const cached = pdfPhotoCache.get(photo.dataUrl);
  if (cached) return cached;
  const blob = await profilePhotoBlob(photo);
  const image = await loadBitmap(blob);
  try {
    const dimensions = imageDimensions(image);
    const canvas = renderImage(image, dimensions.width, dimensions.height, 900);
    const jpeg = await canvasAsBlob(canvas, "image/jpeg", 0.92);
    const dataUrl = await blobAsDataUrl(jpeg);
    pdfPhotoCache.set(photo.dataUrl, dataUrl);
    return dataUrl;
  } finally {
    closeBitmap(image);
  }
}
