import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const script = readFileSync(new URL("../../public/startup-recovery.js", import.meta.url), "utf8");
function startup() {
  const events: Record<string, (event?: unknown) => void> = {};
  const message = { textContent: "Démarrage…" };
  const retry = {
    hidden: true,
    addEventListener: (name: string, fn: () => void) => {
      events[name] = fn;
    },
  };
  let mounted = false,
    destination = "";
  runInNewContext(script, {
    URL,
    Date,
    document: {
      getElementById: (id: string) =>
        mounted
          ? null
          : id === "zgr-startup-message"
            ? message
            : id === "zgr-startup-retry"
              ? retry
              : {},
    },
    window: {
      location: {
        href: "https://zgr-cv.pages.dev/?workspace=tech-orders",
        replace: (url: string) => {
          destination = url;
        },
      },
      addEventListener: (name: string, fn: () => void) => {
        events[name] = fn;
      },
      setTimeout: (fn: () => void) => {
        events.timeout = fn;
      },
    },
  });
  return {
    events,
    message,
    retry,
    mount: () => {
      mounted = true;
    },
    destination: () => destination,
  };
}
test("A failed module or stalled startup offers recovery instead of an empty root", () => {
  for (const event of ["error", "timeout", "unhandledrejection"]) {
    const app = startup();
    app.events[event]({ target: { tagName: "SCRIPT" } });
    assert.equal(app.retry.hidden, false);
    assert.match(app.message.textContent, /WebView/);
  }
});
test("Recovery never replaces a mounted app, even after unrelated runtime errors", () => {
  const app = startup();
  app.mount();
  app.events.timeout();
  app.events.unhandledrejection();
  assert.equal(app.retry.hidden, true);
  assert.equal(app.message.textContent, "Démarrage…");
});
test("Retry keeps the Tech Orders route and changes only the reload URL", () => {
  const app = startup();
  app.events.timeout();
  app.events.click();
  const url = new URL(app.destination());
  assert.equal(url.origin, "https://zgr-cv.pages.dev");
  assert.equal(url.searchParams.get("workspace"), "tech-orders");
  assert.ok(url.searchParams.has("_zgr_retry"));
});
