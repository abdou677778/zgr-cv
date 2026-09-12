const SESSION_KEY = "zgr-cv-admin-session";
const SESSION_USER_KEY = "zgr-cv-session-user";
const SESSION_CHANGED_EVENT = "zgr-cv-session-changed";
const SESSION_VERIFY_TIMEOUT_MS = 12_000;
const SESSION_LOGIN_TIMEOUT_MS = 25_000;
const AUTH_NETWORK_ATTEMPTS = 2;
const API_REQUEST_TIMEOUT_MS = 30_000;
const API_READ_ATTEMPTS = 3;
const API_PUT_ATTEMPTS = 2;
const CLOUD_API_ROOT = "https://zgr-cv-storage-api.zgrcv-wizi.workers.dev";
export const CLOUD_APP_URL = `${CLOUD_API_ROOT}/`;
const FILE_CLIENTS_API_ENDPOINT = `${CLOUD_API_ROOT}/api/clients`;
// GitHub Pages and the local Vite preview are static frontends: neither owns
// an /api route. Pointing them at a relative URL first caused an avoidable
// failed request (or an HTML response) before the Cloudflare fallback.
const defaultClientsEndpoint = FILE_CLIENTS_API_ENDPOINT;
const configuredClientsEndpoint =
  (import.meta.env.VITE_ZGR_API_URL as string | undefined)?.trim() || defaultClientsEndpoint;

export const API_ROOT = configuredClientsEndpoint.replace(/\/api\/clients\/?$/, "");
export const CLIENTS_API_ENDPOINT = `${API_ROOT}/api/clients`;

export const apiUrl = (path: string) => `${API_ROOT}${path.startsWith("/") ? path : `/${path}`}`;

function requestTarget(path: string) {
  return /^https?:\/\//i.test(path) ? path : apiUrl(path);
}

function operationalRoute(path: string) {
  try {
    return new URL(requestTarget(path)).pathname
      .replace(/^(\/api\/clients)\/[^/]+/, "$1/:id")
      .replace(/^(\/api\/admin\/users)\/[^/]+/, "$1/:username")
      .replace(/^(\/api\/admin\/ai-keys)\/[^/]+/, "$1/:id")
      .replace(/^(\/api\/admin\/backups)\/(daily|monthly|recovery)\/[^/]+/, "$1/:kind/:period")
      .replace(/\/versions\/\d+/, "/versions/:version")
      .slice(0, 120);
  } catch {
    return "/api/unknown";
  }
}

function announceApiFailure(path: string, status: number, name: "http_error" | "network_error") {
  if (typeof window === "undefined" || operationalRoute(path) === "/api/telemetry") return;
  window.dispatchEvent(
    new CustomEvent("zgr-api-failure", {
      detail: { route: operationalRoute(path), status, name },
    }),
  );
}

function apiNetworkError(failure: unknown) {
  const message = failure instanceof Error ? failure.message : "";
  if (
    failure instanceof TypeError ||
    failure instanceof DOMException ||
    /failed to fetch|networkerror|load failed|abort|timeout|délai/i.test(message)
  ) {
    return new Error(
      "Connexion Cloudflare bloquée par ce navigateur ou ce réseau. Réessayez, puis utilisez la version Cloudflare du site si le blocage continue.",
    );
  }
  return failure instanceof Error ? failure : new Error("Le service sécurisé est indisponible.");
}

export type AccountRole = "admin" | "editor" | "viewer";

export type AccountPermissions = {
  clientsRead: boolean;
  clientsWrite: boolean;
  clientsDelete: boolean;
  clientsRestore: boolean;
  clientsDownload: boolean;
  aiUse: boolean;
  manageUsers: boolean;
};

