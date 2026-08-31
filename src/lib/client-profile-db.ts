import type { CV, ProfilePhoto } from "./cv-types";
import type { DocumentLanguage } from "./document-language";
import type { HiddenCvElements } from "./cv-visibility";
import type { DocumentKind, PdfTemplateId } from "./document-pdf";
import type { TemplateColorMap } from "./pdf-theme";
import {
  blobToProfilePhotoDataUrl,
  normalizeProfilePhoto,
  profilePhotoBlob,
} from "./profile-photo";

const DB_NAME = "zgr-cv-clients";
const DB_VERSION = 1;
const STORE_NAME = "profiles";

export type ClientProfile = {
  version: 1;
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
  language: DocumentLanguage;
  cvByLanguage: Record<DocumentLanguage, CV>;
  hiddenElements: HiddenCvElements;
  documentKind: DocumentKind;
  templateId: PdfTemplateId;
  templateColors: TemplateColorMap;
  photoAsset?: Omit<ProfilePhoto, "dataUrl">;
};

export type ClientProfileSummary = Pick<
  ClientProfile,
  "id" | "name" | "email" | "phone" | "createdAt" | "updatedAt" | "language"
> & { hasPhoto?: boolean };

const asPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Erreur IndexedDB."));
  });

async function openDatabase() {
  if (!("indexedDB" in window))
    throw new Error("IndexedDB n’est pas disponible dans ce navigateur.");
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(STORE_NAME)) {
      const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
      store.createIndex("name", "name", { unique: false });
      store.createIndex("updatedAt", "updatedAt", { unique: false });
    }
  };
  return asPromise(request);
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, mode);
    const result = await asPromise(operation(transaction.objectStore(STORE_NAME)));
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Transaction interrompue."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Transaction annulée."));
    });
    return result;
  } finally {
    database.close();
  }
}

function randomSuffix() {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 8)
    .toUpperCase();
}

export function newClientProfileId() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `ZGR-${date}-${randomSuffix()}`;
}

export async function saveClientProfile(profile: ClientProfile) {
  await withStore("readwrite", (store) => store.put(structuredClone(profile)));
  return profile;
}

export async function getClientProfile(id: string) {
  return withStore<ClientProfile | undefined>("readonly", (store) => store.get(id));
}

export async function listClientProfiles(): Promise<ClientProfileSummary[]> {
  const profiles = await withStore<ClientProfile[]>("readonly", (store) => store.getAll());
  return profiles
    .map(
      ({
        cvByLanguage,
        hiddenElements: _hidden,
        templateColors: _colors,
        photoAsset,
        ...summary
      }) => ({
        ...summary,
        hasPhoto:
          Boolean(photoAsset?.r2Key) ||
          Object.values(cvByLanguage).some((document) => Boolean(document.photo)),
      }),
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function deleteClientProfile(id: string) {
  await withStore("readwrite", (store) => store.delete(id));
}

export type CloudProfileSummary = ClientProfileSummary & { size?: number };

function cloudHeaders(token: string, json = false): HeadersInit {
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token.trim() ? { Authorization: `Bearer ${token.trim()}` } : {}),
  };
}

async function cloudResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new Error(body.error || `Synchronisation refusée (${response.status}).`);
  return body;
}

const cloudUrl = (endpoint: string, id?: string) => {
  const base = endpoint.trim().replace(/\/$/, "");
  if (!base) throw new Error("Ajoutez l’adresse de l’API R2.");
  return id ? `${base}/${encodeURIComponent(id)}` : base;
};

const cloudPhotoUrl = (endpoint: string, id: string) => `${cloudUrl(endpoint, id)}/photo`;

function profilePhoto(profile: ClientProfile) {
  for (const cv of Object.values(profile.cvByLanguage)) {
    const normalized = normalizeProfilePhoto(cv.photo);
    if (normalized) return normalized;
  }
  return normalizeProfilePhoto(profile.photoAsset);
}

