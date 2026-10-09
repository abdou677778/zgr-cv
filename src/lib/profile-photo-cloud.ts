import { authenticatedFetch } from "./auth-client";

export type ProfilePhotoAssetKind = "original" | "professional";

export type ProfilePhotoAsset = {
  id: string;
  kind: ProfilePhotoAssetKind;
  label: string;
  name: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
  sizeBytes: number;
  createdAt: string;
  backgroundColor?: string;
  model?: string;
  sourceId?: string;
};

type SavePhotoAssetOptions = {
  id?: string;
  kind: ProfilePhotoAssetKind;
  label: string;
  width: number;
  height: number;
  backgroundColor?: string;
  model?: string;
  sourceId?: string;
};

const assetUrl = (profileId: string, assetId?: string) =>
  `/api/clients/${encodeURIComponent(profileId)}/photos${assetId ? `/${assetId}` : ""}`;

async function apiError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

export async function listProfilePhotoAssets(profileId: string) {
  const response = await authenticatedFetch(assetUrl(profileId), { cache: "no-store" });
  if (!response.ok)
    throw new Error(await apiError(response, "Impossible de charger la galerie photo."));
  const body = (await response.json()) as { items?: ProfilePhotoAsset[]; limit?: number };
  return {
    items: Array.isArray(body.items) ? body.items : [],
    limit: Number(body.limit) || 24,
  };
}

export async function getProfilePhotoAssetBlob(profileId: string, assetId: string) {
  const response = await authenticatedFetch(assetUrl(profileId, assetId), { cache: "no-store" });
  if (!response.ok) throw new Error(await apiError(response, "Impossible de charger cette photo."));
  return response.blob();
}

export async function saveProfilePhotoAsset(
  profileId: string,
  blob: Blob,
  options: SavePhotoAssetOptions,
) {
  const id = options.id || crypto.randomUUID();
  const headers = new Headers({
    "Content-Type": blob.type,
    "X-Photo-Kind": options.kind,
    "X-Photo-Label": options.label,
    "X-Photo-Width": String(options.width),
    "X-Photo-Height": String(options.height),
  });
  if (options.backgroundColor) headers.set("X-Photo-Background", options.backgroundColor);
  if (options.model) headers.set("X-Photo-Model", options.model);
  if (options.sourceId) headers.set("X-Photo-Source-Id", options.sourceId);
  const response = await authenticatedFetch(assetUrl(profileId, id), {
    method: "PUT",
    headers,
    body: blob,
  });
  if (!response.ok)
    throw new Error(await apiError(response, "Impossible d’enregistrer la photo dans R2."));
  return { id, ...((await response.json()) as { createdAt?: string }) };
}

export async function deleteProfilePhotoAsset(profileId: string, assetId: string) {
  const response = await authenticatedFetch(assetUrl(profileId, assetId), { method: "DELETE" });
  if (!response.ok)
    throw new Error(await apiError(response, "Impossible de supprimer cette photo."));
}
