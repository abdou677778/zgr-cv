#!/usr/bin/env node

import { createHash } from "node:crypto";
import { access, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

const DEFAULT_PORTAL_URL = "https://cv-pro-team-clients.zgrcv-wizi.workers.dev";
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_ORDER_BYTES = 500 * 1024 * 1024;
const MAX_ARCHIVE_FILES = 500;
const ARCHIVE_FIRST_YEAR = 2022;
const ARCHIVE_LAST_YEAR = 2025;
const DRIVE_SYNC_BATCH_SIZE = 10;

const sourceContainerPatterns = [
  /(?:^|\b)waiting\s+for\s+payment(?:\b|$)/i,
  /(?:^|\b)en\s+attente\s+(?:du\s+)?paiement(?:\b|$)/i,
  /(?:^|\b)unpaid(?:\b|$)/i,
  /(?:^|\b)rejected?(?:\b|$)/i,
  /(?:^|\b)orders?(?:\b|$)/i,
];

const excludedSourcePatterns = [
  {
    reason: "WAITING_PAYMENT",
    pattern: /(?:waiting\s+for\s+payment|en\s+attente\s+(?:du\s+)?paiement|unpaid)/i,
  },
  { reason: "REJECTED", pattern: /(?:^|[/\\\s_-])rejected?(?:$|[/\\\s_-])/i },
  { reason: "CANCELLED", pattern: /(?:annul(?:e|é|er|ée)?|cancel(?:led|ed)?)/i },
];

function usage() {
  return `Migration OneDrive -> Archives ZGR -> Google Drive

Étape 1 — inventaire sans écriture externe :
  node scripts/migrate-onedrive-archives.mjs scan \\
    --source "onedrive:01 - ABDOU" \\
    --manifest ".zgr-migrations/archive-2022-2025.json"

Un inventaire rclone déjà exporté peut aussi être utilisé :
  node scripts/migrate-onedrive-archives.mjs scan \\
    --source "onedrive:01 - ABDOU" --inventory "rclone-lsjson.json" \\
    --manifest ".zgr-migrations/archive-2022-2025.json"

Étape 2 — contrôle seulement (aucun import) :
  node scripts/migrate-onedrive-archives.mjs migrate \\
    --manifest ".zgr-migrations/archive-2022-2025.json"

Validation automatique des dates à confiance élevée ou moyenne :
  node scripts/migrate-onedrive-archives.mjs approve-dates \\
    --manifest ".zgr-migrations/archive-2022-2025.json" \\
    --confidence "HIGH,MEDIUM"

Application de décisions manuelles documentées :
  node scripts/migrate-onedrive-archives.mjs apply-date-decisions \\
    --manifest ".zgr-migrations/archive-2022-2025.json" \\
    --decisions ".zgr-migrations/archive-date-decisions.json"

Étape 3 — copie réelle, reprenable et non destructive :
  $env:ZGR_ARCHIVE_ADMIN_TOKEN="..."
  node scripts/migrate-onedrive-archives.mjs migrate \\
    --manifest ".zgr-migrations/archive-2022-2025.json" \\
    --execute --accept-inferred-dates

Options :
  --rclone <chemin>       Exécutable rclone (défaut : rclone)
  --portal-url <url>      API du portail client
  --actor <nom>           Auteur affiché dans l’historique
  --execute               Autorise les écritures API/Drive
  --accept-inferred-dates Accepte la date déduite du plus ancien fichier
  --only-confirmed        Migre uniquement les clients dont la date est confirmée
  --continue-on-error     Continue avec le client suivant après une erreur
  --review-report <csv>   Rapport CSV des dates et exclusions à vérifier

Les jetons ne doivent jamais être placés dans le manifeste ni dans Git.`;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (!argument.startsWith("--")) throw new Error(`Argument inattendu : ${argument}`);
    const key = argument.slice(2);
    if (
      ["execute", "accept-inferred-dates", "only-confirmed", "continue-on-error", "help"].includes(
        key,
      )
    ) {
      options[key] = true;
      continue;
    }
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Valeur manquante pour --${key}`);
    options[key] = value;
    index += 1;
  }
  return { command, options };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizePath(value) {
  return String(value || "")
    .replaceAll("\\", "/")
    .split("/")
    .filter((part) => part && part !== ".")
    .join("/");
}

function sourceItemPath(item) {
  return normalizePath(item.Path || item.path || item.Name || item.name);
}

function isSourceContainer(segment) {
  return sourceContainerPatterns.some((pattern) => pattern.test(segment));
}

function clientPathParts(segments) {
  let clientIndex = 0;
  while (clientIndex < segments.length - 2 && isSourceContainer(segments[clientIndex])) {
    clientIndex += 1;
  }
  return {
    sourceFolder: segments.slice(0, clientIndex + 1).join("/"),
    clientFolder: segments[clientIndex],
    relativePath: segments.slice(clientIndex + 1).join("/"),
  };
}

function sourceEligibility(sourceFolder) {
  const exclusion = excludedSourcePatterns.find(({ pattern }) => pattern.test(sourceFolder));
  return exclusion
    ? { eligibility: "excluded", exclusionReason: exclusion.reason }
    : { eligibility: "eligible", exclusionReason: "" };
}

function itemModifiedAt(item) {
  const value = item.ModTime || item.modTime || item.ModifiedTime || item.modifiedTime;
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : "";
}

function inferCategory(relativePath, mimeType = "") {
  const normalized = relativePath.toLocaleLowerCase("fr");
  const extension = extname(normalized).slice(1);
  const segments = normalized.split("/").filter(Boolean);
  if (segments.some((segment) => /^infos?$/.test(segment)) || extension === "txt") {
    return "INFOS_CLIENT";
  }
  if (
    segments.some((segment) => /^pdfs?$/.test(segment)) ||
    ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(extension)
  ) {
    return "LIVRABLE_HISTORIQUE";
  }
  if (
    String(mimeType).startsWith("image/") ||
    ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(extension) ||
    /(?:screenshot|capture|facebook|messenger|profile|profil|photo[_-]?\d)/i.test(normalized)
  ) {
    return "CAPTURE_FACEBOOK";
  }
  return "AUTRES_ARCHIVES";
}

function inferServices(text) {
  const value = text.toLocaleLowerCase("fr");
  const services = [];
  if (/europass/.test(value)) services.push("CV_EUROPASS");
  if (/canad(?:a|ian|ien)/.test(value)) services.push("CV_CANADIEN");
  if (/(?:^|[^a-z])ats(?:[^a-z]|$)/.test(value)) services.push("CV_ATS");
  if (/cv\s*(?:arabe|arabic)/.test(value)) services.push("CV_ARABE");
  if (
    /(?:cover|lettre).*(?:eng|anglais|english)|(?:eng|anglais|english).*(?:cover|lettre)/.test(
      value,
    )
  ) {
    services.push("LETTRE_ENG");
  }
  if (/(?:cover|lettre)/.test(value) && !services.includes("LETTRE_ENG"))
    services.push("LETTRE_FR");
  return services.length ? [...new Set(services)] : ["AUTRE"];
}

function inferClientName(folderName) {
  const withoutStatus = folderName.replace(
    /^\s*(?:annul(?:e|é|er|ée)?|cancel(?:led|ed)?)\s*[-_.:]\s*/i,
    "",
  );
  const withoutIndex = withoutStatus.replace(/^\s*\d{1,3}\s*(?:[-_.:]\s*)?/, "").trim();
  const parts = withoutIndex.split(/\s+-\s+/);
  const serviceStart = parts.findIndex(
    (part, index) =>
      index > 0 && /\b(?:cv|europass|canadian|canadien|ats|cover|lettre|ready|done)\b/i.test(part),
  );
  return (serviceStart > 0 ? parts.slice(0, serviceStart).join(" - ") : withoutIndex).slice(0, 120);
}

function mimeFromName(name, supplied = "") {
  if (supplied) return supplied;
  const extension = extname(name).toLowerCase();
  return (
    {
      ".pdf": "application/pdf",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".ppt": "application/vnd.ms-powerpoint",
      ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ".xls": "application/vnd.ms-excel",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".txt": "text/plain",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".heic": "image/heic",
      ".heif": "image/heif",
    }[extension] || "application/octet-stream"
  );
}

function run(command, args, { capture = true } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    const stdout = [];
    const stderr = [];
    child.stdout?.on("data", (chunk) => stdout.push(chunk));
    child.stderr?.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => rejectPromise(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise(Buffer.concat(stdout).toString("utf8"));
        return;
      }
      rejectPromise(
        new Error(
          `${command} a échoué (${code ?? "inconnu"}) : ${Buffer.concat(stderr)
            .toString("utf8")
            .trim()
            .slice(0, 1000)}`,
        ),
      );
    });
  });
}

async function readInventory(options) {
  if (options.inventory) return JSON.parse(await readFile(resolve(options.inventory), "utf8"));
  const rclone = options.rclone || "rclone";
  return JSON.parse(
    await run(rclone, [
      "lsjson",
      options.source,
      "--recursive",
      "--files-only",
      "--hash",
      "--metadata",
    ]),
  );
}

function buildManifest(items, source) {
  if (!Array.isArray(items)) throw new Error("L’inventaire rclone doit être un tableau JSON.");
  const clientsByFolder = new Map();
  const ignoredRootFiles = [];
  const skippedFiles = [];
  for (const item of items) {
    if (item.IsDir || item.isDir) continue;
    const path = sourceItemPath(item);
    const segments = path.split("/").filter(Boolean);
    if (segments.length < 2) {
      ignoredRootFiles.push(path);
      continue;
    }
    if (Number(item.Size ?? item.size ?? 0) <= 0) {
      skippedFiles.push({
        sourcePath: path,
        reason: "EMPTY_FILE",
        sizeBytes: Number(item.Size ?? item.size ?? 0),
        modifiedAt: itemModifiedAt(item),
      });
      continue;
    }
    const { sourceFolder, clientFolder, relativePath } = clientPathParts(segments);
    const file = {
      sourcePath: path,
      relativePath,
      name: segments.at(-1),
      sizeBytes: Number(item.Size ?? item.size ?? 0),
      modifiedAt: itemModifiedAt(item),
      mimeType: mimeFromName(segments.at(-1), item.MimeType || item.mimeType || ""),
      category: inferCategory(relativePath, item.MimeType || item.mimeType || ""),
      hashes: item.Hashes || item.hashes || {},
      status: "pending",
    };
    const existing = clientsByFolder.get(sourceFolder) || [];
    existing.push(file);
    clientsByFolder.set(sourceFolder, existing);
  }

  const clients = [...clientsByFolder.entries()]
    .map(([sourceFolder, files]) => {
      files.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath, "fr"));
      const validDates = files
        .map((file) => file.modifiedAt)
        .filter(Boolean)
        .sort();
      const inferredDate = validDates[0]?.slice(0, 10) || "";
      const dateSpanDays =
        validDates.length > 1
          ? Math.round(
              ((new Date(validDates.at(-1)).getTime() - new Date(validDates[0]).getTime()) /
                (24 * 60 * 60 * 1000)) *
                10,
            ) / 10
          : 0;
      const dateConfidence = dateSpanDays <= 1 ? "HIGH" : dateSpanDays <= 31 ? "MEDIUM" : "LOW";
      const clientFolder = sourceFolder.split("/").at(-1) || sourceFolder;
      const eligibility = sourceEligibility(sourceFolder);
      return {
        migrationKey: `onedrive:${sha256(`${source}\0${sourceFolder}`)}`,
        sourceFolder,
        clientName: inferClientName(clientFolder),
        ...eligibility,
        archiveDate: inferredDate,
        dateSource: inferredDate ? "earliest-file-modified-time" : "missing",
        dateConfidence,
        dateSpanDays,
        dateConfirmed: false,
        email: "",
        phone: "",
        facebookUrl: "",
        language: "fr",
        services: inferServices(
          `${sourceFolder} ${files.map((file) => file.relativePath).join(" ")}`,
        ),
        notes: `Archive importée depuis OneDrive. Dossier source : ${sourceFolder}`,
        totals: {
          files: files.length,
          bytes: files.reduce((sum, file) => sum + file.sizeBytes, 0),
          earliestModifiedAt: validDates[0] || "",
          latestModifiedAt: validDates.at(-1) || "",
        },
        status: eligibility.eligibility === "eligible" ? "pending" : "excluded",
        orderId: "",
        driveFolderId: "",
        files,
      };
    })
    .sort((a, b) => a.clientName.localeCompare(b.clientName, "fr"));

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: { type: "rclone-onedrive", remotePath: source },
    policy: {
      operation: "copy",
      preserveSourceModifiedTime: true,
      deleteSource: false,
      archiveYears: [ARCHIVE_FIRST_YEAR, ARCHIVE_LAST_YEAR],
    },
    ignoredRootFiles,
    skippedFiles,
    clients,
  };
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function writeReviewReport(path, manifest) {
  const header = [
    "dossier_source",
    "client",
    "eligibilite",
    "motif_exclusion",
    "date_proposee",
    "date_confirmee",
    "confiance_date",
    "ecart_dates_jours",
    "date_fichier_plus_ancien",
    "date_fichier_plus_recent",
    "nombre_fichiers",
    "taille_octets",
  ];
  const rows = manifest.clients.map((client) => [
    client.sourceFolder,
    client.clientName,
    client.eligibility,
    client.exclusionReason,
    client.archiveDate,
    client.dateConfirmed,
    client.dateConfidence,
    client.dateSpanDays,
    client.totals.earliestModifiedAt,
    client.totals.latestModifiedAt,
    client.totals.files,
    client.totals.bytes,
  ]);
  await writeFile(
    resolve(path),
    [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n") + "\r\n",
    "utf8",
  );
}

function approveDatesByConfidence(
  manifest,
  allowedConfidences,
  confirmedAt = new Date().toISOString(),
) {
  const allowed = new Set(allowedConfidences.map((value) => String(value).trim().toUpperCase()));
  let approved = 0;
  for (const client of manifest.clients || []) {
    if (
      client.eligibility === "excluded" ||
      client.status === "excluded" ||
      client.dateConfirmed ||
      !allowed.has(String(client.dateConfidence || "").toUpperCase())
    ) {
      continue;
    }
    client.dateConfirmed = true;
    client.dateConfirmation = {
      method: "source-file-metadata-confidence",
      confidence: client.dateConfidence,
      confirmedAt,
    };
    approved += 1;
  }
  return approved;
}

function applyDateDecisions(manifest, decisions, confirmedAt = new Date().toISOString()) {
  if (!Array.isArray(decisions))
    throw new Error("Le fichier de décisions doit contenir un tableau.");
  const clientsBySourceFolder = new Map(
    (manifest.clients || []).map((client) => [client.sourceFolder, client]),
  );
  const seen = new Set();
  let applied = 0;
  for (const decision of decisions) {
    const sourceFolder = String(decision?.sourceFolder || "").trim();
    const archiveDate = String(decision?.archiveDate || "").trim();
    if (!sourceFolder || seen.has(sourceFolder)) {
      throw new Error(`Décision en double ou sans dossier source : ${sourceFolder || "(vide)"}`);
    }
    seen.add(sourceFolder);
    const client = clientsBySourceFolder.get(sourceFolder);
    if (!client) throw new Error(`Dossier introuvable dans le manifeste : ${sourceFolder}`);
    if (client.eligibility === "excluded" || client.status === "excluded") {
      throw new Error(`Le dossier exclu ne peut pas être confirmé : ${sourceFolder}`);
    }
    const parsedDate = new Date(`${archiveDate}T12:00:00.000Z`);
    const year = parsedDate.getUTCFullYear();
    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== archiveDate ||
      year < ARCHIVE_FIRST_YEAR ||
      year > ARCHIVE_LAST_YEAR
    ) {
      throw new Error(`Date manuelle invalide pour ${sourceFolder} : ${archiveDate}`);
    }
    const previousDate = client.archiveDate;
    client.archiveDate = archiveDate;
    client.dateConfirmed = true;
    client.dateConfirmation = {
      method: "manual-source-evidence-review",
      ...(previousDate === archiveDate ? {} : { previousDate }),
      evidence: String(decision.evidence || "Vérification manuelle des métadonnées source").slice(
        0,
        600,
      ),
      confirmedAt,
    };
    applied += 1;
  }
  return applied;
}

async function atomicWriteJson(path, value) {
  const target = resolve(path);
  const temporary = `${target}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, target);
}

