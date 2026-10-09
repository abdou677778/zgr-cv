import type { ProfilePhoto } from "./cv-types";
import { authenticatedFetch } from "./auth-client";
import { composeProfessionalProfilePhoto, profilePhotoDataUrlForPdf } from "./profile-photo";

async function responseError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

/** Removes only the background; no face, body, clothing or identity is generated. */
export async function professionalizeProfilePhoto(photo: ProfilePhoto): Promise<ProfilePhoto> {
  if (!photo.dataUrl) throw new Error("La photo active n’est pas disponible dans ce navigateur.");
  const modelInput = await profilePhotoDataUrlForPdf(photo);
  const response = await authenticatedFetch(
    "/api/ai/profile-photo/background",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: modelInput }),
    },
    90_000,
  );
  if (!response.ok)
    throw new Error(await responseError(response, `Détourage IA refusé (${response.status}).`));
  return composeProfessionalProfilePhoto(await response.blob());
}
