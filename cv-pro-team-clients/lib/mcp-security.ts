import { runtimeEnv } from '@/db/runtime';
import { jsonResponse } from '@/lib/order-model';

const encoder = new TextEncoder();
const OAUTH_CACHE_MS = 10 * 60 * 1000;

type OAuthMetadata = { issuer?: unknown; jwks_uri?: unknown };
type JwkWithKid = JsonWebKey & { kid?: string };
type JwtHeader = { alg?: unknown; kid?: unknown; typ?: unknown };
type JwtPayload = {
  iss?: unknown;
  aud?: unknown;
  exp?: unknown;
  nbf?: unknown;
  sub?: unknown;
  scope?: unknown;
  permissions?: unknown;
};

export type McpPrincipal = {
  subject: string;
  scopes: Set<string>;
  authentication: 'oauth' | 'legacy-token';
};

let cachedDiscovery:
  | { issuer: string; jwksUri: string; expiresAt: number }
  | undefined;
let cachedJwks:
  | { keys: JwkWithKid[]; expiresAt: number; jwksUri: string }
  | undefined;

function normalizeIssuer(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function configuredLegacyToken() {
  return runtimeEnv().MCP_API_TOKEN?.trim() || '';
}

function configuredIssuer() {
  const value = runtimeEnv().MCP_OAUTH_ISSUER?.trim();
  return value ? normalizeIssuer(value) : '';
}

function configuredAudience(request: Request) {
  return (
    runtimeEnv().MCP_OAUTH_AUDIENCE?.trim() ||
    `${new URL(request.url).origin}/api/mcp`
  );
}

function configuredSigningSecret() {
  return runtimeEnv().MCP_FILE_SIGNING_SECRET?.trim() || configuredLegacyToken();
}

function configuredAdminSubjects() {
  return new Set(
    (runtimeEnv().MCP_ADMIN_SUBJECTS || '')
      .split(',')
      .map((subject) => subject.trim())
      .filter(Boolean),
  );
}

function configuredAllowedSubjects() {
  const configured = runtimeEnv().MCP_ALLOWED_SUBJECTS?.trim();
  return new Set(
    (configured || runtimeEnv().MCP_ADMIN_SUBJECTS || '')
      .split(',')
      .map((subject) => subject.trim())
      .filter(Boolean),
  );
}

export function isMcpAdministrator(principal: McpPrincipal) {
  const allowedSubjects = configuredAdminSubjects();
  return allowedSubjects.size > 0 && allowedSubjects.has(principal.subject);
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    Math.ceil(value.length / 4) * 4,
    '=',
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function parseBase64UrlJson<T>(value: string): T | null {
  try {
    return JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(value)),
    ) as T;
  } catch {
    return null;
  }
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

async function signingKey() {
  const secret = configuredSigningSecret();
  if (!secret) throw new Error('MCP_FILE_SIGNING_SECRET is not configured.');
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function bearerToken(request: Request) {
  return request.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '')
    .trim();
}

function resourceMetadataUrl(request: Request) {
  return `${new URL(request.url).origin}/.well-known/oauth-protected-resource`;
}

function oauthChallenge(request: Request, scopes: string[], error?: string) {
  const attributes = [
    `resource_metadata="${resourceMetadataUrl(request)}"`,
    scopes.length ? `scope="${scopes.join(' ')}"` : '',
    error ? `error="${error}"` : '',
    error ? 'error_description="Authentification ou autorisation ZGR requise"' : '',
  ].filter(Boolean);
  return `Bearer ${attributes.join(', ')}`;
}

function deniedResponse(request: Request, scopes: string[], error: string) {
  return new Response(JSON.stringify({ error: 'Accès MCP refusé.' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'WWW-Authenticate': oauthChallenge(request, scopes, error),
    },
  });
}

async function fetchDiscovery(issuer: string) {
  if (
    cachedDiscovery &&
    cachedDiscovery.issuer === issuer &&
    cachedDiscovery.expiresAt > Date.now()
  ) {
    return cachedDiscovery;
  }
  const response = await fetch(`${issuer}/.well-known/openid-configuration`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`OAuth discovery failed with HTTP ${response.status}.`);
  }
  const metadata = (await response.json()) as OAuthMetadata;
  if (
    typeof metadata.issuer !== 'string' ||
    normalizeIssuer(metadata.issuer) !== issuer ||
    typeof metadata.jwks_uri !== 'string' ||
    !metadata.jwks_uri.startsWith('https://')
  ) {
    throw new Error('OAuth discovery metadata is invalid.');
  }
  cachedDiscovery = {
    issuer,
    jwksUri: metadata.jwks_uri,
    expiresAt: Date.now() + OAUTH_CACHE_MS,
  };
  return cachedDiscovery;
}

async function fetchJwks(jwksUri: string, force = false) {
  if (
    !force &&
    cachedJwks &&
    cachedJwks.jwksUri === jwksUri &&
    cachedJwks.expiresAt > Date.now()
  ) {
    return cachedJwks.keys;
  }
  const response = await fetch(jwksUri, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`JWKS fetch failed with HTTP ${response.status}.`);
  const payload = (await response.json()) as { keys?: unknown };
  if (!Array.isArray(payload.keys)) throw new Error('JWKS payload is invalid.');
  const keys = payload.keys.filter(
    (key): key is JwkWithKid => Boolean(key && typeof key === 'object'),
  );
  cachedJwks = { keys, jwksUri, expiresAt: Date.now() + OAUTH_CACHE_MS };
  return keys;
}

