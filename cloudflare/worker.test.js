import assert from "node:assert/strict";
import test from "node:test";
import worker from "./worker.js";

if (typeof crypto.subtle.timingSafeEqual !== "function") {
  Object.defineProperty(crypto.subtle, "timingSafeEqual", {
    value(left, right) {
      const leftBytes = new Uint8Array(left);
      const rightBytes = new Uint8Array(right);
      if (leftBytes.byteLength !== rightBytes.byteLength) return false;
      let difference = 0;
      for (let index = 0; index < leftBytes.byteLength; index += 1) {
        difference |= leftBytes[index] ^ rightBytes[index];
      }
      return difference === 0;
    },
  });
}

class MemoryR2Bucket {
  objects = new Map();
  nextVersion = 1;

  async put(key, value, options = {}) {
    const previous = this.objects.get(key);
    if (options.onlyIf?.etagMatches && previous?.etag !== options.onlyIf.etagMatches) return null;
    if (options.onlyIf?.etagDoesNotMatch === "*" && previous) return null;
    const body =
      typeof value === "string"
        ? new TextEncoder().encode(value)
        : value instanceof ArrayBuffer
          ? new Uint8Array(value)
          : new Uint8Array(await new Response(value).arrayBuffer());
    const etag = `memory-${this.nextVersion++}`;
    this.objects.set(key, {
      body,
      etag,
      customMetadata: options.customMetadata ?? {},
      httpMetadata: options.httpMetadata ?? {},
      uploaded: new Date(),
    });
    return { etag, httpEtag: `"${etag}"` };
  }

  async get(key) {
    const stored = this.objects.get(key);
    if (!stored) return null;
    return {
      body: new Response(stored.body).body,
      customMetadata: stored.customMetadata,
      etag: stored.etag,
      httpEtag: `"${stored.etag}"`,
      size: stored.body.byteLength,
      text: async () => new TextDecoder().decode(stored.body),
      uploaded: stored.uploaded,
    };
  }

  async delete(key) {
    this.objects.delete(key);
  }

  async list({ prefix = "" } = {}) {
    return {
      objects: [...this.objects.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => ({
          key,
          customMetadata: value.customMetadata,
          size: value.body.byteLength,
          uploaded: value.uploaded,
        })),
      truncated: false,
    };
  }
}

function testContext() {
  const pending = [];
  return {
    context: {
      waitUntil(promise) {
        pending.push(promise);
      },
    },
    settle: () => Promise.all(pending),
  };
}

async function call(env, path, init = {}) {
  const { context, settle } = testContext();
  const response = await worker.fetch(
    new Request(`https://zgr-cv-storage-api.test${path}`, {
      ...init,
      headers: {
        Origin: "http://127.0.0.1:8080",
        ...init.headers,
      },
    }),
    env,
    context,
  );
  await settle();
  return response;
}