function validateClient(client, acceptInferredDates) {
  const issues = [];
  if (client.eligibility === "excluded" || client.status === "excluded") return issues;
  const archiveDate = new Date(`${client.archiveDate}T12:00:00.000Z`);
  const year = archiveDate.getUTCFullYear();
  if (
    Number.isNaN(archiveDate.getTime()) ||
    archiveDate.toISOString().slice(0, 10) !== client.archiveDate ||
    year < ARCHIVE_FIRST_YEAR ||
    year > ARCHIVE_LAST_YEAR
  ) {
    issues.push(`date d’archive invalide (${client.archiveDate || "absente"})`);
  }
  if (!client.dateConfirmed && !acceptInferredDates) {
    issues.push(
      "date non confirmée (mettre dateConfirmed=true ou utiliser --accept-inferred-dates)",
    );
  }
  if (!client.clientName || client.clientName.length < 2) issues.push("nom client absent");
  if (!Array.isArray(client.files) || !client.files.length) issues.push("aucun fichier");
  if (client.files?.length > MAX_ARCHIVE_FILES) {
    issues.push(`${client.files.length} fichiers, limite archive ${MAX_ARCHIVE_FILES}`);
  }
  const totalBytes = client.files?.reduce((sum, file) => sum + Number(file.sizeBytes || 0), 0) || 0;
  if (totalBytes > MAX_ORDER_BYTES) issues.push("taille totale supérieure à 500 Mo");
  for (const file of client.files || []) {
    if (!file.modifiedAt) issues.push(`date source absente : ${file.sourcePath}`);
    if (Number(file.sizeBytes) <= 0) issues.push(`fichier vide : ${file.sourcePath}`);
    if (Number(file.sizeBytes) > MAX_FILE_BYTES)
      issues.push(`fichier > 100 Mo : ${file.sourcePath}`);
  }
  return issues;
}

