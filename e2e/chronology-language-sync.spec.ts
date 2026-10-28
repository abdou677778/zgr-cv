import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";

async function setup(page: Page, context: BrowserContext) {
  const fixture = JSON.parse(
    await readFile("test-data/json-multilingue/CV_TEST_GLOBAL_7_LANGUES.json", "utf8"),
  );
  await context.addInitScript((documents) => {
    if (!localStorage.getItem("zgr-cv-canadien-v1"))
      localStorage.setItem(
        "zgr-cv-canadien-v1",
        JSON.stringify({ version: 4, language: "fr", byLanguage: documents }),
      );
  }, fixture.documents);
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
}
async function switchLanguage(page: Page, name: string) {
  await page.getByRole("button", { name: /^Langue du document :/ }).click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}

test("existing French edit preserves six translations and exposes review in every document language", async ({
  page,
  context,
}) => {
  test.setTimeout(60000);
  await setup(page, context);
  await page
    .getByRole("button", { name: "Déplier Expérience professionnelle", exact: true })
    .click();
  await page
    .getByRole("button", { name: /^Modifier l’expérience / })
    .first()
    .click();
  const before = await page.evaluate(() => {
    const docs = JSON.parse(localStorage.getItem("zgr-cv-canadien-v1")!).byLanguage;
    return {
      id: docs.fr.experiences[0].id,
      titles: Object.fromEntries(
        Object.entries(docs).map(([id, cv]) => [
          id,
          (cv as { experiences: Array<{ titre: string }> }).experiences[0].titre,
        ]),
      ),
    };
  });
  await page.getByRole("textbox", { name: "Titre", exact: true }).fill("MODIFICATION FR CONTRÔLÉE");
  await page.getByRole("button", { name: "Masquer Titre", exact: true }).click();
  await page.getByRole("textbox", { name: "Dates", exact: true }).fill("2010");
  for (const [code, name] of [
    ["en", "English"],
    ["es", "Español"],
    ["de", "Deutsch"],
    ["it", "Italiano"],
    ["zh", "中文"],
    ["ar", "العربية"],
  ]) {
    await switchLanguage(page, name);
    await expect(page.getByRole("button", { name: "Afficher Titre", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("textbox", { name: "Titre", exact: true })).toHaveValue(
      before.titles[code],
    );
    const panel = page.getByRole("region", { name: "Champs à traduire de cet élément" });
    await expect(
      panel.locator(`[data-change-path="experiences.${before.id}.titre"]`),
    ).toContainText("MODIFICATION FR CONTRÔLÉE");
    await expect
      .poll(() =>
        page.evaluate(
          ({ code, id }) => {
            const rows = JSON.parse(localStorage.getItem("zgr-cv-canadien-v1")!).byLanguage[code]
              .experiences;
            return rows.at(-1).id === id && rows.at(-1).chronology.end;
          },
          { code, id: before.id },
        ),
      )
      .toBe("2010");
  }
  await switchLanguage(page, "Français");
  await expect(page.getByRole("textbox", { name: "Titre", exact: true })).toHaveValue(
    "MODIFICATION FR CONTRÔLÉE",
  );
});
for (const scenario of [
  { section: "experiences", heading: "Expérience professionnelle", dateLabel: "Dates" },
  { section: "formations", heading: "Formation", dateLabel: "Date" },
  { section: "educations", heading: "Éducation", dateLabel: "Date" },
])
  test(`real editor add, sort, switch language, edit and reload: ${scenario.section}`, async ({
    page,
    context,
  }) => {
    test.setTimeout(60000);
    await setup(page, context);
    await page
      .getByRole("button", { name: `Ajouter dans ${scenario.heading}`, exact: true })
      .click();
    await page.getByRole("textbox", { name: "Titre", exact: true }).fill("AJOUT TECHNIQUE 2026");
    await page.getByRole("textbox", { name: scenario.dateLabel, exact: true }).fill("2026-09");
    await expect
      .poll(() =>
        page.evaluate((section) => {
          const docs = JSON.parse(localStorage.getItem("zgr-cv-canadien-v1")!).byLanguage;
          return Object.values(docs).every((value) => {
            const cv = value as Record<string, Array<{ id: string; titre: string }>>;
            return (
              cv[section][0].titre === "AJOUT TECHNIQUE 2026" &&
              cv[section][0].id === docs.fr[section][0].id
            );
          });
        }, scenario.section),
      )
      .toBe(true);
    const newId = await page.evaluate(
      (section) =>
        JSON.parse(localStorage.getItem("zgr-cv-canadien-v1")!).byLanguage.fr[section][0].id,
      scenario.section,
    );
    await switchLanguage(page, "English");
    const pending = page.getByRole("region", { name: "Champs à traduire de cet élément" });
    await expect(pending).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Titre", exact: true })).toHaveValue(
      "AJOUT TECHNIQUE 2026",
    );
    await expect(
      pending.locator(`[data-change-path="${scenario.section}.${newId}.titre"]`),
    ).toHaveClass(/bg-red/);
    await page.getByRole("textbox", { name: "Titre", exact: true }).fill("TECHNICAL ADDITION 2026");
    await switchLanguage(page, "Français");
    await expect(page.getByRole("textbox", { name: "Titre", exact: true })).toHaveValue(
      "AJOUT TECHNIQUE 2026",
    );
    await page.getByRole("textbox", { name: "Titre", exact: true }).fill("AJOUT FR MODIFIÉ 2026");
    await page.getByRole("textbox", { name: scenario.dateLabel, exact: true }).fill("2010");
    await switchLanguage(page, "English");
    await expect(page.getByRole("textbox", { name: "Titre", exact: true })).toHaveValue(
      "TECHNICAL ADDITION 2026",
    );
    const titleChange = pending.locator(`[data-change-path="${scenario.section}.${newId}.titre"]`);
    await expect(titleChange).toContainText("AJOUT FR MODIFIÉ 2026");
    await expect
      .poll(() =>
        page.evaluate((section) => {
          const docs = JSON.parse(localStorage.getItem("zgr-cv-canadien-v1")!).byLanguage;
          return Object.values(docs).every((value) => {
            const rows = (value as Record<string, Array<{ id: string }>>)[section];
            return rows.at(-1)?.id === docs.fr[section].at(-1)?.id;
          });
        }, scenario.section),
      )
      .toBe(true);
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const path = "/src/lib/client-profile-db.ts";
          const { getWorkspaceDraft } = await import(/* @vite-ignore */ path);
          const draft = await getWorkspaceDraft("admin");
          return draft?.payload?.language;
        }),
      )
      .toBe("en");
    if (scenario.section === "experiences") {
      await mkdir("output/chronology-review", { recursive: true });
      await pending.screenshot({ path: "output/chronology-review/pending-english-experience.png" });
    }
    await page.reload();
    await expect(page.getByRole("button", { name: "Langue du document : English" })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          ({ section, id }) => {
            const docs = JSON.parse(localStorage.getItem("zgr-cv-canadien-v1")!).byLanguage;
            return docs.en[section].find((row: { id: string }) => row.id === id)?.titre;
          },
          { section: scenario.section, id: newId },
        ),
      )
      .toBe("TECHNICAL ADDITION 2026");
    await expect(
      page.getByRole("region", { name: "Modifications linguistiques à vérifier" }),
    ).toBeVisible();
  });
