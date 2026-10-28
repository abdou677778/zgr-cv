import { cvTransactionApi } from "@/lib/cv-transaction-api";
async function handler(request: Request, context: { params: Promise<{ parts: string[] }> }) {
  return cvTransactionApi(request, (await context.params).parts);
}
export { handler as GET, handler as PUT, handler as POST };
