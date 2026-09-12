import type { CV, ProfilePhoto } from "./cv-types";
import type { DocumentLanguage } from "./document-language";
import type { HiddenCvElements } from "./cv-visibility";
import type { DocumentKind, PdfTemplateId } from "./document-pdf";
import type { TemplateColorMap } from "./pdf-theme";
import type { TemplateDesignerSettings } from "./template-designer";
import {
  blobToProfilePhotoDataUrl,
  normalizeProfilePhoto,
  profilePhotoBlob,
} from "./profile-photo";
import { authenticatedFetch, type AccountRole } from "./auth-client";

const DB_NAME = "zgr-cv-clients";
const DB_VERSION = 3;
const STORE_NAME = "profiles";
const QUEUE_STORE_NAME = "pendingCloudProfiles";
const DRAFT_STORE_NAME = "workspaceDrafts";

export type ClientProfile = {
  version: 1;
  /** Révision optimiste attribuée par le serveur. Les anciens profils commencent à 0. */
  revision?: number;
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: ClientProfileActor;
  updatedBy?: ClientProfileActor;
  workflowStatus?: ClientWorkflowStatus;
  workflowUpdatedAt?: string;
  workflowUpdatedBy?: ClientProfileActor;
  workflowComment?: string;
  workflowCommentAt?: string;
  workflowCommentBy?: ClientProfileActor;
  workflowAssignee?: ClientProfileActor;
  workflowAssignedAt?: string;
  workflowAssignedBy?: ClientProfileActor;
  language: DocumentLanguage;
  cvByLanguage: Record<DocumentLanguage, CV>;
  hiddenElements: HiddenCvElements;
  documentKind: DocumentKind;
  templateId: PdfTemplateId;
  templateColors: TemplateColorMap;
  templateDesign?: TemplateDesignerSettings;
  sectionAppearance?: Record<string, { title: string; icon: string }>;
  photoAsset?: Omit<ProfilePhoto, "dataUrl">;
};

export type ClientProfileActor = {
  username: string;
  displayName: string;
  role: AccountRole;
};

export type ClientWorkflowStatus = "draft" | "review" | "approved";

export type ClientProfileSummary = Pick<
  ClientProfile,
  | "id"
  | "revision"
  | "name"
  | "email"
  | "phone"
  | "createdAt"
  | "updatedAt"
  | "createdBy"
  | "updatedBy"
  | "workflowStatus"
  | "workflowUpdatedAt"
  | "workflowUpdatedBy"
  | "workflowComment"
  | "workflowCommentAt"
  | "workflowCommentBy"
  | "workflowAssignee"
  | "workflowAssignedAt"
  | "workflowAssignedBy"
  | "language"
> & { hasPhoto?: boolean };

export type TrashedClientProfile = {
  id: string;
  name: string;
  deletedAt: string;
  expiresAt: string;
  deletedBy: ClientProfileActor;
  revision: number;
  hasPhoto: boolean;
};

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
    if (!database.objectStoreNames.contains(QUEUE_STORE_NAME)) {
      const queue = database.createObjectStore(QUEUE_STORE_NAME, { keyPath: "id" });
      queue.createIndex("queuedAt", "queuedAt", { unique: false });
    }
    if (!database.objectStoreNames.contains(DRAFT_STORE_NAME)) {
      database.createObjectStore(DRAFT_STORE_NAME, { keyPath: "username" });
    }
  };
  return asPromise(request);
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
  storeName = STORE_NAME,
) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, mode);
    const result = await asPromise(operation(transaction.objectStore(storeName)));
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
        templateDesign: _design,
        sectionAppearance: _sectionAppearance,
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

export type QueuedCloudProfile = {
  id: string;
  profile: ClientProfile;
  queuedAt: string;
  attempts: number;
  lastError?: string;
};

export async function queueCloudProfile(profile: ClientProfile, lastError?: string) {
  const current = await withStore<QueuedCloudProfile | undefined>(
    "readonly",
    (store) => store.get(profile.id),
    QUEUE_STORE_NAME,
  );
  const entry: QueuedCloudProfile = {
    id: profile.id,
    profile: structuredClone(profile),
    queuedAt: current?.queuedAt ?? new Date().toISOString(),
    attempts: current?.attempts ?? 0,
    lastError: lastError?.slice(0, 500),
  };
  await withStore("readwrite", (store) => store.put(entry), QUEUE_STORE_NAME);
  return entry;
}

