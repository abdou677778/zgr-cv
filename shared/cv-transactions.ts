export const CV_CURRENCIES = { DZD: 2, TND: 3, USD: 2, MAD: 2 } as const;
export type CvCurrency = keyof typeof CV_CURRENCIES;
export const CV_PAYMENT_METHODS = [
  "BaridiMob",
  "CCP",
  "Wise",
  "Pyypl",
  "Binance",
  "RedotPay",
  "ATB Tunisie",
  "Carte Dinar Tunisien",
  "Autre",
] as const;
export const CV_TRANSACTION_SERVICES = [
  "CV CANADIEN",
  "CV EUROPASS",
  "CV ATS",
  "CV PRO",
  "LETTRE DE MOTIVATION",
  "Inscription Arrima",
  "Inscription Destination Canada",
  "Inscription Journée Québec",
  "Inscription Saskatchewan",
  "Inscription Nunavut",
  "Inscription Nouveau-Brunswick",
];
export type CvReceipt = {
  fileId: string;
  url: string;
  name: string;
  uploadedAt: string;
  uploadedBy: string;
};
export type CvTransaction = {
  id: string;
  revision: number;
  orderId: string;
  client: string;
  date: string;
  admin: string;
  writer: string;
  services: string[];
  amountMinor: number;
  currency: CvCurrency;
  paymentMethod: string;
  receiver: string;
  notes: string;
  voided: boolean;
  voidReason: string;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  receipt?: CvReceipt;
};
export type CvTransactionOrder = {
  id: string;
  clientName: string;
  adminUsername: string;
  writerUsername: string;
};
export const CV_RECEIPT_FOLDER_ID = "1rIuoWe9T84QHVkNfjicfOOYnBOapLqxR";
export const cvTransactionLabel = (id: string) => `TX-${id.slice(0, 8).toUpperCase()}`;
export function parseCvAmount(value: string, currency: CvCurrency): number | null {
  const precision = CV_CURRENCIES[currency];
  if (
    !Object.hasOwn(CV_CURRENCIES, currency) ||
    !new RegExp(`^\\d{1,9}(?:[.,]\\d{1,${precision}})?$`).test(value.trim())
  )
    return null;
  const [whole, fraction = ""] = value.trim().replace(",", ".").split(".");
  const minor = Number(whole) * 10 ** precision + Number(fraction.padEnd(precision, "0"));
  return Number.isSafeInteger(minor) && minor > 0 && minor <= 100000000000 ? minor : null;
}
export function cvAmountInput(minor: number, currency: CvCurrency) {
  return (minor / 10 ** CV_CURRENCIES[currency]).toFixed(CV_CURRENCIES[currency]);
}
export function formatCvAmount(minor: number, currency: CvCurrency) {
  return `${new Intl.NumberFormat("fr-DZ", { minimumFractionDigits: CV_CURRENCIES[currency], maximumFractionDigits: CV_CURRENCIES[currency] }).format(minor / 10 ** CV_CURRENCIES[currency])} ${currency}`;
}
export function cvTransactionTotals(records: CvTransaction[]) {
  const totals: Record<CvCurrency, number> = { DZD: 0, TND: 0, USD: 0, MAD: 0 };
  for (const record of records) if (!record.voided) totals[record.currency] += record.amountMinor;
  return totals;
}
function text(value: unknown, max: number, required = false): value is string {
  return typeof value === "string" && value.length <= max && (!required || !!value.trim());
}
export function validateCvTransaction(value: unknown, id: string): Omit<CvTransaction, "client"> {
  const input = value as CvTransaction;
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    !/^[a-zA-Z0-9-]{8,80}$/.test(id) ||
    input.id !== id ||
    !Number.isSafeInteger(input.revision) ||
    input.revision < 0
  )
    throw Error("Identifiant ou révision invalide.");
  if (!text(input.orderId, 80, true) || !/^[a-zA-Z0-9-]{1,80}$/.test(input.orderId))
    throw Error("Commande CV requise.");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
    input.date < "2000-01-01" ||
    input.date > "2199-12-31" ||
    !Number.isFinite(Date.parse(`${input.date}T00:00:00Z`)) ||
    new Date(`${input.date}T00:00:00Z`).toISOString().slice(0, 10) !== input.date
  )
    throw Error("Date de transaction invalide.");
  if (
    !text(input.admin, 120, true) ||
    !text(input.writer, 120) ||
    !text(input.receiver, 120, true) ||
    !text(input.notes, 4000) ||
    !text(input.voidReason, 500)
  )
    throw Error("Admin, bénéficiaire et textes valides requis.");
  if (
    !Array.isArray(input.services) ||
    input.services.length < 1 ||
    input.services.length > 30 ||
    !input.services.every((s) => text(s, 150, true)) ||
    new Set(input.services.map((s) => s.trim().toLocaleLowerCase("fr"))).size !==
      input.services.length
  )
    throw Error("Sélectionnez des services distincts (30 maximum).");
  if (
    !Object.hasOwn(CV_CURRENCIES, input.currency) ||
    !Number.isSafeInteger(input.amountMinor) ||
    input.amountMinor <= 0 ||
    input.amountMinor > 100000000000
  )
    throw Error("Montant global ou devise invalide.");
  if (
    !(CV_PAYMENT_METHODS as readonly string[]).includes(input.paymentMethod) ||
    typeof input.voided !== "boolean" ||
    (input.voided && !input.voidReason.trim())
  )
    throw Error("Moyen de paiement ou motif d’annulation invalide.");
  return {
    id,
    revision: input.revision,
    orderId: input.orderId,
    date: input.date,
    admin: input.admin.trim(),
    writer: input.writer.trim(),
    receiver: input.receiver.trim(),
    notes: input.notes.trim(),
    services: input.services.map((s) => s.trim()),
    currency: input.currency,
    amountMinor: input.amountMinor,
    paymentMethod: input.paymentMethod,
    voided: input.voided,
    voidReason: input.voidReason.trim(),
  };
}
export function cvReceiptType(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  if (bytes.length < 12 || bytes.length > 5 * 1024 * 1024) return null;
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)) return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}
