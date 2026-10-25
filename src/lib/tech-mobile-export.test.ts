import test from "node:test";
import assert from "node:assert/strict";
import { saveTechExcel } from "./tech-mobile-export";
test("Android Excel handoff transmits only the generated workbook bytes to the local save bridge", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  let encoded = "";
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      ZgrTechAndroid: {
        saveExcel: (value: string) => {
          encoded = value;
        },
      },
    },
  });
  try {
    saveTechExcel(new Uint8Array([80, 75, 3, 4]), "example.xlsx");
    assert.equal(encoded, "UEsDBA==");
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