export async function listQueuedCloudProfiles() {
  const entries = await withStore<QueuedCloudProfile[]>(
    "readonly",
    (store) => store.getAll(),
    QUEUE_STORE_NAME,
  );
  return entries.sort((left, right) => left.queuedAt.localeCompare(right.queuedAt));
}

export async function removeQueuedCloudProfile(id: string) {
  await withStore("readwrite", (store) => store.delete(id), QUEUE_STORE_NAME);
}

export type WorkspaceDraft<T = unknown> = {
  username: string;
  version: 1;
  savedAt: string;
  fingerprint: string;
  baselineFingerprint: string;
  payload: T;
};

export async function saveWorkspaceDraft<T>(draft: WorkspaceDraft<T>) {
  await withStore("readwrite", (store) => store.put(structuredClone(draft)), DRAFT_STORE_NAME);
  return draft;
}

export async function getWorkspaceDraft<T>(username: string) {
  return withStore<WorkspaceDraft<T> | undefined>(
    "readonly",
    (store) => store.get(username),
    DRAFT_STORE_NAME,
  );
}

export async function deleteWorkspaceDraft(username: string) {
  await withStore("readwrite", (store) => store.delete(username), DRAFT_STORE_NAME);
}

export type CloudProfileSummary = ClientProfileSummary & { size?: number };

export type CloudDeletedProfileSummary = {
  id: string;
  deletedAt: string;
  deletedBy: string;
};

export type CloudProfilePagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

export type ClientWorkflowCounts = Record<"all" | ClientWorkflowStatus, number>;

export type CloudProfileListOptions = {
  query?: string;
  owner?: "all" | "created" | "updated" | "involved";
  status?: "all" | ClientWorkflowStatus;
  page?: number;
  pageSize?: number;
  scope?: "page" | "sync";
};

export type CloudProfileCommit = Pick<
  ClientProfile,
  | "revision"
  | "createdAt"
  | "updatedAt"
  | "createdBy"
  | "updatedBy"
  | "workflowStatus"
  | "workflowUpdatedAt"
  | "workflowUpdatedBy"
  | "workflowComment"
  | "workflowCommentAt"
  | "workflowCommentBy"
  | "workflowAssignee"
  | "workflowAssignedAt"
  | "workflowAssignedBy"
> & {
  photoAsset?: Omit<ProfilePhoto, "dataUrl">;
};

export type CloudProfileVersion = {
  revision: number;
  updatedAt: string;
  updatedBy?: ClientProfileActor;
  restoredFromRevision?: number;
  workflowStatus?: ClientWorkflowStatus;
  workflowAssignee?: ClientProfileActor;
  hasPhoto?: boolean;
  size?: number;
};

export type CloudProfileConflict = {
  revision: number;
  updatedAt: string;
  updatedBy?: ClientProfileActor;
};

export class CloudProfileConflictError extends Error {
  readonly current?: CloudProfileConflict;

  constructor(message: string, current?: CloudProfileConflict) {
    super(message);
    this.name = "CloudProfileConflictError";
    this.current = current;
  }
}

export class CloudProfileLockedError extends Error {
  readonly current?: CloudProfileConflict & { workflowStatus?: ClientWorkflowStatus };

  constructor(
    message: string,
    current?: CloudProfileConflict & { workflowStatus?: ClientWorkflowStatus },
  ) {
    super(message);
    this.name = "CloudProfileLockedError";
    this.current = current;
  }
}

function cloudHeaders(token: string, json = false): HeadersInit {
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token.trim() ? { Authorization: `Bearer ${token.trim()}` } : {}),
  };
}

async function cloudResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
    current?: CloudProfileConflict & { workflowStatus?: ClientWorkflowStatus };
  } & T;
  if (response.status === 409 && body.code === "CLIENT_PROFILE_CONFLICT") {
    throw new CloudProfileConflictError(
      body.error || "Ce profil a été modifié par un autre utilisateur.",
      body.current,
    );
  }
  if (response.status === 423 && body.code === "CLIENT_PROFILE_LOCKED") {
    throw new CloudProfileLockedError(body.error || "Ce CV validé est verrouillé.", body.current);
  }
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