export type SessionUser = {
  username: string;
  displayName: string;
  role: AccountRole;
  permissions: AccountPermissions;
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

const permissionsForRole = (role: AccountRole): AccountPermissions => ({
  clientsRead: true,
  clientsWrite: role === "admin" || role === "editor",
  clientsDelete: role === "admin",
  clientsRestore: role === "admin",
  clientsDownload: true,
  aiUse: role === "admin" || role === "editor",
  manageUsers: role === "admin",
});

function normalizeSessionUser(value: unknown): SessionUser | null {
  if (!value || typeof value !== "object") return null;
  const user = value as Partial<SessionUser> & { role?: AccountRole | "user" };
  if (
    typeof user.username !== "string" ||
    !user.username.trim() ||
    typeof user.displayName !== "string" ||
    !["admin", "editor", "viewer", "user"].includes(String(user.role)) ||
    typeof user.active !== "boolean"
  )
    return null;
  const role: AccountRole = user.role === "admin" || user.role === "viewer" ? user.role : "editor";
  return { ...user, role, permissions: permissionsForRole(role) } as SessionUser;
}

async function fetchAuthentication(path: string, init: RequestInit, timeoutMs: number) {
  const roots = [...new Set([API_ROOT, CLOUD_API_ROOT].filter(Boolean))];
  let lastFailure: unknown;
  let lastStatus = 0;
  for (let attempt = 0; attempt < AUTH_NETWORK_ATTEMPTS; attempt += 1) {
    for (const root of roots) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
      try {
        const target = new URL(`${root}${path.startsWith("/") ? path : `/${path}`}`);
        if (attempt) target.searchParams.set("retry", String(attempt + 1));
        const response = await fetch(target, {
          ...init,
          cache: "no-store",
          credentials: "omit",
          mode: "cors",
          redirect: "error",
          referrerPolicy: "strict-origin-when-cross-origin",
          signal: controller.signal,
        });
        // Authentication errors are definitive and must be shown immediately.
        // Only transient server failures should move to the next attempt/root.
        if (response.status < 500) return response;
        lastStatus = response.status;
        lastFailure = new Error(`Service temporairement indisponible (${response.status}).`);
      } catch (failure) {
        lastFailure = failure;
      } finally {
        window.clearTimeout(timeout);
      }
    }
    if (attempt + 1 < AUTH_NETWORK_ATTEMPTS) {
      await new Promise((resolve) => window.setTimeout(resolve, 650));
    }
  }
  announceApiFailure(path, lastStatus, lastStatus ? "http_error" : "network_error");
  throw lastFailure instanceof Error
    ? lastFailure
    : new Error("Le service d’authentification n’est pas joignable.");
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
    const normalized = normalizeSessionUser(user);
    if (normalized) {
      localStorage.setItem(SESSION_USER_KEY, JSON.stringify(normalized));
      return normalized;
    }
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
  const user = normalizeSessionUser(body.user);
  if (!body.token || !user) throw new Error("Le serveur n’a pas créé de session.");
  saveSession(body.token, user);
  return user;
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
    const user = normalizeSessionUser(body.user);
    if (!user) {
      clearAdminSession();
      return null;
    }
    saveSession(token, user);
    return user;
  } catch {
    return cachedUser;
  }
}

export async function authenticatedFetch(path: string, init: RequestInit = {}) {
  const token = getAdminSession();
  if (!token) throw new Error("Session utilisateur absente.");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const method = (init.method || "GET").toUpperCase();
  const attempts =
    method === "GET" || method === "HEAD"
      ? API_READ_ATTEMPTS
      : method === "PUT"
        ? API_PUT_ATTEMPTS
        : 1;
  let lastFailure: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);
    const abortFromCaller = () => controller.abort();
    init.signal?.addEventListener("abort", abortFromCaller, { once: true });
    try {
      const target = new URL(requestTarget(path));
      if (attempt) target.searchParams.set("retry", String(attempt + 1));
      const response = await fetch(target, {
        ...init,
        cache: "no-store",
        credentials: "omit",
        mode: "cors",
        redirect: "error",
        referrerPolicy: "strict-origin-when-cross-origin",
        headers,
        signal: controller.signal,
      });
      if (response.status === 401) clearAdminSession();
      if (response.status < 500 || attempt + 1 === attempts) {
        if (response.status >= 500) announceApiFailure(path, response.status, "http_error");
        return response;
      }
      lastFailure = new Error(`Service temporairement indisponible (${response.status}).`);
    } catch (failure) {
      if (init.signal?.aborted) throw failure;
      lastFailure = failure;
    } finally {
      window.clearTimeout(timeout);
      init.signal?.removeEventListener("abort", abortFromCaller);
    }
    if (attempt + 1 < attempts)
      await new Promise((resolve) => window.setTimeout(resolve, 500 * (attempt + 1)));
  }

  announceApiFailure(path, 0, "network_error");
  throw apiNetworkError(lastFailure);
}
