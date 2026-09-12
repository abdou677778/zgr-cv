import { expect, test, type BrowserContext, type Page, type Route } from "@playwright/test";

type TestUser = {
  username: string;
  displayName: string;
  role: "admin" | "editor" | "viewer";
  active: true;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
  loginCount: number;
  workflowManager?: boolean;
};

type StoredProfile = Record<string, unknown> & {
  id: string;
  revision: number;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
  createdBy: Pick<TestUser, "username" | "displayName" | "role">;
  updatedBy: Pick<TestUser, "username" | "displayName" | "role">;
  workflowStatus?: "draft" | "review" | "approved";
  workflowUpdatedAt?: string;
  workflowUpdatedBy?: Pick<TestUser, "username" | "displayName" | "role">;
  workflowComment?: string;
  workflowCommentAt?: string;
  workflowCommentBy?: Pick<TestUser, "username" | "displayName" | "role">;
  workflowAssignee?: Pick<TestUser, "username" | "displayName" | "role">;
  workflowAssignedAt?: string;
  workflowAssignedBy?: Pick<TestUser, "username" | "displayName" | "role">;
};

const USERS: Record<string, TestUser> = {
  admin: {
    username: "admin",
    displayName: "Administrateur E2E",
    role: "admin",
    active: true,
    createdAt: "2026-09-11T08:00:00.000Z",
    updatedAt: "2026-09-11T08:00:00.000Z",
    lastLoginAt: "2026-09-11T08:00:00.000Z",
    loginCount: 1,
    workflowManager: true,
  },
  editeur: {
    username: "editeur",
    displayName: "Éditeur E2E",
    role: "editor",
    active: true,
    createdAt: "2026-09-11T08:00:00.000Z",
    updatedAt: "2026-09-11T08:00:00.000Z",
    lastLoginAt: "2026-09-11T08:00:00.000Z",
    loginCount: 1,
    workflowManager: true,
  },
  lecteur: {
    username: "lecteur",
    displayName: "Lecteur E2E",
    role: "viewer",
    active: true,
    createdAt: "2026-09-11T08:00:00.000Z",
    updatedAt: "2026-09-11T08:00:00.000Z",
    lastLoginAt: "2026-09-11T08:00:00.000Z",
    loginCount: 1,
  },
};

function actor(user: TestUser) {
  return { username: user.username, displayName: user.displayName, role: user.role };
}

function publicTestUser(user: TestUser) {
  const canEdit = user.role === "admin" || user.role === "editor";
  const clientsApprove = user.role === "admin" || user.workflowManager === true;
  return {
    ...user,
    workflowManager: clientsApprove,
    permissions: {
      clientsRead: true,
      clientsWrite: canEdit,
      clientsApprove,
      clientsDelete: user.role === "admin",
      clientsRestore: user.role === "admin",
      clientsDownload: true,
      aiUse: canEdit,
      manageUsers: user.role === "admin",
    },
  };
}

function tokenFor(username: string) {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3_600, sub: username }),
  ).toString("base64url");
  return `${payload}.e2e-signature`;
}

class SharedClientApi {
  readonly profiles = new Map<string, StoredProfile>();
  readonly profileVersions = new Map<string, Map<number, StoredProfile>>();
  readonly sessions = new Map<string, TestUser>();
  readonly offlineUsers = new Set<string>();
  private revisionClock = 0;

  private async respond(route: Route, status: number, body: unknown) {
    await route.fulfill({
      status,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(body),
    });
  }

  private authenticatedUser(route: Route) {
    const authorization = route.request().headers().authorization || "";
    return this.sessions.get(authorization.replace(/^Bearer\s+/i, ""));
  }

  private summary(profile: StoredProfile) {
    return {
      id: profile.id,
      revision: profile.revision,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      createdBy: profile.createdBy,
      updatedBy: profile.updatedBy,
      workflowStatus: profile.workflowStatus ?? "draft",
      workflowUpdatedAt: profile.workflowUpdatedAt,
      workflowUpdatedBy: profile.workflowUpdatedBy,
      workflowComment: profile.workflowComment,
      workflowCommentAt: profile.workflowCommentAt,
      workflowCommentBy: profile.workflowCommentBy,
      workflowAssignee: profile.workflowAssignee,
      workflowAssignedAt: profile.workflowAssignedAt,
      workflowAssignedBy: profile.workflowAssignedBy,
      language: profile.language,
      hasPhoto: false,
    };
  }

