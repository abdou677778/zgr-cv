import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

for (const scenario of ['identity', 'stale', 'missing'] as const) {
  test(`multilingual record warning: ${scenario}`, async ({ page, context }) => {
    const fixture = JSON.parse(await readFile('test-data/json-multilingue/CV_TEST_GLOBAL_7_LANGUES.json', 'utf8'));
    const documents = fixture.documents;
    if (scenario === 'identity') {
      documents.fr.nom_complet = 'CLIENT SYNTHETIQUE A';
      documents.en.nom_complet = 'CLIENT SYNTHETIQUE B';
    } else if (scenario === 'stale') {
      documents.fr.translation_review = { source_language: 'en' };
    } else {
      delete documents.fr;
    }
    await context.addInitScript(value => {
      localStorage.setItem('zgr-cv-canadien-v1', JSON.stringify({ version: 4, language: 'fr', byLanguage: value }));
    }, documents);
    const user = { username: 'admin', displayName: 'Test', role: 'admin', active: true,
      permissions: { clientsRead: true, clientsWrite: true, aiUse: true, manageUsers: true } };
    await context.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const body = path === '/api/auth/login' ? { token: 'eyJleHAiOjQxMDI0NDQ4MDB9.signature', user }
        : path === '/api/auth/session' ? { ok: true, user } : path === '/api/clients' ? { profiles: [] } : {};
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto('/?login=admin');
    await page.getByLabel('Mot de passe').fill('synthetic-test-password');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    const panel = page.getByRole('complementary', { name: 'État des versions linguistiques' });
    const expected = scenario === 'identity' ? 'Identité du dossier à vérifier avant export'
      : scenario === 'stale' ? 'Cette version est à vérifier après une modification dans une autre langue'
      : 'Cette version linguistique est vide';
    await expect(panel.getByRole('status')).toHaveText(expected);
    await panel.getByText('Voir les contrôles multilingues').click();
    await expect(panel.getByText(/Aucun contenu n’est remplacé automatiquement/)).toBeVisible();
    expect(await panel.innerText()).not.toContain('CLIENT SYNTHETIQUE');
  });
}