function profileForCloud(profile: ClientProfile, photo?: ProfilePhoto): ClientProfile {
  const next = structuredClone(profile);
  const r2Key = photo ? `clients/${profile.id}/photo.webp` : undefined;
  for (const cv of Object.values(next.cvByLanguage)) {
    if (!photo) {
      cv.photo = undefined;
      continue;
    }
    cv.photo = { ...photo, dataUrl: undefined, r2Key };
  }
  if (photo) {
    const { dataUrl: _dataUrl, ...metadata } = photo;
    next.photoAsset = { ...metadata, r2Key };
  } else {
    next.photoAsset = undefined;
  }
  return next;
}

export async function listCloudProfiles(endpoint: string, token: string) {
  const response = await fetch(cloudUrl(endpoint), { headers: cloudHeaders(token) });
  const body = await cloudResponse<{ profiles: CloudProfileSummary[] }>(response);
  return body.profiles;
}

export async function getCloudProfile(endpoint: string, token: string, id: string) {
  const response = await fetch(cloudUrl(endpoint, id), { headers: cloudHeaders(token) });
  const profile = await cloudResponse<ClientProfile>(response);
  const metadata = profilePhoto(profile);
  if (!metadata) return profile;
  const photoResponse = await fetch(cloudPhotoUrl(endpoint, id), {
    headers: cloudHeaders(token),
    cache: "no-store",
  });
  if (photoResponse.status === 404) {
    profile.photoAsset = undefined;
    for (const cv of Object.values(profile.cvByLanguage)) cv.photo = undefined;
    return profile;
  }
  if (!photoResponse.ok) {
    await cloudResponse(photoResponse);
    return profile;
  }
  const photoDataUrl = await blobToProfilePhotoDataUrl(await photoResponse.blob());
  const hydrated: ProfilePhoto = { ...metadata, dataUrl: photoDataUrl };
  const { dataUrl: _dataUrl, ...photoAsset } = metadata;
  profile.photoAsset = photoAsset;
  for (const cv of Object.values(profile.cvByLanguage)) cv.photo = structuredClone(hydrated);
  return profile;
}

export async function putCloudProfile(endpoint: string, token: string, profile: ClientProfile) {
  const photo = profilePhoto(profile);
  if (photo?.dataUrl) {
    const blob = await profilePhotoBlob(photo);
    const photoResponse = await fetch(cloudPhotoUrl(endpoint, profile.id), {
      method: "PUT",
      headers: {
        ...cloudHeaders(token),
        "Content-Type": "image/webp",
      },
      body: blob,
    });
    await cloudResponse<{ ok: true; key: string }>(photoResponse);
  }
  const cloudProfile = profileForCloud(profile, photo);
  const response = await fetch(cloudUrl(endpoint, profile.id), {
    method: "PUT",
    headers: cloudHeaders(token, true),
    body: JSON.stringify(cloudProfile),
  });
  await cloudResponse<{ ok: true }>(response);
  if (!photo) {
    const photoResponse = await fetch(cloudPhotoUrl(endpoint, profile.id), {
      method: "DELETE",
      headers: cloudHeaders(token),
    });
    if (photoResponse.status !== 404) await cloudResponse<{ ok: true }>(photoResponse);
  }
  return cloudProfile.photoAsset;
}

export async function synchronizeClientProfiles(endpoint: string, token: string) {
  const localSummaries = await listClientProfiles();
  const remoteSummaries = await listCloudProfiles(endpoint, token);
  const localById = new Map(localSummaries.map((profile) => [profile.id, profile]));
  const remoteById = new Map(remoteSummaries.map((profile) => [profile.id, profile]));
  let uploaded = 0;
  let downloaded = 0;

  for (const local of localSummaries) {
    const remote = remoteById.get(local.id);
    if (!remote || local.updatedAt > remote.updatedAt) {
      const profile = await getClientProfile(local.id);
      if (profile) {
        await putCloudProfile(endpoint, token, profile);
        uploaded += 1;
      }
    }
  }

  for (const remote of remoteSummaries) {
    const local = localById.get(remote.id);
    if (!local || remote.updatedAt > local.updatedAt) {
      const profile = await getCloudProfile(endpoint, token, remote.id);
      await saveClientProfile(profile);
      downloaded += 1;
    }
  }

  return { uploaded, downloaded, total: new Set([...localById.keys(), ...remoteById.keys()]).size };
}
