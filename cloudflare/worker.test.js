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
    for (const item of Array.isArray(key) ? key : [key]) this.objects.delete(item);
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

class MemoryTelemetryD1 {
  rows = [];

  prepare(sql) {
    const database = this;
    return {
      values: [],
      bind(...values) {
        this.values = values;
        return this;
      },
      async run() {
        if (sql.includes("INSERT INTO operational_events")) {
          const [id, kind, name, value, rating, status, route, buildId, role, createdAt] =
            this.values;
          database.rows.push({
            id,
            kind,
            name,
            value,
            rating,
            status,
            route,
            build_id: buildId,
            role,
            created_at: createdAt,
          });
        } else if (sql.includes("DELETE FROM operational_events")) {
          const [cutoff] = this.values;
          database.rows = database.rows.filter((row) => row.created_at >= cutoff);
        }
        return { success: true };
      },
      async first() {
        return null;
      },
      async all() {
        return { results: structuredClone(database.rows) };
      },
    };
  }

  async batch(statements) {
    return Promise.all(statements.map((statement) => statement.run()));
  }
}

class MemorySecurityD1 {
  loginAttempts = new Map();

  prepare(sql) {
    const database = this;
    return {
      values: [],
      bind(...values) {
        this.values = values;
        return this;
      },
      async first() {
        if (!sql.includes("FROM login_attempts")) return null;
        return structuredClone(database.loginAttempts.get(this.values[0]) || null);
      },
      async run() {
        if (sql.includes("INSERT INTO login_attempts")) {
          const [keyHash, attempts, windowStartedAt, blockedUntil, updatedAt] = this.values;
          database.loginAttempts.set(keyHash, {
            attempts,
            window_started_at: windowStartedAt,
            blocked_until: blockedUntil,
            updated_at: updatedAt,
          });
        } else if (sql.includes("DELETE FROM login_attempts")) {
          database.loginAttempts.delete(this.values[0]);
        }
        return { success: true };
      },
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

test("les sessions par appareil peuvent être consultées et révoquées séparément", async () => {
  const env = {
    CLIENTS_BUCKET: new MemoryR2Bucket(),
    ADMIN_USERNAME: "admin",
    ADMIN_PASSWORD: "mot-de-passe-admin-test",
    SESSION_SECRET: "secret-de-session-de-test-suffisamment-long-1234567890",
    ALLOWED_ORIGINS: "http://127.0.0.1:8080",
  };

  const firstResponse = await call(env, "/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/140.0",
    },
    body: JSON.stringify({ username: "admin", password: env.ADMIN_PASSWORD }),
  });
  const first = await firstResponse.json();
  const secondResponse = await call(env, "/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Firefox/142.0",
    },
    body: JSON.stringify({ username: "admin", password: env.ADMIN_PASSWORD }),
  });
  const second = await secondResponse.json();

  const listResponse = await call(env, "/api/account/sessions", authorized(second.token));
  assert.equal(listResponse.status, 200);
  const listed = await listResponse.json();
  assert.equal(listed.sessions.length, 2);
  assert.equal(listed.sessions.filter((session) => session.current).length, 1);
  assert.ok(listed.sessions.some((session) => session.deviceLabel === "Google Chrome sur Windows"));
  assert.ok(listed.sessions.some((session) => session.deviceLabel === "Firefox sur Linux"));

  const firstSession = listed.sessions.find((session) => !session.current);
  const revokeFirst = await call(
    env,
    `/api/account/sessions/${firstSession.id}`,
    authorized(second.token, { method: "DELETE" }),
  );
  assert.equal(revokeFirst.status, 200);
  assert.equal((await revokeFirst.json()).logoutRequired, false);
  assert.equal((await call(env, "/api/auth/session", authorized(first.token))).status, 401);
  assert.equal((await call(env, "/api/auth/session", authorized(second.token))).status, 200);

  const currentSession = listed.sessions.find((session) => session.current);
  const revokeCurrent = await call(
    env,
    `/api/account/sessions/${currentSession.id}`,
    authorized(second.token, { method: "DELETE" }),
  );
  assert.equal(revokeCurrent.status, 200);
  assert.equal((await revokeCurrent.json()).logoutRequired, true);
  assert.equal((await call(env, "/api/auth/session", authorized(second.token))).status, 401);
});

