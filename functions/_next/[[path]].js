import { proxyClientPortal } from "../_shared/client-portal-proxy.js";

// Portal HTML and its hashed assets must come from the same deployment.
// Resolve new chunks on the portal even if Pages still has an older static copy.
export function onRequest(context) {
  return proxyClientPortal({
    request: context.request,
    env: context.env,
    path: context.params.path,
    asset: true,
  });
}
