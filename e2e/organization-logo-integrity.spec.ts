import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const arabicName = "جامعة هواري بومدين للعلوم والتكنولوجيا (USTHB)";
test.beforeEach(async ({ page, context }) => {
  const pack = JSON.parse(
    await readFile("test-data/json-multilingue/CV_TEST_GLOBAL_7_LANGUES.json", "utf8"),
  );
  await context.addInitScript((documents) => {
    if (!localStorage.getItem("zgr-cv-canadien-v1"))
      localStorage.setItem(
        "zgr-cv-canadien-v1",
        JSON.stringify({ version: 4, language: "fr", byLanguage: documents }),
      );
  }, pack.documents);
  const user = {
    username: "admin",
    displayName: "Test",
    role: "admin",
    active: true,
    permissions: { clientsRead: true, clientsWrite: true, aiUse: true, manageUsers: true },
  };
  const logo = `data:image/png;base64,${(await readFile("public/organization-logos/dz-1.png")).toString("base64")}`;
  await context.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body =
      path === "/api/auth/login"
        ? { token: "eyJleHAiOjQxMDI0NDQ4MDB9.signature", user }
        : path === "/api/auth/session"
          ? { ok: true, user }
          : path === "/api/clients"
            ? { profiles: [] }
            : path === "/api/organization-logos"
              ? {
                  logos: { "qa-usthb": logo },
                  organizations: [
                    {
                      id: "qa-usthb",
                      name: arabicName,
                      category: "university",
                      domain: "",
                      asset: "",
                    },
                  ],
                }
              : {};
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.goto("/?login=admin");
  await page.getByLabel("Mot de passe").fill("synthetic-test-password");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.getByRole("button", { name: "Exemple", exact: true })).toBeVisible();
});

for (const scenario of [
  { section: "education", label: "Éducation", edit: /^Modifier éducation /, field: "Institution" },
  { section: "training", label: "Formation", edit: /^Modifier formation /, field: "Institution" },
  {
    section: "experience",
    label: "Expérience professionnelle",
    edit: /^Modifier l’expérience /,
    field: "Employeur",
  },
])
  test(`Arabic catalog logo never replaces French text in ${scenario.section}`, async ({
    page,
  }) => {
    await page.getByRole("button", { name: `Déplier ${scenario.label}`, exact: true }).click();
    await page.getByRole("button", { name: scenario.edit }).first().click();
    const section = page.locator(`#cv-editor-section-${scenario.section}`);
    const field =
      scenario.field === "Employeur"
        ? section.locator("input").filter({ hasNot: section.locator("[aria-label]") })
        : section.getByRole("textbox", { name: scenario.field, exact: true });
    // Employer's legacy input has no aria-label; check persisted text as well.
    const before = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("zgr-cv-canadien-v1")!),
    );
    const search = section.getByPlaceholder("Sonatrach, ADE, université…");
    await search.fill("USTHB");
    await page
      .getByRole("button", { name: `Utiliser le logo de ${arabicName}`, exact: true })
      .click();
    await expect(section.getByRole("status")).toContainText("Le nom du document est conservé");
    if (scenario.field === "Institution") await expect(field).not.toHaveValue(arabicName);
    await expect
      .poll(async () =>
        page.evaluate(() => JSON.parse(localStorage.getItem("zgr-cv-canadien-v1")!)),
      )
      .not.toEqual(before);
    const after = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("zgr-cv-canadien-v1")!),
    );
    const key =
      scenario.section === "education"
        ? "educations"
        : scenario.section === "training"
          ? "formations"
          : "experiences";
    const textKey = scenario.field === "Institution" ? "institution" : "employeur";
    for (const language of Object.keys(before.byLanguage)) {
      expect(
        after.byLanguage[language][key].map((row: Record<string, unknown>) => row[textKey]),
      ).toEqual(
        before.byLanguage[language][key].map((row: Record<string, unknown>) => row[textKey]),
      );
    }
    expect(
      after.byLanguage.fr[key].some(
        (row: { logo?: { catalogId: string } }) => row.logo?.catalogId === "qa-usthb",
      ),
    ).toBe(true);
    await expect
      .poll(() =>
        page.evaluate(async (sectionKey) => {
          const path = "/src/lib/client-profile-db.ts";
          const { getWorkspaceDraft } = await import(path);
          const draft = await getWorkspaceDraft("admin");
          return draft?.payload?.cvByLanguage?.fr?.[sectionKey]?.some(
            (row: { logo?: { catalogId: string } }) => row.logo?.catalogId === "qa-usthb",
          );
        }, key),
      )
      .toBe(true);
    await page.reload();
    await expect(page.getByRole("button", { name: "Exemple", exact: true })).toBeVisible();
    const restored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("zgr-cv-canadien-v1")!),
    );
    expect(restored.byLanguage.fr[key]).toEqual(after.byLanguage.fr[key]);
  });

test("empty institution stays empty and a failed logo download preserves existing data", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Déplier Éducation", exact: true }).click();
  await page
    .getByRole("button", { name: /^Modifier éducation / })
    .first()
    .click();
  const section = page.locator("#cv-editor-section-education");
  const institution = section.getByRole("textbox", { name: "Institution", exact: true });
  await institution.fill("");
  const search = section.getByPlaceholder("Sonatrach, ADE, université…");
  await search.fill("USTHB");
  await page
    .getByRole("button", { name: `Utiliser le logo de ${arabicName}`, exact: true })
    .click();
  await expect(section.getByRole("status")).toContainText("Le nom du document est conservé");
  await expect(institution).toHaveValue("");
  const selectedLogo = await section
    .getByRole("img", { name: "Logo organisation", exact: true })
    .getAttribute("src");
  await institution.fill("Nom français à conserver");
  // A catalog entry without an image must not clear an existing selection.
  await search.fill("Sonelgaz");
  await page.getByRole("button", { name: "Utiliser le logo de Sonelgaz", exact: true }).click();
  await expect(section.getByRole("status")).toContainText(
    "le nom et le logo du document sont conservés",
  );
  await expect(institution).toHaveValue("Nom français à conserver");
  await expect(
    section.getByRole("img", { name: "Logo organisation", exact: true }),
  ).toHaveAttribute("src", selectedLogo!);
});

test("fresh PDF loader registers Arabic font for mixed French institution text", async ({
  page,
}) => {
  const fontRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("ArialArabic-")) fontRequests.push(request.url());
  });
  const result = await page.evaluate(async () => {
    const pdfModule = "/src/lib/cv-pdf.ts";
    const typesModule = "/src/lib/cv-types.ts";
    const { createCvPdfBlob } = await import(pdfModule);
    const { emptyCV } = await import(typesModule);
    const cv = {
      ...emptyCV,
      nom_complet: "TEST POLICE",
      educations: [
        {
          id: "qa",
          titre: "Licence en informatique",
          date: "2012 – 2015",
          institution: "جامعة هواري بومدين للعلوم والتكنولوجيا (USTHB)",
          lieu: "Alger, Algérie",
          option: "",
          equivalence: "",
        },
      ],
    };
    const blob = await createCvPdfBlob(cv, "cv-pro-international", "fr");
    return { size: blob.size, signature: await blob.slice(0, 4).text() };
  });
  expect(result.signature).toBe("%PDF");
  expect(result.size).toBeGreaterThan(10000);
  expect(fontRequests.some((url) => url.includes("ArialArabic-Regular"))).toBe(true);
});