function tokenScopes(payload: JwtPayload) {
  if (typeof payload.scope !== 'string') return new Set<string>();
  const supportedScopes = new Set([
    'zgr:orders:read',
    'zgr:json:write',
    'zgr:photos:write',
    'zgr:admin:read',
    'zgr:drive:write',
  ]);
  return new Set(
    payload.scope.split(/\s+/).filter((scope) => supportedScopes.has(scope)),
  );
}

async function verifyOAuthToken(
  token: string,
  request: Request,
  requiredScopes: string[],
): Promise<McpPrincipal | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const header = parseBase64UrlJson<JwtHeader>(parts[0]);
  const payload = parseBase64UrlJson<JwtPayload>(parts[1]);
  if (
    !header ||
    header.alg !== 'RS256' ||
    typeof header.kid !== 'string' ||
    !payload
  ) {
    return null;
  }

  const issuer = configuredIssuer();
  const audience = configuredAudience(request);
  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (
    typeof payload.iss !== 'string' ||
    normalizeIssuer(payload.iss) !== issuer ||
    !audiences.includes(audience) ||
    typeof payload.exp !== 'number' ||
    payload.exp <= now ||
    (typeof payload.nbf === 'number' && payload.nbf > now + 30) ||
    typeof payload.sub !== 'string' ||
    !payload.sub
  ) {
    return null;
  }

  const discovery = await fetchDiscovery(issuer);
  let keys = await fetchJwks(discovery.jwksUri);
  let jwk = keys.find((candidate) => candidate.kid === header.kid);
  if (!jwk) {
    keys = await fetchJwks(discovery.jwksUri, true);
    jwk = keys.find((candidate) => candidate.kid === header.kid);
  }
  if (!jwk) return null;
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const verified = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64UrlToBytes(parts[2]) as unknown as BufferSource,
    encoder.encode(`${parts[0]}.${parts[1]}`),
  );
  if (!verified) return null;

  const allowedSubjects = configuredAllowedSubjects();
  if (!allowedSubjects.size || !allowedSubjects.has(payload.sub)) return null;

  const scopes = tokenScopes(payload);
  if (requiredScopes.some((scope) => !scopes.has(scope))) return null;
  return { subject: payload.sub, scopes, authentication: 'oauth' };
}

export async function requireMcp(request: Request, requiredScopes: string[]) {
  const provided = bearerToken(request);
  if (!provided) {
    return {
      principal: null,
      denial: deniedResponse(request, requiredScopes, 'invalid_token'),
    };
  }

  const issuer = configuredIssuer();
  if (issuer) {
    try {
      const principal = await verifyOAuthToken(provided, request, requiredScopes);
      if (principal) return { principal, denial: null };
    } catch (error) {
      console.error('MCP OAuth verification failed', error);
    }
    return {
      principal: null,
      denial: deniedResponse(request, requiredScopes, 'insufficient_scope'),
    };
  }

  const configured = configuredLegacyToken();
  if (!configured) {
    return {
      principal: null,
      denial: jsonResponse(
        { error: 'Le serveur MCP ZGR n’est pas encore configuré.' },
        503,
      ),
    };
  }
  if (!constantTimeEqual(await digest(provided), await digest(configured))) {
    return {
      principal: null,
      denial: deniedResponse(request, requiredScopes, 'invalid_token'),
    };
  }
  return {
    principal: {
      subject: 'legacy-local-plugin',
      scopes: new Set([
        'zgr:orders:read',
        'zgr:json:write',
        'zgr:photos:write',
      ]),
      authentication: 'legacy-token' as const,
    },
    denial: null,
  };
}

export function oauthProtectedResourceMetadata(request: Request) {
  const issuer = configuredIssuer();
  if (!issuer) {
    return jsonResponse({ error: 'OAuth MCP n’est pas encore configuré.' }, 503);
  }
  return jsonResponse({
    resource: configuredAudience(request),
    authorization_servers: [issuer],
    scopes_supported: [
      'zgr:orders:read',
      'zgr:json:write',
      'zgr:photos:write',
      'zgr:admin:read',
      'zgr:drive:write',
    ],
    resource_documentation: 'https://abdou677778.github.io/zgr-cv/mcp-support.html',
    resource_policy_uri: 'https://abdou677778.github.io/zgr-cv/privacy.html',
    resource_tos_uri: 'https://abdou677778.github.io/zgr-cv/terms.html',
  });
}

export async function createFileAccessToken(orderId: string, fileId: string) {
  const payload = bytesToBase64Url(
    encoder.encode(
      JSON.stringify({
        orderId,
        fileId,
        expiresAt: Date.now() + 15 * 60 * 1000,
      }),
    ),
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', await signingKey(), encoder.encode(payload)),
  );
  return `${payload}.${bytesToBase64Url(signature)}`;
}

export async function verifyFileAccessToken(token: string) {
  const [payload, signatureValue, extra] = token.split('.');
  if (!payload || !signatureValue || extra) return null;
  let signature: Uint8Array;
  try {
    signature = base64UrlToBytes(signatureValue);
  } catch {
    return null;
  }
  const valid = await crypto.subtle.verify(
    'HMAC',
    await signingKey(),
    signature as unknown as BufferSource,
    encoder.encode(payload),
  );
  if (!valid) return null;
  try {
    const parsed = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(payload)),
    ) as { orderId?: unknown; fileId?: unknown; expiresAt?: unknown };
    if (
      typeof parsed.orderId !== 'string' ||
      typeof parsed.fileId !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt < Date.now()
    ) {
      return null;
    }
    return {
      orderId: parsed.orderId,
      fileId: parsed.fileId,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}
