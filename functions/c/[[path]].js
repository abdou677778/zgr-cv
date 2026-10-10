import { proxyClientPortal } from "../_shared/client-portal-proxy.js";

export function onRequest(context) {
  return proxyClientPortal({
    request: context.request,
    env: context.env,
    path: context.params.path,
  });
}