  async handle(route: Route) {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname === "/api/auth/login" && method === "POST") {
      const credentials = request.postDataJSON() as { username?: string; password?: string };
      const user =
        credentials.password === "e2e-password" ? USERS[credentials.username || ""] : null;
      if (!user) return this.respond(route, 401, { error: "Identifiants de test invalides." });
      const token = tokenFor(user.username);
      this.sessions.set(token, user);
      return this.respond(route, 200, {
        token,
        user: publicTestUser(user),
        expiresAt: Date.now() + 3_600_000,
      });
    }

    if (url.pathname === "/api/auth/session" && method === "GET") {
      const user = this.authenticatedUser(route);
      return user
        ? this.respond(route, 200, { ok: true, user: publicTestUser(user) })
        : this.respond(route, 401, { error: "Session de test expirée." });
    }

    const user = this.authenticatedUser(route);
    if (!user) return this.respond(route, 401, { error: "Session de test absente." });

    if (url.pathname === "/api/telemetry" && method === "POST") {
      const events = (request.postDataJSON() as { events?: unknown[] }).events || [];
      return this.respond(route, 202, { ok: true, stored: events.length, available: true });
    }

    if (url.pathname === "/api/account/sessions" && method === "GET") {
      return this.respond(route, 200, {
        legacySession: false,
        sessions: [
          {
            id: "e2e-session-current-12345",
            deviceLabel: "Navigateur E2E sur Windows",
            createdAt: "2026-09-12T07:00:00.000Z",
            lastSeenAt: "2026-09-12T08:00:00.000Z",
            expiresAt: "2026-09-19T07:00:00.000Z",
            current: true,
          },
        ],
      });
    }

    if (url.pathname.startsWith("/api/admin/")) {
      if (user.role !== "admin")
        return this.respond(route, 403, { error: "Droits administrateur requis." });
      if (url.pathname === "/api/admin/trash" && method === "GET") {
        return this.respond(route, 200, { items: [], retentionDays: 30 });
      }
      if (url.pathname === "/api/admin/users" && method === "GET") {
        return this.respond(route, 200, {
          users: Object.values(USERS).map((managedUser) => ({
            ...publicTestUser(managedUser),
            sessionVersion: 1,
            isPrimary: managedUser.username === "admin",
          })),
        });
      }
      if (url.pathname === "/api/admin/audit" && method === "GET") {
        return this.respond(route, 200, { entries: [] });
      }
      if (url.pathname === "/api/admin/monitoring" && method === "GET") {
        return this.respond(route, 200, {
          generatedAt: new Date().toISOString(),
          available: true,
          health: "healthy",
          retentionDays: 30,
          last24h: { events: 24, javascriptErrors: 0, apiFailures: 0, syncFailures: 0 },
          vitals: [
            { name: "LCP", samples: 5, p75: 1_420, average: 1_310, poor: 0 },
            { name: "INP", samples: 4, p75: 110, average: 95, poor: 0 },
            { name: "CLS", samples: 5, p75: 0.03, average: 0.02, poor: 0 },
            { name: "FCP", samples: 5, p75: 780, average: 720, poor: 0 },
            { name: "TTFB", samples: 5, p75: 190, average: 175, poor: 0 },
          ],
          daily: [],
          privacy:
            "Aucun nom, CV, courriel, téléphone, adresse IP ou contenu client n’est enregistré.",
        });
      }
      const restoreMatch = url.pathname.match(
        /^\/api\/admin\/backups\/(daily|monthly)\/([^/]+)\/restore$/,
      );
      if (restoreMatch && method === "GET") {
        const period = decodeURIComponent(restoreMatch[2]);
        return this.respond(route, 200, {
          backup: {
            version: 1,
            day: "2026-09-11",
            createdAt: "2026-09-11T03:15:00.000Z",
            profiles: 8,
            photos: 4,
            deletions: 1,
            d1: { available: true, profiles: 8, deletions: 1, systemState: 1 },
          },
          summary: {
            profilesInBackup: 8,
            added: 1,
            overwritten: 7,
            removed: 2,
            objectsToRestore: 13,
          },
          confirmation: `RESTAURER ${period}`,
          safety: "Un point de récupération est créé automatiquement avant toute modification.",
        });
      }
      if (url.pathname === "/api/admin/backups" && method === "GET") {
        return this.respond(route, 200, {
          generatedAt: new Date().toISOString(),
          health: "healthy",
          alerts: [],
          latestStatus: {
            state: "success",
            checkedAt: "2026-09-11T04:15:00.000Z",
            day: "2026-09-11",
            message: "Sauvegarde quotidienne terminée.",
          },
          latestBackup: {
            version: 1,
            day: "2026-09-11",
            createdAt: "2026-09-11T03:15:00.000Z",
            profiles: 8,
            photos: 4,
            deletions: 1,
            d1: { available: true, profiles: 8, deletions: 1, systemState: 1 },
          },
          recentBackups: [
            {
              version: 1,
              day: "2026-09-11",
              createdAt: "2026-09-11T03:15:00.000Z",
              profiles: 8,
              photos: 4,
              deletions: 1,
              d1: { available: true, profiles: 8, deletions: 1, systemState: 1 },
            },
          ],
          recentMonthlyBackups: [
            {
              version: 1,
              kind: "monthly",
              day: "2026-09-11",
              month: "2026-09",
              sourceDay: "2026-09-11",
              createdAt: "2026-09-11T03:15:00.000Z",
              profiles: 8,
              photos: 4,
              deletions: 1,
              d1: { available: true, profiles: 8, deletions: 1, systemState: 1 },
            },
          ],
          recentRecoveryPoints: [],
          storage: {
            clients: { objects: 12, bytes: 120_000 },
            history: { objects: 24, bytes: 240_000 },
            backups: { objects: 18, bytes: 360_000 },
            recovery: { objects: 0, bytes: 0 },
            system: { objects: 4, bytes: 8_000 },
            total: { objects: 58, bytes: 728_000 },
          },
          d1: { available: true, profiles: 8, deletions: 1, indexReady: true },
          schedule: { cron: "15 3 * * *", timezone: "UTC", algerTime: "04:15" },
          retention: { daily: 30, monthly: 12, recoveryPoints: 10 },
        });
      }
      if (url.pathname === "/api/admin/backups" && method === "POST") {
        return this.respond(route, 200, {
          ok: true,
          backup: {
            version: 1,
            day: "2026-09-11",
            createdAt: "2026-09-11T03:15:00.000Z",
            profiles: 8,
            photos: 4,
            deletions: 1,
            skipped: true,
            d1: { available: true, profiles: 8, deletions: 1, systemState: 1 },
          },
        });
      }
      return this.respond(route, 404, { error: "Route administrateur de test inconnue." });
    }