async function apiRequest(baseUrl, path, token, actor, init = {}, attempts = 4) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const headers = new Headers(init.headers);
    headers.set("x-admin-token", token);
    headers.set("X-ZGR-Actor", actor);
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, { ...init, headers });
    const bodyText = await response.text();
    let body;
    try {
      body = bodyText ? JSON.parse(bodyText) : {};
    } catch {
      body = { error: bodyText.slice(0, 500) };
    }
    if (response.ok) return body;
    if (attempt < attempts && (response.status === 429 || response.status >= 500)) {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 2 ** (attempt - 1) * 1000));
      continue;
    }
    throw new Error(`${response.status} ${body.error || response.statusText}`);
  }
  throw new Error("API indisponible après plusieurs tentatives.");
}

async function createArchive(client, context) {
  const payload = await apiRequest(
    context.portalUrl,
    "/api/admin/orders/archive-create",
    context.token,
    context.actor,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: client.clientName,
        email: client.email || "",
        phone: client.phone || "",
        facebookUrl: client.facebookUrl || "",
        language: client.language || "fr",
        notes: client.notes || "",
        services: client.services?.length ? client.services : ["AUTRE"],
        archiveDate: client.archiveDate,
        migrationKey: client.migrationKey,
      }),
    },
  );
  if (!payload.order?.id)
    throw new Error("La création de l’archive n’a renvoyé aucun identifiant.");
  client.orderId = payload.order.id;
  client.status = "created";
}