export async function listCloudProfiles(
  endpoint: string,
  token: string,
  options: CloudProfileListOptions = {},
) {
  const params = new URLSearchParams();
  if (options.query?.trim()) params.set("q", options.query.trim());
  if (options.owner && options.owner !== "all") params.set("owner", options.owner);
  if (options.status && options.status !== "all") params.set("status", options.status);
  if (options.page) params.set("page", String(options.page));
  if (options.pageSize) params.set("pageSize", String(options.pageSize));
  if (options.scope === "sync") params.set("scope", "sync");
  const query = params.toString();
  const response = await authenticatedFetch(`${cloudUrl(endpoint)}${query ? `?${query}` : ""}`, {
    headers: cloudHeaders(token),
  });
  const body = await cloudResponse<{
    profiles: CloudProfileSummary[];
    deletedProfiles?: CloudDeletedProfileSummary[];
    pagination?: CloudProfilePagination;
    indexSource?: "d1" | "r2" | "r2-backfill";
    workflowCounts?: ClientWorkflowCounts;
  }>(response);
  return {
    profiles: body.profiles,
    deletedProfiles: body.deletedProfiles ?? [],
    pagination: body.pagination,
    indexSource: body.indexSource,
    workflowCounts: body.workflowCounts ?? {
      all: body.profiles.length,
      draft: body.profiles.filter((profile) => (profile.workflowStatus ?? "draft") === "draft")
        .length,
      review: body.profiles.filter((profile) => profile.workflowStatus === "review").length,
      approved: body.profiles.filter((profile) => profile.workflowStatus === "approved").length,
    },
  };
}

export async function listWorkflowValidators(endpoint: string, token: string) {
  const response = await authenticatedFetch(`${cloudUrl(endpoint)}/workflow-validators`, {
    headers: cloudHeaders(token),
    cache: "no-store",
  });
  return cloudResponse<{ validators: ClientProfileActor[] }>(response);
}

