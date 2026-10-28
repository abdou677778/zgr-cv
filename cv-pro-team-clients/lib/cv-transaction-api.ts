import { requireAdmin } from "@/lib/admin-auth";
import { ensureSchema, runtimeEnv } from "@/db/runtime";
import { jsonResponse } from "@/lib/order-model";
import { getOrder } from "@/lib/order-repository";
import { inspectCvReceiptFolder, uploadCvPaymentReceipt } from "@/lib/google-drive";
import { CvTransactionError, cvTransactionStore } from "@/lib/cv-transaction-repository";
import { cvReceiptType } from "../../shared/cv-transactions";

async function boundedBody(request: Request, max: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new CvTransactionError("Corps de requête requis.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new CvTransactionError("Fichier ou données trop volumineux.", 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
export async function cvTransactionApi(request: Request, parts: string[] = []) {
  const denial = requireAdmin(request);
  if (denial) return denial;
  const store = cvTransactionStore(runtimeEnv().FILES);
  const actor = (request.headers.get("X-ZGR-Actor") || "portal-admin").slice(0, 120);
  try {
    if (!parts.length && request.method === "GET") {
      await ensureSchema();
      const [records, choices] = await Promise.all([
        store.list(),
        runtimeEnv()
          .DB.prepare(
            "SELECT id, client_name, admin_username, writer_username FROM orders ORDER BY created_at DESC",
          )
          .all<{
            id: string;
            client_name: string;
            admin_username: string;
            writer_username: string;
          }>(),
      ]);
      return jsonResponse({
        records,
        orders: choices.results.map((order) => ({
          id: order.id,
          clientName: order.client_name,
          adminUsername: order.admin_username,
          writerUsername: order.writer_username,
        })),
      });
    }
    if (parts.length === 1 && parts[0] === "drive" && request.method === "GET") {
      return jsonResponse({ drive: await inspectCvReceiptFolder() });
    }
    const id = parts[0] || "";
    if (!/^[a-zA-Z0-9-]{8,80}$/.test(id)) throw new CvTransactionError("Route invalide.", 404);
    if (parts.length === 1 && request.method === "PUT") {
      let input: unknown;
      try {
        input = JSON.parse(new TextDecoder().decode(await boundedBody(request, 32000)));
      } catch (error) {
        if (error instanceof CvTransactionError) throw error;
        throw new CvTransactionError("JSON invalide.");
      }
      const orderId = (input as { orderId?: unknown })?.orderId;
      if (typeof orderId !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(orderId))
        throw new CvTransactionError("Commande CV requise.");
      const record = await store.save(id, input, actor, await getOrder(orderId));
      return jsonResponse({ record });
    }
    if (parts.length === 2 && parts[1] === "receipt" && request.method === "POST") {
      const bytes = await boundedBody(request, 5 * 1024 * 1024);
      const contentType = cvReceiptType(bytes);
      if (!contentType)
        throw new CvTransactionError("Justificatif PNG, JPEG ou WebP requis (5 Mo maximum).");
      const receipt = await store.uploadReceipt(id, actor, () =>
        uploadCvPaymentReceipt(id, bytes, contentType),
      );
      return jsonResponse({ receipt });
    }
    throw new CvTransactionError("Route de transaction introuvable.", 404);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Erreur de transaction." },
      error instanceof CvTransactionError ? error.status : 400,
    );
  }
}