    if (!url.pathname.startsWith("/api/clients")) return route.fallback();

    if (method === "PUT" && this.offlineUsers.has(user.username)) {
      return this.respond(route, 503, { error: "Cloud temporairement indisponible." });
    }

    if (url.pathname === "/api/clients" && method === "GET") {
      const query = (url.searchParams.get("q") || "").trim().toLocaleLowerCase("fr");
      const owner = url.searchParams.get("owner") || "all";
      const status = url.searchParams.get("status") || "all";
      const allProfiles = [...this.profiles.values()];
      const workflowCounts = {
        all: allProfiles.length,
        draft: allProfiles.filter((profile) => (profile.workflowStatus ?? "draft") === "draft")
          .length,
        review: allProfiles.filter((profile) => profile.workflowStatus === "review").length,
        approved: allProfiles.filter((profile) => profile.workflowStatus === "approved").length,
      };
      const profiles = allProfiles
        .filter((profile) => {
          if (owner === "created" && profile.createdBy.username !== user.username) return false;
          if (owner === "updated" && profile.updatedBy.username !== user.username) return false;
          if (
            owner === "involved" &&
            profile.createdBy.username !== user.username &&
            profile.updatedBy.username !== user.username
          )
            return false;
          if (status !== "all" && (profile.workflowStatus ?? "draft") !== status) return false;
          return (
            !query ||
            [profile.id, profile.name, profile.email, profile.phone]
              .join(" ")
              .toLocaleLowerCase("fr")
              .includes(query)
          );
        })
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      const pageSize = Math.max(
        1,
        Number(url.searchParams.get("pageSize")) || profiles.length || 1,
      );
      const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
      const totalPages = Math.max(1, Math.ceil(profiles.length / pageSize));
      const visibleProfiles =
        url.searchParams.get("scope") === "sync"
          ? profiles
          : profiles.slice((page - 1) * pageSize, page * pageSize);
      return this.respond(route, 200, {
        profiles: visibleProfiles.map((profile) => this.summary(profile)),
        deletedProfiles: [],
        pagination: {
          page,
          pageSize,
          total: profiles.length,
          totalPages,
          hasPrevious: page > 1,
          hasNext: page < totalPages,
        },
        indexSource: "d1",
        workflowCounts,
      });
    }

    if (url.pathname === "/api/clients/workflow-validators" && method === "GET") {
      if (user.role !== "admin" && user.workflowManager !== true)
        return this.respond(route, 403, { error: "Droit de validation requis." });
      return this.respond(route, 200, {
        validators: Object.values(USERS)
          .filter((candidate) => candidate.role === "admin" || candidate.workflowManager === true)
          .map(actor),
      });
    }

