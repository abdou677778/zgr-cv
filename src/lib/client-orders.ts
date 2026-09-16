import { authenticatedFetch } from "@/lib/auth-client";

export type ClientOrderStatus =
  | "DRAFT"
  | "RECEIVED"
  | "JSON_IMPORTED"
  | "IN_PRODUCTION"
  | "TO_VALIDATE"
  | "DELIVERED"
  | "ARCHIVED";

export interface ClientOrderSummary {
  id: string;
  clientName: string;
  email: string;
  phone: string;
  facebookUrl: string;
  language: string;
  notes: string;
  services: string[];
  status: ClientOrderStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  currentJsonVersion?: number;
  driveFolderId?: string;
  driveStatus: "PENDING" | "SYNCING" | "SYNCED" | "ERROR";
  fileCount: number;
  totalBytes: number;
  jsonVersionCount: number;
}

export interface ClientOrderFile {
  id: string;
  orderId: string;
  category: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
}

export interface ClientOrderJsonVersion {
  id: string;
  orderId: string;
  versionNumber: number;
  originalName: string;
  sha256: string;
  promptVersion: string;
  validation: {
    valid?: boolean;
    warnings?: string[];
    presentLanguages?: string[];
    missingLanguages?: string[];
  };
  createdAt: string;
}

export interface ClientOrderEvent {
  id: number;
  type: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface ClientOrderDeliverable {
  id: string;
  orderId: string;
  service: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
}

export interface ClientOrderDelivery {
  id: string;
  orderId: string;
  versionNumber: number;
  driveFolderId: string;
  shareUrl: string;
  fileIds: string[];
  createdAt: string;
}

export interface ClientOrderDetail {
  order: ClientOrderSummary;
  files: ClientOrderFile[];
  jsonVersions: ClientOrderJsonVersion[];
  deliverables: ClientOrderDeliverable[];
  deliveries: ClientOrderDelivery[];
  events: ClientOrderEvent[];
}

async function responseJson<T>(response: Response) {
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || `Erreur portail (${response.status}).`);
  return body;
}

function saveResponseBlob(response: Response, fallbackName: string) {
  return response.blob().then((blob) => {
    const disposition = response.headers.get("Content-Disposition") || "";
    const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const quoted = disposition.match(/filename="([^"]+)"/i)?.[1];
    const filename = encoded ? decodeURIComponent(encoded) : quoted || fallbackName;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  });
}

export async function listClientOrders() {
  const response = await authenticatedFetch("/api/admin/client-orders");
  return responseJson<{ orders: ClientOrderSummary[] }>(response).then((body) => body.orders);
}

export async function createClientInvitation(validDays = 5) {
  const response = await authenticatedFetch("/api/admin/client-orders/invitations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ validDays }),
  });
  return responseJson<{ id: string; inviteUrl: string; expiresAt: string; validDays: number }>(
    response,
  );
}

export async function getClientOrder(orderId: string) {
  const response = await authenticatedFetch(
    `/api/admin/client-orders/${encodeURIComponent(orderId)}`,
  );
  return responseJson<ClientOrderDetail>(response);
}

export async function downloadClientOrderPack(orderId: string) {
  const response = await authenticatedFetch(
    `/api/admin/client-orders/${encodeURIComponent(orderId)}/pack`,
  );
  if (!response.ok) await responseJson(response);
  await saveResponseBlob(response, `${orderId}_PACK_IA.zip`);
}

export async function downloadClientOrderFile(orderId: string, file: ClientOrderFile) {
  const response = await authenticatedFetch(
    `/api/admin/client-orders/${encodeURIComponent(orderId)}/files/${encodeURIComponent(file.id)}`,
  );
  if (!response.ok) await responseJson(response);
  await saveResponseBlob(response, file.originalName);
}

export async function addClientOrderSourceFile(orderId: string, file: File) {
  const data = new FormData();
  data.append("file", file);
  const response = await authenticatedFetch(
    `/api/admin/client-orders/${encodeURIComponent(orderId)}/files`,
    { method: "POST", body: data },
  );
  return responseJson<{ file: ClientOrderFile }>(response).then((body) => body.file);
}

