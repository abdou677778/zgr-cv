import { expect, test, type BrowserContext, type Page, type Route } from "@playwright/test";

type TestUser = {
  username: string;
  displayName: string;
  role: "admin" | "user";
  active: true;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
  loginCount: number;
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
  },
  editeur: {
    username: "editeur",
    displayName: "Éditeur E2E",
    role: "user",
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

function tokenFor(username: string) {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3_600, sub: username }),
  ).toString("base64url");
  return `${payload}.e2e-signature`;
}

class SharedClientApi {
  readonly profiles = new Map<string, StoredProfile>();
  readonly sessions = new Map<string, TestUser>();
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
      return this.respond(route, 200, { token, user, expiresAt: Date.now() + 3_600_000 });
    }

    if (url.pathname === "/api/auth/session" && method === "GET") {
      const user = this.authenticatedUser(route);
      return user
        ? this.respond(route, 200, { ok: true, user })
        : this.respond(route, 401, { error: "Session de test expirée." });
    }

    if (!url.pathname.startsWith("/api/clients")) return route.fallback();
    const user = this.authenticatedUser(route);
    if (!user) return this.respond(route, 401, { error: "Session de test absente." });

    if (url.pathname === "/api/clients" && method === "GET") {
      const query = (url.searchParams.get("q") || "").trim().toLocaleLowerCase("fr");
      const owner = url.searchParams.get("owner") || "all";
      const profiles = [...this.profiles.values()]
        .filter((profile) => {
          if (owner === "created" && profile.createdBy.username !== user.username) return false;
          if (owner === "updated" && profile.updatedBy.username !== user.username) return false;
          if (
            owner === "involved" &&
            profile.createdBy.username !== user.username &&
            profile.updatedBy.username !== user.username
          )
            return false;
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
      });
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
      };
      this.profiles.set(id, committed);
      return this.respond(route, 200, {
        ok: true,
        profile: {
          revision: committed.revision,
          createdAt: committed.createdAt,
          updatedAt: committed.updatedAt,
          createdBy: committed.createdBy,
          updatedBy: committed.updatedBy,
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

test("deux navigateurs partagent un client et protègent une modification concurrente", async ({
  browser,
}) => {
  const api = new SharedClientApi();
  const adminContext = await browser.newContext();
  const editorContext = await browser.newContext();

  try {
    const adminPage = await connect(adminContext, api, "admin");
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

    await adminPage.getByPlaceholder("+1 514 000 0000").fill("+213 555 999 999");
    await adminPage.getByRole("button", { name: "Sauvegarder", exact: true }).click();
    const conflictStatus = adminPage.getByRole("status").filter({ hasText: /^Conflit$/ });
    await expect(conflictStatus).toBeVisible();
    await expect(conflictStatus).toHaveAttribute(
      "title",
      /Conflit avec la révision 2 modifiée par Éditeur E2E/,
    );
    expect(api.profiles.get(profileId)?.phone).toBe("+213 555 200 200");
    expect(api.profiles.get(profileId)?.revision).toBe(2);
  } finally {
    await adminContext.close();
    await editorContext.close();
  }
});