    const versionMatch = url.pathname.match(/^\/api\/clients\/([^/]+)\/versions\/(\d+)$/);
    if (versionMatch && method === "GET") {
      const id = decodeURIComponent(versionMatch[1]);
      const revision = Number(versionMatch[2]);
      const profile = this.profileVersions.get(id)?.get(revision);
      return profile
        ? this.respond(route, 200, { id, revision, profile })
        : this.respond(route, 404, { error: "Cette version n’existe plus." });
    }

    const versionsMatch = url.pathname.match(/^\/api\/clients\/([^/]+)\/versions$/);
    if (versionsMatch && method === "GET") {
      const id = decodeURIComponent(versionsMatch[1]);
      const profile = this.profiles.get(id);
      if (!profile) return this.respond(route, 404, { error: "Profil de test introuvable." });
      const versions = [...(this.profileVersions.get(id)?.values() || [])]
        .sort((left, right) => right.revision - left.revision)
        .map((version) => ({
          revision: version.revision,
          updatedAt: version.updatedAt,
          updatedBy: version.updatedBy,
          workflowStatus: version.workflowStatus ?? "draft",
          workflowAssignee: version.workflowAssignee,
          hasPhoto: false,
        }));
      return this.respond(route, 200, {
        id,
        currentRevision: profile.revision,
        versions,
      });
    }

    const assignmentMatch = url.pathname.match(/^\/api\/clients\/([^/]+)\/workflow\/assignment$/);
    if (assignmentMatch && method === "PUT") {
      const id = decodeURIComponent(assignmentMatch[1]);
      const current = this.profiles.get(id);
      if (!current) return this.respond(route, 404, { error: "Profil de test introuvable." });
      if (user.role !== "admin" && user.workflowManager !== true)
        return this.respond(route, 403, { error: "Droit de validation requis." });
      const input = request.postDataJSON() as {
        expectedRevision?: number;
        assigneeUsername?: string;
      };
      if (input.expectedRevision !== current.revision) {
        return this.respond(route, 409, {
          error: "Ce profil a été modifié dans une autre session.",
          code: "CLIENT_PROFILE_CONFLICT",
          current: {
            revision: current.revision,
            updatedAt: current.updatedAt,
            updatedBy: current.updatedBy,
          },
        });
      }
      if ((current.workflowStatus ?? "draft") !== "review")
        return this.respond(route, 422, { error: "CV non attribuable." });
      const assignee = input.assigneeUsername ? USERS[input.assigneeUsername] : undefined;
      if (
        input.assigneeUsername &&
        (!assignee || (assignee.role !== "admin" && assignee.workflowManager !== true))
      )
        return this.respond(route, 422, { error: "Responsable non autorisé." });
      this.revisionClock += 1;
      const timestamp = new Date(Date.UTC(2026, 8, 11, 9, 0, this.revisionClock)).toISOString();
      const updated: StoredProfile = {
        ...structuredClone(current),
        revision: current.revision + 1,
        updatedAt: timestamp,
        updatedBy: actor(user),
        workflowAssignee: assignee ? actor(assignee) : undefined,
        workflowAssignedAt: assignee ? timestamp : undefined,
        workflowAssignedBy: assignee ? actor(user) : undefined,
      };
      this.profiles.set(id, updated);
      const versions = this.profileVersions.get(id) || new Map<number, StoredProfile>();
      versions.set(updated.revision, structuredClone(updated));
      this.profileVersions.set(id, versions);
      return this.respond(route, 200, { ok: true, id, profile: updated });
    }