export async function deleteClientOrderSourceFile(orderId: string, fileId: string) {
  const response = await authenticatedFetch(
    `/api/admin/client-orders/${encodeURIComponent(orderId)}/files/${encodeURIComponent(fileId)}`,
    { method: "DELETE" },
  );
  return responseJson<{ deleted: true }>(response);
}

export async function updateClientOrderFacebook(orderId: string, facebookUrl: string) {
  const result = await updateClientOrder(orderId, { facebookUrl });
  return {
    facebookUrl: result.order.facebookUrl,
    updatedAt: result.updatedAt,
  };
}

export type ClientOrderUpdate = Partial<
  Pick<
    ClientOrderSummary,
    "clientName" | "email" | "phone" | "facebookUrl" | "language" | "notes" | "services"
  >
>;

export async function updateClientOrder(orderId: string, input: ClientOrderUpdate) {
  const response = await authenticatedFetch(
    `/api/admin/client-orders/${encodeURIComponent(orderId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return responseJson<{ order: ClientOrderSummary; updatedAt: string }>(response);
}

export async function deleteClientOrder(orderId: string) {
  const response = await authenticatedFetch(
    `/api/admin/client-orders/${encodeURIComponent(orderId)}`,
    { method: "DELETE" },
  );
  return responseJson<{
    deleted: true;
    deletedObjects: number;
    storageCleanupPending?: boolean;
  }>(response);
}

export async function importClientOrderJson(orderId: string, file: File) {
  const data = new FormData();
  data.append("file", file);
  data.append("promptVersion", "1.1");
  const response = await authenticatedFetch(
    `/api/admin/client-orders/${encodeURIComponent(orderId)}/json`,
    { method: "POST", body: data },
  );
  return responseJson<{
    versionNumber: number;
    validation: ClientOrderJsonVersion["validation"];
    driveStatus: string;
  }>(response);
}

export async function readClientOrderJson(orderId: string, versionNumber: number) {
  const response = await authenticatedFetch(
    `/api/admin/client-orders/${encodeURIComponent(orderId)}/json/${versionNumber}`,
  );
  if (!response.ok) await responseJson(response);
  return response.json() as Promise<unknown>;
}

export async function downloadClientOrderJson(orderId: string, versionNumber: number) {
  const response = await authenticatedFetch(
    `/api/admin/client-orders/${encodeURIComponent(orderId)}/json/${versionNumber}`,
  );
  if (!response.ok) await responseJson(response);
  await saveResponseBlob(
    response,
    `${orderId}_CV_GLOBAL_7_LANGUES_v${String(versionNumber).padStart(3, "0")}.json`,
  );
}

export async function syncClientOrderDrive(orderId: string) {
  const response = await authenticatedFetch(
    `/api/admin/client-orders/${encodeURIComponent(orderId)}/sync-drive`,
    { method: "POST" },
  );
  return responseJson<{ configured: true; driveFolderId: string }>(response);
}

export async function addClientOrderDeliverable(orderId: string, file: File, service = "AUTRE") {
  const data = new FormData();
  data.append("file", file);
  data.append("service", service);
  const response = await authenticatedFetch(
    `/api/admin/client-orders/${encodeURIComponent(orderId)}/deliverables`,
    { method: "POST", body: data },
  );
  return responseJson<{ deliverable: ClientOrderDeliverable }>(response).then(
    (body) => body.deliverable,
  );
}

export async function downloadClientOrderDeliverable(
  orderId: string,
  deliverable: ClientOrderDeliverable,
) {
  const response = await authenticatedFetch(
    `/api/admin/client-orders/${encodeURIComponent(orderId)}/deliverables/${encodeURIComponent(deliverable.id)}`,
  );
  if (!response.ok) await responseJson(response);
  await saveResponseBlob(response, deliverable.originalName);
}

export async function publishClientOrderDelivery(orderId: string, fileIds: string[]) {
  const response = await authenticatedFetch(
    `/api/admin/client-orders/${encodeURIComponent(orderId)}/deliveries`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileIds }),
    },
  );
  return responseJson<{ delivery: ClientOrderDelivery }>(response).then((body) => body.delivery);
}
