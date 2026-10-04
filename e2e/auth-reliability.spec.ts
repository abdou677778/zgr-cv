import { expect, test, type BrowserContext, type Route } from "@playwright/test";

const authenticatedUser = {
  username: "admin",
  displayName: "Administrateur test",
  role: "admin",
  workflowManager: true,
  permissions: {
    clientsRead: true,
    clientsWrite: true,
    clientsApprove: true,
    clientsDelete: true,
    clientsRestore: true,
    clientsDownload: true,
    aiUse: true,
    manageUsers: true,
  },
  active: true,
  createdAt: "2026-10-04T00:00:00.000Z",
  updatedAt: "2026-10-04T00:00:00.000Z",
  lastLoginAt: "2026-10-04T00:00:00.000Z",
  loginCount: 1,
};

async function installApi(context: BrowserContext, loginStatus = 200) {
  await context.route("**/api/**", async (route: Route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/auth/login") {
      if (loginStatus !== 200) {
        await route.fulfill({
          status: loginStatus,
          contentType: "application/json",
          body: JSON.stringify({
            error:
              loginStatus === 429
                ? "Trop de tentatives. Réessayez dans quelques minutes."
                : "Identifiants incorrects.",
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          token: "eyJleHAiOjQxMDI0NDQ4MDB9.signature",
          user: authenticatedUser,
        }),
      });
      return;
    }
    if (url.pathname === "/api/auth/session") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, user: authenticatedUser }),
      });
      return;
    }
    if (url.pathname === "/api/clients") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ profiles: [], nextCursor: null }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

test("accepte un mot de passe rempli par le navigateur sans événement React", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await installApi(context);
  const page = await context.newPage();
  try {
    await page.goto("/?login=admin");
    await page.getByLabel("Mot de passe").evaluate((input: HTMLInputElement) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "e2e-password");
    });
    const submit = page.getByRole("button", { name: "Se connecter" });
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.getByRole("button", { name: "Sauvegarder client" })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("ouvre une session même lorsque le navigateur bloque les stockages Web", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    for (const method of ["getItem", "setItem", "removeItem"] as const) {
      Object.defineProperty(Storage.prototype, method, {
        configurable: true,
        value() {
          throw new DOMException("Storage disabled by privacy mode", "SecurityError");
        },
      });
    }
  });
  await installApi(context);
  const page = await context.newPage();
  try {
    await page.goto("/?login=admin");
    await page.getByLabel("Mot de passe").fill("e2e-password");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByRole("button", { name: "Sauvegarder client" })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("rend la main et explique clairement une limitation temporaire", async ({ browser }) => {
  const context = await browser.newContext();
  await installApi(context, 429);
  const page = await context.newPage();
  try {
    await page.goto("/?login=admin");
    await page.getByLabel("Mot de passe").fill("incorrect-password");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByRole("alert")).toContainText("Trop de tentatives");
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeEnabled();
  } finally {
    await context.close();
  }
});
