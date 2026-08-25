const SESSION_KEY = "zgr-cv-admin-session";
const SESSION_USER_KEY = "zgr-cv-session-user";
const SESSION_CHANGED_EVENT = "zgr-cv-session-changed";
const SESSION_VERIFY_TIMEOUT_MS = 6_000;
const SESSION_LOGIN_TIMEOUT_MS = 12_000;
const FILE_CLIENTS_API_ENDPOINT = "https://zgr-cv-storage-api.zgrcv-wizi.workers.dev/api/clients";
const defaultClientsEndpoint =
  typeof window !== "undefined" && window.location.protocol === "file:"
    ? FILE_CLIENTS_API_ENDPOINT
    : "/api/clients";
const configuredClientsEndpoint =
  (import.meta.env.VITE_ZGR_API_URL as string | undefined)?.trim() || defaultClientsEndpoint;

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

function migrateLegacySession() {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem(SESSION_KEY)) {
    const legacyToken = sessionStorage.getItem(SESSION_KEY);
    const legacyUser = sessionStorage.getItem(SESSION_USER_KEY);
    if (legacyToken) localStorage.setItem(SESSION_KEY, legacyToken);
    if (legacyUser) localStorage.setItem(SESSION_USER_KEY, legacyUser);
  }
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_USER_KEY);
}

function tokenHasExpired(token: string) {
  try {
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) return true;
    const normalized = payload.replaceAll("-", "+").replaceAll("_", "/");
    const claims = JSON.parse(
      atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")),
    ) as {
      exp?: number;
    };
    return !Number.isFinite(claims.exp) || Number(claims.exp) * 1000 <= Date.now();
  } catch {
    return true;
  }
}

function isSessionUser(value: unknown): value is SessionUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<SessionUser>;
  return (
    typeof user.username === "string" &&
    user.username.trim().length > 0 &&
    typeof user.displayName === "string" &&
    (user.role === "admin" || user.role === "user") &&
    typeof user.active === "boolean"
  );
}

async function fetchAuthentication(path: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(apiUrl(path), {
      ...init,
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

function notifySessionChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

function saveSession(token: string, user: SessionUser) {
  localStorage.setItem(SESSION_KEY, token);
  localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_USER_KEY);
  notifySessionChange();
}

export function getAdminSession() {
  if (typeof window === "undefined") return "";
  migrateLegacySession();
  const token = localStorage.getItem(SESSION_KEY) || "";
  if (token && tokenHasExpired(token)) {
    clearAdminSession();
    return "";
  }
  return token;
}

export function clearAdminSession() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_USER_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_USER_KEY);
    notifySessionChange();
  }
}

export function getCurrentUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  if (!getAdminSession()) return null;
  try {
    const user = JSON.parse(localStorage.getItem(SESSION_USER_KEY) || "null") as unknown;
    if (isSessionUser(user)) return user;
  } catch {
    // The cleanup below repairs legacy or partially-written browser sessions.
  }
  clearAdminSession();
  return null;
}

export function subscribeToSessionChanges(listener: (user: SessionUser | null) => void) {
  if (typeof window === "undefined") return () => undefined;
  const sync = () => listener(getCurrentUser());
  const storageSync = (event: StorageEvent) => {
    if (event.key === SESSION_KEY || event.key === SESSION_USER_KEY || event.key === null) sync();
  };
  window.addEventListener("storage", storageSync);
  window.addEventListener(SESSION_CHANGED_EVENT, sync);
  return () => {
    window.removeEventListener("storage", storageSync);
    window.removeEventListener(SESSION_CHANGED_EVENT, sync);
  };
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
  const response = await fetchAuthentication(
    "/api/auth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    },
    SESSION_LOGIN_TIMEOUT_MS,
  );
  const body = await responseJson(response);
  if (!body.token || !body.user) throw new Error("Le serveur n’a pas créé de session.");
  saveSession(body.token, body.user);
  return body.user;
}

export async function verifyAdminSession(token = getAdminSession()) {
  if (!token) return null;
  const cachedUser = getCurrentUser();
  try {
    const response = await fetchAuthentication(
      "/api/auth/session",
      { headers: { Authorization: `Bearer ${token}` } },
      SESSION_VERIFY_TIMEOUT_MS,
    );
    if (response.status === 401) {
      clearAdminSession();
      return null;
    }
    const body = await responseJson(response);
    if (!body.user) {
      clearAdminSession();
      return null;
    }
    saveSession(token, body.user);
    return body.user;
  } catch {
    return cachedUser;
  }
}

export async function authenticatedFetch(path: string, init: RequestInit = {}) {
  const token = getAdminSession();
  if (!token) throw new Error("Session administrateur absente.");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(apiUrl(path), {
    ...init,
    cache: "no-store",
    credentials: "omit",
    headers,
  });
  if (response.status === 401) clearAdminSession();
  return response;
}
