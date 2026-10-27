/** Geometry of the existing International capsule; never changes the portrait. */
export const INTERNATIONAL_CONTACT_ROW_HEIGHT = 12;
export const INTERNATIONAL_CONTACT_GAP = 4;
export function internationalContactLayout(visibleRows: number, hasPortrait: boolean) {
  const count = Math.max(0, Math.min(7, Math.trunc(visibleRows)));
  const photoBottom = hasPortrait ? 67 + 140 : 63 + 148;
  const ovalBottom = 37 + 311;
  const height = count
    ? count * INTERNATIONAL_CONTACT_ROW_HEIGHT + (count - 1) * INTERNATIONAL_CONTACT_GAP
    : 0;
  const margin = (ovalBottom - photoBottom - height) / 2;
  return { photoBottom, ovalBottom, height, top: photoBottom + margin, margin };
}
