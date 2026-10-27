import { expect, test } from "@playwright/test";
import { mkdir,writeFile,readFile } from 'node:fs/promises';

test("language logos support selection, local import and admin cloud replacement", async ({ page, context }) => {
  const user = { username: "admin", displayName: "Test", role: "admin", active: true,
    permissions: { clientsRead: true, clientsWrite: true, aiUse: true, manageUsers: true } };
  const logos: Record<string, string> = {};
  let writes = 0;
  await context.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if(path.startsWith('/api/language-flags/')) {
      const file=path.split('/').at(-1)!;
      if(!/^[a-z]{2}(?:-[a-z]{2,3})?\.svg$/.test(file))throw Error('Unexpected fixture flag');
      await route.fulfill({status:200,contentType:'image/svg+xml',body:await readFile(`public/language-flags/${file}`,'utf8')});return;
    }
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
  await page.getByRole('button',{name:'Ajouter dans Langues',exact:true}).click();
  await page.getByLabel('Rechercher une langue',{exact:true}).fill('italien');
  await page.getByRole('button',{name:'Ajouter cette langue',exact:true}).click();
  await page.getByLabel('Niveau italien',{exact:true}).fill('B2');
  const additionalFlag=page.getByLabel('Choisir le logo de italien',{exact:true});
  await expect(additionalFlag).toHaveValue('country-it');
  await page.getByLabel('Rechercher un drapeau italien',{exact:true}).fill('Canada');
  await additionalFlag.selectOption('country-ca');
  await expect(additionalFlag).toHaveValue('country-ca');
  await expect.poll(async()=>page.evaluate(async()=>{
    const path='/src/lib/client-profile-db.ts';
    const {getWorkspaceDraft}=await import(/* @vite-ignore */ path);
    const draft=await getWorkspaceDraft('admin');
    return draft?.payload?.cvByLanguage?.fr?.additional_languages?.[0]?.icon;
  })).toBe('country-ca');
  await page.reload();
  if(!await page.getByLabel('Niveau italien',{exact:true}).isVisible())await page.getByText('Langues',{exact:true}).first().click();
  await expect(page.getByLabel('Niveau italien',{exact:true})).toHaveValue('B2');
  await expect(page.getByLabel('Choisir le logo de italien',{exact:true})).toHaveValue('country-ca');
  const pdfs=await page.evaluate(async()=>{
    const storePath='/src/lib/client-profile-db.ts',pdfPath='/src/lib/cv-pdf.ts';
    const {getWorkspaceDraft}=await import(/* @vite-ignore */ storePath);
    const {createCvPdfBlob}=await import(/* @vite-ignore */ pdfPath);
    const draft=await getWorkspaceDraft('admin');
    const french=draft.payload.cvByLanguage.fr;
    const arabic={...draft.payload.cvByLanguage.ar,additional_languages:french.additional_languages};
    const first=await createCvPdfBlob(french,'cv-pro-international','fr');
    const second=await createCvPdfBlob(arabic,'cv-pro-ar-v3','ar');
    return [Array.from(new Uint8Array(await first.arrayBuffer())),Array.from(new Uint8Array(await second.arrayBuffer()))];
  });
  await mkdir('output/pdf/language-catalog',{recursive:true});
  await writeFile('output/pdf/language-catalog/international-added-language.pdf',Buffer.from(pdfs[0]));
  await writeFile('output/pdf/language-catalog/arabic-added-language.pdf',Buffer.from(pdfs[1]));
  await page.getByRole('button',{name:'Supprimer la langue italien',exact:true}).click();
  await expect(page.getByLabel('Niveau italien',{exact:true})).toHaveCount(0);
});