    const workflowMatch = url.pathname.match(/^\/api\/clients\/([^/]+)\/workflow$/);
    if (workflowMatch && method === "PUT") {
      const id = decodeURIComponent(workflowMatch[1]);
      const current = this.profiles.get(id);
      if (!current) return this.respond(route, 404, { error: "Profil de test introuvable." });
      const input = request.postDataJSON() as {
        status?: "draft" | "review" | "approved";
        expectedRevision?: number;
        comment?: string;
      };
      if (input.expectedRevision !== current.revision) {
        return this.respond(route, 409, {
          error: "Ce profil a été modifié dans une autre session.",
          code: "CLIENT_PROFILE_CONFLICT",
          current: {
            revision: current.revision,
            updatedAt: current.updatedAt,
            updatedBy: current.updatedBy,
          },
        });
      }
      if (!input.status) return this.respond(route, 422, { error: "Statut invalide." });
      const currentStatus = current.workflowStatus ?? "draft";
      const managesWorkflow = user.role === "admin" || user.workflowManager === true;
      const managerTransition =
        managesWorkflow &&
        ((currentStatus === "draft" && input.status === "review") ||
          (currentStatus === "review" &&
            (input.status === "draft" || input.status === "approved")) ||
          (currentStatus === "approved" && input.status === "draft"));
      const editorTransition =
        user.role === "editor" &&
        ((currentStatus === "draft" && input.status === "review") ||
          (currentStatus === "review" && input.status === "draft"));
      if (!managerTransition && !editorTransition) {
        return this.respond(route, 403, { error: "Droits administrateur requis." });
      }
      if (input.status === "draft" && managesWorkflow && !input.comment?.trim()) {
        return this.respond(route, 422, { error: "Commentaire obligatoire." });
      }
      this.revisionClock += 1;
      const timestamp = new Date(Date.UTC(2026, 8, 11, 9, 0, this.revisionClock)).toISOString();
      const updated: StoredProfile = {
        ...structuredClone(current),
        revision: current.revision + 1,
        updatedAt: timestamp,
        updatedBy: actor(user),
        workflowStatus: input.status,
        workflowUpdatedAt: timestamp,
        workflowUpdatedBy: actor(user),
        ...(input.status === "draft" && managesWorkflow
          ? {
              workflowComment: input.comment?.trim(),
              workflowCommentAt: timestamp,
              workflowCommentBy: actor(user),
            }
          : input.status === "approved"
            ? {
                workflowComment: undefined,
                workflowCommentAt: undefined,
                workflowCommentBy: undefined,
              }
            : {}),
        ...(input.status === "review" && currentStatus === "draft"
          ? {
              workflowAssignee: undefined,
              workflowAssignedAt: undefined,
              workflowAssignedBy: undefined,
            }
          : {}),
      };
      this.profiles.set(id, updated);
      const versions = this.profileVersions.get(id) || new Map<number, StoredProfile>();
      versions.set(updated.revision, structuredClone(updated));
      this.profileVersions.set(id, versions);
      return this.respond(route, 200, { ok: true, id, profile: updated });
    }

    const match = url.pathname.match(/^\/api\/clients\/([^/]+)(?:\/(photo))?$/);
    if (!match) return this.respond(route, 404, { error: "Route de test inconnue." });
    const id = decodeURIComponent(match[1]);
    const photo = match[2] === "photo";

    if (photo) {
      return this.respond(route, 404, { error: "Aucune photo dans ce scénario de test." });
    }

    if (method === "GET") {
      const profile = this.profiles.get(id);
      return profile
        ? this.respond(route, 200, profile)
        : this.respond(route, 404, { error: "Profil de test introuvable." });
    }

    if (method === "PUT") {
      const candidate = request.postDataJSON() as StoredProfile;
      const current = this.profiles.get(id);
      if ((current?.workflowStatus ?? "draft") === "approved") {
        return this.respond(route, 423, {
          error: "Ce CV est validé et verrouillé.",
          code: "CLIENT_PROFILE_LOCKED",
          current: {
            revision: current?.revision,
            updatedAt: current?.updatedAt,
            updatedBy: current?.updatedBy,
            workflowStatus: "approved",
          },
        });
      }
      if (current && Number(candidate.revision || 0) !== current.revision) {
        return this.respond(route, 409, {
          error: "Ce profil a été modifié dans une autre session.",
          code: "CLIENT_PROFILE_CONFLICT",
          current: {
            revision: current.revision,
            updatedAt: current.updatedAt,
            updatedBy: current.updatedBy,
          },
        });
      }
      this.revisionClock += 1;
      const timestamp = new Date(Date.UTC(2026, 8, 11, 9, 0, this.revisionClock)).toISOString();
      const committed: StoredProfile = {
        ...structuredClone(candidate),
        id,
        revision: (current?.revision || 0) + 1,
        createdAt: current?.createdAt || timestamp,
        updatedAt: timestamp,
        createdBy: current?.createdBy || actor(user),
        updatedBy: actor(user),
        workflowStatus: current?.workflowStatus ?? candidate.workflowStatus ?? "draft",
        workflowUpdatedAt: current?.workflowUpdatedAt ?? timestamp,
        workflowUpdatedBy: current?.workflowUpdatedBy ?? actor(user),
      };
      this.profiles.set(id, committed);
      const versions = this.profileVersions.get(id) || new Map<number, StoredProfile>();
      versions.set(committed.revision, structuredClone(committed));
      this.profileVersions.set(id, versions);
      return this.respond(route, 200, {
        ok: true,
        profile: {
          revision: committed.revision,
          createdAt: committed.createdAt,
          updatedAt: committed.updatedAt,
          createdBy: committed.createdBy,
          updatedBy: committed.updatedBy,
          workflowStatus: committed.workflowStatus,
          workflowUpdatedAt: committed.workflowUpdatedAt,
          workflowUpdatedBy: committed.workflowUpdatedBy,
        },
      });
    }

