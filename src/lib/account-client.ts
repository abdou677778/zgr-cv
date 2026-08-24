import { authenticatedFetch, type SessionUser } from "@/lib/auth-client";

export type ManagedUser = SessionUser & { sessionVersion: number };

export type AuditEntry = {
  id: string;
  event: string;
  username: string;
  outcome: string;
  createdAt: string;
  ip: string;
  country: string;
};

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(path, init);
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || `Opération refusée (${response.status}).`);
  return body;
}

const jsonRequest = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export async function listManagedUsers() {
  return (await apiJson<{ users: ManagedUser[] }>("/api/admin/users")).users;
}

export async function createManagedUser(input: {
  username: string;
  displayName: string;
  password: string;
}) {
  return (await apiJson<{ user: ManagedUser }>("/api/admin/users", jsonRequest("POST", input)))
    .user;
}

export async function updateManagedUser(
  username: string,
  input: { displayName: string; active: boolean },
) {
  return (
    await apiJson<{ user: ManagedUser }>(
      `/api/admin/users/${encodeURIComponent(username)}`,
      jsonRequest("PUT", input),
    )
  ).user;
}

export async function resetManagedUserPassword(username: string, password: string) {
  return apiJson<{ ok: boolean; logoutRequired?: boolean }>(
    `/api/admin/users/${encodeURIComponent(username)}/password`,
    jsonRequest("PUT", { password }),
  );
}

export async function deleteManagedUser(username: string) {
  return apiJson<{ ok: boolean }>(`/api/admin/users/${encodeURIComponent(username)}`, {
    method: "DELETE",
  });
}

export async function changeOwnPassword(currentPassword: string, newPassword: string) {
  return apiJson<{ ok: boolean; logoutRequired: boolean }>(
    "/api/account/password",
    jsonRequest("PUT", { currentPassword, newPassword }),
  );
}

export async function listAuditEntries(limit = 100) {
  return (
    await apiJson<{ entries: AuditEntry[] }>(
      `/api/admin/audit?limit=${Math.min(200, Math.max(1, limit))}`,
    )
  ).entries;
}
