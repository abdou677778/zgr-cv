import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTechRenewalMessage,
  defaultMessageLines,
  hasOtherActiveSubscription,
  safeTechContactUrl,
} from "./tech-renewal-message";
import type { TechOrder } from "./tech-orders";
const order: TechOrder = {
  id: "test-order",
  revision: 1,
  client: "CLIENT FICTIF",
  facebookUrl: "https://facebook.com/example",
  notes: "PRIVATE NOTE DO NOT INCLUDE",
  renewalOf: "",
  lines: [
    {
      id: "expired",
      serviceId: "chatgpt",
      name: "ChatGPT Plus",
      start: "2026-09-20",
      end: "2026-10-20",
      priceUsd: 20,
      rate: 260,
      saleDzd: 6200,
      invoiceRef: "PRIVATE INVOICE",
      invoiceUrl: "",
    },
    {
      id: "active",
      serviceId: "canva",
      name: "Canva Pro",
      start: "2026-10-01",
      end: "2026-11-01",
      priceUsd: 10,
      rate: 260,
      saleDzd: 3200,
      invoiceRef: "",
      invoiceUrl: "",
    },
  ],
};
test("Renewal drafts address the explicit gender and never infer it from the name", () => {
  const female = buildTechRenewalMessage(order, ["expired"], "female", "2026-10-25");
  assert.match(female, /حابة تجدّدي/);
  assert.match(female, /ابعثيلنا/);
  assert.match(female, /CLIENT FICTIF/);
  assert.match(buildTechRenewalMessage(order, ["expired"], "male", "2026-10-25"), /حاب تجدّد/);
  const neutral = buildTechRenewalMessage(
    { ...order, client: "أمينة" },
    ["expired"],
    "neutral",
    "2026-10-25",
  );
  assert.ok(!neutral.includes("حابة"));
  assert.ok(!neutral.includes("حاب تجدّد"));
  assert.ok(!female.includes("PRIVATE"));
  assert.ok(!female.includes("6200"));
  assert.ok(!female.includes("facebook.com"));
});
test("Messages distinguish expired, active and future subscriptions with their real dates", () => {
  assert.deepEqual(defaultMessageLines(order, "2026-10-25"), ["expired"]);
  assert.match(
    buildTechRenewalMessage(order, ["expired"], "neutral", "2026-10-25"),
    /كمل نهار 20\/10\/2026/,
  );
  const active = buildTechRenewalMessage(order, ["active"], "neutral", "2026-10-25");
  assert.match(active, /راه ساري ويكمل/);
  assert.ok(!active.includes("ChatGPT"));
  assert.match(
    buildTechRenewalMessage(order, ["active"], "neutral", "2026-09-25"),
    /يبدا نهار 01\/10\/2026/,
  );
  assert.equal(buildTechRenewalMessage(order, [], "neutral", "2026-10-25"), "");
});
test("Already-renewed matching subscriptions trigger a warning without mixing other clients", () => {
  const renewed = {
    ...order,
    id: "renewed",
    lines: [{ ...order.lines[0], start: "2026-10-20", end: "2026-11-20" }],
  };
  assert.equal(
    hasOtherActiveSubscription(order, ["expired"], [order, renewed], "2026-10-25"),
    true,
  );
  assert.equal(
    hasOtherActiveSubscription(order, ["active"], [order, renewed], "2026-10-25"),
    false,
  );
  assert.equal(
    hasOtherActiveSubscription(
      order,
      ["expired"],
      [{ ...renewed, client: "AUTRE CLIENT" }],
      "2026-10-25",
    ),
    false,
  );
});
test("Contact links reject credentials and non-HTTPS schemes", () => {
  assert.equal(safeTechContactUrl("javascript:alert(1)"), "");
  assert.equal(safeTechContactUrl("https://user:secret@example.com"), "");
  assert.equal(safeTechContactUrl(order.facebookUrl), order.facebookUrl);
});
