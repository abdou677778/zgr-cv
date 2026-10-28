import {
  validateCvTransaction,
  type CvReceipt,
  type CvTransaction,
} from "../../shared/cv-transactions";

const PREFIX = "cv-transactions/v1/";
export class CvTransactionError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
type Bucket = {
  get(key: string): Promise<{ etag: string; text(): Promise<string> } | null>;
  put(
    key: string,
    body: string,
    options?: {
      onlyIf?: { etagMatches?: string; etagDoesNotMatch?: string };
      httpMetadata?: { contentType: string };
    },
  ): Promise<{ etag: string } | null>;
  list(options: {
    prefix: string;
    cursor?: string;
    limit: number;
  }): Promise<{ objects: { key: string }[]; truncated: boolean; cursor?: string }>;
};
export function cvTransactionStore(bucket: Bucket) {
  const recordKey = (id: string) => `${PREFIX}current/${id}.json`;
  const receiptKey = (id: string) => `${PREFIX}receipts/${id}.json`;
  async function get(id: string) {
    const object = await bucket.get(recordKey(id));
    return object
      ? { record: JSON.parse(await object.text()) as CvTransaction, etag: object.etag }
      : null;
  }
  async function list() {
    const records: CvTransaction[] = [];
    let cursor: string | undefined;
    do {
      const page = await bucket.list({ prefix: `${PREFIX}current/`, cursor, limit: 500 });
      for (let offset = 0; offset < page.objects.length; offset += 8) {
        const batch = await Promise.all(
          page.objects.slice(offset, offset + 8).map(async (entry) => {
            const object = await bucket.get(entry.key);
            if (!object) return null;
            const record = JSON.parse(await object.text()) as CvTransaction;
            const receipt = await bucket.get(receiptKey(record.id));
            if (receipt) {
              const metadata = JSON.parse(await receipt.text()) as { receipt?: CvReceipt };
              record.receipt = metadata.receipt;
            }
            return record;
          }),
        );
        records.push(...batch.filter((r): r is CvTransaction => !!r));
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    return records.sort(
      (a, b) =>
        b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || ""),
    );
  }
  async function save(
    id: string,
    value: unknown,
    actor: string,
    order: { id: string; clientName: string } | null,
  ) {
    const input = validateCvTransaction(value, id);
    if (!order || order.id !== input.orderId)
      throw new CvTransactionError("Commande CV introuvable.", 404);
    const previous = await get(id);
    if ((previous?.record.revision || 0) !== input.revision)
      throw new CvTransactionError(
        "Cette transaction a changé. Actualisez avant de réessayer.",
        409,
      );
    const now = new Date().toISOString();
    const record: CvTransaction = {
      ...input,
      client: order.clientName,
      revision: input.revision + 1,
      createdAt: previous?.record.createdAt || now,
      createdBy: previous?.record.createdBy || actor,
      updatedAt: now,
      updatedBy: actor,
    };
    if (previous)
      await bucket.put(
        `${PREFIX}history/${id}/${previous.record.revision}-${crypto.randomUUID()}.json`,
        JSON.stringify(previous.record),
      );
    const saved = await bucket.put(recordKey(id), JSON.stringify(record), {
      onlyIf: previous ? { etagMatches: previous.etag } : { etagDoesNotMatch: "*" },
      httpMetadata: { contentType: "application/json" },
    });
    if (!saved)
      throw new CvTransactionError("Modification concurrente : actualisez le registre.", 409);
    return record;
  }
  async function uploadReceipt(
    id: string,
    actor: string,
    upload: () => Promise<Omit<CvReceipt, "uploadedAt" | "uploadedBy">>,
  ) {
    const existing = await get(id);
    if (!existing)
      throw new CvTransactionError("Enregistrez la transaction avant le justificatif.", 404);
    if (existing.record.voided)
      throw new CvTransactionError("Transaction annulée : justificatif inchangé.", 409);
    const key = receiptKey(id);
    const old = await bucket.get(key);
    const oldState = old
      ? (JSON.parse(await old.text()) as {
          receipt?: CvReceipt;
          pendingAt?: string;
          token?: string;
        })
      : null;
    if (oldState?.pendingAt && Date.now() - Date.parse(oldState.pendingAt) < 5 * 60_000)
      throw new CvTransactionError("Un envoi est déjà en cours pour cette transaction.", 409);
    const token = crypto.randomUUID();
    const lock = await bucket.put(
      key,
      JSON.stringify({ receipt: oldState?.receipt, pendingAt: new Date().toISOString(), token }),
      { onlyIf: old ? { etagMatches: old.etag } : { etagDoesNotMatch: "*" } },
    );
    if (!lock) throw new CvTransactionError("Envoi concurrent : actualisez.", 409);
    try {
      const uploaded = await upload();
      const receipt: CvReceipt = {
        ...uploaded,
        uploadedAt: new Date().toISOString(),
        uploadedBy: actor,
      };
      // Preserve every uploaded Drive reference even if the final current-pointer write fails.
      await bucket.put(`${PREFIX}receipt-history/${id}/${token}.json`, JSON.stringify(receipt));
      const saved = await bucket.put(key, JSON.stringify({ receipt }), {
        onlyIf: { etagMatches: lock.etag },
      });
      if (!saved)
        throw new CvTransactionError(
          "Fichier envoyé dans Drive, référence conservée dans l’historique. Actualisez avant un nouvel envoi.",
          409,
        );
      return receipt;
    } catch (error) {
      await bucket.put(key, JSON.stringify({ receipt: oldState?.receipt }), {
        onlyIf: { etagMatches: lock.etag },
      });
      throw error;
    }
  }
  return { get, list, save, uploadReceipt };
}
