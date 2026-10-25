import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyTechFilters,
  filterTechOrders,
  newTechOrderForClient,
  orderTotals,
  techClientKey,
  techClients,
  techLineStatus,
  techOrderState,
  type TechLine,
  type TechOrder,
} from "./tech-orders";
const line: TechLine = {
  id: "l1",
  serviceId: "chatgpt",
  name: "ChatGPT",
  start: "2026-10-01",
  end: "2026-10-28",
  priceUsd: 20,
  rate: 260,
  saleDzd: 6200,
  invoiceUrl: "",
  invoiceRef: "",
};
const order: TechOrder = {
  id: "abcd1234-order",
  revision: 1,
  client: "Client Exemple",
  facebookUrl: "https://facebook.com/example",
  notes: "",
  renewalOf: "",
  createdAt: "2026-10-24T23:30:00Z",
  lines: [line],
};
test("Tech states use the exact three-day boundary and handle mixed subscriptions", () => {
  assert.equal(techLineStatus(line, "2026-10-25"), "Expire sous 3 jours");
  assert.equal(techLineStatus(line, "2026-10-24"), "Actif");
  assert.equal(techOrderState(order, "2026-10-28"), "inactive");
  assert.equal(
    techOrderState(
      { ...order, lines: [{ ...line, start: "2026-11-01", end: "2026-12-01" }] },
      "2026-10-25",
    ),
    "inactive",
  );
  assert.equal(
    techOrderState(
      {
        ...order,
        lines: [
          { ...line, end: "2026-10-20" },
          { ...line, id: "l2", end: "2026-12-01" },
        ],
      },
      "2026-10-25",
    ),
    "active",
  );
  assert.equal(
    techOrderState({ ...order, lines: [{ ...line, end: "2026-12-01" }, line] }, "2026-10-25"),
    "ending",
  );
});
test("Tech filters combine client, visible order ID, status and inclusive period correctly", () => {
  const other = {
    ...order,
    id: "other-order",
    client: "Autre client",
    lines: [{ ...line, end: "2026-12-01" }],
  };
  const all = [order, other];
  assert.deepEqual(
    filterTechOrders(
      all,
      {
        ...emptyTechFilters,
        client: techClientKey(order),
        orderId: "TECH-ABCD1234",
        state: "ending",
        from: "2026-10-28",
        to: "2026-10-28",
      },
      "2026-10-25",
    ).map((o) => o.id),
    [order.id],
  );
  assert.equal(
    filterTechOrders(all, { ...emptyTechFilters, state: "active" }, "2026-10-25")[0].id,
    "other-order",
  );
  assert.equal(
    filterTechOrders(all, { ...emptyTechFilters, query: "exemple" }, "2026-10-25").length,
    1,
  );
  assert.equal(
    filterTechOrders(
      all,
      { ...emptyTechFilters, from: "2026-12-01", to: "2026-10-01" },
      "2026-10-25",
    ).length,
    0,
  );
  assert.equal(
    filterTechOrders(
      all,
      { ...emptyTechFilters, dateBasis: "created", from: "2026-10-25", to: "2026-10-25" },
      "2026-10-25",
    ).length,
    2,
  );
});
test("Service and date filters must match the same line; totals remain complete orders", () => {
  const combined = {
    ...order,
    lines: [line, { ...line, id: "l2", serviceId: "gemini", name: "Gemini", end: "2026-12-01" }],
  };
  assert.equal(
    filterTechOrders(
      [combined],
      { ...emptyTechFilters, serviceId: "gemini", from: "2026-10-28", to: "2026-10-28" },
      "2026-10-25",
    ).length,
    0,
  );
  const result = filterTechOrders(
    [combined],
    { ...emptyTechFilters, serviceId: "gemini" },
    "2026-10-25",
  );
  assert.equal(orderTotals(result[0]).sale, 12400);
});
test("Existing-client choices preserve contact distinctions and create independent new sales", () => {
  const sameNameOtherContact = {
    ...order,
    id: "second",
    facebookUrl: "https://facebook.com/different",
  };
  assert.equal(techClients([order, { ...order, id: "older" }, sameNameOtherContact]).length, 2);
  const fresh = newTechOrderForClient(order);
  assert.equal(fresh.client, order.client);
  assert.equal(fresh.facebookUrl, order.facebookUrl);
  assert.deepEqual(fresh.lines, []);
  assert.equal(fresh.renewalOf, "");
  assert.notEqual(fresh.id, order.id);
  assert.equal(fresh.revision, 0);
});
