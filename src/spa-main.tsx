import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Index from "./routes/index";
import { startObservability } from "./lib/observability";
import { registerPwa } from "./lib/pwa-client";
import "./styles.css";

const queryClient = new QueryClient();

// `release` is only a cache-busting diagnostic parameter. Removing it keeps the
// address bar on the permanent team URL after an old shared link is opened.
const shareUrl = new URL(window.location.href);
if (shareUrl.searchParams.has("release")) {
  shareUrl.searchParams.delete("release");
  window.history.replaceState(window.history.state, "", shareUrl);
}

void registerPwa();
startObservability();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Index />
    </QueryClientProvider>
  </React.StrictMode>,
);