async function login(env, username, password) {
  const response = await call(env, "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(response.status, 200);
  return response.json();
}

const authorized = (token, init = {}) => ({
  ...init,
  headers: { Authorization: `Bearer ${token}`, ...init.headers },
});

test("les clients R2 sont partagés, attribués et protégés contre les écrasements", async () => {
  const env = {
    CLIENTS_BUCKET: new MemoryR2Bucket(),
    ADMIN_USERNAME: "admin",
    ADMIN_PASSWORD: "mot-de-passe-admin-test",
    SESSION_SECRET: "secret-de-session-de-test-suffisamment-long-1234567890",
    ALLOWED_ORIGINS: "http://127.0.0.1:8080",
  };

  const unauthenticated = await call(env, "/api/clients");
  assert.equal(unauthenticated.status, 401);

  const admin = await login(env, "admin", env.ADMIN_PASSWORD);
  const profile = {
    version: 1,
    id: "ZGR-20260906-ABC123",
    name: "Client partagé",
    email: "client@example.com",
    phone: "+213555000000",
    createdAt: "2026-09-06T10:00:00.000Z",
    updatedAt: "2026-09-06T10:00:00.000Z",
    language: "fr",
    cvByLanguage: { fr: { nom_complet: "Client partagé" } },
    hiddenElements: {},
    documentKind: "cv",
    templateId: "canadian-v1",
    templateColors: {},
  };
  const createdResponse = await call(
    env,
    `/api/clients/${profile.id}`,
    authorized(admin.token, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    }),
  );
  assert.equal(createdResponse.status, 200);
  const created = await createdResponse.json();
  assert.equal(created.profile.createdBy.username, "admin");
  assert.equal(created.profile.updatedBy.username, "admin");
  assert.equal(created.profile.revision, 1);

  const accountResponse = await call(
    env,
    "/api/admin/users",
    authorized(admin.token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "editeur",
        displayName: "Éditeur Test",
        password: "mot-de-passe-editeur",
        role: "user",
      }),
    }),
  );
  assert.equal(accountResponse.status, 201);

  const editor = await login(env, "editeur", "mot-de-passe-editeur");
  const sharedListResponse = await call(env, "/api/clients", authorized(editor.token));
  assert.equal(sharedListResponse.status, 200);
  const sharedList = await sharedListResponse.json();
  assert.equal(sharedList.profiles.length, 1);
  assert.equal(sharedList.profiles[0].createdBy.username, "admin");
  assert.equal(sharedList.profiles[0].revision, 1);

  const currentResponse = await call(env, `/api/clients/${profile.id}`, authorized(editor.token));
  const current = await currentResponse.json();
  const staleAdminCopy = structuredClone(current);
  const updatedResponse = await call(
    env,
    `/api/clients/${profile.id}`,
    authorized(editor.token, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...current, phone: "+213555111111" }),
    }),
  );
  assert.equal(updatedResponse.status, 200);
  const updated = await updatedResponse.json();
  assert.equal(updated.profile.createdBy.username, "admin");
  assert.equal(updated.profile.updatedBy.username, "editeur");
  assert.equal(updated.profile.revision, 2);

  const stalePhotoResponse = await call(
    env,
    `/api/clients/${profile.id}/photo`,
    authorized(admin.token, {
      method: "PUT",
      headers: { "Content-Type": "image/webp", "X-Profile-Revision": "1" },
      body: new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]),
    }),
  );
  assert.equal(stalePhotoResponse.status, 409);

  const conflictResponse = await call(
    env,
    `/api/clients/${profile.id}`,
    authorized(admin.token, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...staleAdminCopy, phone: "+213555999999" }),
    }),
  );
  assert.equal(conflictResponse.status, 409);
  const conflict = await conflictResponse.json();
  assert.equal(conflict.code, "CLIENT_PROFILE_CONFLICT");
  assert.equal(conflict.current.revision, 2);
  assert.equal(conflict.current.updatedBy.username, "editeur");

  const finalResponse = await call(env, `/api/clients/${profile.id}`, authorized(admin.token));
  const finalProfile = await finalResponse.json();
  assert.equal(finalProfile.phone, "+213555111111");
  assert.equal(finalProfile.revision, 2);
  assert.equal(finalProfile.createdBy.username, "admin");
  assert.equal(finalProfile.updatedBy.username, "editeur");

  const searchedResponse = await call(
    env,
    "/api/clients?q=partag&page=1&pageSize=1&owner=updated",
    authorized(editor.token),
  );
  const searched = await searchedResponse.json();
  assert.equal(searched.profiles.length, 1);
  assert.equal(searched.pagination.total, 1);
  assert.equal(searched.pagination.pageSize, 1);

  const hiddenFromEditor = await call(env, "/api/clients?owner=created", authorized(editor.token));
  assert.equal((await hiddenFromEditor.json()).pagination.total, 0);

  const deletedResponse = await call(
    env,
    `/api/clients/${profile.id}`,
    authorized(editor.token, { method: "DELETE" }),
  );
  assert.equal(deletedResponse.status, 200);
  const emptyListResponse = await call(env, "/api/clients?scope=sync", authorized(admin.token));
  const emptyList = await emptyListResponse.json();
  assert.equal(emptyList.profiles.length, 0);
  assert.equal(emptyList.deletedProfiles.length, 1);
  assert.equal(emptyList.deletedProfiles[0].deletedBy, "editeur");
});
