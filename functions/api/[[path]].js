import { proxyApiRequest } from "../_shared/api-proxy.js";

export const onRequest = (context) => proxyApiRequest(context);
