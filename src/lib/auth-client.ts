const SESSION_KEY = "zgr-cv-admin-session";
const SESSION_USER_KEY = "zgr-cv-session-user";
const configuredClientsEndpoint =
  (import.meta.env.VITE_ZGR_API_URL as string | undefined)?.trim() || "/api/clients";

export const API_ROOT = configuredClientsEndpoint.replace(/\/api\/clients\/?$/, "");
export const CLIENTS_API_ENDPOINT = `${API_ROOT}/api/clients`;

export const apiUrl = (path: string) => `${API_ROOT}${path.startsWith("/") ? path : `/${path}`}`;

export type SessionUser = {
  username: string;
  displayName: string;
  role: "admin" | "user";
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  lastLoginAt: string | null;
  loginCount: number;
};

export function getAdminSession() {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(SESSION_KEY) || "";
}

export function clearAdminSession() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_USER_KEY);
  }
}

export function getCurrentUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_USER_KEY) || "null") as SessionUser | null;
  } catch {
    return null;
  }
}

async function responseJson(response: Response) {
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    token?: string;
    expiresAt?: number;
    ok?: boolean;
    user?: SessionUser;
  };
  if (!response.ok) throw new Error(body.error || `Accès refusé (${response.status}).`);
  return body;
}

export async function loginAdmin(username: string, password: string) {
  const response = await fetch(apiUrl("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const body = await responseJson(response);
  if (!body.token || !body.user) throw new Error("Le serveur n’a pas créé de session.");
  sessionStorage.setItem(SESSION_KEY, body.token);
  sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(body.user));
  return body.user;
}

export async function verifyAdminSession(token = getAdminSession()) {
  if (!token) return null;
  const response = await fetch(apiUrl("/api/auth/session"), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    clearAdminSession();
    return null;
  }
  const body = await responseJson(response);
  if (!body.user) {
    clearAdminSession();
    return null;
  }
  sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(body.user));
  return body.user;
}

export async function authenticatedFetch(path: string, init: RequestInit = {}) {
  const token = getAdminSession();
  if (!token) throw new Error("Session administrateur absente.");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(apiUrl(path), { ...init, headers });
  if (response.status === 401) clearAdminSession();
  return response;
}
