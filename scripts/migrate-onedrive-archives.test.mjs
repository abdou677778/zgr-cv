import assert from "node:assert/strict";
import test from "node:test";

import {
  approveDatesByConfidence,
  buildManifest,
  clientPathParts,
  sourceEligibility,
  validateClient,
} from "./migrate-onedrive-archives.mjs";

function inventoryFile(path, size = 128, modified = "2023-08-27T10:30:00.000Z") {
  return {
    Path: path,
    Name: path.split("/").at(-1),
    Size: size,
    ModTime: modified,
    IsDir: false,
    Hashes: { SHA1: `${path}-${size}` },
  };
}

test("les dossiers de statut sont aplatis et exclus de la migration terminée", () => {
  const manifest = buildManifest(
    [
      inventoryFile("01 - Waiting for payment/Ayas's Orders/Client Exemple/INFOS/info.txt"),
      inventoryFile("Rejected/Client Refusé/CV.pdf"),
      inventoryFile("Annuler - Client Annulé/CV.pdf"),
    ],
    "onedrive:archives",
  );

  assert.equal(manifest.clients.length, 3);
  const waiting = manifest.clients.find((client) => client.clientName === "Client Exemple");
  assert.equal(waiting?.sourceFolder, "01 - Waiting for payment/Ayas's Orders/Client Exemple");
  assert.equal(waiting?.eligibility, "excluded");
  assert.equal(waiting?.exclusionReason, "WAITING_PAYMENT");
  assert.equal(validateClient(waiting, false).length, 0);
  assert.equal(
    manifest.clients.find((client) => client.clientName === "Client Refusé")?.exclusionReason,
    "REJECTED",
  );
  assert.equal(
    manifest.clients.find((client) => client.clientName === "Client Annulé")?.exclusionReason,
    "CANCELLED",
  );
});

test("les fichiers vides sont isolés sans bloquer le client", () => {
  const manifest = buildManifest(
    [inventoryFile("Client Valide/INFOS/vide.txt", 0), inventoryFile("Client Valide/CV.pdf", 2048)],
    "onedrive:archives",
  );

  assert.equal(manifest.clients.length, 1);
  assert.equal(manifest.clients[0].files.length, 1);
  assert.equal(manifest.skippedFiles.length, 1);
  assert.equal(manifest.skippedFiles[0].reason, "EMPTY_FILE");
});

test("une archive administrateur de plus de 50 fichiers reste valide jusqu’à 500", () => {
  const files = Array.from({ length: 54 }, (_, index) =>
    inventoryFile(`Client Volumineux/PDF/document-${index + 1}.pdf`),
  );
  const client = buildManifest(files, "onedrive:archives").clients[0];

  assert.equal(client.eligibility, "eligible");
  assert.deepEqual(validateClient(client, true), []);
});

test("les chemins normaux conservent le premier dossier comme client", () => {
  assert.deepEqual(clientPathParts(["Client A", "INFOS", "info.txt"]), {
    sourceFolder: "Client A",
    clientFolder: "Client A",
    relativePath: "INFOS/info.txt",
  });
  assert.deepEqual(sourceEligibility("Client A"), {
    eligibility: "eligible",
    exclusionReason: "",
  });
});

test("la validation automatique ne confirme que les niveaux autorisés", () => {
  const manifest = buildManifest(
    [
      inventoryFile("Client Stable/CV.pdf", 128, "2023-08-27T10:00:00.000Z"),
      inventoryFile("Client Stable/Lettre.pdf", 128, "2023-08-27T12:00:00.000Z"),
      inventoryFile("Client À vérifier/CV.pdf", 128, "2023-01-01T10:00:00.000Z"),
      inventoryFile("Client À vérifier/Lettre.pdf", 128, "2023-05-01T10:00:00.000Z"),
    ],
    "onedrive:archives",
  );

  assert.equal(approveDatesByConfidence(manifest, ["HIGH", "MEDIUM"]), 1);
  assert.equal(
    manifest.clients.find((client) => client.clientName === "Client Stable")?.dateConfirmed,
    true,
  );
  assert.equal(
    manifest.clients.find((client) => client.clientName === "Client À vérifier")?.dateConfirmed,
    false,
  );
});
