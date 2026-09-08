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

  async put(key, value, options = {}) {
    const body =
      typeof value === "string"
        ? new TextEncoder().encode(value)
        : value instanceof ArrayBuffer
          ? new Uint8Array(value)
          : new Uint8Array(await new Response(value).arrayBuffer());
    this.objects.set(key, {
      body,
      customMetadata: options.customMetadata ?? {},
      httpMetadata: options.httpMetadata ?? {},
      uploaded: new Date(),
    });
  }

  async get(key) {
    const stored = this.objects.get(key);
    if (!stored) return null;
    return {
      body: new Response(stored.body).body,
      customMetadata: stored.customMetadata,
      httpEtag: `"${key}"`,
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

test("les clients R2 sont partagés et attribuent le créateur puis le dernier éditeur", async () => {
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

  const currentResponse = await call(env, `/api/clients/${profile.id}`, authorized(editor.token));
  const current = await currentResponse.json();
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

  const finalResponse = await call(env, `/api/clients/${profile.id}`, authorized(admin.token));
  const finalProfile = await finalResponse.json();
  assert.equal(finalProfile.phone, "+213555111111");
  assert.equal(finalProfile.createdBy.username, "admin");
  assert.equal(finalProfile.updatedBy.username, "editeur");

  const deletedResponse = await call(
    env,
    `/api/clients/${profile.id}`,
    authorized(editor.token, { method: "DELETE" }),
  );
  assert.equal(deletedResponse.status, 200);
  const emptyListResponse = await call(env, "/api/clients", authorized(admin.token));
  const emptyList = await emptyListResponse.json();
  assert.equal(emptyList.profiles.length, 0);
  assert.equal(emptyList.deletedProfiles.length, 1);
  assert.equal(emptyList.deletedProfiles[0].deletedBy, "editeur");
});