export async function getCloudProfile(endpoint: string, token: string, id: string) {
  const response = await authenticatedFetch(cloudUrl(endpoint, id), {
    headers: cloudHeaders(token),
  });
  const profile = await cloudResponse<ClientProfile>(response);
  const metadata = profilePhoto(profile);
  if (!metadata) return profile;
  const photoResponse = await authenticatedFetch(cloudPhotoUrl(endpoint, id), {
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

export async function listCloudProfileVersions(endpoint: string, token: string, id: string) {
  const response = await authenticatedFetch(`${cloudUrl(endpoint, id)}/versions`, {
    headers: cloudHeaders(token),
    cache: "no-store",
  });
  return cloudResponse<{
    id: string;
    currentRevision: number;
    versions: CloudProfileVersion[];
  }>(response);
}

export async function getCloudProfileVersion(
  endpoint: string,
  token: string,
  id: string,
  revision: number,
) {
  const response = await authenticatedFetch(`${cloudUrl(endpoint, id)}/versions/${revision}`, {
    headers: cloudHeaders(token),
    cache: "no-store",
  });
  return cloudResponse<{ id: string; revision: number; profile: ClientProfile }>(response);
}

export async function updateCloudProfileWorkflow(
  endpoint: string,
  token: string,
  id: string,
  status: ClientWorkflowStatus,
  expectedRevision: number,
  comment?: string,
) {
  const response = await authenticatedFetch(`${cloudUrl(endpoint, id)}/workflow`, {
    method: "PUT",
    headers: cloudHeaders(token, true),
    body: JSON.stringify({ status, expectedRevision, comment }),
  });
  return cloudResponse<{ ok: true; id: string; unchanged?: boolean; profile: ClientProfile }>(
    response,
  );
}

export async function updateCloudProfileWorkflowAssignment(
  endpoint: string,
  token: string,
  id: string,
  expectedRevision: number,
  assigneeUsername: string,
) {
  const response = await authenticatedFetch(`${cloudUrl(endpoint, id)}/workflow/assignment`, {
    method: "PUT",
    headers: cloudHeaders(token, true),
    body: JSON.stringify({ expectedRevision, assigneeUsername }),
  });
  return cloudResponse<{ ok: true; id: string; unchanged?: boolean; profile: ClientProfile }>(
    response,
  );
}

export async function restoreCloudProfileVersion(
  endpoint: string,
  token: string,
  id: string,
  revision: number,
  expectedRevision: number,
) {
  const response = await authenticatedFetch(
    `${cloudUrl(endpoint, id)}/versions/${revision}/restore`,
    {
      method: "POST",
      headers: cloudHeaders(token, true),
      body: JSON.stringify({ expectedRevision }),
    },
  );
  return cloudResponse<{
    ok: true;
    id: string;
    restoredFromRevision: number;
    profile: CloudProfileCommit;
  }>(response);
}

export async function deleteCloudProfile(endpoint: string, token: string, id: string) {
  const response = await authenticatedFetch(cloudUrl(endpoint, id), {
    method: "DELETE",
    headers: cloudHeaders(token),
  });
  await cloudResponse<{ ok: true; id: string }>(response);
}

export async function listCloudTrash() {
  const response = await authenticatedFetch("/api/admin/trash");
  return cloudResponse<{ items: TrashedClientProfile[]; retentionDays: number }>(response);
}

export async function restoreCloudTrashProfile(id: string) {
  const response = await authenticatedFetch(`/api/admin/trash/${encodeURIComponent(id)}/restore`, {
    method: "POST",
  });
  return cloudResponse<{ ok: true; profile: ClientProfile }>(response);
}

export async function purgeCloudTrashProfile(id: string, confirmation: string) {
  const query = new URLSearchParams({ confirmation });
  const response = await authenticatedFetch(
    `/api/admin/trash/${encodeURIComponent(id)}?${query.toString()}`,
    { method: "DELETE" },
  );
  return cloudResponse<{ ok: true; id: string; deletedObjects: number }>(response);
}

export async function putCloudProfile(endpoint: string, token: string, profile: ClientProfile) {
  const photo = profilePhoto(profile);
  if (photo?.dataUrl) {
    const blob = await profilePhotoBlob(photo);
    const photoResponse = await authenticatedFetch(cloudPhotoUrl(endpoint, profile.id), {
      method: "PUT",
      headers: {
        ...cloudHeaders(token),
        "Content-Type": "image/webp",
        "X-Profile-Revision": String(profile.revision ?? 0),
      },
      body: blob,
    });
    await cloudResponse<{ ok: true; key: string }>(photoResponse);
  }
  const cloudProfile = profileForCloud(profile, photo);
  const response = await authenticatedFetch(cloudUrl(endpoint, profile.id), {
    method: "PUT",
    headers: cloudHeaders(token, true),
    body: JSON.stringify(cloudProfile),
  });
  const result = await cloudResponse<{
    ok: true;
    profile?: Pick<
      ClientProfile,
      | "revision"
      | "createdAt"
      | "updatedAt"
      | "createdBy"
      | "updatedBy"
      | "workflowStatus"
      | "workflowUpdatedAt"
      | "workflowUpdatedBy"
      | "workflowComment"
      | "workflowCommentAt"
      | "workflowCommentBy"
      | "workflowAssignee"
      | "workflowAssignedAt"
      | "workflowAssignedBy"
    >;
  }>(response);
  if (!photo) {
    const photoResponse = await authenticatedFetch(cloudPhotoUrl(endpoint, profile.id), {
      method: "DELETE",
      headers: cloudHeaders(token),
    });
    if (photoResponse.status !== 404) await cloudResponse<{ ok: true }>(photoResponse);
  }
  return {
    revision: result.profile?.revision ?? cloudProfile.revision ?? 0,
    createdAt: result.profile?.createdAt ?? cloudProfile.createdAt,
    updatedAt: result.profile?.updatedAt ?? cloudProfile.updatedAt,
    createdBy: result.profile?.createdBy ?? cloudProfile.createdBy,
    updatedBy: result.profile?.updatedBy ?? cloudProfile.updatedBy,
    workflowStatus: result.profile?.workflowStatus ?? cloudProfile.workflowStatus ?? "draft",
    workflowUpdatedAt: result.profile?.workflowUpdatedAt ?? cloudProfile.workflowUpdatedAt,
    workflowUpdatedBy: result.profile?.workflowUpdatedBy ?? cloudProfile.workflowUpdatedBy,
    workflowComment: result.profile?.workflowComment ?? cloudProfile.workflowComment,
    workflowCommentAt: result.profile?.workflowCommentAt ?? cloudProfile.workflowCommentAt,
    workflowCommentBy: result.profile?.workflowCommentBy ?? cloudProfile.workflowCommentBy,
    workflowAssignee: result.profile?.workflowAssignee ?? cloudProfile.workflowAssignee,
    workflowAssignedAt: result.profile?.workflowAssignedAt ?? cloudProfile.workflowAssignedAt,
    workflowAssignedBy: result.profile?.workflowAssignedBy ?? cloudProfile.workflowAssignedBy,
    photoAsset: cloudProfile.photoAsset,
  } satisfies CloudProfileCommit;
}

export function applyCloudCommit(profile: ClientProfile, commit: CloudProfileCommit) {
  const committed = structuredClone(profile);
  committed.revision = commit.revision;
  committed.createdAt = commit.createdAt;
  committed.updatedAt = commit.updatedAt;
  committed.createdBy = commit.createdBy;
  committed.updatedBy = commit.updatedBy;
  committed.workflowStatus = commit.workflowStatus;
  committed.workflowUpdatedAt = commit.workflowUpdatedAt;
  committed.workflowUpdatedBy = commit.workflowUpdatedBy;
  committed.workflowComment = commit.workflowComment;
  committed.workflowCommentAt = commit.workflowCommentAt;
  committed.workflowCommentBy = commit.workflowCommentBy;
  committed.workflowAssignee = commit.workflowAssignee;
  committed.workflowAssignedAt = commit.workflowAssignedAt;
  committed.workflowAssignedBy = commit.workflowAssignedBy;
  committed.photoAsset = commit.photoAsset;
  if (commit.photoAsset?.r2Key) {
    for (const cv of Object.values(committed.cvByLanguage)) {
      if (cv.photo) cv.photo.r2Key = commit.photoAsset.r2Key;
    }
  }
  return committed;
}

export async function flushCloudProfileQueue(endpoint: string, token: string) {
  const entries = await listQueuedCloudProfiles();
  let uploaded = 0;
  let conflicts = 0;
  let locked = 0;
  let failed = 0;
  const committedProfiles: ClientProfile[] = [];
  for (const entry of entries) {
    const local = (await getClientProfile(entry.id)) ?? entry.profile;
    try {
      const commit = await putCloudProfile(endpoint, token, local);
      const committed = applyCloudCommit(local, commit);
      await saveClientProfile(committed);
      await removeQueuedCloudProfile(entry.id);
      committedProfiles.push(committed);
      uploaded += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Synchronisation cloud impossible.";
      if (error instanceof CloudProfileLockedError) {
        const shared = await getCloudProfile(endpoint, token, entry.id);
        await saveClientProfile(shared);
        await removeQueuedCloudProfile(entry.id);
        committedProfiles.push(shared);
        locked += 1;
        continue;
      }
      await withStore(
        "readwrite",
        (store) =>
          store.put({
            ...entry,
            profile: structuredClone(local),
            attempts: entry.attempts + 1,
            lastError: message.slice(0, 500),
          }),
        QUEUE_STORE_NAME,
      );
      if (error instanceof CloudProfileConflictError) {
        conflicts += 1;
        continue;
      }
      failed += 1;
      break;
    }
  }
  return {
    uploaded,
    conflicts,
    locked,
    failed,
    pending: (await listQueuedCloudProfiles()).length,
    committedProfiles,
  };
}

export async function synchronizeClientProfiles(endpoint: string, token: string) {
  const initialLocalSummaries = await listClientProfiles();
  const remoteIndex = await listCloudProfiles(endpoint, token, { scope: "sync" });
  const remoteSummaries = remoteIndex.profiles;
  const initialLocalById = new Map(initialLocalSummaries.map((profile) => [profile.id, profile]));
  const remoteById = new Map(remoteSummaries.map((profile) => [profile.id, profile]));
  let removed = 0;

  for (const deleted of remoteIndex.deletedProfiles) {
    const local = initialLocalById.get(deleted.id);
    const remote = remoteById.get(deleted.id);
    if (
      local &&
      (!remote || remote.updatedAt <= deleted.deletedAt) &&
      local.updatedAt <= deleted.deletedAt
    ) {
      await deleteClientProfile(deleted.id);
      removed += 1;
    }
  }

  const localSummaries = removed ? await listClientProfiles() : initialLocalSummaries;
  const localById = new Map(localSummaries.map((profile) => [profile.id, profile]));
  let uploaded = 0;
  let downloaded = 0;
  let conflicts = 0;
  const conflictIds: string[] = [];

  for (const local of localSummaries) {
    const remote = remoteById.get(local.id);
    if (!remote || local.updatedAt > remote.updatedAt) {
      const profile = await getClientProfile(local.id);
      if (profile) {
        try {
          const commit = await putCloudProfile(endpoint, token, profile);
          await saveClientProfile(applyCloudCommit(profile, commit));
          uploaded += 1;
        } catch (error) {
          if (error instanceof CloudProfileLockedError) {
            await saveClientProfile(await getCloudProfile(endpoint, token, profile.id));
            downloaded += 1;
            continue;
          }
          if (!(error instanceof CloudProfileConflictError)) throw error;
          conflicts += 1;
          conflictIds.push(profile.id);
        }
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

  return {
    uploaded,
    downloaded,
    removed,
    conflicts,
    conflictIds,
    total: new Set([...localById.keys(), ...remoteById.keys()]).size,
  };
}
