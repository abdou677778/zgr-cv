import { proxyClientPortal } from "../_shared/client-portal-proxy.js";

// The client portal is rendered behind the short /c/<invite> URL, but its
// application runtime references immutable Next assets from /_next/....
// Forward those assets through the same Pages gateway so the browser never
// receives the ZGR Studio SPA index in place of a JavaScript module.
export function onRequest(context) {
  return proxyClientPortal({
    request: context.request,
    env: context.env,
    path: context.params.path,
    asset: true,
  });
}