async function uploadFile(client, file, context, temporaryDirectory) {
  const safeTemporaryName = `${sha256(file.sourcePath).slice(0, 16)}${extname(file.name)}`;
  const localPath = join(temporaryDirectory, safeTemporaryName);
  const remotePath = `${context.source.replace(/\/$/, "")}/${file.sourcePath}`;
  await run(context.rclone, [
    "copyto",
    remotePath,
    localPath,
    "--retries",
    "5",
    "--low-level-retries",
    "10",
  ]);
  const localStat = await stat(localPath);
  if (localStat.size !== Number(file.sizeBytes)) {
    throw new Error(
      `taille différente pour ${file.sourcePath} (${localStat.size} au lieu de ${file.sizeBytes})`,
    );
  }
  const bytes = await readFile(localPath);
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: file.mimeType }), file.name);
  form.append("category", file.category);
  form.append("sourceModifiedAt", file.modifiedAt);
  form.append("sourceRelativePath", `${client.sourceFolder}/${file.relativePath}`);
  try {
    await apiRequest(
      context.portalUrl,
      `/api/admin/orders/${encodeURIComponent(client.orderId)}/files`,
      context.token,
      context.actor,
      { method: "POST", body: form },
    );
    file.status = "uploaded";
    file.uploadedAt = new Date().toISOString();
  } catch (error) {
    if (/409\s/.test(String(error))) {
      file.status = "duplicate";
      file.uploadedAt = new Date().toISOString();
      return;
    }
    throw error;
  } finally {
    await rm(localPath, { force: true });
  }
}

