import type { CV } from "./cv-types";

export type Chronology = { start: string; end: string; ongoing: boolean };
function validDatePart(value: string): boolean {
  if (!value) return true;
  if (!/^(19|20|21)\d{2}(?:-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?)?$/.test(value))
    return false;
  const [year, month, day] = value.split("-").map(Number);
  return !day || day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}
const groups = [
  "january janvier enero januar gennaio jan janv ene gen يناير جانفي",
  "february fevrier febrero februar febbraio feb fev fevr فبراير فيفري شباط",
  "march mars marzo marz mar مارس اذار",
  "april avril abril aprile apr avr abr ابريل افريل نيسان",
  "may mai mayo maggio مايو ماي ايار",
  "june juin junio juni giugno jun giu يونيو جوان حزيران",
  "july juillet julio juli luglio jul juil lug يوليو جويلية تموز",
  "august aout agosto aug ago اغسطس اوت اب",
  "september septembre septiembre settembre sep sept set سبتمبر ايلول",
  "october octobre octubre oktober ottobre oct okt ott اكتوبر",
  "november novembre noviembre nov نوفمبر",
  "december decembre diciembre dezember dicembre dec dez dic ديسمبر",
];
const normalized = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/[٠-٩۰-۹]/g, (digit) =>
      String(
        "٠١٢٣٤٥٦٧٨٩".includes(digit) ? "٠١٢٣٤٥٦٧٨٩".indexOf(digit) : "۰۱۲۳۴۵۶۷۸۹".indexOf(digit),
      ),
    );
const ongoingPattern =
  /\b(?:present|current|now|today|actuel|actualite|en cours|aujourd'hui|actualidad|actualmente|heute|laufend|oggi|attuale|presente)\b|حتى الان|حتي الان|الى الان|الي الان|حاليا|至今|现在|目前/u;

/** Parse only stated precision. No locale-dependent Date.parse and no invented month/day. */
export function parseCvChronology(text: string): Chronology {
  const value = normalized(text);
  if (/\b\d{1,2}\/\d{1,2}\/\d{4}\b/.test(value)) return { start: "", end: "", ongoing: false };
  const matches = [...value.matchAll(/\b(?:19|20|21)\d{2}\b/g)];
  const dates = matches.map((match) => {
    const year = match[0],
      index = match.index!;
    const after = value.slice(index + 4);
    const iso = after.match(/^[-/.](\d{1,2})(?!\d)(?:[-/.](\d{1,2})(?!\d))?/);
    if (iso) {
      const part = `${year}-${iso[1].padStart(2, "0")}${iso[2] ? `-${iso[2].padStart(2, "0")}` : ""}`;
      return validDatePart(part) ? part : "";
    }
    const chinese = after.match(/^年\s*(\d{1,2})月/);
    if (chinese)
      return +chinese[1] >= 1 && +chinese[1] <= 12 ? `${year}-${chinese[1].padStart(2, "0")}` : "";
    const before = value.slice(Math.max(0, index - 28), index).trim();
    const numeric = before.match(/(?:^|\s)(\d{1,2})\/(\d{1,2})\/$/);
    // Ambiguous numeric dates are not guessed. Use ISO to disambiguate them.
    if (numeric) return year;
    const monthYear = before.match(/(?:^|\s)(0?[1-9]|1[0-2])\/$/);
    if (monthYear) return `${year}-${monthYear[1].padStart(2, "0")}`;
    const token = before.match(/\p{L}+\.?$/u)?.[0].replace(/\.$/, "");
    const phrase = [
      ["كانون الثاني", 0],
      ["تشرين الاول", 9],
      ["تشرين الثاني", 10],
      ["كانون الاول", 11],
    ] as const;
    const month =
      phrase.find(([name]) => before.endsWith(name))?.[1] ??
      groups.findIndex((group) => group.split(" ").includes(token ?? ""));
    return month >= 0 ? `${year}-${String(month + 1).padStart(2, "0")}` : year;
  });
  if (dates.length > 2 || dates.some((part) => !part))
    return { start: "", end: "", ongoing: false };
  const ongoing = ongoingPattern.test(value);
  return { start: dates[0] ?? "", end: ongoing ? "" : (dates.at(-1) ?? ""), ongoing };
}

export function normalizeChronology(value: unknown): Chronology | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const valid = (part: unknown) => typeof part === "string" && validDatePart(part);
  if (!valid(row.start) || !valid(row.end) || typeof row.ongoing !== "boolean") return undefined;
  return { start: row.start as string, end: row.end as string, ongoing: row.ongoing };
}
export function rowChronology(row: {
  chronology?: Chronology;
  dates?: string;
  date?: string;
}): Chronology {
  return normalizeChronology(row.chronology) ?? parseCvChronology(row.dates ?? row.date ?? "");
}
const compareDate = (a: string, b: string) => {
  const left = a.split("-"),
    right = b.split("-");
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    if (+left[index] !== +right[index]) return +right[index] - +left[index];
  }
  return right.length - left.length;
};
export function compareChronology(a: Chronology, b: Chronology): number {
  const ak = (!!a.start || !!a.end) && !reversedChronology(a),
    bk = (!!b.start || !!b.end) && !reversedChronology(b);
  if (ak !== bk) return ak ? -1 : 1;
  if (!ak) return 0;
  if (a.ongoing !== b.ongoing) return a.ongoing ? -1 : 1;
  return compareDate(a.end || a.start, b.end || b.start) || compareDate(a.start, b.start);
}
export function reversedChronology(value: Chronology): boolean {
  if (!value.start || !value.end) return false;
  const a = value.start.split("-").map(Number),
    b = value.end.split("-").map(Number);
  for (let index = 0; index < Math.min(a.length, b.length); index++)
    if (a[index] !== b[index]) return a[index] > b[index];
  return false;
}
export function sortDatedRows<T extends { chronology?: Chronology; dates?: string; date?: string }>(
  rows: T[],
): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) => compareChronology(rowChronology(a.row), rowChronology(b.row)) || a.index - b.index,
    )
    .map(({ row }) => row);
}
export function sortCvChronology(cv: CV): CV {
  return {
    ...cv,
    experiences: sortDatedRows(cv.experiences),
    formations: sortDatedRows(cv.formations),
    educations: sortDatedRows(cv.educations),
  };
}
