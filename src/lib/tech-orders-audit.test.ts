import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyTechFilters,
  filterTechOrders,
  techMatchesSearch,
  techOrdersTotals,
  addTechMonths,
  techDatePresets,
  type TechService,
  type TechOrder,
} from "./tech-orders";
import { techServiceError, techOrderError } from "./tech-orders-validation";
import {
  techLogoMime,
  normalizedTechLogo,
  pngDataBytes,
  TECH_LOGO_MAX_BYTES,
} from "./tech-logo-upload";
const service: TechService = {
  id: "sample",
  revision: 1,
  name: "Service test",
  icon: "openai",
  logo: "",
  priceUsd: 20,
  rate: 260,
  saleDzd: 6200,
  months: 1,
};
const order: TechOrder = {
  id: "abc-order",
  revision: 1,
  client: "Émilie Exemple",
  facebookUrl: "https://facebook.com/client.exemple",
  notes: "Renouvellement équipe",
  renewalOf: "",
  lines: [
    {
      id: "line",
      serviceId: service.id,
      name: service.name,
      priceUsd: 20,
      rate: 260,
      saleDzd: 6200,
      start: "2026-10-25",
      end: "2026-11-25",
      invoiceUrl: "",
      invoiceRef: "FACT-123",
    },
  ],
};
test("Premium search ignores accents and Arabic diacritics and combines tokens in any order", () => {
  assert.ok(techMatchesSearch("Émilie Ben Ali", "ali emilie"));
  assert.ok(techMatchesSearch("أَمِين الجزائر", "امين الجزائر"));
  assert.ok(!techMatchesSearch("Émilie Ben Ali", "alice ali"));
  for (const query of ["facebook.com/client", "FACT-123", "equipe renouvellement", "emilie test"])
    assert.equal(filterTechOrders([order], { ...emptyTechFilters, query }).length, 1);
});
test("Premium totals remain rounded, sorts are stable and invalid calendar days never roll over", () => {
  assert.equal(addTechMonths("2026-02-30", 1), "");
  assert.equal(addTechMonths("2026-2-01", 1), "");
  assert.equal(addTechMonths("2026-01-31", 1), "2026-02-28");
  assert.deepEqual(
    techDatePresets("2028-02-28").map(({ from, to }) => [from, to]),
    [
      ["2028-02-28", "2028-02-28"],
      ["2028-02-28", "2028-03-05"],
      ["2028-02-01", "2028-02-29"],
    ],
  );
  const second = {
    ...order,
    id: "second",
    client: "Adam",
    lines: [{ ...order.lines[0], saleDzd: 8000, end: "2026-10-28" }],
  };
  for (const sort of ["client", "ending", "sale-desc"] as const)
    assert.equal(
      filterTechOrders([order, second], { ...emptyTechFilters, sort }, "2026-10-25")[0].id,
      "second",
    );
  assert.deepEqual(techOrdersTotals([order, second]), { cost: 10400, sale: 14200, margin: 3800 });
  const fractional = {
    ...order,
    lines: [{ ...order.lines[0], saleDzd: 0.1, priceUsd: 0, rate: 260 }],
  };
  assert.equal(techOrdersTotals(Array.from({ length: 100 }, () => fractional)).sale, 10);
});
test("Draft validation rejects unsafe prices, zero rate, malformed dates and missing catalog services", () => {
  assert.equal(techServiceError(service), "");
  assert.equal(techOrderError(order, [service]), "");
  for (const bad of [
    { ...service, rate: 0 },
    { ...service, rate: 1e-10 },
    { ...service, saleDzd: 1.005 },
    { ...service, priceUsd: NaN },
    { ...service, rate: 100000000 },
  ])
    assert.ok(techServiceError(bad));
  assert.equal(techServiceError({ ...service, saleDzd: 0 }), "");
  assert.equal(techServiceError({ ...service, saleDzd: 0.1 + 0.2 }), "");
  assert.ok(techOrderError(order, []));
  assert.ok(
    techOrderError({ ...order, facebookUrl: "https://secret:password@example.com" }, [service]),
  );
  assert.ok(
    techOrderError({ ...order, lines: [{ ...order.lines[0], end: order.lines[0].start }] }, [
      service,
    ]),
  );
});
test("Logo imports accept missing MIME metadata only for known image extensions", () => {
  assert.equal(techLogoMime({ name: "Logo.PNG", type: "", size: 200 }), "image/png");
  assert.equal(
    techLogoMime({ name: "logo.svg", type: "application/octet-stream", size: 200 }),
    "image/svg+xml",
  );
  assert.equal(techLogoMime({ name: "logo.jpg", type: "image/jpg", size: 200 }), "image/jpeg");
  for (const file of [
    { name: "logo.heic", type: "", size: 200 },
    { name: "file.pdf", type: "application/pdf", size: 200 },
    { name: "empty.png", type: "image/png", size: 0 },
    { name: "large.png", type: "image/png", size: 5 * 1024 * 1024 },
  ])
    assert.throws(() => techLogoMime(file));
  assert.equal(pngDataBytes("data:image/png;base64,YQ=="), 1);
});
test("Complex logos adapt content size before upload, preserving a 256-square transparent canvas", async () => {
  const oldImage = Object.getOwnPropertyDescriptor(globalThis, "Image"),
    oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const sizes: number[] = [];
  let canvas: { width: number; height: number; getContext: () => unknown; toDataURL: () => string };
  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    value: class {
      naturalWidth = 1024;
      naturalHeight = 1024;
      src = "";
      decode() {
        return Promise.resolve();
      }
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: () =>
        (canvas = {
          width: 0,
          height: 0,
          getContext: () => ({
            clearRect() {},
            drawImage(_i: unknown, _x: number, _y: number, w: number) {
              sizes.push(w);
            },
          }),
          toDataURL: () =>
            `data:image/png;base64,${Buffer.alloc(sizes.length === 1 ? 180000 : 1000).toString("base64")}`,
        }),
    },
  });
  try {
    const result = await normalizedTechLogo(new File(["fake"], "logo.png", { type: "image/png" }));
    assert.deepEqual(sizes, [224, 192]);
    assert.equal(canvas!.width, 256);
    assert.equal(canvas!.height, 256);
    assert.ok(pngDataBytes(result) <= TECH_LOGO_MAX_BYTES);
  } finally {
    if (oldImage) Object.defineProperty(globalThis, "Image", oldImage);
    else Reflect.deleteProperty(globalThis, "Image");
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