async function syncDrive(client, context, onProgress) {
  let offset = Number(client.driveSyncOffset || 0);
  for (;;) {
    const payload = await apiRequest(
      context.portalUrl,
      `/api/admin/orders/${encodeURIComponent(client.orderId)}/sync-drive?offset=${offset}&batchSize=${DRIVE_SYNC_BATCH_SIZE}`,
      context.token,
      context.actor,
      { method: "POST" },
    );
    client.driveFolderId = payload.driveFolderId || client.driveFolderId || "";
    if (payload.complete !== false) {
      delete client.driveSyncOffset;
      client.status = "completed";
      client.completedAt = new Date().toISOString();
      await onProgress();
      return;
    }
    const nextOffset = Number(payload.nextOffset);
    if (!Number.isInteger(nextOffset) || nextOffset <= offset) {
      throw new Error("La synchronisation Google Drive n’a pas renvoyé un curseur valide.");
    }
    offset = nextOffset;
    client.driveSyncOffset = offset;
    await onProgress();
  }
}

async function scanCommand(options) {
  if (!options.source) throw new Error("--source est obligatoire.");
  const manifestPath = resolve(options.manifest || ".zgr-migrations/archive-2022-2025.json");
  await access(dirname(manifestPath)).catch(async () => {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(dirname(manifestPath), { recursive: true });
  });
  const inventory = await readInventory(options);
  const manifest = buildManifest(inventory, options.source);
  await atomicWriteJson(manifestPath, manifest);
  const reviewReportPath = resolve(
    options["review-report"] || manifestPath.replace(/\.json$/i, ".review.csv"),
  );
  await writeReviewReport(reviewReportPath, manifest);
  const fileCount = manifest.clients.reduce((sum, client) => sum + client.files.length, 0);
  const eligibleCount = manifest.clients.filter(
    (client) => client.eligibility === "eligible",
  ).length;
  const excludedCount = manifest.clients.length - eligibleCount;
  console.log(`Inventaire créé : ${manifestPath}`);
  console.log(`Rapport de contrôle : ${reviewReportPath}`);
  console.log(
    `${eligibleCount} client(s) éligible(s), ${excludedCount} exclu(s), ${fileCount} fichier(s).`,
  );
  if (manifest.skippedFiles.length) {
    console.log(
      `${manifest.skippedFiles.length} fichier(s) vide(s) isolé(s) et non importable(s).`,
    );
  }
  if (manifest.ignoredRootFiles.length) {
    console.log(`${manifest.ignoredRootFiles.length} fichier(s) à la racine ignoré(s).`);
  }
  console.log("Aucune donnée n’a été envoyée. Vérifiez les noms, services et dates avant migrate.");
}

