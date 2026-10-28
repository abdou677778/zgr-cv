import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CV_RECEIPT_FOLDER_ID,
  cvReceiptType,
  cvTransactionTotals,
  parseCvAmount,
  validateCvTransaction,
  type CvTransaction,
} from "../../shared/cv-transactions";
import {
  cvTransactionStore,
  CvTransactionError,
} from "../../cv-pro-team-clients/lib/cv-transaction-repository";

const input: CvTransaction = {
  id: "transaction-fixture",
  revision: 0,
  orderId: "CPT-TEST",
  client: "IGNORED",
  date: "2026-10-28",
  admin: "Admin test",
  writer: "Rédactrice test",
  services: ["CV CANADIEN", "LETTRE DE MOTIVATION"],
  amountMinor: 620000,
  currency: "DZD",
  paymentMethod: "BaridiMob",
  receiver: "Bénéficiaire test",
  notes: "TEST",
  voided: false,
  voidReason: "",
};
class Bucket {
  items = new Map<string, { body: string; etag: string }>();
  count = 0;
  async get(key: string) {
    const item = this.items.get(key);
    return item ? { etag: item.etag, text: async () => item.body } : null;
  }
  async put(
    key: string,
    body: string,
    options?: { onlyIf?: { etagMatches?: string; etagDoesNotMatch?: string } },
  ) {
    const old = this.items.get(key);
    if (
      (options?.onlyIf?.etagMatches && old?.etag !== options.onlyIf.etagMatches) ||
      (options?.onlyIf?.etagDoesNotMatch === "*" && old)
    )
      return null;
    const item = { body, etag: String(++this.count) };
    this.items.set(key, item);
    return { etag: item.etag };
  }
  async list({ prefix }: { prefix: string }) {
    return {
      objects: [...this.items.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((key) => ({ key })),
      truncated: false,
    };
  }
}
test("Exact global amounts: TND uses three decimals, no currency conversion or per-service multiplication", () => {
  assert.equal(parseCvAmount("20,125", "TND"), 20125);
  assert.equal(parseCvAmount("20.125", "DZD"), null);
  assert.equal(parseCvAmount("6200", "DZD"), 620000);
  for (const value of ["0", "-1", "1e3", "Infinity", "20,1234", "1.2.3", ""])
    assert.equal(parseCvAmount(value, "TND"), null);
  assert.deepEqual(
    cvTransactionTotals([
      input,
      { ...input, id: "tnd", currency: "TND", amountMinor: 20125 },
      { ...input, id: "void", voided: true },
    ]),
    { DZD: 620000, TND: 20125, USD: 0, MAD: 0 },
  );
});
test("Validation rejects malformed dates, duplicate services and invalid money or cancellation", () => {
  assert.equal(validateCvTransaction(input, input.id).amountMinor, 620000);
  for (const patch of [
    { date: "2026-02-30" },
    { services: ["CV ATS", "cv ats"] },
    { amountMinor: 1.1 },
    { currency: "EUR" },
    { receiver: "" },
    { voided: true, voidReason: "" },
    { paymentMethod: "<script>" },
  ])
    assert.throws(() => validateCvTransaction({ ...input, ...patch }, input.id));
  const checked = validateCvTransaction(
    { ...input, receipt: { url: "https://evil.test" }, createdBy: "spoof" },
    input.id,
  );
  assert.equal(checked.createdBy, undefined);
  assert.equal(checked.receipt, undefined);
});
test("Ledger is isolated, version guarded, audited, linked to a real CV order and never modifies that order", async () => {
  const bucket = new Bucket();
  const store = cvTransactionStore(bucket);
  const order = { id: input.orderId, clientName: "Client vérifié" };
  await assert.rejects(
    () => store.save(input.id, input, "admin", null),
    (e) => e instanceof CvTransactionError && e.status === 404,
  );
  const saved = await store.save(input.id, input, "actual-admin", order);
  assert.equal(saved.client, "Client vérifié");
  assert.equal(saved.createdBy, "actual-admin");
  assert.equal(saved.revision, 1);
  await assert.rejects(
    () => store.save(input.id, input, "admin", order),
    (e) => e instanceof CvTransactionError && e.status === 409,
  );
  const updated = await store.save(input.id, { ...saved, amountMinor: 570000 }, "admin2", order);
  assert.equal(updated.amountMinor, 570000);
  assert.equal((await store.list()).length, 1);
  assert.ok([...bucket.items.keys()].some((k) => k.startsWith("cv-transactions/v1/history/")));
  assert.ok([...bucket.items.keys()].every((k) => k.startsWith("cv-transactions/v1/")));
  const voided = await store.save(
    input.id,
    { ...updated, voided: true, voidReason: "Erreur technique" },
    "admin",
    order,
  );
  assert.equal(cvTransactionTotals([voided]).DZD, 0);
  const restored = await store.save(input.id, { ...voided, voided: false }, "admin", order);
  assert.equal(cvTransactionTotals([restored]).DZD, 570000);
});
test("Receipt upload failure preserves the saved ledger and previous Drive reference; successful references are privately audited", async () => {
  const bucket = new Bucket(),
    store = cvTransactionStore(bucket);
  await store.save(input.id, input, "admin", { id: input.orderId, clientName: "Fixture" });
  const receipt = await store.uploadReceipt(input.id, "admin", async () => ({
    fileId: "fixture-id",
    url: "https://drive.google.com/file/d/fixture-id/view",
    name: "fixture.png",
  }));
  assert.equal(receipt.uploadedBy, "admin");
  await assert.rejects(() =>
    store.uploadReceipt(input.id, "admin", async () => {
      throw Error("Drive unavailable");
    }),
  );
  assert.equal((await store.list())[0].receipt?.fileId, "fixture-id");
  assert.equal((await store.get(input.id))?.record.revision, 1);
  assert.ok([...bucket.items.values()].every((item) => !item.body.includes("data:image")));
  assert.ok([...bucket.items.keys()].some((k) => k.includes("/receipt-history/")));
});
test("Receipt type checks file signatures and Drive uses only the chosen private folder, with no sharing changes", () => {
  assert.equal(
    cvReceiptType(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])),
    "image/png",
  );
  assert.equal(cvReceiptType(new TextEncoder().encode("<svg>not a photo</svg>")), null);
  assert.equal(cvReceiptType(new Uint8Array(5 * 1024 * 1024 + 1)), null);
  assert.equal(CV_RECEIPT_FOLDER_ID, "1rIuoWe9T84QHVkNfjicfOOYnBOapLqxR");
  const code = readFileSync(
    new URL("../../cv-pro-team-clients/lib/google-drive.ts", import.meta.url),
    "utf8",
  );
  const upload = code.slice(
    code.indexOf("export async function uploadCvPaymentReceipt"),
    code.indexOf("async function accessToken"),
  );
  assert.match(upload, /inspectCvReceiptFolder\(\)/);
  assert.match(upload, /parents: \[CV_RECEIPT_FOLDER_ID\]/);
  assert.doesNotMatch(upload, /ensurePrivateLinkSharing|FILES\.put|permissions.*POST/);
});
