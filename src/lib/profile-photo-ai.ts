import type { ImageSegmenter } from "@mediapipe/tasks-vision";
import type { ProfilePhoto } from "./cv-types";
import { PROFILE_PHOTO_BACKGROUND, processProfilePhoto, profilePhotoBlob } from "./profile-photo";

let segmenterPromise: Promise<ImageSegmenter> | null = null;

function publicAsset(path: string) {
  const base = import.meta.env.BASE_URL || "/";
  return `${base.replace(/\/?$/, "/")}${path.replace(/^\//, "")}`;
}

async function localSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = import("@mediapipe/tasks-vision")
      .then(async ({ FilesetResolver, ImageSegmenter }) => {
        const fileset = await FilesetResolver.forVisionTasks(publicAsset("mediapipe/wasm"));
        return ImageSegmenter.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: publicAsset("mediapipe/models/selfie_segmenter.tflite"),
            delegate: "CPU",
          },
          runningMode: "IMAGE",
          outputCategoryMask: false,
          outputConfidenceMasks: true,
        });
      })
      .catch((error) => {
        segmenterPromise = null;
        throw error;
      });
  }
  return segmenterPromise;
}

async function imageBitmap(blob: Blob) {
  if (typeof createImageBitmap !== "function")
    throw new Error("Ce navigateur ne prend pas en charge le moteur photo local.");
  return createImageBitmap(blob, { imageOrientation: "from-image" });
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encodage de la photo impossible."))),
      "image/png",
      1,
    );
  });
}

function refinedAlpha(confidence: number) {
  const normalized = Math.max(0, Math.min(1, (confidence - 0.08) / 0.72));
  return normalized * normalized * (3 - 2 * normalized);
}

function maskCanvas(mask: Float32Array, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D indisponible pour le masque photo.");
  const pixels = context.createImageData(width, height);
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4;
    const alpha = Math.round(refinedAlpha(mask[index]) * 255);
    pixels.data[offset] = 255;
    pixels.data[offset + 1] = 255;
    pixels.data[offset + 2] = 255;
    pixels.data[offset + 3] = alpha;
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

/**
 * Runs Google MediaPipe entirely inside the browser. No image bytes, API key,
 * quota or paid service are involved.
 */
export async function professionalizeProfilePhoto(photo: ProfilePhoto): Promise<ProfilePhoto> {
  if (!photo.dataUrl) throw new Error("La photo active n’est pas disponible dans ce navigateur.");
  const [segmenter, bitmap] = await Promise.all([
    localSegmenter(),
    profilePhotoBlob(photo).then(imageBitmap),
  ]);
  try {
    const result = segmenter.segment(bitmap);
    try {
      const masks = result.confidenceMasks || [];
      if (!masks.length) throw new Error("Aucune personne n’a été détectée sur la photo.");
      const labels = segmenter.getLabels();
      const labelledPerson = labels.findIndex((label) => /person|foreground/i.test(label));
      const maskIndex = labelledPerson >= 0 ? labelledPerson : masks.length > 1 ? 1 : 0;
      const selectedMask = masks[Math.min(maskIndex, masks.length - 1)];
      const mask = new Float32Array(selectedMask.getAsFloat32Array());
      if (!mask.some((value) => value >= 0.35))
        throw new Error("La personne n’est pas assez visible pour créer une photo CV fiable.");

      const subject = document.createElement("canvas");
      subject.width = bitmap.width;
      subject.height = bitmap.height;
      const subjectContext = subject.getContext("2d");
      if (!subjectContext) throw new Error("Canvas 2D indisponible pour traiter la photo.");
      subjectContext.imageSmoothingEnabled = true;
      subjectContext.imageSmoothingQuality = "high";
      subjectContext.drawImage(bitmap, 0, 0);
      subjectContext.globalCompositeOperation = "destination-in";
      subjectContext.drawImage(
        maskCanvas(mask, selectedMask.width, selectedMask.height),
        0,
        0,
        bitmap.width,
        bitmap.height,
      );

      const output = document.createElement("canvas");
      output.width = bitmap.width;
      output.height = bitmap.height;
      const outputContext = output.getContext("2d", { alpha: false });
      if (!outputContext) throw new Error("Canvas 2D indisponible pour finaliser la photo.");
      outputContext.fillStyle = PROFILE_PHOTO_BACKGROUND;
      outputContext.fillRect(0, 0, output.width, output.height);
      outputContext.drawImage(subject, 0, 0);

      const flattened = await canvasBlob(output);
      const processed = await processProfilePhoto(
        new File([flattened], "photo-cv-fond-e7e7e7.png", { type: "image/png" }),
      );
      return {
        ...processed,
        name: "photo-cv-professionnelle.webp",
        updatedAt: new Date().toISOString(),
      };
    } finally {
      result.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Traitement local impossible.";
    throw new Error(`Photo CV locale impossible : ${message}`);
  } finally {
    bitmap.close();
  }
}
