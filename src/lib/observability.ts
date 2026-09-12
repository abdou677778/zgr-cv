import { authenticatedFetch, getAdminSession } from "./auth-client";

type OperationalEvent = {
  kind: "web_vital" | "javascript_error" | "api_failure" | "sync_failure";
  name:
    | "LCP"
    | "CLS"
    | "INP"
    | "FCP"
    | "TTFB"
    | "window_error"
    | "unhandled_rejection"
    | "http_error"
    | "network_error"
    | "sync_error";
  value?: number;
  rating: "good" | "needs-improvement" | "poor" | "error";
  status?: number;
  route?: string;
  buildId?: string;
};

type ApiFailureDetail = {
  route?: string;
  status?: number;
  name?: "http_error" | "network_error";
};

const buildId = (import.meta.env.VITE_ZGR_BUILD_ID as string | undefined)?.trim() || "local";
const queue: OperationalEvent[] = [];
const sentVitals = new Set<string>();
let started = false;
let flushing = false;
let flushTimer = 0;
let largestContentfulPaint = 0;
let cumulativeLayoutShift = 0;
let interactionToNextPaint = 0;
let lcpSupported = false;
let clsSupported = false;

function rating(name: OperationalEvent["name"], value: number): OperationalEvent["rating"] {
  const thresholds: Partial<Record<OperationalEvent["name"], [number, number]>> = {
    LCP: [2_500, 4_000],
    CLS: [0.1, 0.25],
    INP: [200, 500],
    FCP: [1_800, 3_000],
    TTFB: [800, 1_800],
  };
  const limits = thresholds[name];
  if (!limits) return "error";
  return value <= limits[0] ? "good" : value <= limits[1] ? "needs-improvement" : "poor";
}

function scheduleFlush(delay = 1_500) {
  window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => void flushOperationalEvents(), delay);
}

function enqueue(event: OperationalEvent) {
  queue.push({ ...event, buildId });
  if (queue.length > 50) queue.splice(0, queue.length - 50);
  scheduleFlush();
}

function reportVital(name: "LCP" | "CLS" | "INP" | "FCP" | "TTFB", value: number) {
  if (!Number.isFinite(value) || value < 0 || sentVitals.has(name)) return;
  sentVitals.add(name);
  enqueue({ kind: "web_vital", name, value, rating: rating(name, value) });
}

async function flushOperationalEvents() {
  if (flushing || !queue.length || !navigator.onLine || !getAdminSession()) return;
  flushing = true;
  const events = queue.splice(0, 20);
  try {
    const response = await authenticatedFetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
      keepalive: true,
    });
    if (!response.ok) throw new Error(`Télémétrie refusée (${response.status}).`);
  } catch {
    queue.unshift(...events);
    if (queue.length > 50) queue.length = 50;
  } finally {
    flushing = false;
  }
}

function finalizeVitals() {
  if (lcpSupported && largestContentfulPaint > 0) reportVital("LCP", largestContentfulPaint);
  if (clsSupported) reportVital("CLS", cumulativeLayoutShift);
  if (interactionToNextPaint > 0) reportVital("INP", interactionToNextPaint);
}

function observePerformance() {
  const navigation = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  if (navigation) reportVital("TTFB", navigation.responseStart);

  try {
    const paintObserver = new PerformanceObserver((list) => {
      const firstContentfulPaint = list
        .getEntries()
        .find((entry) => entry.name === "first-contentful-paint");
      if (firstContentfulPaint) reportVital("FCP", firstContentfulPaint.startTime);
    });
    paintObserver.observe({ type: "paint", buffered: true });
  } catch {
    // Some browsers do not expose paint timing observers.
  }

  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entry = list.getEntries().at(-1);
      if (entry) largestContentfulPaint = entry.startTime;
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    lcpSupported = true;
  } catch {
    // LCP is optional on older WebViews.
  }

  try {
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
        if (!shift.hadRecentInput) cumulativeLayoutShift += shift.value || 0;
      }
    });
    clsObserver.observe({ type: "layout-shift", buffered: true });
    clsSupported = true;
  } catch {
    // CLS is optional on older browsers.
  }

  try {
    const inpObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        interactionToNextPaint = Math.max(interactionToNextPaint, entry.duration || 0);
      }
    });
    inpObserver.observe({
      type: "event",
      buffered: true,
      durationThreshold: 40,
    } as PerformanceObserverInit & { durationThreshold: number });
  } catch {
    // INP is optional on browsers without Event Timing.
  }
}

export function reportSyncFailure() {
  enqueue({ kind: "sync_failure", name: "sync_error", rating: "error" });
}

export function startObservability() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (typeof PerformanceObserver !== "undefined") observePerformance();

  window.addEventListener("error", () => {
    enqueue({ kind: "javascript_error", name: "window_error", rating: "error" });
  });
  window.addEventListener("unhandledrejection", () => {
    enqueue({ kind: "javascript_error", name: "unhandled_rejection", rating: "error" });
  });
  window.addEventListener("zgr-api-failure", (event) => {
    const detail = (event as CustomEvent<ApiFailureDetail>).detail || {};
    enqueue({
      kind: "api_failure",
      name: detail.name === "network_error" ? "network_error" : "http_error",
      rating: "error",
      status: detail.status,
      route: detail.route,
    });
  });
  window.addEventListener("online", () => scheduleFlush(250));
  window.addEventListener("pagehide", () => {
    finalizeVitals();
    void flushOperationalEvents();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      finalizeVitals();
      void flushOperationalEvents();
    }
  });
  window.setTimeout(finalizeVitals, 10_000);
  window.setInterval(() => void flushOperationalEvents(), 30_000);
}