async function approveDatesCommand(options) {
  if (!options.manifest) throw new Error("--manifest est obligatoire.");
  const manifestPath = resolve(options.manifest);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.clients)) {
    throw new Error("Format de manifeste non pris en charge.");
  }
  const confidences = String(options.confidence || "HIGH,MEDIUM")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  if (
    !confidences.length ||
    confidences.some((value) => !["HIGH", "MEDIUM", "LOW"].includes(value))
  ) {
    throw new Error("--confidence doit contenir HIGH, MEDIUM ou LOW.");
  }
  const approved = approveDatesByConfidence(manifest, confidences);
  await atomicWriteJson(manifestPath, manifest);
  const reviewReportPath = resolve(
    options["review-report"] || manifestPath.replace(/\.json$/i, ".review.csv"),
  );
  await writeReviewReport(reviewReportPath, manifest);
  console.log(`${approved} date(s) confirmée(s) pour les niveaux ${confidences.join(", ")}.`);
  console.log(`Rapport actualisé : ${reviewReportPath}`);
}

async function applyDateDecisionsCommand(options) {
  if (!options.manifest || !options.decisions) {
    throw new Error("--manifest et --decisions sont obligatoires.");
  }
  const manifestPath = resolve(options.manifest);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const decisions = JSON.parse(await readFile(resolve(options.decisions), "utf8"));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.clients)) {
    throw new Error("Format de manifeste non pris en charge.");
  }
  const applied = applyDateDecisions(manifest, decisions);
  await atomicWriteJson(manifestPath, manifest);
  const reviewReportPath = resolve(
    options["review-report"] || manifestPath.replace(/\.json$/i, ".review.csv"),
  );
  await writeReviewReport(reviewReportPath, manifest);
  console.log(`${applied} décision(s) manuelle(s) appliquée(s).`);
  console.log(`Rapport actualisé : ${reviewReportPath}`);
}

