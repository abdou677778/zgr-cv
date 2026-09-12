import { useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export type PwaStatus = {
  supported: boolean;
  installAvailable: boolean;
  installed: boolean;
  updateAvailable: boolean;
};

const listeners = new Set<() => void>();
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let registration: ServiceWorkerRegistration | null = null;
let registrationPromise: Promise<void> | null = null;
let refreshRequested = false;
let status: PwaStatus = {
  supported: typeof navigator !== "undefined" && "serviceWorker" in navigator,
  installAvailable: false,
  installed:
    typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches,
  updateAvailable: false,
};

function publish(next: Partial<PwaStatus>) {
  status = { ...status, ...next };
  listeners.forEach((listener) => listener());
}

function watchRegistration(nextRegistration: ServiceWorkerRegistration) {
  registration = nextRegistration;
  publish({ updateAvailable: Boolean(nextRegistration.waiting) });

  nextRegistration.addEventListener("updatefound", () => {
    const worker = nextRegistration.installing;
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        publish({ updateAvailable: true });
      }
    });
  });
}

export function registerPwa(): Promise<void> {
  if (registrationPromise) return registrationPromise;
  if (!status.supported || import.meta.env.DEV) return Promise.resolve();

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event as BeforeInstallPromptEvent;
    publish({ installAvailable: true });
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    publish({ installAvailable: false, installed: true });
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!refreshRequested) return;
    refreshRequested = false;
    window.location.reload();
  });

  const serviceWorkerUrl = new URL("./sw.js", window.location.href);
  const scopeUrl = new URL("./", window.location.href);
  registrationPromise = navigator.serviceWorker
    .register(serviceWorkerUrl, { scope: scopeUrl.pathname })
    .then((nextRegistration) => {
      watchRegistration(nextRegistration);
      window.addEventListener("focus", () => void nextRegistration.update());
      window.setInterval(() => void nextRegistration.update(), 60 * 60 * 1000);
    })
    .catch((error: unknown) => {
      console.warn("Installation PWA indisponible.", error);
    });
  return registrationPromise;
}

export async function promptPwaInstall() {
  const prompt = deferredInstallPrompt;
  if (!prompt) return false;
  await prompt.prompt();
  const choice = await prompt.userChoice;
  deferredInstallPrompt = null;
  publish({ installAvailable: false, installed: choice.outcome === "accepted" });
  return choice.outcome === "accepted";
}

export function activatePwaUpdate() {
  if (!registration?.waiting) return false;
  refreshRequested = true;
  registration.waiting.postMessage({ type: "SKIP_WAITING" });
  return true;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return status;
}

export function usePwaStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
