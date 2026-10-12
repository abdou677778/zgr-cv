/**
 * Superviseur de migration sans secret sur disque.
 * Le jeton doit être fourni uniquement par l'environnement du processus père.
 */
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const manifest = '.zgr-migrations/archive-06-meriem.json';
const manifestPath = path.join(projectRoot, manifest);
const logPath = path.join(projectRoot, '.zgr-migrations/continuation.stdout.log');
const errorPath = path.join(projectRoot, '.zgr-migrations/continuation.stderr.log');

if (!process.env.ZGR_ARCHIVE_ADMIN_TOKEN?.trim()) {
  throw new Error('Jeton de migration absent : aucun transfert n’a été lancé.');
}

const stamp = () => new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const writeLog = async (line) => appendFile(logPath, `[${stamp()}] ${line}\n`, 'utf8');

function runPass() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [
      'scripts/migrate-onedrive-archives.mjs', 'migrate',
      '--manifest', manifest,
      '--execute', '--only-confirmed', '--actor', 'meriem-redactrice',
      '--continue-on-error', '--expected-drive-root', '12ZWlrOkzQUlW52F1QCU0FaZjxzxwK_Qj',
      '--upload-concurrency', '1',
    ], { cwd: projectRoot, env: process.env, windowsHide: true });
    child.stdout.on('data', (chunk) => appendFile(logPath, chunk));
    child.stderr.on('data', (chunk) => appendFile(errorPath, chunk));
    child.once('error', async (error) => {
      await appendFile(errorPath, `${error.stack || error}\n`, 'utf8');
      resolve(-1);
    });
    child.once('close', (code) => resolve(code ?? -1));
  });
}

function remainingAndDelay(data) {
  const remaining = data.clients.filter((client) =>
    client.dateConfirmed === true &&
    client.eligibility !== 'excluded' &&
    client.status !== 'excluded' &&
    client.status !== 'completed',
  );
  const messages = remaining.map((client) => String(client.lastError || '')).join('\n');
  if (/Worker exceeded resource limits|Racine Google Drive refusée/i.test(messages)) return [remaining, 300];
  if (/synchronisation Google Drive est déjà en cours/i.test(messages)) return [remaining, 180];
  if (/EPERM|EACCES|EBUSY/i.test(messages)) return [remaining, 60];
  return [remaining, 180];
}

await writeFile(path.join(projectRoot, '.zgr-migrations/active-manifest.txt'), `${manifest}\n`, 'utf8');
let pass = 0;
for (;;) {
  pass += 1;
  await writeLog(`Passage resilient ${pass} : reprise des dossiers confirmés non terminés.`);
  const code = await runPass();
  const data = JSON.parse(await readFile(manifestPath, 'utf8'));
  const [remaining, delay] = remainingAndDelay(data);
  if (remaining.length === 0) {
    await writeLog('Terminé : tous les dossiers à date confirmée sont synchronisés.');
    break;
  }
  await writeLog(`${remaining.length} dossier(s) confirmé(s) restent. Code Node : ${code}. Nouvelle tentative dans ${delay} secondes.`);
  await sleep(delay * 1000);
}
