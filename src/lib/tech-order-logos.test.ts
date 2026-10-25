import test from "node:test";
import assert from "node:assert/strict";
import { setSharedSoftwareLogos } from "./software-icons";
import { techLogoSource } from "./tech-order-logos";
import { newTechLine, lineTotals, type TechService } from "./tech-orders";
const service: TechService = {
  id: "sample",
  revision: 1,
  name: "ChatGPT Go",
  icon: "openai",
  logo: "",
  priceUsd: 20,
  rate: 260,
  saleDzd: 6200,
  months: 1,
};
test("Tech Orders reuses corrected shared logos, with private service uploads taking priority", () => {
  setSharedSoftwareLogos({ openai: "data:image/png;base64,shared-logo" });
  assert.equal(techLogoSource(service), "data:image/png;base64,shared-logo");
  assert.equal(techLogoSource({ ...service, logo: "legacy-upload" }), "legacy-upload");
  const override = { id: "sample", revision: 1, icon: "openai", dataUrl: "private-cloud-logo" };
  assert.equal(techLogoSource(service, override), "private-cloud-logo");
  assert.equal(
    techLogoSource(service, { ...override, icon: "googlegemini" }),
    "data:image/png;base64,shared-logo",
  );
  assert.equal(techLogoSource(undefined), "");
  setSharedSoftwareLogos({});
});
test("Selected service prices can be changed without altering the catalog, including zero", () => {
  const line = newTechLine(service, "2026-10-25");
  assert.equal(line.saleDzd, 6200);
  line.saleDzd = 7000;
  assert.equal(service.saleDzd, 6200);
  assert.equal(lineTotals(line).margin, 1800);
  line.saleDzd = 0;
  assert.equal(lineTotals(line).margin, -5200);
});
