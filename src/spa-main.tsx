import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Index from "./routes/index";
import { refreshStalePublishedBuild } from "./lib/build-freshness";
import "./styles.css";

const queryClient = new QueryClient();

void refreshStalePublishedBuild();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Index />
    </QueryClientProvider>
  </React.StrictMode>,
);
