import { expect, test } from "@playwright/test";

test("language logos support selection, local import and admin cloud replacement", async ({ page, context }) => {
  const user = { username: "admin", displayName: "Test", role: "admin", active: true,
    permissions: { clientsRead: true, clientsWrite: true, aiUse: true, manageUsers: true } };
  const logos: Record<string, string> = {};
  let writes = 0;
  await context.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = {};
    if (path === "/api/auth/login") body = { token: "eyJleHAiOjQxMDI0NDQ4MDB9.signature", user };
    if (path === "/api/auth/session") body = { ok: true, user };
    if (path === "/api/clients") body = { profiles: [] };
    if (path === "/api/language-logos") body = { logos };
    if (path.startsWith("/api/language-logos/") && route.request().method() === "PUT") {
      const data = route.request().postDataJSON();
      expect(data.dataUrl).toMatch(/^data:image\/png;base64,/);
      logos[path.split("/").at(-1)!] = data.dataUrl;
      writes++;
      body = { ok: true };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/?login=admin");
  await page.getByLabel("Mot de passe").fill("synthetic-test-password");
  await page.getByRole("button", { name: "Se connecter" }).click();
  const picker = page.getByLabel("Choisir le logo de Français", { exact: true });
  if (!await picker.isVisible()) await page.getByText("Langues", { exact: true }).first().click();
  await expect(picker).toBeVisible();
  await picker.selectOption("en");
  await expect(picker).toHaveValue("en");
  const file = { name: "synthetic.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40"><rect width="60" height="40" fill="blue"/></svg>') };
  await page.getByLabel("Importer un logo local Français", { exact: true }).setInputFiles(file);
  await expect(page.getByText("Logo local appliqué au profil.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Utiliser le logo cloud", exact: true }).click();
  await page.getByLabel("Remplacer le logo cloud Anglais", { exact: true }).first().setInputFiles(file);
  await expect(page.getByText("Logo enregistré dans le cloud partagé.", { exact: true })).toBeVisible();
  expect(writes).toBe(1);
  await expect(picker).toHaveValue("en");
  const dimensions = await page.evaluate(async () => {
    const modulePath = "/src/lib/software-icons-pdf.ts";
    const { pdfLogo } = await import(/* @vite-ignore */ modulePath);
    const source = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect x="20" y="30" width="60" height="40" fill="blue"/></svg>')}`;
    const measure = async (trim: boolean, square = false) => {
      const image = new Image(); image.src = await pdfLogo(source, trim, square); await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    };
    return { cropped: await measure(true), original: await measure(false), square: await measure(true, true) };
  });
  expect(dimensions.original).toEqual([128, 128]);
  expect(dimensions.cropped[0]).toBeLessThan(128);
  expect(dimensions.cropped[0] / dimensions.cropped[1]).toBeCloseTo(1.5, 1);
  expect(dimensions.square[0]).toBe(dimensions.square[1]);
  expect(dimensions.square[0]).toBe(dimensions.cropped[0]);
});
