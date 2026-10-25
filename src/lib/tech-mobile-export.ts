declare global {
  interface Window {
    ZgrTechAndroid?: { saveExcel: (base64: string) => void };
  }
}
/** Narrow, optional Android save dialog. No tokens or client data leave the device here. */
export function saveTechExcel(bytes: Uint8Array, filename: string) {
  if (window.ZgrTechAndroid?.saveExcel) {
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 32768)
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
    window.ZgrTechAndroid.saveExcel(btoa(binary));
    return;
  }
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(bytes)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