    return this.respond(route, 405, { error: "Méthode de test non autorisée." });
  }
}

async function connect(context: BrowserContext, api: SharedClientApi, username: string) {
  await context.route("**/api/**", (route) => api.handle(route));
  const page = await context.newPage();
  await page.goto(`/?login=${username}`);
  await page.getByLabel("Mot de passe").fill("e2e-password");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("button", { name: "Sauvegarder client" })).toBeVisible();
  return page;
}

async function openPersonalDetails(page: Page) {
  const fullName = page.getByPlaceholder("Nom complet");
  if (!(await fullName.isVisible())) {
    await page.getByRole("button", { name: "Déplier Informations personnelles" }).click();
  }
  await expect(fullName).toBeVisible();
}

test("les outils lourds sont chargés uniquement lorsqu’ils deviennent utiles", async ({
  browser,
}) => {
  const api = new SharedClientApi();
  const context = await browser.newContext();

  try {
    const page = await connect(context, api, "admin");
    const resourcesBeforeInteraction = await page.evaluate(() =>
      performance.getEntriesByType("resource").map((entry) => entry.name),
    );
    expect(resourcesBeforeInteraction.some((url) => url.includes("preview-control-dock"))).toBe(
      false,
    );
    expect(resourcesBeforeInteraction.some((url) => url.includes("cv-experience-workspace"))).toBe(
      false,
    );

    await page.getByRole("button", { name: "Déplier Expérience professionnelle" }).click();
    await expect(page.getByRole("button", { name: /Modifier l’expérience/ }).first()).toBeVisible();

    await page.getByRole("button", { name: "Afficher l’aperçu" }).click();
    await expect(page.getByRole("toolbar", { name: "Outils de l’aperçu" })).toBeVisible();
    await expect(page.getByLabel(/Page 1 sur/)).toBeVisible({ timeout: 30_000 });

    const resourcesAfterInteraction = await page.evaluate(() =>
      performance.getEntriesByType("resource").map((entry) => entry.name),
    );
    expect(resourcesAfterInteraction.some((url) => url.includes("preview-control-dock"))).toBe(
      true,
    );
    expect(resourcesAfterInteraction.some((url) => url.includes("cv-experience-workspace"))).toBe(
      true,
    );
    expect(resourcesAfterInteraction.some((url) => url.includes("document-pdf"))).toBe(true);
  } finally {
    await context.close();
  }
});