test("les tentatives de connexion abusives sont temporairement bloquées sans IP en clair", async () => {
  const database = new MemorySecurityD1();
  const env = {
    CLIENTS_BUCKET: new MemoryR2Bucket(),
    CLIENTS_DB: database,
    ADMIN_USERNAME: "admin",
    ADMIN_PASSWORD: "mot-de-passe-admin-test",
    SESSION_SECRET: "secret-de-session-de-test-suffisamment-long-1234567890",
    ALLOWED_ORIGINS: "http://127.0.0.1:8080",
  };
  const sourceIp = "203.0.113.42";
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await call(env, "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": sourceIp },
      body: JSON.stringify({ username: "admin", password: "incorrect-password" }),
    });
    assert.equal(response.status, 401);
  }
  const blocked = await call(env, "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": sourceIp },
    body: JSON.stringify({ username: "admin", password: env.ADMIN_PASSWORD }),
  });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("Retry-After")) > 0);
  assert.equal(JSON.stringify([...database.loginAttempts.keys()]).includes(sourceIp), false);
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
    photoAsset: {
      mimeType: "image/webp",
      width: 1,
      height: 1,
      size: 12,
      r2Key: "clients/ZGR-20260906-ABC123/photo.webp",
    },
  };
  const initialPhotoResponse = await call(
    env,
    `/api/clients/${profile.id}/photo`,
    authorized(admin.token, {
      method: "PUT",
      headers: { "Content-Type": "image/webp", "X-Profile-Revision": "0" },
      body: new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]),
    }),
  );
  assert.equal(initialPhotoResponse.status, 200);
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

  const versionsResponse = await call(
    env,
    `/api/clients/${profile.id}/versions`,
    authorized(editor.token),
  );
  assert.equal(versionsResponse.status, 200);
  const versions = await versionsResponse.json();
  assert.deepEqual(
    versions.versions.map((version) => version.revision),
    [2, 1],
  );

  const restoredResponse = await call(
    env,
    `/api/clients/${profile.id}/versions/1/restore`,
    authorized(editor.token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision: 2 }),
    }),
  );
  assert.equal(restoredResponse.status, 200);
  const restored = await restoredResponse.json();
  assert.equal(restored.profile.revision, 3);
  assert.equal(restored.profile.updatedBy.username, "editeur");

  const staleRestoreResponse = await call(
    env,
    `/api/clients/${profile.id}/versions/2/restore`,
    authorized(admin.token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedRevision: 2 }),
    }),
  );
  assert.equal(staleRestoreResponse.status, 409);

  const finalResponse = await call(env, `/api/clients/${profile.id}`, authorized(admin.token));
  const finalProfile = await finalResponse.json();
  assert.equal(finalProfile.phone, "+213555000000");
  assert.equal(finalProfile.revision, 3);
  assert.equal(finalProfile.createdBy.username, "admin");
  assert.equal(finalProfile.updatedBy.username, "editeur");

  const scheduled = testContext();
  const backupTime = Date.now();
  const backupDay = new Date(backupTime).toISOString().slice(0, 10);
  worker.scheduled({ scheduledTime: backupTime }, env, scheduled.context);
  await scheduled.settle();
  const manifestObject = await env.CLIENTS_BUCKET.get(`backups/daily/${backupDay}/manifest.json`);
  assert.ok(manifestObject);
  const manifest = JSON.parse(await manifestObject.text());
  assert.equal(manifest.profiles, 1);
  assert.equal(manifest.photos, 1);
  assert.equal(manifest.d1.available, false);
  assert.ok(
    await env.CLIENTS_BUCKET.get(`backups/daily/${backupDay}/r2/clients/${profile.id}.json`),
  );
  assert.ok(await env.CLIENTS_BUCKET.get(`backups/monthly/${backupDay.slice(0, 7)}/manifest.json`));

  const monitoringResponse = await call(env, "/api/admin/backups", authorized(admin.token));
  assert.equal(monitoringResponse.status, 200);
  const monitoring = await monitoringResponse.json();
  assert.equal(monitoring.health, "warning");
  assert.equal(monitoring.latestStatus.state, "success");
  assert.equal(monitoring.latestBackup.day, backupDay);
  assert.equal(monitoring.recentBackups.length, 1);
  assert.equal(monitoring.recentMonthlyBackups.length, 1);
  assert.deepEqual(monitoring.retention, { daily: 30, monthly: 12, recoveryPoints: 10 });
  assert.ok(monitoring.storage.backups.objects >= 3);
  assert.ok(monitoring.storage.history.objects >= 6);

  const forbiddenMonitoring = await call(env, "/api/admin/backups", authorized(editor.token));
  assert.equal(forbiddenMonitoring.status, 403);

  const repeatedBackupResponse = await call(
    env,
    "/api/admin/backups",
    authorized(admin.token, { method: "POST" }),
  );
  assert.equal(repeatedBackupResponse.status, 200);
  assert.equal((await repeatedBackupResponse.json()).backup.skipped, true);

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

  const changedAfterBackupResponse = await call(
    env,
    `/api/clients/${profile.id}`,
    authorized(admin.token, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...finalProfile, phone: "+213555777777" }),
    }),
  );
  assert.equal(changedAfterBackupResponse.status, 200);

  const previewRestoreResponse = await call(
    env,
    `/api/admin/backups/daily/${backupDay}/restore`,
    authorized(admin.token),
  );
  assert.equal(previewRestoreResponse.status, 200);
  const previewRestore = await previewRestoreResponse.json();
  assert.equal(previewRestore.summary.overwritten, 1);
  assert.equal(previewRestore.confirmation, `RESTAURER ${backupDay}`);

  const refusedRestoreResponse = await call(
    env,
    `/api/admin/backups/daily/${backupDay}/restore`,
    authorized(admin.token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: "RESTAURER MAINTENANT" }),
    }),
  );
  assert.equal(refusedRestoreResponse.status, 422);

  const restoreBackupResponse = await call(
    env,
    `/api/admin/backups/daily/${backupDay}/restore`,
    authorized(admin.token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: `RESTAURER ${backupDay}` }),
    }),
  );
  assert.equal(restoreBackupResponse.status, 200);
  const restoredBackup = await restoreBackupResponse.json();
  assert.equal(restoredBackup.summary.overwritten, 1);
  assert.equal(restoredBackup.recoveryPoint.kind, "recovery");
  const restoredFromBackupResponse = await call(
    env,
    `/api/clients/${profile.id}`,
    authorized(admin.token),
  );
  const restoredFromBackup = await restoredFromBackupResponse.json();
  assert.equal(restoredFromBackup.phone, "+213555000000");
  assert.ok(restoredFromBackup.revision >= 5);
  const monitoringAfterRestoreResponse = await call(
    env,
    "/api/admin/backups",
    authorized(admin.token),
  );
  const monitoringAfterRestore = await monitoringAfterRestoreResponse.json();
  assert.equal(monitoringAfterRestore.recentRecoveryPoints.length, 1);
  assert.equal(
    monitoringAfterRestore.recentRecoveryPoints[0].period,
    restoredBackup.recoveryPoint.period,
  );

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