async function migrateCommand(options) {
  if (!options.manifest) throw new Error("--manifest est obligatoire.");
  const manifestPath = resolve(options.manifest);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.clients)) {
    throw new Error("Format de manifeste non pris en charge.");
  }
  const allEligibleClients = manifest.clients.filter(
    (client) => client.eligibility !== "excluded" && client.status !== "excluded",
  );
  const eligibleClients = options["only-confirmed"]
    ? allEligibleClients.filter((client) => client.dateConfirmed)
    : allEligibleClients;
  const deferredUnconfirmedCount = allEligibleClients.length - eligibleClients.length;
  const validation = eligibleClients.flatMap((client) =>
    validateClient(client, true).map((issue) => `${client.sourceFolder}: ${issue}`),
  );
  const pendingDateConfirmations = options["accept-inferred-dates"]
    ? []
    : eligibleClients.filter((client) => !client.dateConfirmed);
  const excludedCount = manifest.clients.length - allEligibleClients.length;
  console.log(
    `${eligibleClients.length} client(s) éligible(s) à contrôler, ${excludedCount} exclu(s), ${deferredUnconfirmedCount} reporté(s).`,
  );
  if (validation.length) {
    console.error(
      validation
        .slice(0, 100)
        .map((issue) => `- ${issue}`)
        .join("\n"),
    );
  }
  if (pendingDateConfirmations.length) {
    console.error(
      `${pendingDateConfirmations.length} date(s) restent à confirmer dans le rapport CSV ou le manifeste.`,
    );
  }
  if (validation.length || pendingDateConfirmations.length) {
    throw new Error(
      `${validation.length} anomalie(s) technique(s) et ${pendingDateConfirmations.length} date(s) non confirmée(s) bloquent la migration.`,
    );
  }
  if (!options.execute) {
    console.log(
      "Contrôle réussi. Aucune écriture effectuée (ajoutez --execute pour lancer la copie). ",
    );
    return;
  }
  const token = process.env.ZGR_ARCHIVE_ADMIN_TOKEN?.trim();
  if (!token)
    throw new Error("La variable ZGR_ARCHIVE_ADMIN_TOKEN est obligatoire avec --execute.");
  const source = manifest.source?.remotePath;
  if (!source) throw new Error("Chemin source absent du manifeste.");
  const context = {
    token,
    source,
    rclone: options.rclone || "rclone",
    portalUrl: options["portal-url"] || DEFAULT_PORTAL_URL,
    actor: (options.actor || "migration-onedrive").slice(0, 64),
  };
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "zgr-archive-"));
  const resolvedTemp = resolve(temporaryDirectory);
  const allowedTempRoot = `${resolve(tmpdir())}${sep}`.toLocaleLowerCase();
  if (
    !resolvedTemp.toLocaleLowerCase().startsWith(allowedTempRoot) ||
    !basename(resolvedTemp).startsWith("zgr-archive-")
  ) {
    throw new Error("Répertoire temporaire inattendu : migration arrêtée.");
  }
  try {
    for (const client of eligibleClients) {
      if (client.status === "completed") {
        console.log(`✓ ${client.clientName} déjà terminé`);
        continue;
      }
      try {
        if (!client.orderId) {
          console.log(`Création : ${client.clientName}`);
          await createArchive(client, context);
          await atomicWriteJson(manifestPath, manifest);
        }
        for (const [index, file] of client.files.entries()) {
          if (["uploaded", "duplicate"].includes(file.status)) continue;
          console.log(`  ${index + 1}/${client.files.length} ${file.relativePath}`);
          await uploadFile(client, file, context, temporaryDirectory);
          await atomicWriteJson(manifestPath, manifest);
        }
        console.log(`Synchronisation Google Drive : ${client.clientName}`);
        await syncDrive(client, context, () => atomicWriteJson(manifestPath, manifest));
        console.log(`✓ ${client.clientName}`);
      } catch (error) {
        client.status = "error";
        client.lastError = error instanceof Error ? error.message : String(error);
        client.lastErrorAt = new Date().toISOString();
        await atomicWriteJson(manifestPath, manifest);
        console.error(`✗ ${client.clientName}: ${client.lastError}`);
        if (!options["continue-on-error"]) throw error;
      }
    }
  } finally {
    await rm(resolvedTemp, { recursive: true, force: true });
  }
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (!command || command === "--help" || command === "-h" || options.help || command === "help") {
    console.log(usage());
    return;
  }
  if (command === "scan") return scanCommand(options);
  if (command === "approve-dates") return approveDatesCommand(options);
  if (command === "apply-date-decisions") return applyDateDecisionsCommand(options);
  if (command === "migrate") return migrateCommand(options);
  throw new Error(`Commande inconnue : ${command}`);
}

export {
  applyDateDecisions,
  approveDatesByConfidence,
  buildManifest,
  clientPathParts,
  sourceEligibility,
  validateClient,
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`Erreur : ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