test("le profil lecture seule masque les actions interdites", async ({ browser }) => {
  const api = new SharedClientApi();
  const context = await browser.newContext();
  try {
    const page = await connect(context, api, "lecteur");
    await expect(page.getByText(/Mode lecture seule : consultation/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Sauvegarder client" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Assistant IA" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Commandes" })).toHaveCount(0);
    await page.getByRole("button", { name: "Base de données", exact: true }).click();
    const database = page.getByRole("dialog", { name: /Base de données clients/ });
    await expect(database.getByText(/lecture seule/).first()).toBeVisible();
    await expect(
      database.getByRole("button").filter({ hasText: "Actualiser la base" }),
    ).toBeVisible();
    await expect(database.getByRole("button", { name: "Synchroniser maintenant" })).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("deux navigateurs partagent un client et protègent une modification concurrente", async ({
  browser,
}) => {
  const api = new SharedClientApi();
  const adminContext = await browser.newContext();
  const editorContext = await browser.newContext();

  try {
    const adminPage = await connect(adminContext, api, "admin");
    await expect(adminPage.getByText("Travail enregistré")).toBeVisible();
    await adminPage.getByRole("button", { name: "Administrateur E2E" }).click();
    const accountSettings = adminPage.getByRole("dialog", { name: /Paramètres du compte/ });
    await expect(accountSettings.getByText("Santé de l’application")).toBeVisible();
    await expect(accountSettings.getByText("Fonctionnement sain")).toBeVisible();
    await expect(accountSettings.getByText("Web Vitals réels — 75e percentile")).toBeVisible();
    await expect(accountSettings.getByText("Supervision D1 et R2")).toBeVisible();
    await expect(accountSettings.getByText("Sauvegardes opérationnelles")).toBeVisible();
    await expect(accountSettings.getByText("8 profils", { exact: true })).toBeVisible();
    await accountSettings.getByRole("button", { name: "Sauvegarder maintenant" }).click();
    await expect(accountSettings.getByRole("status")).toContainText("existe déjà");
    await accountSettings.getByRole("button", { name: "Préparer" }).first().click();
    await expect(accountSettings.getByText("Restaurer la sauvegarde 2026-09-11")).toBeVisible();
    const restoreButton = accountSettings.getByRole("button", {
      name: "Restaurer la base clients",
    });
    await expect(restoreButton).toBeDisabled();
    await accountSettings.getByLabel(/Saisissez exactement/).fill("RESTAURER 2026-09-11");
    await expect(restoreButton).toBeEnabled();
    await accountSettings.getByRole("button", { name: "Annuler" }).click();
    await accountSettings.getByRole("button", { name: "Fermer" }).click();

    await adminPage.getByRole("button", { name: "Exemple" }).click();
    await openPersonalDetails(adminPage);
    await adminPage.getByPlaceholder("Nom complet").fill("Client E2E partagé");
    await adminPage.getByPlaceholder("+1 514 000 0000").fill("+213 555 100 100");
    await adminPage.getByRole("button", { name: "Sauvegarder client" }).click();

    await expect.poll(() => api.profiles.size).toBe(1);
    const profileId = [...api.profiles.keys()][0];
    await expect(
      adminPage.getByText(/Nouveau profil sauvegardé localement et dans R2/),
    ).toBeVisible();
    expect(api.profiles.get(profileId)?.createdBy.username).toBe("admin");
    await adminPage.getByRole("button", { name: "Base de données", exact: true }).click();
    const adminDatabase = adminPage.getByRole("dialog", { name: /Base de données clients/ });
    await expect(adminDatabase.getByText("Corbeille sécurisée")).toBeVisible();
    await expect(adminDatabase.getByText("La corbeille est vide.")).toBeVisible();
    await adminDatabase.getByRole("button", { name: "Close" }).click();
    await expect(adminPage.getByText("Travail enregistré")).toBeVisible();
    await adminPage.reload();
    await expect(adminPage.getByRole("button", { name: "Sauvegarder", exact: true })).toBeVisible();
    await openPersonalDetails(adminPage);
    await expect(adminPage.getByPlaceholder("Nom complet")).toHaveValue("Client E2E partagé");
    await expect(adminPage.getByPlaceholder("+1 514 000 0000")).toHaveValue("+213 555 100 100");

    const editorPage = await connect(editorContext, api, "editeur");
    await editorPage.getByRole("button", { name: "Base de données", exact: true }).click();
    const database = editorPage.getByRole("dialog", { name: /Base de données clients/ });
    await expect(database).toBeVisible();
    await database.getByRole("button", { name: "Synchroniser maintenant" }).click();
    await expect(database.getByRole("status")).toContainText("1 récupéré(s)");

    const profileRow = database.locator("article").filter({ hasText: "Client E2E partagé" });
    await expect(profileRow).toContainText("Créé par Administrateur E2E (admin)");
    await profileRow.getByRole("button", { name: "Ouvrir et modifier" }).click();
    await openPersonalDetails(editorPage);
    await editorPage.getByPlaceholder("+1 514 000 0000").fill("+213 555 200 200");
    await editorPage.getByRole("button", { name: "Sauvegarder", exact: true }).click();

    await expect.poll(() => api.profiles.get(profileId)?.revision).toBe(2);
    expect(api.profiles.get(profileId)?.phone).toBe("+213 555 200 200");
    expect(api.profiles.get(profileId)?.updatedBy.username).toBe("editeur");

    await editorPage.getByRole("button", { name: "Base de données", exact: true }).click();
    const historyDatabase = editorPage.getByRole("dialog", { name: /Base de données clients/ });
    const historyRow = historyDatabase.locator("article").filter({ hasText: "Client E2E partagé" });
    await historyRow.getByRole("button", { name: "Historique" }).click();
    await expect(historyRow.getByText("Timeline des modifications")).toBeVisible();
    await expect(historyRow.getByLabel("Version de départ")).toHaveValue("1");
    await expect(historyRow.getByLabel("Version d’arrivée")).toHaveValue("2");
    await historyRow.getByRole("button", { name: "Comparer", exact: true }).click();
    const comparison = historyRow.getByRole("region", { name: "Résultat de la comparaison" });
    await expect(comparison.getByText("Révision 1 → révision 2")).toBeVisible();
    await expect(comparison.getByText("CV › Français › Téléphone", { exact: true })).toBeVisible();
    await expect(comparison.getByText("+213 555 100 100", { exact: true })).toBeVisible();
    await expect(comparison.getByText("+213 555 200 200", { exact: true })).toBeVisible();
    await historyDatabase.getByRole("button", { name: "Close" }).click();

    api.offlineUsers.add("editeur");
    await editorPage.getByPlaceholder("+1 514 000 0000").fill("+213 555 300 300");
    await editorPage.getByRole("button", { name: "Sauvegarder", exact: true }).click();
    await expect(editorPage.getByText("1 cloud en attente")).toBeVisible();
    api.offlineUsers.delete("editeur");
    await editorPage.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect.poll(() => api.profiles.get(profileId)?.revision).toBe(3);
    await expect(editorPage.getByText("1 cloud en attente")).toBeHidden();
    expect(api.profiles.get(profileId)?.phone).toBe("+213 555 300 300");

    await adminPage.getByPlaceholder("+1 514 000 0000").fill("+213 555 999 999");
    await adminPage.getByRole("button", { name: "Sauvegarder", exact: true }).click();
    const conflictStatus = adminPage.getByRole("status").filter({ hasText: /^Conflit$/ });
    await expect(conflictStatus).toBeVisible();
    await expect(conflictStatus).toHaveAttribute(
      "title",
      /Conflit avec la révision 3 modifiée par Éditeur E2E/,
    );
    expect(api.profiles.get(profileId)?.phone).toBe("+213 555 300 300");
    expect(api.profiles.get(profileId)?.revision).toBe(3);

    await editorPage.getByRole("button", { name: "Base de données", exact: true }).click();
    const editorWorkflowDatabase = editorPage.getByRole("dialog", {
      name: /Base de données clients/,
    });
    const editorWorkflowRow = editorWorkflowDatabase
      .locator("article")
      .filter({ hasText: "Client E2E partagé" });
    await expect(editorWorkflowRow.getByText("Brouillon", { exact: true })).toBeVisible();
    editorPage.once("dialog", (dialog) => dialog.accept());
    await editorWorkflowRow.getByRole("button", { name: "Soumettre" }).click();
    await expect.poll(() => api.profiles.get(profileId)?.workflowStatus).toBe("review");
    await expect(editorWorkflowRow.getByText("À valider", { exact: true })).toBeVisible();
    await expect(editorWorkflowDatabase.getByRole("button", { name: /1 À valider/ })).toBeVisible();
    await editorWorkflowRow
      .getByLabel("Responsable de validation pour Client E2E partagé")
      .selectOption("editeur");
    await expect
      .poll(() => api.profiles.get(profileId)?.workflowAssignee?.username)
      .toBe("editeur");
    await expect(editorWorkflowRow.getByText(/Responsable : Éditeur E2E/)).toBeVisible();
    editorPage.once("dialog", (dialog) => dialog.accept());
    await editorWorkflowRow.getByRole("button", { name: "Valider" }).click();
    await expect.poll(() => api.profiles.get(profileId)?.workflowStatus).toBe("approved");
    await expect(editorWorkflowRow.getByText("Validé", { exact: true })).toBeVisible();
    await editorWorkflowDatabase.getByRole("button", { name: "Close" }).click();

    await expect(editorPage.getByText(/CV validé et verrouillé/).first()).toBeVisible();
    await expect(
      editorPage.getByRole("button", { name: "Sauvegarder", exact: true }),
    ).toBeDisabled();
    expect(api.profiles.get(profileId)?.phone).toBe("+213 555 300 300");

    await editorPage.getByRole("button", { name: "Base de données", exact: true }).click();
    const reopenDatabase = editorPage.getByRole("dialog", { name: /Base de données clients/ });
    const reopenRow = reopenDatabase.locator("article").filter({ hasText: "Client E2E partagé" });
    editorPage.once("dialog", async (dialog) => {
      await dialog.accept("Mettre à jour les coordonnées du client.");
    });
    await reopenRow.getByRole("button", { name: "Rouvrir" }).click();
    await expect.poll(() => api.profiles.get(profileId)?.workflowStatus).toBe("draft");
    await expect(reopenRow.getByText("Brouillon", { exact: true })).toBeVisible();
    await expect(reopenRow.getByText(/Mettre à jour les coordonnées du client\./)).toBeVisible();
    await reopenDatabase.getByRole("button", { name: "Close" }).click();
    await editorPage.getByPlaceholder("+1 514 000 0000").fill("+213 555 888 888");
    await editorPage.getByRole("button", { name: "Sauvegarder", exact: true }).click();
    await expect.poll(() => api.profiles.get(profileId)?.phone).toBe("+213 555 888 888");
  } finally {
    await adminContext.close();
    await editorContext.close();
  }
});
