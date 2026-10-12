/**
 * Renouvelle le jeton interne d'administration du portail, puis relance la
 * migration continue sans jamais écrire ce jeton sur le disque.
 *
 * Utilisation : node scripts/rotate-and-resume-archive.mjs
 */
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const token = randomBytes(36).toString('hex');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const wranglerArgs = [
  'wrangler',
  'secret',
  'put',
  'ADMIN_API_TOKEN',
  '--config',
  'cv-pro-team-clients/wrangler.production.jsonc',
];

function runSecretUpdate() {
  return new Promise((resolve, reject) => {
    const child = spawn(npx, wranglerArgs, {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      // Node requires the command shell when launching a .cmd shim on Windows.
      shell: process.platform === 'win32',
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`Cloudflare a refusé le renouvellement du jeton (code ${code}). ${output}`));
    });
    child.stdin.end(`${token}\n`);
  });
}

await runSecretUpdate();

// A migration is never started blindly: confirm that the Worker has accepted
// the newly rotated secret. The response body and token are deliberately not
// logged.
let authenticated = false;
let lastStatus = 0;
for (let attempt = 1; attempt <= 6; attempt += 1) {
  try {
    const response = await fetch('https://cv-pro-team-clients.zgrcv-wizi.workers.dev/api/admin/orders?limit=1', {
      headers: { 'x-admin-token': token },
    });
    lastStatus = response.status;
    if (response.ok) {
      authenticated = true;
      break;
    }
  } catch {
    lastStatus = 0;
  }
  await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
}
if (!authenticated) {
  throw new Error(`Le portail n’a pas accepté le nouveau jeton (HTTP ${lastStatus || 'réseau'}). Migration non lancée.`);
}

const runner = spawn(
  process.execPath,
  [path.join(scriptDir, 'run-archive-06-in-memory.mjs')],
  {
    cwd: projectRoot,
    detached: true,
    windowsHide: true,
    stdio: 'ignore',
    env: { ...process.env, ZGR_ARCHIVE_ADMIN_TOKEN: token },
  },
);
runner.unref();

console.log(`Jeton interne renouvelé. Migration continue relancée (processus ${runner.pid}).`);