test("la supervision agrège uniquement des métriques techniques anonymes", async () => {
  const env = {
    CLIENTS_BUCKET: new MemoryR2Bucket(),
    CLIENTS_DB: new MemoryTelemetryD1(),
    ADMIN_USERNAME: "admin",
    ADMIN_PASSWORD: "mot-de-passe-admin-test",
    SESSION_SECRET: "secret-de-session-de-test-suffisamment-long-1234567890",
    ALLOWED_ORIGINS: "http://127.0.0.1:8080",
  };
  const admin = await login(env, "admin", env.ADMIN_PASSWORD);
  const telemetryResponse = await call(
    env,
    "/api/telemetry",
    authorized(admin.token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        events: [
          {
            kind: "web_vital",
            name: "LCP",
            value: 1_450,
            rating: "good",
            buildId: "test-build",
            email: "personnel@example.com",
          },
          {
            kind: "api_failure",
            name: "http_error",
            rating: "error",
            status: 503,
            route: "/api/clients/:id",
            message: "Contenu confidentiel qui ne doit pas être stocké",
          },
        ],
      }),
    }),
  );
  assert.equal(telemetryResponse.status, 202);
  assert.equal((await telemetryResponse.json()).stored, 2);
  assert.equal(env.CLIENTS_DB.rows.length, 2);
  assert.equal("email" in env.CLIENTS_DB.rows[0], false);
  assert.equal("message" in env.CLIENTS_DB.rows[1], false);

  const monitoringResponse = await call(env, "/api/admin/monitoring", authorized(admin.token));
  assert.equal(monitoringResponse.status, 200);
  const monitoring = await monitoringResponse.json();
  assert.equal(monitoring.available, true);
  assert.equal(monitoring.last24h.events, 2);
  assert.equal(monitoring.last24h.apiFailures, 1);
  assert.equal(monitoring.vitals.find((vital) => vital.name === "LCP").p75, 1_450);
  assert.equal(JSON.stringify(monitoring).includes("personnel@example.com"), false);
  assert.match(monitoring.privacy, /Aucun nom/);
});

test("la conservation limite les sauvegardes quotidiennes et mensuelles", async () => {
  const bucket = new MemoryR2Bucket();
  const env = { CLIENTS_BUCKET: bucket };
  const now = Date.now();
  for (let index = 1; index <= 35; index += 1) {
    const day = new Date(now - index * 86_400_000).toISOString().slice(0, 10);
    await bucket.put(
      `backups/daily/${day}/manifest.json`,
      JSON.stringify({ version: 1, day, createdAt: `${day}T03:15:00.000Z`, d1: {} }),
    );
  }
  const current = new Date(now);
  for (let index = 1; index <= 15; index += 1) {
    const monthDate = new Date(
      Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - index, 1),
    );
    const month = monthDate.toISOString().slice(0, 7);
    await bucket.put(
      `backups/monthly/${month}/manifest.json`,
      JSON.stringify({ version: 1, kind: "monthly", month, day: `${month}-01`, d1: {} }),
    );
  }

  const scheduled = testContext();
  worker.scheduled({ scheduledTime: now }, env, scheduled.context);
  await scheduled.settle();

  const daily = await bucket.list({ prefix: "backups/daily/" });
  const dailyPeriods = new Set(
    daily.objects.map((object) => object.key.split("/")[2]).filter(Boolean),
  );
  const monthly = await bucket.list({ prefix: "backups/monthly/" });
  const monthlyPeriods = new Set(
    monthly.objects.map((object) => object.key.split("/")[2]).filter(Boolean),
  );
  assert.equal(dailyPeriods.size, 30);
  assert.equal(monthlyPeriods.size, 12);
});
