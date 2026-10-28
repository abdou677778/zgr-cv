import { cvTransactionApi } from "@/lib/cv-transaction-api";
export const GET = (request: Request) => cvTransactionApi(request);
