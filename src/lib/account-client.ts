import { authenticatedFetch, type SessionUser } from "@/lib/auth-client";

export type ManagedUser = SessionUser & { sessionVersion: number; isPrimary?: boolean };

export type AccountSession = {
  id: string;
  deviceLabel: string;
  createdAt: string | null;
  lastSeenAt: string | null;
  expiresAt: string;
  current: boolean;
};

export type AuditEntry = {
  id: string;
  event: string;
  username: string;
  outcome: string;
  createdAt: string;
  ip: string;
  country: string;
};

export type BackupManifest = {
  version: number;
  kind?: "monthly";
  day: string;
  month?: string;
  sourceDay?: string;
  createdAt: string;
  profiles: number;
  photos: number;
  deletions: number;
  skipped?: boolean;
  d1: { available: boolean; profiles: number; deletions: number; systemState: number };
};

export type RecoveryPoint = {
  version: number;
  kind: "recovery";
  period: string;
  createdAt: string;
  copied: number;
  createdBy?: { username: string; displayName: string; role: "admin" | "user" };
};

export type BackupMonitoring = {
  generatedAt: string;
  health: "healthy" | "warning" | "critical";
  alerts: { level: "warning" | "critical"; message: string }[];
  latestStatus?: {
    state: "success" | "failed";
    checkedAt: string;
    day: string;
    message: string;
  };
  latestBackup: BackupManifest | null;
  recentBackups: BackupManifest[];
  recentMonthlyBackups: BackupManifest[];
  recentRecoveryPoints: RecoveryPoint[];
  storage: Record<
    "clients" | "history" | "backups" | "recovery" | "system" | "total",
    { objects: number; bytes: number }
  >;
  d1: {
    available: boolean;
    profiles: number;
    deletions: number;
    indexReady: boolean;
    error?: string;
  };
  schedule: { cron: string; timezone: string; algerTime: string };
  retention: { daily: number; monthly: number; recoveryPoints: number };
};

export type BackupRestorePreview = {
  backup: BackupManifest | RecoveryPoint;
  summary: {
    profilesInBackup: number;
    added: number;
    overwritten: number;
    removed: number;
    objectsToRestore: number;
  };
  confirmation: string;
  safety: string;
};

export type OperationalMonitoring = {
  generatedAt: string;
  available: boolean;
  health: "healthy" | "warning" | "critical" | "collecting";
  retentionDays: number;
  last24h: {
    events: number;
    javascriptErrors: number;
    apiFailures: number;
    syncFailures: number;
  };
  vitals: Array<{
    name: "LCP" | "INP" | "CLS" | "FCP" | "TTFB";
    samples: number;
    p75: number | null;
    average: number | null;
    poor: number;
  }>;
  daily: Array<{ day: string; events: number; errors: number }>;
  privacy: string;
  error?: string;
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
  role: "admin" | "user";
}) {
  return (await apiJson<{ user: ManagedUser }>("/api/admin/users", jsonRequest("POST", input)))
    .user;
}

export async function updateManagedUser(
  username: string,
  input: { displayName: string; active: boolean; role: "admin" | "user" },
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

export async function listAccountSessions() {
  return apiJson<{ sessions: AccountSession[]; legacySession: boolean }>("/api/account/sessions");
}

export async function revokeAccountSession(sessionId: string) {
  return apiJson<{ ok: boolean; logoutRequired: boolean }>(
    `/api/account/sessions/${encodeURIComponent(sessionId)}`,
    { method: "DELETE" },
  );
}

export async function revokeOtherAccountSessions() {
  return apiJson<{ ok: boolean; revoked: number }>("/api/account/sessions/others", {
    method: "DELETE",
  });
}

export async function listAuditEntries(limit = 100) {
  return (
    await apiJson<{ entries: AuditEntry[] }>(
      `/api/admin/audit?limit=${Math.min(200, Math.max(1, limit))}`,
    )
  ).entries;
}

export async function getBackupMonitoring() {
  return apiJson<BackupMonitoring>("/api/admin/backups");
}

export async function getOperationalMonitoring() {
  return apiJson<OperationalMonitoring>("/api/admin/monitoring");
}

export async function runBackupNow() {
  return apiJson<{ ok: true; backup: BackupManifest }>("/api/admin/backups", {
    method: "POST",
  });
}

export async function previewBackupRestore(kind: "daily" | "monthly" | "recovery", period: string) {
  return apiJson<BackupRestorePreview>(
    `/api/admin/backups/${kind}/${encodeURIComponent(period)}/restore`,
  );
}

export async function restoreClientBackup(
  kind: "daily" | "monthly" | "recovery",
  period: string,
  confirmation: string,
) {
  return apiJson<{
    ok: true;
    backup: BackupManifest | RecoveryPoint;
    summary: BackupRestorePreview["summary"];
    recoveryPoint: { kind: "recovery"; period: string; createdAt: string; copied: number };
    profiles: number;
  }>(
    `/api/admin/backups/${kind}/${encodeURIComponent(period)}/restore`,
    jsonRequest("POST", { confirmation }),
  );
}
