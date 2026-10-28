import { expect, test } from "@playwright/test";

for (const scenario of ["apply", "stale", "invalid"] as const)
  test(`full CV translation ${scenario}`, async ({ page, context }) => {
    await context.route("**/src/lib/ai-client.ts", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: `
    export class AiHttpError extends Error {}
    export async function testAiConnection(){throw Error('Not used in test');}
    export async function runAiJson(settings,system,payload){
      const request=JSON.parse(payload);
      const documents=Object.fromEntries(request.targetLanguages.map(id=>[id,structuredClone(request.source)]));
      for(const id of request.targetLanguages) documents[id].objectif='Translated '+id+' '+request.source.objectif;
      if(${JSON.stringify(scenario)}==='invalid') delete documents.en;
      return {data:{documents},nextSettings:settings};
    }
  `,
      }),
    );
    const user = {
      username: "admin",
      displayName: "Test",
      role: "admin",
      active: true,
      permissions: { clientsRead: true, clientsWrite: true, aiUse: true, manageUsers: true },
    };
    await context.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      const body =
        path === "/api/auth/login"
          ? { token: "eyJleHAiOjQxMDI0NDQ4MDB9.signature", user }
          : path === "/api/auth/session"
            ? { ok: true, user }
            : path === "/api/clients"
              ? { profiles: [] }
              : {};
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });
    await page.goto("/?login=admin");
    await page.getByLabel("Mot de passe").fill("synthetic-test-password");
    await page.getByRole("button", { name: "Se connecter" }).click();
    const panel = page.getByRole("region", { name: "Traduction du CV complet" });
    const generate = panel.getByRole("button", {
      name: "Proposer les six traductions",
      exact: true,
    });
    await expect(generate).toBeDisabled();
    await panel.getByRole("checkbox", { name: /Je confirme que cette source/ }).check();
    await generate.click();
    if (scenario === "invalid") {
      await expect(panel.getByRole("status")).toContainText("Une langue cible manque");
      await expect(
        panel.getByRole("button", { name: "Valider et remplacer les six versions" }),
      ).toHaveCount(0);
      return;
    }
    const apply = panel.getByRole("button", { name: "Valider et remplacer les six versions" });
    await expect(apply).toBeDisabled();
    for (const detail of await panel.locator("details").all()) {
      await detail.locator("summary").click();
      await detail.getByRole("checkbox").check();
    }
    await expect(apply).toBeEnabled();
    if (scenario === "stale") {
      await page
        .getByRole("button", { name: "Déplier Informations personnelles", exact: true })
        .click();
      await page.getByPlaceholder("Nom complet", { exact: true }).fill("SYNTHETIC CHANGED NAME");
      await expect(panel.getByRole("alert")).toContainText("Le dossier ou la source a changé");
      await expect(apply).toBeDisabled();
    } else {
      await apply.click();
      await expect(panel.getByRole("status")).toContainText(
        "Traductions appliquées au brouillon local",
      );
      await expect
        .poll(() =>
          page.evaluate(() => {
            const saved = JSON.parse(localStorage.getItem("zgr-cv-canadien-v1")!);
            return (
              saved.byLanguage.en.objectif.startsWith("Translated en ") &&
              !saved.byLanguage.fr.objectif.startsWith("Translated") &&
              !saved.byLanguage.en.translation_review
            );
          }),
        )
        .toBe(true);
    }
  });
