// Generate ATS-friendly PDF (selectable text) for the Canadian CV template.
// Uses pdfmake (vector text), NOT html2canvas. Dynamic import keeps SSR safe.
import type {
  TDocumentDefinitions,
  Content,
  TFontDictionary,
  TVirtualFileSystem,
} from "pdfmake/interfaces";
import type { CV, Experience, Formation, Education, ObjectiveFormat } from "./cv-types";
import { normalizeObjectiveFormat } from "./cv-objective-format";
import { documentFont, type DocumentLanguage } from "./document-language";
import { applyPdfTheme } from "./pdf-theme";
import {
  applyTemplateDesigner,
  effectiveDesignerSettings,
  type TemplateDesignerSettings,
} from "./template-designer";
import {
  CV_TEMPLATES,
  isArabicCvTemplate,
  normalizeCvTemplateForLanguage,
  type CvTemplateId,
} from "./document-templates";
import { toPdfRtlVisualText } from "./arabic-pdf-text";
import { profilePhotoDataUrlForPdf } from "./profile-photo";
import pdfMake from "pdfmake/build/pdfmake";
import calibriRegularUrl from "@/assets/fonts/CalibriLatin-Regular.ttf?url";
import calibriItalicUrl from "@/assets/fonts/CalibriLatin-Italic.ttf?url";
import calibriBoldUrl from "@/assets/fonts/CalibriLatin-Bold.ttf?url";
import calibriBoldItalicUrl from "@/assets/fonts/CalibriLatin-BoldItalic.ttf?url";
import cambriaRegularUrl from "@/assets/fonts/CambriaLatin-Regular.ttf?url";
import cambriaBoldUrl from "@/assets/fonts/CambriaLatin-Bold.ttf?url";
import arialOfficialRegularUrl from "@/assets/fonts/ArialArabic-Regular.ttf?url";
import arialOfficialBoldUrl from "@/assets/fonts/ArialArabic-Bold.ttf?url";
import arialOfficialItalicUrl from "@/assets/fonts/ArialArabic-Italic.ttf?url";
import arialOfficialBoldItalicUrl from "@/assets/fonts/ArialArabic-BoldItalic.ttf?url";

const ACCENT = "#111827";
const MUTED = "#6b7280";
const RULE = "#111827";
const BANNER_BG = "#f4f4f5";
const BANNER_BAR = "#52525b";

// Same Lucide outlines used by the HTML template. Keeping them as SVG paths
// preserves the crisp vector rendering without turning the CV into an image.
const CONTACT_ICONS = {
  phone:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#52525b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="#52525b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="#52525b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>',
} as const;
const CONTACT_LINE_HEIGHT = 16.5;
const CONTACT_ICON_COLUMN = 12;
const CONTACT_ICON_SIZE = 11;
// Optical baseline correction: centering on the 16.5 pt line box placed the
// visible Lucide strokes 1.5-3 px below the adjacent Calibri glyphs.
const CONTACT_ICON_TOP = 0.25;

// Canadian templates use North-American Letter: 612 x 792 pt.
const PAGE_W = 612;
const MARGIN_X = 32;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const V2_PAGE_W = 612;
const V2_MARGIN_X = 48;
const V2_CONTENT_W = V2_PAGE_W - V2_MARGIN_X * 2;
const V2_DATE_COLUMN_W = 100;
const V2_COLUMN_GAP = 13;
const V2_DETAILS_W = V2_CONTENT_W - V2_DATE_COLUMN_W - V2_COLUMN_GAP;
const V2_LIST_MARKER_W = 10;
const V2_LIST_GAP = 4;
const V2_FULL_LIST_TEXT_W = V2_CONTENT_W - V2_LIST_MARKER_W - V2_LIST_GAP;
const V2_DETAILS_LIST_TEXT_W = V2_DETAILS_W - V2_LIST_MARKER_W - V2_LIST_GAP;
const V2_ACCENT = "#953735";
const V2_MUTED = "#595959";
const V2_BANNER_BG = "#f2f2f2";
let fontsConfigured = false;
const fontFilePromises = new Map<string, Promise<void>>();

export { CV_TEMPLATES };
export type { CvTemplateId };

const FONT_FILES = {
  "CalibriLatin-Regular.ttf": calibriRegularUrl,
  "CalibriLatin-Italic.ttf": calibriItalicUrl,
  "CalibriLatin-Bold.ttf": calibriBoldUrl,
  "CalibriLatin-BoldItalic.ttf": calibriBoldItalicUrl,
  "CambriaLatin-Regular.ttf": cambriaRegularUrl,
  "CambriaLatin-Bold.ttf": cambriaBoldUrl,
  "ArialArabic-Regular.ttf": arialOfficialRegularUrl,
  "ArialArabic-Bold.ttf": arialOfficialBoldUrl,
  "ArialArabic-Italic.ttf": arialOfficialItalicUrl,
  "ArialArabic-BoldItalic.ttf": arialOfficialBoldItalicUrl,
} as const;

const CV_FONTS: TFontDictionary = {
  Calibri: {
    normal: "CalibriLatin-Regular.ttf",
    bold: "CalibriLatin-Bold.ttf",
    italics: "CalibriLatin-Italic.ttf",
    bolditalics: "CalibriLatin-BoldItalic.ttf",
  },
  CalibriSupplied: {
    normal: "CalibriLatin-Regular.ttf",
    bold: "CalibriLatin-Bold.ttf",
    italics: "CalibriLatin-Italic.ttf",
    bolditalics: "CalibriLatin-BoldItalic.ttf",
  },
  Cambria: {
    normal: "CambriaLatin-Regular.ttf",
    bold: "CambriaLatin-Bold.ttf",
    italics: "CambriaLatin-Regular.ttf",
    bolditalics: "CambriaLatin-Bold.ttf",
  },
  NotoSansSC: {
    normal: "NotoSansSC-VF.ttf",
    bold: "NotoSansSC-VF.ttf",
    italics: "NotoSansSC-VF.ttf",
    bolditalics: "NotoSansSC-VF.ttf",
  },
  NotoSansArabic: {
    normal: "ArialArabic-Regular.ttf",
    bold: "ArialArabic-Bold.ttf",
    italics: "ArialArabic-Italic.ttf",
    bolditalics: "ArialArabic-BoldItalic.ttf",
  },
  HacenTunisia: {
    normal: "ArialArabic-Regular.ttf",
    bold: "ArialArabic-Bold.ttf",
    italics: "ArialArabic-Italic.ttf",
    bolditalics: "ArialArabic-BoldItalic.ttf",
  },
  ArialOfficial: {
    normal: "ArialArabic-Regular.ttf",
    bold: "ArialArabic-Bold.ttf",
    italics: "ArialArabic-Italic.ttf",
    bolditalics: "ArialArabic-BoldItalic.ttf",
  },
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function ensureFontConfiguration() {
  if (fontsConfigured) return;
  pdfMake.addFonts(CV_FONTS);
  fontsConfigured = true;
}

async function registerFontFile(filename: string, url: string) {
  const existing = fontFilePromises.get(filename);
  if (existing) return existing;
  const registration = (async () => {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) throw new Error(`Police PDF indisponible (${response.status}) : ${filename}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    pdfMake.addVirtualFileSystem({ [filename]: bytesToBase64(bytes) } as TVirtualFileSystem);
  })();
  fontFilePromises.set(filename, registration);
  try {
    await registration;
  } catch (error) {
    fontFilePromises.delete(filename);
    throw error;
  }
}

async function ensureFontFamily(family: keyof typeof CV_FONTS) {
  ensureFontConfiguration();
  const filenames = [...new Set(Object.values(CV_FONTS[family]))];
  await Promise.all(
    filenames.map(async (filename) => {
      if (filename === "NotoSansSC-VF.ttf") {
        const { default: notoSansScUrl } = await import("@/assets/fonts/NotoSansSC-VF.ttf?url");
        return registerFontFile(filename, notoSansScUrl);
      }
      const url = FONT_FILES[filename as keyof typeof FONT_FILES];
      if (!url) throw new Error(`Fichier de police PDF non configuré : ${filename}`);
      return registerFontFile(filename, url);
    }),
  );
}

async function ensureFontsForDocument(templateId: CvTemplateId, language: DocumentLanguage) {
  const family = isArabicCvTemplate(templateId)
    ? "ArialOfficial"
    : templateId === "canadian-v4" && language !== "zh" && language !== "ar"
      ? "Cambria"
      : documentFont(language);
  await ensureFontFamily(family as keyof typeof CV_FONTS);
}

type ObjectiveRun = {
  text: string;
  bold?: boolean;
  italics?: boolean;
  decoration?: "underline" | "lineThrough";
  link?: string;
};

function objectiveRichRuns(cv: CV, transformText = (text: string) => text): ObjectiveRun[] {
  const html = normalizeObjectiveFormat(cv.objectif_format).html;
  if (!html || typeof DOMParser === "undefined") return [{ text: transformText(cv.objectif) }];

  const documentNode = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const runs: ObjectiveRun[] = [];
  const pushText = (text: string, style: Omit<ObjectiveRun, "text"> = {}) => {
    if (!text) return;
    const transformed = transformText(text.replace(/\u00a0/g, " "));
    const previous = runs.at(-1);
    if (
      previous &&
      previous.bold === style.bold &&
      previous.italics === style.italics &&
      previous.decoration === style.decoration &&
      previous.link === style.link
    ) {
      previous.text += transformed;
    } else {
      runs.push({ text: transformed, ...style });
    }
  };

  const visit = (node: Node, inherited: Omit<ObjectiveRun, "text"> = {}) => {
    if (node.nodeType === 3) {
      pushText(node.textContent || "", inherited);
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    const tag = node.tagName;
    if (tag === "BR") {
      pushText("\n", inherited);
      return;
    }
    const next = { ...inherited };
    if (tag === "B" || tag === "STRONG") next.bold = true;
    if (tag === "I" || tag === "EM") next.italics = true;
    if (tag === "U") next.decoration = "underline";
    if (tag === "S" || tag === "STRIKE" || tag === "DEL") next.decoration = "lineThrough";
    if (tag === "A") {
      const href = node.getAttribute("href") || "";
      if (/^(https?:|mailto:)/i.test(href)) next.link = href;
    }
    if (tag === "LI") {
      const parentTag = node.parentElement?.tagName;
      const index = [...(node.parentElement?.children || [])].indexOf(node) + 1;
      pushText(parentTag === "OL" ? `${index}. ` : "• ", next);
    }
    for (const child of [...node.childNodes]) visit(child, next);
    if (["BLOCKQUOTE", "DIV", "LI", "P"].includes(tag)) pushText("\n", inherited);
  };

  for (const child of [...documentNode.body.childNodes]) visit(child);
  const last = runs.at(-1);
  if (last) last.text = last.text.replace(/\n+$/g, "");
  return runs.filter((run) => run.text.length > 0).length
    ? runs.filter((run) => run.text.length > 0)
    : [{ text: transformText(cv.objectif) }];
}

function objectivePdfContent(
  cv: CV,
  baseFontSize: number,
  defaults: Record<string, unknown> = {},
  transformText?: (text: string) => string,
): Content {
  const format = normalizeObjectiveFormat(cv.objectif_format);
  return {
    ...defaults,
    text: objectiveRichRuns(cv, transformText),
    fontSize: Number((baseFontSize * (format.fontSize / 15)).toFixed(2)),
    ...(format.alignment ? { alignment: format.alignment } : {}),
    ...(format.color ? { color: format.color } : {}),
  } as Content;
}

type RichInline = string | ObjectiveRun[];

function richRunsForElement(
  element: Element,
  transformText: (text: string) => string,
): ObjectiveRun[] {
  const runs: ObjectiveRun[] = [];
  const pushText = (text: string, style: Omit<ObjectiveRun, "text"> = {}) => {
    if (!text) return;
    const transformed = transformText(text.replace(/\u00a0/g, " "));
    const previous = runs.at(-1);
    if (
      previous &&
      previous.bold === style.bold &&
      previous.italics === style.italics &&
      previous.decoration === style.decoration &&
      previous.link === style.link
    ) {
      previous.text += transformed;
    } else {
      runs.push({ text: transformed, ...style });
    }
  };
  const visit = (node: Node, inherited: Omit<ObjectiveRun, "text"> = {}) => {
    if (node.nodeType === Node.TEXT_NODE) {
      pushText(node.textContent || "", inherited);
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName === "BR") {
      pushText("\n", inherited);
      return;
    }
    const next = { ...inherited };
    if (node.matches("b,strong")) next.bold = true;
    if (node.matches("i,em")) next.italics = true;
    if (node.matches("u")) next.decoration = "underline";
    if (node.matches("s,strike,del")) next.decoration = "lineThrough";
    if (node.matches("a")) {
      const href = node.getAttribute("href") || "";
      if (/^(https?:|mailto:)/i.test(href)) next.link = href;
    }
    for (const child of [...node.childNodes]) visit(child, next);
  };
  for (const child of [...element.childNodes]) visit(child);
  return runs.filter((run) => run.text.length > 0);
}

function richListItems(
  items: string[],
  formatValue: ObjectiveFormat | undefined,
  transformText = (text: string) => text,
): RichInline[] {
  const fallback = items.filter(Boolean).map((item) => transformText(item)) as RichInline[];
  const html = normalizeObjectiveFormat(formatValue).html;
  if (!html || typeof DOMParser === "undefined") return fallback;
  const documentNode = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  let elements = [...documentNode.body.querySelectorAll(":scope > ul > li, :scope > ol > li")];
  if (!elements.length) {
    elements = [...documentNode.body.querySelectorAll(":scope > p, :scope > div")];
  }
  const richItems = elements
    .map((element) => richRunsForElement(element, transformText))
    .filter((runs) => runs.some((run) => run.text.trim().length > 0));
  return richItems.length === fallback.length ? richItems : fallback;
}

function richListText(
  formatValue: ObjectiveFormat | undefined,
  text: RichInline,
  baseFontSize: number,
  defaults: Record<string, unknown> = {},
): Content {
  const format = normalizeObjectiveFormat(formatValue);
  return {
    ...defaults,
    text,
    fontSize: Number((baseFontSize * (format.fontSize / 15)).toFixed(2)),
    ...(format.alignment ? { alignment: format.alignment } : {}),
    ...(format.color ? { color: format.color } : {}),
  } as Content;
}

function experienceRichDescriptions(
  experience: Experience,
  transformText = (text: string) => text,
) {
  return richListItems(experience.descriptions, experience.descriptions_format, transformText);
}

function achievementText(
  experience: Experience,
  text: RichInline,
  baseFontSize: number,
  defaults: Record<string, unknown> = {},
) {
  return richListText(experience.descriptions_format, text, baseFontSize, defaults);
}

function richListUl(
  items: string[],
  format: ObjectiveFormat | undefined,
  baseFontSize: number,
): Content {
  return {
    ul: richListItems(items, format).map((item) => richListText(format, item, baseFontSize)),
  } as Content;
}

function companyLine(
  experience: Experience,
  text: string,
  logoSize: number,
  defaults: Record<string, unknown> = {},
  rtl = false,
): Content {
  if (!experience.logo?.dataUrl) return { ...defaults, text } as Content;
  const { margin, ...textDefaults } = defaults;
  const logo = {
    width: logoSize,
    image: experience.logo.dataUrl,
    fit: [logoSize, logoSize],
  } as Content;
  const body = { width: "*", ...textDefaults, text } as Content;
  return {
    columns: rtl ? [body, logo] : [logo, body],
    columnGap: 4,
    ...(margin ? { margin } : {}),
  } as Content;
}

function profilePhotoBlock(cv: CV, size = 68, bottomMargin = 10): Content[] {
  if (!cv.photo?.dataUrl) return [];
  return [
    {
      columns: [
        { width: "*", text: "" },
        {
          width: size + 6,
          table: {
            widths: [size],
            body: [
              [
                {
                  image: cv.photo.dataUrl,
                  fit: [size, size],
                  alignment: "center",
                  margin: [2, 2, 2, 2],
                },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.8,
            vLineWidth: () => 0.8,
            hLineColor: () => "#d4d4d8",
            vLineColor: () => "#d4d4d8",
            paddingLeft: () => 0,
            paddingRight: () => 0,
            paddingTop: () => 0,
            paddingBottom: () => 0,
          },
        },
        { width: "*", text: "" },
      ],
      columnGap: 0,
      margin: [0, 0, 0, bottomMargin],
    } as Content,
  ];
}

function contactLine(icon: keyof typeof CONTACT_ICONS, text: string): Content {
  return {
    columns: [
      {
        width: CONTACT_ICON_COLUMN,
        svg: CONTACT_ICONS[icon],
        fit: [CONTACT_ICON_SIZE, CONTACT_ICON_SIZE],
        margin: [
          (CONTACT_ICON_COLUMN - CONTACT_ICON_SIZE) / 2,
          CONTACT_ICON_TOP,
          (CONTACT_ICON_COLUMN - CONTACT_ICON_SIZE) / 2,
          0,
        ],
      },
      { width: "auto", text, fontSize: 11, lineHeight: 1.5 },
    ],
    columnGap: 8,
    margin: [0, 0, 0, 4],
  } as Content;
}

function header(cv: CV): Content {
  const contacts: Content[] = [];
  if (cv.telephone) contacts.push(contactLine("phone", cv.telephone));
  if (cv.email) contacts.push(contactLine("mail", cv.email));
  if (cv.adresse) contacts.push(contactLine("pin", cv.adresse));
  if (cv.statut_relocation) contacts.push(contactLine("pin", cv.statut_relocation));

  const BAR_H = Math.max(
    2,
    contacts.length * CONTACT_LINE_HEIGHT + Math.max(0, contacts.length - 1) * 4,
  );

  return {
    stack: [
      {
        columns: [
          {
            width: "*",
            stack: [
              {
                text: (cv.nom_complet || " ").toLocaleUpperCase(),
                fontSize: 24,
                lineHeight: 1,
                bold: true,
                color: ACCENT,
              },
              {
                text: (cv.titre_poste || " ").toLocaleUpperCase(),
                fontSize: 14,
                lineHeight: 1,
                color: MUTED,
                margin: [0, 6, 0, 0],
              },
            ],
            margin: [0, 4, 0, 0],
          },
          {
            width: "auto",
            columns: [
              {
                width: 2,
                canvas: [{ type: "rect", x: 0, y: 0, w: 2, h: BAR_H, color: BANNER_BAR }],
                relativePosition: { x: 24, y: 0 },
              },
              { width: "auto", stack: contacts, margin: [8, 0, 0, 0] },
            ],
            margin: [0, -4, 0, 0],
          },
        ],
        columnGap: 24,
      },
    ],
    margin: [0, 0, 0, 16],
  };
}

function sectionTitle(label: string): Content {
  return {
    headlineLevel: 1,
    stack: [
      {
        text: label,
        fontSize: 14,
        lineHeight: 1,
        bold: true,
        color: ACCENT,
        margin: [0, 0, 0, 3],
      },
      {
        canvas: [
          { type: "line", x1: 0, y1: 1, x2: CONTENT_W, y2: 1, lineWidth: 1, lineColor: RULE },
        ],
      },
    ],
    margin: [0, 8, 0, 15],
  };
}

const DATE_MONTHS = [
  {
    fr: "Jan",
    en: "Jan",
    es: "Ene",
    de: "Jan",
    it: "Gen",
    zh: "1月",
    ar: "يناير",
    aliases: ["janvier", "january", "enero", "januar", "gennaio", "janv", "jan"],
  },
  {
    fr: "Fév",
    en: "Feb",
    es: "Feb",
    de: "Feb",
    it: "Feb",
    zh: "2月",
    ar: "فبراير",
    aliases: [
      "février",
      "fevrier",
      "february",
      "febrero",
      "februar",
      "febbraio",
      "févr",
      "fevr",
      "feb",
    ],
  },
  {
    fr: "Mar",
    en: "Mar",
    es: "Mar",
    de: "Mär",
    it: "Mar",
    zh: "3月",
    ar: "مارس",
    aliases: ["mars", "march", "marzo", "märz", "maerz", "mar"],
  },
  {
    fr: "Avr",
    en: "Apr",
    es: "Abr",
    de: "Apr",
    it: "Apr",
    zh: "4月",
    ar: "أبريل",
    aliases: ["avril", "april", "abril", "aprile", "avr", "apr"],
  },
  {
    fr: "Mai",
    en: "May",
    es: "May",
    de: "Mai",
    it: "Mag",
    zh: "5月",
    ar: "مايو",
    aliases: ["mai", "may", "mayo", "maggio"],
  },
  {
    fr: "Juin",
    en: "Jun",
    es: "Jun",
    de: "Jun",
    it: "Giu",
    zh: "6月",
    ar: "يونيو",
    aliases: ["juin", "june", "junio", "juni", "giugno", "jun"],
  },
  {
    fr: "Juil",
    en: "Jul",
    es: "Jul",
    de: "Jul",
    it: "Lug",
    zh: "7月",
    ar: "يوليو",
    aliases: ["juillet", "july", "julio", "juli", "luglio", "juil", "jul"],
  },
  {
    fr: "Août",
    en: "Aug",
    es: "Ago",
    de: "Aug",
    it: "Ago",
    zh: "8月",
    ar: "أغسطس",
    aliases: ["août", "aout", "august", "agosto", "aug"],
  },
  {
    fr: "Sep",
    en: "Sep",
    es: "Sep",
    de: "Sep",
    it: "Set",
    zh: "9月",
    ar: "سبتمبر",
    aliases: ["septembre", "september", "septiembre", "settembre", "sept", "sep"],
  },
  {
    fr: "Oct",
    en: "Oct",
    es: "Oct",
    de: "Okt",
    it: "Ott",
    zh: "10月",
    ar: "أكتوبر",
    aliases: ["octobre", "october", "octubre", "oktober", "ottobre", "oct"],
  },
  {
    fr: "Nov",
    en: "Nov",
    es: "Nov",
    de: "Nov",
    it: "Nov",
    zh: "11月",
    ar: "نوفمبر",
    aliases: ["novembre", "november", "noviembre", "nov"],
  },
  {
    fr: "Déc",
    en: "Dec",
    es: "Dic",
    de: "Dez",
    it: "Dic",
    zh: "12月",
    ar: "ديسمبر",
    aliases: [
      "décembre",
      "decembre",
      "december",
      "diciembre",
      "dezember",
      "dicembre",
      "déc",
      "dec",
    ],
  },
] as const;

function formatCvDate(value: string, language: DocumentLanguage) {
  let result = value.trim();
  for (const month of DATE_MONTHS) {
    const aliases = [...month.aliases].sort((left, right) => right.length - left.length).join("|");
    result = result.replace(new RegExp(`\\b(?:${aliases})\\b\\.?`, "giu"), month[language]);
  }
  return result
    .replace(/\s*[–—-]\s*/g, " - ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function experienceBlock(e: Experience, language: DocumentLanguage): Content {
  const descriptions = experienceRichDescriptions(e);
  return {
    unbreakable: true,
    columns: [
      {
        width: 110,
        stack: [
          {
            text: formatCvDate(e.dates || "", language),
            fontSize: 11,
            color: MUTED,
            lineHeight: 1.5,
          },
          { text: e.lieu || "", fontSize: 11, color: MUTED, lineHeight: 1.5 },
        ],
      },
      {
        width: "*",
        stack: [
          { text: e.titre || "", bold: true },
          companyLine(e, e.employeur || "", 11, { color: MUTED }),
          {
            ul: descriptions.map((item) => achievementText(e, item, 11)),
            margin: [0, 4, 0, 0],
          },
        ],
      },
    ],
    columnGap: 12,
    margin: [0, 0, 0, 12],
  } as Content;
}

function formationBlock(f: Formation, language: DocumentLanguage): Content {
  return {
    unbreakable: true,
    columns: [
      {
        width: 110,
        stack: [
          {
            text: formatCvDate(f.date || "", language),
            fontSize: 11,
            color: MUTED,
            lineHeight: 1.5,
          },
          { text: f.lieu || "", fontSize: 11, color: MUTED, lineHeight: 1.5 },
        ],
      },
      {
        width: "*",
        stack: [
          { text: f.titre || "", bold: true, lineHeight: 1.45 },
          { text: f.institution || "", color: MUTED, lineHeight: 1.45 },
          ...(f.competences
            ? [{ text: f.competences, lineHeight: 1.45, margin: [0, 2, 0, 0] } as Content]
            : []),
        ],
      },
    ],
    columnGap: 12,
    margin: [0, 0, 0, 8],
  } as Content;
}

function educationBlock(e: Education, language: DocumentLanguage): Content {
  return {
    unbreakable: true,
    columns: [
      {
        width: 110,
        stack: [
          {
            text: formatCvDate(e.date || "", language),
            fontSize: 11,
            color: MUTED,
            lineHeight: 1.5,
          },
          { text: e.lieu || "", fontSize: 11, color: MUTED, lineHeight: 1.5 },
        ],
      },
      {
        width: "*",
        stack: [
          { text: e.titre || "", bold: true },
          ...(e.institution
            ? [{ text: e.institution, color: MUTED, margin: [0, 1, 0, 0] } as Content]
            : []),
          ...(e.option ? [{ text: e.option, margin: [0, 1, 0, 0] } as Content] : []),
          ...(e.equivalence
            ? [
                {
                  text: e.equivalence,
                  italics: true,
                  color: MUTED,
                  margin: [0, 2, 0, 0],
                } as Content,
              ]
            : []),
        ],
      },
    ],
    columnGap: 12,
    margin: [0, 0, 0, 12],
  } as Content;
}

/** Mark the first block so page-break logic can prevent an orphan section heading. */
function section(title: string, first: Content, ...rest: Content[]): Content[] {
  return [sectionTitle(title), { headlineLevel: 2, stack: [first] }, ...rest];
}

function additionalInformation(cv: CV, language: DocumentLanguage): string[] {
  const labels = {
    fr: {
      candidature: "Candidature",
      date: "Date de naissance",
      family: "Situation familiale",
      licence: "Permis de conduire",
      service: "Service national",
      region: "Wilaya / Province",
      country: "Pays",
    },
    en: {
      candidature: "Application",
      date: "Date of birth",
      family: "Marital status",
      licence: "Driver's licence",
      service: "National service",
      region: "Province / Region",
      country: "Country",
    },
    es: {
      candidature: "Candidatura",
      date: "Fecha de nacimiento",
      family: "Estado civil",
      licence: "Permiso de conducir",
      service: "Servicio nacional",
      region: "Provincia / Región",
      country: "País",
    },
    de: {
      candidature: "Bewerbung",
      date: "Geburtsdatum",
      family: "Familienstand",
      licence: "Führerschein",
      service: "Wehrdienst",
      region: "Bundesland / Region",
      country: "Land",
    },
    it: {
      candidature: "Candidatura",
      date: "Data di nascita",
      family: "Stato civile",
      licence: "Patente di guida",
      service: "Servizio nazionale",
      region: "Provincia / Regione",
      country: "Paese",
    },
    zh: {
      candidature: "求职申请",
      date: "出生日期",
      family: "婚姻状况",
      licence: "驾驶执照",
      service: "服役情况",
      region: "省 / 地区",
      country: "国家",
    },
    ar: {
      candidature: "طلب التوظيف",
      date: "تاريخ الميلاد",
      family: "الحالة العائلية",
      licence: "رخصة القيادة",
      service: "الخدمة الوطنية",
      region: "الولاية / المنطقة",
      country: "البلد",
    },
  }[language];

  return [
    [labels.candidature, cv.candidature],
    [labels.date, cv.date_naissance],
    [labels.family, cv.situation_familiale],
    [labels.licence, cv.permis_conduire],
    [labels.service, cv.service_national],
    [labels.region, cv.wilaya],
    [labels.country, cv.pays],
  ]
    .filter(([, value]) => value.trim())
    .map(([label, value]) => `${label} : ${value}`);
}

function cvCopy(language: DocumentLanguage) {
  return {
    fr: {
      objective: "OBJECTIF",
      skills: "COMPÉTENCES CLÉS",
      languages: "LANGUES",
      experience: "EXPÉRIENCE PROFESSIONNELLE",
      training: "FORMATION",
      education: "ÉDUCATION",
      participation: "PARTICIPATION & ACTIVITÉS",
      certifications: "CERTIFICATIONS",
      interests: "CENTRES D'INTÉRÊT",
      additional: "INFORMATIONS COMPLÉMENTAIRES",
      references: "RÉFÉRENCES",
      responsibilities: "Mes responsabilités :",
      specialty: "Spécialité",
      email: "Courriel",
      professional: "PROFESSIONNELLES",
      volunteering: "BÉNÉVOLAT",
    },
    en: {
      objective: "PROFESSIONAL SUMMARY",
      skills: "KEY SKILLS",
      languages: "LANGUAGES",
      experience: "PROFESSIONAL EXPERIENCE",
      training: "TRAINING",
      education: "EDUCATION",
      participation: "VOLUNTEERING & ACTIVITIES",
      certifications: "CERTIFICATIONS",
      interests: "INTERESTS",
      additional: "ADDITIONAL INFORMATION",
      references: "REFERENCES",
      responsibilities: "Key responsibilities:",
      specialty: "Specialization",
      email: "Email",
      professional: "PROFESSIONAL",
      volunteering: "VOLUNTEERING",
    },
    es: {
      objective: "RESUMEN PROFESIONAL",
      skills: "COMPETENCIAS CLAVE",
      languages: "IDIOMAS",
      experience: "EXPERIENCIA PROFESIONAL",
      training: "FORMACIÓN",
      education: "EDUCACIÓN",
      participation: "VOLUNTARIADO Y ACTIVIDADES",
      certifications: "CERTIFICACIONES",
      interests: "INTERESES",
      additional: "INFORMACIÓN ADICIONAL",
      references: "REFERENCIAS",
      responsibilities: "Responsabilidades principales:",
      specialty: "Especialidad",
      email: "Correo electrónico",
      professional: "PROFESIONAL",
      volunteering: "VOLUNTARIADO",
    },
    de: {
      objective: "BERUFLICHES PROFIL",
      skills: "KERNKOMPETENZEN",
      languages: "SPRACHEN",
      experience: "BERUFSERFAHRUNG",
      training: "WEITERBILDUNG",
      education: "AUSBILDUNG",
      participation: "EHRENAMT UND AKTIVITÄTEN",
      certifications: "ZERTIFIKATE",
      interests: "INTERESSEN",
      additional: "ZUSÄTZLICHE INFORMATIONEN",
      references: "REFERENZEN",
      responsibilities: "Hauptaufgaben:",
      specialty: "Schwerpunkt",
      email: "E-Mail",
      professional: "BERUFLICH",
      volunteering: "EHRENAMT",
    },
    it: {
      objective: "PROFILO PROFESSIONALE",
      skills: "COMPETENZE CHIAVE",
      languages: "LINGUE",
      experience: "ESPERIENZA PROFESSIONALE",
      training: "FORMAZIONE",
      education: "ISTRUZIONE",
      participation: "VOLONTARIATO E ATTIVITÀ",
      certifications: "CERTIFICAZIONI",
      interests: "INTERESSI",
      additional: "INFORMAZIONI AGGIUNTIVE",
      references: "REFERENZE",
      responsibilities: "Responsabilità principali:",
      specialty: "Specializzazione",
      email: "E-mail",
      professional: "PROFESSIONALE",
      volunteering: "VOLONTARIATO",
    },
    zh: {
      objective: "职业概述",
      skills: "核心技能",
      languages: "语言能力",
      experience: "工作经历",
      training: "专业培训",
      education: "教育背景",
      participation: "志愿服务与活动",
      certifications: "专业认证",
      interests: "兴趣爱好",
      additional: "其他信息",
      references: "推荐人",
      responsibilities: "主要职责：",
      specialty: "专业方向",
      email: "电子邮箱",
      professional: "职业技能",
      volunteering: "志愿服务",
    },
    ar: {
      objective: "الملخص المهني",
      skills: "المهارات الأساسية",
      languages: "اللغات",
      experience: "الخبرة المهنية",
      training: "التكوين المهني",
      education: "التعليم",
      participation: "التطوع والأنشطة",
      certifications: "الشهادات",
      interests: "الاهتمامات",
      additional: "معلومات إضافية",
      references: "المراجع",
      responsibilities: "المسؤوليات الرئيسية:",
      specialty: "التخصص",
      email: "البريد الإلكتروني",
      professional: "مهني",
      volunteering: "التطوع",
    },
  }[language];
}

function cvLanguages(cv: CV, language: DocumentLanguage, uppercase = true) {
  const names = {
    fr: ["Français", "Anglais", "Arabe", "Allemand", "Espagnol", "Kabyle"],
    en: ["French", "English", "Arabic", "German", "Spanish", "Kabyle"],
    es: ["Francés", "Inglés", "Árabe", "Alemán", "Español", "Cabilio"],
    de: ["Französisch", "Englisch", "Arabisch", "Deutsch", "Spanisch", "Kabylisch"],
    it: ["Francese", "Inglese", "Arabo", "Tedesco", "Spagnolo", "Cabilo"],
    zh: ["法语", "英语", "阿拉伯语", "德语", "西班牙语", "卡拜尔语"],
    ar: ["الفرنسية", "الإنجليزية", "العربية", "الألمانية", "الإسبانية", "القبائلية"],
  }[language];
  const values = [
    cv.langues.fr,
    cv.langues.en,
    cv.langues.ar,
    cv.langues.de,
    cv.langues.es,
    cv.langues.kab,
  ];
  return names
    .map((name, index) => [uppercase ? name.toLocaleUpperCase(language) : name, values[index]])
    .filter(([, value]) => value && value.trim());
}

function buildCvPdfV1(cv: CV, language: DocumentLanguage): TDocumentDefinitions {
  const labels = cvCopy(language);
  const langues = cvLanguages(cv, language, false);

  const content: Content[] = [...profilePhotoBlock(cv), header(cv)];

  if (cv.objectif) content.push(...section(labels.objective, objectivePdfContent(cv, 12)));

  const competences = cv.competences.filter(Boolean);
  if (competences.length)
    content.push(...section(labels.skills, richListUl(competences, cv.competences_format, 12)));

  if (langues.length)
    content.push(
      ...section(labels.languages, {
        columns: [0, 1, 2].map((col) => ({
          width: "*",
          stack: langues
            .filter((_, i) => i % 3 === col)
            .map(([k, v]) => ({
              text: [{ text: `${k}: `, bold: true }, { text: v as string }],
              margin: [0, 0, 0, 4],
            })),
        })),
      }),
    );

  const exps = cv.experiences.filter((e) => e.titre || e.employeur || e.dates);
  if (exps.length) {
    const [first, ...rest] = exps;
    content.push(
      ...section(
        labels.experience,
        experienceBlock(first, language),
        ...rest.map((item) => experienceBlock(item, language)),
      ),
    );
  }

  const forms = cv.formations.filter((f) => f.titre || f.institution);
  if (forms.length) {
    const [first, ...rest] = forms;
    content.push(
      ...section(
        labels.training,
        formationBlock(first, language),
        ...rest.map((item) => formationBlock(item, language)),
      ),
    );
  }

  const edus = cv.educations.filter((e) => e.titre || e.institution);
  if (edus.length) {
    const [first, ...rest] = edus;
    content.push(
      ...section(
        labels.education,
        educationBlock(first, language),
        ...rest.map((item) => educationBlock(item, language)),
      ),
    );
  }

  const parts = cv.participations.filter(Boolean);
  if (parts.length)
    content.push(...section(labels.participation, richListUl(parts, cv.participations_format, 12)));

  const certs = cv.certifications.filter(Boolean);
  if (certs.length)
    content.push(
      ...section(labels.certifications, richListUl(certs, cv.certifications_format, 12)),
    );

  const ints = cv.interets.filter(Boolean);
  if (ints.length)
    content.push(...section(labels.interests, richListUl(ints, cv.interets_format, 12)));

  const extras = additionalInformation(cv, language);
  if (extras.length) content.push(...section(labels.additional, { ul: extras }));

  const references = cv.references.filter(Boolean);
  if (references.length) content.push(...section(labels.references, { ul: references }));

  return {
    info: {
      title: cv.nom_complet ? `CV - ${cv.nom_complet}` : "CV",
      author: cv.nom_complet || "",
      subject: cv.titre_poste || "Curriculum Vitae",
    },
    pageSize: "LETTER",
    pageMargins: [32, 32, 32, 32],
    background: (currentPage) =>
      currentPage === 1
        ? {
            canvas: [{ type: "rect", x: 0, y: 0, w: PAGE_W, h: 126, color: BANNER_BG }],
          }
        : null,
    defaultStyle: {
      font: documentFont(language),
      fontSize: 12,
      color: "#111827",
      lineHeight: 1.625,
      alignment: language === "ar" ? "right" : undefined,
    },
    pageBreakBefore: (currentNode, nodeQueries) =>
      currentNode.headlineLevel === 1 &&
      !nodeQueries.getFollowingNodesOnPage().some((node) => node.headlineLevel === 2),
    content,
  };
}

const CONTACT_ICONS_V2 = {
  phone: CONTACT_ICONS.phone.replaceAll("#52525b", V2_ACCENT),
  mail: CONTACT_ICONS.mail.replaceAll("#52525b", V2_ACCENT),
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="${V2_ACCENT}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>`,
  plane: `<svg viewBox="0 0 24 24" fill="none" stroke="${V2_ACCENT}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 19h20"/><path d="M4 15h4l3-4 9 3 2-2-10-6-3-4-2 1 2 5-3 3-3-1-1 1Z"/></svg>`,
} as const;

function v2CharacterWidthEm(character: string) {
  if (/\p{Mark}/u.test(character)) return 0;
  if (/\s/u.test(character)) return 0.28;
  if (/\p{Script=Arabic}/u.test(character)) return 0.37;
  if (/[A-Z]/u.test(character)) return 0.64;
  if (/[a-z]/u.test(character)) return 0.5;
  if (/\d/u.test(character)) return 0.52;
  if (/[\p{Punctuation}\p{Symbol}]/u.test(character)) return 0.3;
  return 0.5;
}

function v2EstimatedTextWidth(text: string, fontSize: number) {
  return Array.from(text).reduce(
    (total, character) => total + v2CharacterWidthEm(character) * fontSize,
    0,
  );
}

function v2SplitOversizedWord(word: string, maxWidth: number, fontSize: number) {
  const pieces: string[] = [];
  let current = "";
  for (const character of Array.from(word)) {
    const candidate = `${current}${character}`;
    if (current && v2EstimatedTextWidth(candidate, fontSize) > maxWidth) {
      pieces.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

function v2WrappedRtlText(text: string, maxWidth: number, fontSize: number) {
  // pdfMake shapes connected Arabic glyphs after this pass. Keep only the small
  // reserve required by those final glyph metrics, so each line still uses the
  // available column width before wrapping at a word boundary.
  const widthLimit = Math.max(fontSize, maxWidth * 0.97);
  return text
    .normalize("NFC")
    .split(/\r?\n/u)
    .flatMap((paragraph) => {
      const words = paragraph
        .trim()
        .split(/\s+/u)
        .filter(Boolean)
        .flatMap((word) =>
          v2EstimatedTextWidth(word, fontSize) > widthLimit
            ? v2SplitOversizedWord(word, widthLimit, fontSize)
            : [word],
        );
      if (!words.length) return [""];
      const lines: string[] = [];
      let current: string[] = [];
      for (const word of words) {
        const candidate = [...current, word].join(" ");
        if (current.length && v2EstimatedTextWidth(candidate, fontSize) > widthLimit) {
          lines.push(current.join("\u00a0"));
          current = [word];
        } else {
          current.push(word);
        }
      }
      if (current.length) lines.push(current.join("\u00a0"));
      return lines;
    })
    .join("\n");
}

function v2RtlText(text: string, rtl: boolean, maxWidth = V2_CONTENT_W, fontSize = 10.6) {
  if (!rtl) return text;
  const containsArabic = /\p{Script=Arabic}/u.test(text);
  if (!containsArabic) return text;
  const startsWithArabic = /^\s*\p{Script=Arabic}/u.test(text);
  const numericCompensated = text.replace(/\d+(?:[.,:/+-]\d+)*/gu, (token) =>
    Array.from(token).reverse().join(""),
  );
  const protectedLatin = numericCompensated.replace(
    /[A-Za-z][A-Za-z0-9.+/#@_-]*/g,
    (token) => `\u200e${startsWithArabic ? Array.from(token).reverse().join("") : token}\u200e`,
  );
  return v2WrappedRtlText(protectedLatin, maxWidth, fontSize);
}

function v2RtlRichInline(
  item: RichInline,
  rtl: boolean,
  maxWidth = V2_FULL_LIST_TEXT_W,
  fontSize = 10.6,
): RichInline {
  if (!rtl) return item;
  return typeof item === "string"
    ? v2RtlText(item, true, maxWidth, fontSize)
    : item.map((run) => ({
        ...run,
        text: v2RtlText(run.text, true, maxWidth, fontSize),
      }));
}

function v2DateText(value: string, language: DocumentLanguage, rtl: boolean) {
  const formatted = formatCvDate(value, language).toLocaleUpperCase(language);
  return v2RtlText(rtl ? formatted.replace(/\s+-\s+/g, "\n") : formatted, rtl, V2_DATE_COLUMN_W, 9);
}

function v2ContactLine(icon: keyof typeof CONTACT_ICONS_V2, text: string, rtl = false): Content {
  const iconNode = {
    width: 13,
    svg: CONTACT_ICONS_V2[icon],
    fit: [11, 11],
    margin: rtl ? [1, 1, 0, 0] : [1, 1, 1, 0],
  } as Content;
  const textNode = {
    width: rtl ? 160 : "*",
    text: v2RtlText(text, rtl, 160, 8.2),
    fontSize: rtl ? 8.2 : 10,
    lineHeight: 1.25,
    alignment: "left",
  } as Content;
  return {
    columns: [iconNode, textNode],
    columnGap: rtl ? 4 : 6,
    margin: [0, 0, 0, 3],
  } as Content;
}

function v2Header(cv: CV, rtl = false): Content {
  const nameParts = cv.nom_complet.trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts.shift() || " ";
  const remainingName = nameParts.join(" ");
  const contacts: Content[] = [];

  if (cv.telephone) contacts.push(v2ContactLine("phone", cv.telephone, rtl));
  if (cv.email) contacts.push(v2ContactLine("mail", cv.email, rtl));
  if (cv.adresse) contacts.push(v2ContactLine("home", cv.adresse, rtl));
  if (cv.statut_relocation) contacts.push(v2ContactLine("plane", cv.statut_relocation, rtl));

  const identity = {
    width: "*",
    stack: [
      {
        text: rtl
          ? [
              { text: v2RtlText(remainingName, true, 220, 24), color: V2_ACCENT },
              { text: remainingName ? "\u00a0" : "" },
              { text: v2RtlText(firstName, true, 110, 24), color: "#000000" },
            ]
          : [
              { text: firstName.toLocaleUpperCase("fr"), color: "#000000" },
              remainingName
                ? { text: ` ${remainingName.toLocaleUpperCase("fr")}`, color: V2_ACCENT }
                : { text: "" },
            ],
        fontSize: 24,
        bold: true,
        lineHeight: 1,
        alignment: rtl ? "right" : "left",
      },
      {
        text: v2RtlText((cv.titre_poste || " ").toLocaleUpperCase("fr"), rtl, 300, 14),
        fontSize: 14,
        bold: true,
        color: V2_MUTED,
        alignment: rtl ? "right" : "left",
        margin: [0, 11, 0, 0],
      },
    ],
  } as Content;
  const divider = {
    width: 3,
    designerElementId: "native:arabic-pro-v2:header-divider",
    canvas: [{ type: "rect", x: 0, y: 0, w: 3, h: 60, color: V2_MUTED }],
  } as Content;
  const contactStack = {
    width: rtl ? "auto" : "*",
    stack: contacts,
    margin: rtl ? [0, -1, 4, 0] : [8, -1, 0, 0],
  } as Content;
  const contactPanel = {
    width: rtl ? 184 : 228,
    columns: rtl ? [contactStack, divider] : [divider, contactStack],
  } as Content;

  return {
    columns: rtl ? [contactPanel, identity] : [identity, contactPanel],
    columnGap: 18,
    margin: [0, 0, 0, 44],
  } as Content;
}

function v2SectionTitle(label: string, topMargin = 10, rtl = false): Content {
  return {
    headlineLevel: 1,
    stack: [
      {
        text: v2RtlText(label, rtl, V2_CONTENT_W, 14.2),
        fontSize: 14.2,
        bold: true,
        color: V2_ACCENT,
        alignment: rtl ? "right" : "left",
        lineHeight: 1,
        margin: [0, 0, 0, 3],
      },
      {
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 1,
            x2: V2_CONTENT_W,
            y2: 1,
            lineWidth: 1.2,
            lineColor: V2_ACCENT,
          },
        ],
      },
    ],
    margin: [0, topMargin, 0, 12],
  } as Content;
}

const V2_DIAMOND_MARKER = `<svg viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><g fill="${V2_ACCENT}"><path d="M6 0.5 8.5 3 6 5.5 3.5 3Z"/><path d="M6 6.5 8.5 9 6 11.5 3.5 9Z"/><path d="M0.5 6 3 3.5 5.5 6 3 8.5Z"/><path d="M6.5 6 9 3.5 11.5 6 9 8.5Z"/></g></svg>`;
const V2_CHECK_MARKER = `<svg viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 6.5 4.5 9.5 10.5 1.5" fill="none" stroke="${V2_ACCENT}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
// Calibri's visible glyphs sit high in their line box. The source template's
// marker starts level with the cap height, so only a tiny optical offset is used.
const V2_LIST_MARKER_TOP = 0.25;

function v2List(
  items: RichInline[],
  marker: "diamond" | "check" = "diamond",
  format?: ObjectiveFormat,
  rtl = false,
  availableTextWidth = V2_FULL_LIST_TEXT_W,
): Content {
  return {
    stack: items.filter(Boolean).map((item) => {
      const markerNode = {
        width: 10,
        svg: marker === "check" ? V2_CHECK_MARKER : V2_DIAMOND_MARKER,
        fit: [7, 7],
        margin: rtl ? [3, V2_LIST_MARKER_TOP, 0, 0] : [0, V2_LIST_MARKER_TOP, 3, 0],
      } as Content;
      const listFontSize = format ? Number((10 * (format.fontSize / 15)).toFixed(2)) : 10.6;
      const visualItem = v2RtlRichInline(item, rtl, availableTextWidth, listFontSize);
      const textNode = format
        ? richListText(format, visualItem, 10, {
            width: "*",
            alignment: rtl ? "right" : "left",
          })
        : ({
            width: "*",
            text: visualItem,
            alignment: rtl ? "right" : "left",
          } as Content);
      return {
        unbreakable: true,
        columns: rtl ? [textNode, markerNode] : [markerNode, textNode],
        columnGap: 4,
        margin: [0, 0, 0, 2],
      } as Content;
    }),
  } as Content;
}

function v2ExperienceBlock(
  experience: Experience,
  language: DocumentLanguage,
  rtl = false,
): Content {
  const descriptions = experienceRichDescriptions(experience);
  const dateColumn = {
    width: 100,
    stack: [
      {
        text: v2DateText(experience.dates || "", language, rtl),
        bold: true,
        color: V2_ACCENT,
        fontSize: 9,
        alignment: rtl ? "right" : "left",
      },
      {
        text: v2RtlText(experience.lieu || "", rtl, V2_DATE_COLUMN_W, 9),
        fontSize: 9,
        alignment: rtl ? "right" : "left",
        margin: [0, 2, 0, 0],
      },
    ],
  } as Content;
  const detailsColumn = {
    width: "*",
    stack: [
      {
        text: v2RtlText((experience.titre || "").toLocaleUpperCase("fr"), rtl, V2_DETAILS_W, 11),
        bold: true,
        fontSize: 11,
        alignment: rtl ? "right" : "left",
      },
      companyLine(
        experience,
        v2RtlText((experience.employeur || "").toLocaleUpperCase("fr"), rtl, V2_DETAILS_W, 11),
        11,
        {
          bold: true,
          fontSize: 11,
          color: V2_MUTED,
          alignment: rtl ? "right" : "left",
          margin: [0, 2, 0, 3],
        },
        rtl,
      ),
      v2List(descriptions, "diamond", experience.descriptions_format, rtl, V2_DETAILS_LIST_TEXT_W),
    ],
  } as Content;
  return {
    columns: rtl ? [detailsColumn, dateColumn] : [dateColumn, detailsColumn],
    columnGap: V2_COLUMN_GAP,
    margin: [0, 0, 0, 14],
  } as Content;
}

function v2FormationBlock(formation: Formation, language: DocumentLanguage, rtl = false): Content {
  const dateColumn = {
    width: 100,
    stack: [
      {
        text: v2DateText(formation.date || "", language, rtl),
        bold: true,
        color: V2_ACCENT,
        fontSize: 9,
        alignment: rtl ? "right" : "left",
      },
      {
        text: v2RtlText(formation.lieu || "", rtl, V2_DATE_COLUMN_W, 9),
        fontSize: 9,
        alignment: rtl ? "right" : "left",
        margin: [0, 2, 0, 0],
      },
    ],
  } as Content;
  const detailsColumn = {
    width: "*",
    stack: [
      {
        text: v2RtlText((formation.titre || "").toLocaleUpperCase("fr"), rtl, V2_DETAILS_W, 11),
        bold: true,
        fontSize: 11,
        alignment: rtl ? "right" : "left",
      },
      {
        text: v2RtlText(
          (formation.institution || "").toLocaleUpperCase("fr"),
          rtl,
          V2_DETAILS_W,
          11,
        ),
        bold: true,
        fontSize: 11,
        color: V2_MUTED,
        alignment: rtl ? "right" : "left",
        margin: [0, 2, 0, 3],
      },
      ...(formation.competences
        ? [v2List([formation.competences], "diamond", undefined, rtl, V2_DETAILS_LIST_TEXT_W)]
        : []),
    ],
  } as Content;
  return {
    unbreakable: true,
    columns: rtl ? [detailsColumn, dateColumn] : [dateColumn, detailsColumn],
    columnGap: V2_COLUMN_GAP,
    margin: [0, 0, 0, 14],
  } as Content;
}

function v2EducationBlock(education: Education, language: DocumentLanguage, rtl = false): Content {
  const dateColumn = {
    width: 100,
    stack: [
      {
        text: v2DateText(education.date || "", language, rtl),
        bold: true,
        color: V2_ACCENT,
        fontSize: 9,
        alignment: rtl ? "right" : "left",
      },
      {
        text: v2RtlText(education.lieu || "", rtl, V2_DATE_COLUMN_W, 9),
        fontSize: 9,
        alignment: rtl ? "right" : "left",
        margin: [0, 2, 0, 0],
      },
    ],
  } as Content;
  const detailsColumn = {
    width: "*",
    stack: [
      {
        text: v2RtlText((education.titre || "").toLocaleUpperCase("fr"), rtl, V2_DETAILS_W, 11),
        bold: true,
        fontSize: 11,
        alignment: rtl ? "right" : "left",
      },
      ...(education.institution
        ? [
            {
              text: v2RtlText(
                education.institution.toLocaleUpperCase(language),
                rtl,
                V2_DETAILS_W,
                11,
              ),
              bold: true,
              fontSize: 11,
              color: V2_MUTED,
              alignment: rtl ? "right" : "left",
              margin: [0, 2, 0, 0],
            } as Content,
          ]
        : []),
      ...(education.option
        ? [
            {
              text: v2RtlText(education.option, rtl, V2_DETAILS_W, 10.6),
              alignment: rtl ? "right" : "left",
              margin: [0, 2, 0, 0],
            } as Content,
          ]
        : []),
      ...(education.equivalence
        ? [
            {
              text: v2RtlText(education.equivalence, rtl, V2_DETAILS_W, 10.6),
              alignment: rtl ? "right" : "left",
              margin: [0, 2, 0, 0],
            } as Content,
          ]
        : []),
    ],
  } as Content;
  return {
    unbreakable: true,
    columns: rtl ? [detailsColumn, dateColumn] : [dateColumn, detailsColumn],
    columnGap: V2_COLUMN_GAP,
    margin: [0, 0, 0, 14],
  } as Content;
}

function v2Section(
  title: string,
  first: Content,
  rest: Content[] = [],
  firstSection = false,
  rtl = false,
) {
  return [
    {
      unbreakable: true,
      stack: [v2SectionTitle(title, firstSection ? 0 : 10, rtl), first],
    } as Content,
    ...rest,
  ];
}

type CvV2BuildOptions = {
  rtlLayout?: boolean;
  templateName?: string;
  font?: string;
  subjectFallback?: string;
};

function buildCvPdfV2(
  cv: CV,
  language: DocumentLanguage,
  options: CvV2BuildOptions = {},
): TDocumentDefinitions {
  const rtl = options.rtlLayout ?? false;
  const templateName = options.templateName ?? "CV Canadien V2";
  const labels = cvCopy(language);
  const langues = cvLanguages(cv, language);
  const content: Content[] = [...profilePhotoBlock(cv), v2Header(cv, rtl)];
  let isFirstSection = true;
  const pushSection = (title: string, first: Content, rest: Content[] = []) => {
    content.push(...v2Section(title, first, rest, isFirstSection, rtl));
    isFirstSection = false;
  };
  const pushListSection = (
    title: string,
    items: string[],
    marker: "diamond" | "check" = "diamond",
    format?: ObjectiveFormat,
  ) => {
    const filtered = richListItems(items, format);
    if (!filtered.length) return;
    const [first, ...rest] = filtered;
    pushSection(
      title,
      v2List([first], marker, format, rtl),
      rest.length ? [v2List(rest, marker, format, rtl)] : [],
    );
  };

  if (cv.objectif)
    pushSection(
      labels.objective,
      objectivePdfContent(
        cv,
        10.6,
        rtl ? { alignment: "right" } : {},
        rtl ? (text) => v2RtlText(text, true, V2_CONTENT_W, 10.6) : undefined,
      ),
    );

  const competences = cv.competences.filter(Boolean);
  if (competences.length)
    pushListSection(labels.skills, competences, "diamond", cv.competences_format);

  if (langues.length) {
    pushSection(labels.languages, {
      columns: (rtl ? [2, 1, 0] : [0, 1, 2]).map((column) => ({
        width: "*",
        stack: langues
          .filter((_, index) => index % 3 === column)
          .map(([label, value]) => ({
            text: rtl
              ? [
                  { text: v2RtlText(value as string, true, 154, 10.6) },
                  { text: "\u00a0:\u00a0" },
                  { text: v2RtlText(label, true, 154, 10.6), bold: true },
                ]
              : [{ text: `${label} : `, bold: true }, { text: value as string }],
            alignment: rtl ? "right" : "left",
            margin: [0, 0, 0, 4],
          })),
      })),
      columnGap: 12,
    } as Content);
  }

  const experiences = cv.experiences.filter(
    (experience) => experience.titre || experience.employeur || experience.dates,
  );
  if (experiences.length) {
    const [first, ...rest] = experiences;
    pushSection(
      labels.experience,
      v2ExperienceBlock(first, language, rtl),
      rest.map((experience) => v2ExperienceBlock(experience, language, rtl)),
    );
  }

  const formations = cv.formations.filter((formation) => formation.titre || formation.institution);
  if (formations.length) {
    const [first, ...rest] = formations;
    pushSection(
      labels.training,
      v2FormationBlock(first, language, rtl),
      rest.map((formation) => v2FormationBlock(formation, language, rtl)),
    );
  }

  const educations = cv.educations.filter((education) => education.titre || education.institution);
  if (educations.length) {
    const [first, ...rest] = educations;
    pushSection(
      labels.education,
      v2EducationBlock(first, language, rtl),
      rest.map((education) => v2EducationBlock(education, language, rtl)),
    );
  }

  const participations = cv.participations.filter(Boolean);
  if (participations.length)
    pushListSection(labels.participation, participations, "diamond", cv.participations_format);

  const certifications = cv.certifications.filter(Boolean);
  if (certifications.length)
    pushListSection(labels.certifications, certifications, "check", cv.certifications_format);

  const interests = cv.interets.filter(Boolean);
  if (interests.length) pushListSection(labels.interests, interests, "diamond", cv.interets_format);

  const extras = additionalInformation(cv, language);
  if (extras.length) pushListSection(labels.additional, extras);

  const references = cv.references.filter(Boolean);
  if (references.length) pushListSection(labels.references, references);

  return {
    info: {
      title: cv.nom_complet ? `${templateName} - ${cv.nom_complet}` : templateName,
      author: cv.nom_complet || "",
      subject: cv.titre_poste || options.subjectFallback || "Curriculum Vitae",
    },
    pageSize: "LETTER",
    pageMargins: [V2_MARGIN_X, 28, V2_MARGIN_X, 42],
    background: (currentPage) =>
      currentPage === 1
        ? {
            canvas: [{ type: "rect", x: 0, y: 0, w: V2_PAGE_W, h: 112, color: V2_BANNER_BG }],
          }
        : null,
    defaultStyle: {
      font: options.font || documentFont(language),
      fontSize: 10.6,
      color: "#000000",
      lineHeight: 1.42,
      alignment: rtl || language === "ar" ? "right" : undefined,
    },
    content,
  };
}

function buildCvPdfArabicProV2(cv: CV): TDocumentDefinitions {
  return buildCvPdfV2(cv, "ar", {
    rtlLayout: true,
    templateName: "CV PRO Arabe V2",
    font: "ArialOfficial",
    subjectFallback: "السيرة الذاتية",
  });
}

const V3_ACCENT = "#0070c0";
const V3_LINK = "#0563c1";
const V3_MARGIN_X = 50.4;
const V3_LEFT_COLUMN = 104;
const V3_COLUMN_GAP = 14;

function joinV3OrganizationAndPlace(organization: string, place: string) {
  const cleanOrganization = organization.trim();
  const placeParts = place
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!cleanOrganization) return placeParts.join(", ");
  if (!placeParts.length) return cleanOrganization;

  const firstPlacePart = placeParts[0].toLocaleLowerCase();
  if (cleanOrganization.toLocaleLowerCase().endsWith(firstPlacePart)) placeParts.shift();
  return [cleanOrganization, ...placeParts].join(", ");
}

function v3Header(cv: CV, language: DocumentLanguage): Content {
  const labels = cvCopy(language);
  const addressLine = [cv.adresse, cv.statut_relocation].filter(Boolean).join(" | ");
  const directContacts: Content[] = [];
  if (cv.telephone) directContacts.push({ text: cv.telephone });
  if (cv.email) {
    if (directContacts.length) directContacts.push({ text: " | " });
    directContacts.push({
      text: `${labels.email} : ${cv.email}`,
      color: V3_LINK,
      decoration: "underline",
      link: `mailto:${cv.email}`,
    });
  }

  return {
    stack: [
      {
        text: (cv.nom_complet || " ").toLocaleUpperCase(language),
        alignment: "center",
        bold: true,
        fontSize: 15,
        lineHeight: 1,
        margin: [0, 0, 0, 4],
      },
      {
        text: cv.titre_poste || " ",
        alignment: "center",
        fontSize: 10.5,
        lineHeight: 1,
        margin: [0, 0, 0, 4],
      },
      ...(addressLine
        ? [
            {
              text: addressLine,
              alignment: "center",
              fontSize: 9.2,
              lineHeight: 1.2,
              margin: [0, 0, 0, 4],
            } as Content,
          ]
        : []),
      ...(directContacts.length
        ? [
            {
              text: directContacts,
              alignment: "center",
              fontSize: 9.2,
              lineHeight: 1.2,
            } as Content,
          ]
        : []),
    ],
    margin: [0, 2, 0, 2],
  } as Content;
}

function v3SectionTitle(label: string, topMargin = 7): Content {
  return {
    text: label,
    headlineLevel: 1,
    bold: true,
    fontSize: 12.61,
    lineHeight: 1,
    color: V3_ACCENT,
    margin: [0, topMargin, 0, 4],
  } as Content;
}

function v3List(items: RichInline[], markerColor = V3_ACCENT, format?: ObjectiveFormat): Content {
  return {
    stack: items.filter(Boolean).map((item) => ({
      unbreakable: true,
      columns: [
        {
          width: 3.5,
          text: "•",
          color: markerColor,
          fontSize: 8.76,
          lineHeight: 1.5,
        },
        format
          ? richListText(format, item, 8.76, { width: "*", lineHeight: 1.5 })
          : { width: "*", text: item, fontSize: 8.76, lineHeight: 1.5 },
      ],
      columnGap: 8,
    })),
    margin: [0, 1, 0, 0],
  } as Content;
}

function v3ExperienceBlock(experience: Experience, language: DocumentLanguage): Content {
  const labels = cvCopy(language);
  const descriptions = experienceRichDescriptions(experience);
  const employerAndPlace = joinV3OrganizationAndPlace(
    experience.employeur || "",
    experience.lieu || "",
  );

  return {
    columns: [
      {
        width: V3_LEFT_COLUMN,
        text: formatCvDate(experience.dates || "", language),
        fontSize: 8.2,
        lineHeight: 1.45,
      },
      {
        width: "*",
        stack: [
          {
            text: (experience.titre || "").toLocaleUpperCase(language),
            bold: true,
            fontSize: 10.75,
            lineHeight: 1.15,
            margin: [0, 0, 0, 3],
          },
          ...(employerAndPlace
            ? [
                companyLine(experience, employerAndPlace, 9, {
                  margin: [0, 0, 0, descriptions.length ? 2 : 0],
                }),
              ]
            : []),
          ...(descriptions.length
            ? [
                { text: labels.responsibilities, margin: [0, 0, 0, 0] } as Content,
                v3List(descriptions, V3_ACCENT, experience.descriptions_format),
              ]
            : []),
        ],
      },
    ],
    columnGap: V3_COLUMN_GAP,
    margin: [0, 0, 0, 6],
  } as Content;
}

function v3FormationBlock(formation: Formation, language: DocumentLanguage): Content {
  const institutionAndPlace = joinV3OrganizationAndPlace(
    formation.institution || "",
    formation.lieu || "",
  );

  return {
    stack: [
      {
        unbreakable: true,
        columns: [
          {
            width: V3_LEFT_COLUMN,
            text: formatCvDate(formation.date || "", language),
            fontSize: 8.2,
            lineHeight: 1.45,
          },
          {
            width: "*",
            stack: [
              {
                text: (formation.titre || "").toLocaleUpperCase(language),
                bold: true,
                fontSize: 10.75,
                lineHeight: 1.15,
                margin: [0, 0, 0, 3],
              },
              ...(institutionAndPlace ? [{ text: institutionAndPlace } as Content] : []),
            ],
          },
        ],
        columnGap: V3_COLUMN_GAP,
      } as Content,
      ...(formation.competences
        ? [
            {
              unbreakable: true,
              columns: [
                { width: V3_LEFT_COLUMN, text: "" },
                {
                  width: "*",
                  text: formation.competences,
                  margin: [0, 2, 0, 0],
                },
              ],
              columnGap: V3_COLUMN_GAP,
            } as Content,
          ]
        : []),
    ],
    margin: [0, 0, 0, 10],
  } as Content;
}

function v3EducationBlock(education: Education, language: DocumentLanguage): Content {
  const labels = cvCopy(language);
  const institutionAndPlace = joinV3OrganizationAndPlace(
    education.institution || "",
    education.lieu || "",
  );

  return {
    unbreakable: true,
    columns: [
      {
        width: V3_LEFT_COLUMN,
        text: formatCvDate(education.date || "", language),
        fontSize: 8.2,
        lineHeight: 1.45,
      },
      {
        width: "*",
        stack: [
          {
            text: (education.titre || "").toLocaleUpperCase(language),
            bold: true,
            fontSize: 10.75,
            lineHeight: 1.15,
            margin: [0, 0, 0, 3],
          },
          ...(education.option
            ? [
                {
                  text: `${labels.specialty} : ${education.option}`,
                  margin: [0, 0, 0, 2],
                } as Content,
              ]
            : []),
          ...(institutionAndPlace
            ? [
                {
                  text: institutionAndPlace,
                  margin: [0, 0, 0, education.equivalence ? 2 : 0],
                } as Content,
              ]
            : []),
          ...(education.equivalence ? [{ text: education.equivalence } as Content] : []),
        ],
      },
    ],
    columnGap: V3_COLUMN_GAP,
    margin: [0, 0, 0, 10],
  } as Content;
}

function v3Section(title: string, first: Content, rest: Content[] = [], firstSection = false) {
  return [v3SectionTitle(title, firstSection ? 5 : 7), first, ...rest];
}

function buildCvPdfV3(cv: CV, language: DocumentLanguage): TDocumentDefinitions {
  const labels = cvCopy(language);
  const content: Content[] = [...profilePhotoBlock(cv), v3Header(cv, language)];
  let isFirstSection = true;
  const pushSection = (title: string, first: Content, rest: Content[] = []) => {
    content.push(...v3Section(title, first, rest, isFirstSection));
    isFirstSection = false;
  };
  const pushListSection = (title: string, items: string[], format?: ObjectiveFormat) => {
    const filtered = richListItems(items, format);
    if (!filtered.length) return;
    const [first, ...rest] = filtered;
    pushSection(
      title,
      v3List([first], V3_ACCENT, format),
      rest.length ? [v3List(rest, V3_ACCENT, format)] : [],
    );
  };

  if (cv.objectif) pushSection(labels.objective, objectivePdfContent(cv, 9));

  const experiences = cv.experiences.filter(
    (experience) => experience.titre || experience.employeur || experience.dates,
  );
  if (experiences.length) {
    const [first, ...rest] = experiences;
    pushSection(
      labels.experience,
      v3ExperienceBlock(first, language),
      rest.map((item) => v3ExperienceBlock(item, language)),
    );
  }

  const formations = cv.formations.filter((formation) => formation.titre || formation.institution);
  if (formations.length) {
    const [first, ...rest] = formations;
    pushSection(
      labels.training,
      v3FormationBlock(first, language),
      rest.map((item) => v3FormationBlock(item, language)),
    );
  }

  const educations = cv.educations.filter((education) => education.titre || education.institution);
  if (educations.length) {
    const [first, ...rest] = educations;
    pushSection(
      labels.education,
      v3EducationBlock(first, language),
      rest.map((item) => v3EducationBlock(item, language)),
    );
  }

  const competences = cv.competences.filter(Boolean);
  if (competences.length) {
    const [first, ...rest] = richListItems(competences, cv.competences_format);
    const skillsColumns = (items: RichInline[], showLabel: boolean): Content => ({
      columns: [
        { width: V3_LEFT_COLUMN, text: "" },
        {
          width: "*",
          stack: [
            ...(showLabel
              ? [
                  {
                    text: labels.professional,
                    bold: true,
                    fontSize: 10.75,
                    lineHeight: 1.15,
                    margin: [0, 0, 0, 2],
                  } as Content,
                ]
              : []),
            v3List(items, V3_ACCENT, cv.competences_format),
          ],
        },
      ],
      columnGap: V3_COLUMN_GAP,
    });
    pushSection(
      labels.skills,
      skillsColumns([first], true),
      rest.length ? [skillsColumns(rest, false)] : [],
    );
  }

  const participations = cv.participations.filter(Boolean);
  if (participations.length)
    pushListSection(labels.participation, participations, cv.participations_format);

  const certifications = cv.certifications.filter(Boolean);
  if (certifications.length)
    pushListSection(labels.certifications, certifications, cv.certifications_format);

  const interests = cv.interets.filter(Boolean);
  if (interests.length) pushListSection(labels.interests, interests, cv.interets_format);

  const extras = additionalInformation(cv, language);
  if (extras.length) pushListSection(labels.additional, extras);

  const references = cv.references.filter(Boolean);
  if (references.length) pushListSection(labels.references, references);

  const langues = cvLanguages(cv, language);
  if (langues.length) {
    pushSection(labels.languages, {
      columns: [0, 1, 2].map((column) => ({
        width: "*",
        stack: langues
          .filter((_, index) => index % 3 === column)
          .map(([label, value]) => ({
            text: [{ text: `${label} : `, bold: true }, { text: value as string }],
            margin: [0, 0, 0, 3],
          })),
      })),
      columnGap: 10,
    } as Content);
  }

  return {
    info: {
      title: cv.nom_complet ? `CV Canadien V3 - ${cv.nom_complet}` : "CV Canadien V3",
      author: cv.nom_complet || "",
      subject: cv.titre_poste || "Curriculum Vitae",
    },
    pageSize: "LETTER",
    pageMargins: [V3_MARGIN_X, 32, V3_MARGIN_X, 40],
    pageBreakBefore: (currentNode) =>
      currentNode.headlineLevel === 1 && currentNode.startPosition.verticalRatio > 0.93,
    defaultStyle: {
      font: documentFont(language),
      fontSize: 9,
      color: "#000000",
      lineHeight: 1.38,
      alignment: language === "ar" ? "right" : undefined,
    },
    content,
  };
}

// CV Canadien V4 keeps the source's Cambria styling while using the required
// Canadian Letter page. It remains one full-width column with a compact
// header separated by a fine rule.
const V4_PAGE_W = 612;
const V4_PAGE_H = 792;
const V4_MARGIN_X = 45;
const V4_CONTENT_W = V4_PAGE_W - V4_MARGIN_X * 2;
const V4_TEXT = "#404040";
const V4_HEADING = "#191919";
const V4_GROUP_HEADING = "#ef4444";
const V4_SECTION_SIZE = 14.5;
const V4_ITEM_SIZE = 12.2;
const V4_BODY_SIZE = 10.4;

function v4Header(cv: CV, language: DocumentLanguage): Content {
  const contact = [cv.adresse, cv.telephone, cv.email].filter(Boolean).join(" | ");

  return {
    stack: [
      {
        text: (cv.nom_complet || " ").toLocaleUpperCase(language),
        alignment: "center",
        fontSize: 24,
        lineHeight: 1,
        color: V4_GROUP_HEADING,
        margin: [0, 0, 0, 7],
      },
      {
        canvas: [
          {
            type: "rect",
            x: -1.44,
            y: 0,
            w: V4_CONTENT_W + 2.88,
            h: 1.44,
            color: "#141414",
          },
        ],
        margin: [0, 0, 0, 6.4],
      },
      {
        text: contact || " ",
        alignment: "center",
        fontSize: V4_BODY_SIZE,
        lineHeight: 1,
        color: V4_TEXT,
      },
    ],
    margin: [0, 0, 0, 12],
  } as Content;
}

function v4SectionTitle(
  label: string,
  topMargin: number,
  bottomMargin: number,
  language: DocumentLanguage,
): Content {
  return {
    text: label.toLocaleUpperCase(language),
    bold: true,
    fontSize: V4_SECTION_SIZE,
    lineHeight: 1,
    color: V4_GROUP_HEADING,
    margin: [0, topMargin, 0, bottomMargin],
  } as Content;
}

function v4List(items: RichInline[], fontSize = V4_BODY_SIZE, format?: ObjectiveFormat): Content {
  return {
    stack: items.filter(Boolean).map((item) => ({
      unbreakable: true,
      columns: [
        {
          width: 6,
          text: "•",
          fontSize,
          lineHeight: 1.38,
          color: V4_GROUP_HEADING,
        },
        format
          ? richListText(format, item, fontSize, {
              width: "*",
              lineHeight: 1.38,
              color: V4_TEXT,
            })
          : {
              width: "*",
              text: item,
              fontSize,
              lineHeight: 1.38,
              color: V4_TEXT,
            },
      ],
      columnGap: 8,
      margin: [0, 0, 0, 1],
    })),
  } as Content;
}

function v4ItemTitle(title: string, date: string, language: DocumentLanguage): Content {
  return {
    columns: [
      {
        width: "*",
        text: (title || " ").toLocaleUpperCase(language),
        bold: true,
        fontSize: V4_ITEM_SIZE,
        lineHeight: 1.08,
        color: V4_HEADING,
      },
      date
        ? {
            width: "auto",
            text: date,
            alignment: "right",
            bold: true,
            fontSize: 9.4,
            lineHeight: 1.08,
            color: V4_GROUP_HEADING,
            margin: [8, 2.2, 0, 0],
          }
        : { width: 0, text: "" },
    ],
    columnGap: 8,
    margin: [0, 0, 0, 5],
  } as Content;
}

function v4ExperienceBlock(experience: Experience, language: DocumentLanguage): Content {
  const descriptions = experienceRichDescriptions(experience);
  const [firstDescription, ...remainingDescriptions] = descriptions;
  const employerAndPlace = joinV3OrganizationAndPlace(experience.employeur, experience.lieu);
  const heading: Content[] = [
    v4ItemTitle(experience.titre, formatCvDate(experience.dates, language), language),
  ];
  if (employerAndPlace) {
    heading.push(
      companyLine(experience, employerAndPlace, V4_BODY_SIZE, {
        fontSize: V4_BODY_SIZE,
        lineHeight: 1.3,
        color: V4_TEXT,
        margin: [0, 0, 0, firstDescription ? 2 : 0],
      }),
    );
  }
  if (firstDescription)
    heading.push(v4List([firstDescription], V4_BODY_SIZE, experience.descriptions_format));

  return {
    stack: [
      { unbreakable: true, stack: heading } as Content,
      remainingDescriptions.length
        ? v4List(remainingDescriptions, V4_BODY_SIZE, experience.descriptions_format)
        : ({ text: "" } as Content),
    ],
    margin: [0, 0, 0, 10],
  } as Content;
}

function v4FormationBlock(formation: Formation, language: DocumentLanguage): Content {
  const institutionAndPlace = joinV3OrganizationAndPlace(formation.institution, formation.lieu);

  return {
    unbreakable: true,
    stack: [
      v4ItemTitle(formation.titre, formatCvDate(formation.date, language), language),
      institutionAndPlace
        ? {
            text: institutionAndPlace,
            fontSize: V4_BODY_SIZE,
            lineHeight: 1.35,
            margin: [0, 0, 0, formation.competences ? 1 : 0],
          }
        : ({ text: "" } as Content),
      formation.competences
        ? { text: formation.competences, fontSize: V4_BODY_SIZE, lineHeight: 1.35 }
        : ({ text: "" } as Content),
    ],
    margin: [0, 0, 0, 9],
  } as Content;
}

function v4EducationBlock(education: Education, language: DocumentLanguage): Content {
  const labels = cvCopy(language);
  const institutionAndPlace = joinV3OrganizationAndPlace(education.institution, education.lieu);
  const details = [
    education.option ? `${labels.specialty} : ${education.option}` : "",
    institutionAndPlace,
    education.equivalence,
  ].filter(Boolean);

  return {
    unbreakable: true,
    stack: [
      v4ItemTitle(education.titre, formatCvDate(education.date, language), language),
      ...details.map((detail) => ({
        text: detail,
        fontSize: V4_BODY_SIZE,
        lineHeight: 1.35,
      })),
    ],
    margin: [0, 0, 0, 9],
  } as Content;
}

function buildCvPdfV4(cv: CV, language: DocumentLanguage): TDocumentDefinitions {
  const labels = cvCopy(language);
  const content: Content[] = [...profilePhotoBlock(cv), v4Header(cv, language)];
  const pushSection = (title: Content, blocks: Content[]) => {
    const [first, ...rest] = blocks;
    content.push({ unbreakable: true, stack: [title, first] } as Content, ...rest);
  };
  const pushListSection = (title: Content, items: string[], format?: ObjectiveFormat) => {
    const [first, ...rest] = richListItems(items, format);
    content.push({
      unbreakable: true,
      stack: [title, v4List([first], V4_BODY_SIZE, format)],
    } as Content);
    if (rest.length) content.push(v4List(rest, V4_BODY_SIZE, format));
  };

  if (cv.objectif) {
    pushSection(v4SectionTitle(labels.objective, 0, 5, language), [
      objectivePdfContent(cv, V4_BODY_SIZE, {
        lineHeight: 1.42,
        color: V4_TEXT,
        margin: [0, 0, 0, 10],
      }),
    ]);
  }

  const experiences = cv.experiences.filter(
    (experience) => experience.titre || experience.employeur || experience.dates,
  );
  if (experiences.length) {
    pushSection(
      v4SectionTitle(labels.experience, 0, 8, language),
      experiences.map((item) => v4ExperienceBlock(item, language)),
    );
  }

  const formations = cv.formations.filter((formation) => formation.titre || formation.institution);
  if (formations.length) {
    pushSection(
      v4SectionTitle(labels.training, 10, 6, language),
      formations.map((item) => v4FormationBlock(item, language)),
    );
  }

  const educations = cv.educations.filter((education) => education.titre || education.institution);
  if (educations.length) {
    pushSection(
      v4SectionTitle(labels.education, 10, 6, language),
      educations.map((item) => v4EducationBlock(item, language)),
    );
  }

  const participations = cv.participations.filter(Boolean);
  if (participations.length) {
    pushListSection(
      v4SectionTitle(labels.volunteering, 10, 6, language),
      participations,
      cv.participations_format,
    );
  }

  const certifications = cv.certifications.filter(Boolean);
  if (certifications.length) {
    pushListSection(
      v4SectionTitle(labels.certifications, 10, 6, language),
      certifications,
      cv.certifications_format,
    );
  }

  const interests = cv.interets.filter(Boolean);
  if (interests.length) {
    pushListSection(
      v4SectionTitle(labels.interests, 10, 6, language),
      interests,
      cv.interets_format,
    );
  }

  const langues = cvLanguages(cv, language, false).map(([label, value]) => `${label} : ${value}`);
  if (langues.length) {
    pushListSection(v4SectionTitle(labels.languages, 10, 6, language), langues);
  }

  const competences = cv.competences.filter(Boolean);
  if (competences.length) {
    pushListSection(
      v4SectionTitle(labels.skills, 10, 6, language),
      competences,
      cv.competences_format,
    );
  }

  const extras = additionalInformation(cv, language);
  if (extras.length) {
    pushListSection(v4SectionTitle(labels.additional, 10, 6, language), extras);
  }

  const references = cv.references.filter(Boolean);
  if (references.length) {
    pushListSection(v4SectionTitle(labels.references, 10, 6, language), references);
  }

  return {
    info: {
      title: cv.nom_complet ? `CV Canadien V4 - ${cv.nom_complet}` : "CV Canadien V4",
      author: cv.nom_complet || "",
      subject: cv.titre_poste || "Curriculum Vitae",
    },
    pageSize: { width: V4_PAGE_W, height: V4_PAGE_H },
    pageMargins: [V4_MARGIN_X, 39, V4_MARGIN_X, 41],
    footer: (currentPage) =>
      currentPage > 1
        ? ({
            text: String(currentPage),
            font: language === "zh" || language === "ar" ? documentFont(language) : "Cambria",
            fontSize: V4_BODY_SIZE,
            color: "#141414",
            margin: [V4_MARGIN_X, 8.7, 0, 0],
          } as Content)
        : ({ text: "" } as Content),
    defaultStyle: {
      font: language === "zh" || language === "ar" ? documentFont(language) : "Cambria",
      fontSize: V4_BODY_SIZE,
      color: V4_TEXT,
      lineHeight: 1.38,
      alignment: language === "ar" ? "right" : undefined,
      // Cambria's discretionary substitutions create unmapped subset glyphs
      // in pdfkit. Disabling them keeps every visible character ATS-readable.
      fontFeatures: [],
    },
    content,
  };
}

// The dedicated ATS model follows the supplied A4 source: Calibri, one
// reading column, 1-inch side margins, gray separators, and no decorative
// elements that could disturb automatic résumé parsers.
const V5_PAGE_W = 595.28;
const V5_MARGIN_X = 72;
const V5_CONTENT_W = V5_PAGE_W - V5_MARGIN_X * 2;
const V5_RULE = "#afabab";
const V5_LINK = "#0563c1";
const V5_ACCENT = "#101010";
const V5_BODY_SIZE = 10.5;

function v5Header(cv: CV): Content {
  const address = [cv.adresse, cv.statut_relocation].filter(Boolean).join(" | ");
  const contact = [cv.telephone, address].filter(Boolean).join(" | ");

  return {
    stack: [
      {
        text: (cv.nom_complet || " ").toLocaleUpperCase("fr"),
        alignment: "center",
        bold: true,
        fontSize: 18,
        lineHeight: 1,
        margin: [0, 2, 0, 6],
      },
      {
        text: cv.titre_poste || " ",
        alignment: "center",
        fontSize: 13,
        lineHeight: 1,
        margin: [0, 0, 0, 5],
      },
      {
        text: contact || " ",
        alignment: "center",
        fontSize: V5_BODY_SIZE,
        lineHeight: 1,
        margin: [0, 0, 0, 4],
      },
      {
        text: cv.email || " ",
        alignment: "center",
        fontSize: V5_BODY_SIZE,
        lineHeight: 1,
        color: cv.email ? V5_LINK : "#000000",
        decoration: cv.email ? "underline" : undefined,
        link: cv.email ? `mailto:${cv.email}` : undefined,
      },
    ],
  } as Content;
}

function v5SectionHeading(label: string, topMargin: number): Content {
  return {
    headlineLevel: 1,
    stack: [
      {
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: V5_CONTENT_W,
            y2: 0,
            lineWidth: 0.96,
            lineColor: V5_RULE,
          },
        ],
        margin: [0, topMargin, 0, 7],
      },
      {
        text: label,
        bold: true,
        color: V5_ACCENT,
        fontSize: 13,
        lineHeight: 1,
        margin: [0, 0, 0, 7],
      },
    ],
  } as Content;
}

function v5List(items: RichInline[], indent = 18, format?: ObjectiveFormat): Content {
  return {
    stack: items.filter(Boolean).map((item) => ({
      unbreakable: true,
      columns: [
        {
          width: 5,
          text: "•",
          color: V5_ACCENT,
          fontSize: V5_BODY_SIZE,
          lineHeight: 1.32,
        },
        format
          ? richListText(format, item, V5_BODY_SIZE, {
              width: "*",
              lineHeight: 1.32,
            })
          : {
              width: "*",
              text: item,
              fontSize: V5_BODY_SIZE,
              lineHeight: 1.32,
            },
      ],
      columnGap: 8,
      margin: [0, 0, 0, 1],
    })),
    margin: [indent, 0, 0, 0],
  } as Content;
}

function v5ExperienceBlock(experience: Experience, language: DocumentLanguage): Content {
  const labels = cvCopy(language);
  const descriptions = experienceRichDescriptions(experience);
  const [firstDescription, ...remainingDescriptions] = descriptions;
  const employerAndPlace = joinV3OrganizationAndPlace(
    experience.employeur || "",
    experience.lieu || "",
  );
  const lead: Content[] = [];
  if (employerAndPlace) {
    lead.push(
      companyLine(experience, employerAndPlace, 11, {
        bold: true,
        fontSize: 11,
        lineHeight: 1.2,
        margin: [0, 0, 0, 2],
      }),
    );
  }
  lead.push({
    columns: [
      {
        width: "*",
        text: experience.titre || " ",
        bold: true,
        fontSize: 11,
        lineHeight: 1.2,
      },
      {
        width: "auto",
        text: formatCvDate(experience.dates || "", language) || " ",
        alignment: "right",
        bold: true,
        fontSize: 11,
        lineHeight: 1.2,
      },
    ],
    columnGap: 14,
    margin: [0, 0, 0, firstDescription ? 5 : 0],
  } as Content);
  if (firstDescription) {
    lead.push({ text: labels.responsibilities, margin: [0, 0, 0, 1] } as Content);
    lead.push(v5List([firstDescription], 26, experience.descriptions_format));
  }

  return {
    stack: [
      { unbreakable: true, stack: lead } as Content,
      remainingDescriptions.length
        ? v5List(remainingDescriptions, 26, experience.descriptions_format)
        : ({ text: "" } as Content),
    ],
    margin: [0, 0, 0, 12],
  } as Content;
}

function v5FormationBlock(formation: Formation, language: DocumentLanguage): Content {
  const titleAndDate = [formation.titre, formatCvDate(formation.date || "", language)]
    .filter(Boolean)
    .join(", ");
  const institutionAndPlace = joinV3OrganizationAndPlace(
    formation.institution || "",
    formation.lieu || "",
  );

  return {
    unbreakable: true,
    stack: [
      titleAndDate ? { text: titleAndDate, bold: true } : ({ text: "" } as Content),
      formation.competences ? { text: formation.competences } : ({ text: "" } as Content),
      institutionAndPlace ? { text: institutionAndPlace } : ({ text: "" } as Content),
    ],
    margin: [0, 0, 0, 9],
  } as Content;
}

function v5EducationBlock(education: Education, language: DocumentLanguage): Content {
  const titleAndDate = [education.titre, formatCvDate(education.date || "", language)]
    .filter(Boolean)
    .join(", ");
  const institutionAndPlace = joinV3OrganizationAndPlace(
    education.institution || "",
    education.lieu || "",
  );

  return {
    unbreakable: true,
    stack: [
      titleAndDate ? { text: titleAndDate, bold: true } : ({ text: "" } as Content),
      education.option ? { text: education.option } : ({ text: "" } as Content),
      institutionAndPlace ? { text: institutionAndPlace } : ({ text: "" } as Content),
      education.equivalence ? { text: education.equivalence } : ({ text: "" } as Content),
    ],
    margin: [0, 0, 0, 9],
  } as Content;
}

function buildCvPdfAtsA4(cv: CV, language: DocumentLanguage): TDocumentDefinitions {
  const labels = cvCopy(language);
  const content: Content[] = [...profilePhotoBlock(cv), v5Header(cv)];
  let firstSection = true;
  const pushSection = (title: string, first: Content, rest: Content[] = []) => {
    content.push(v5SectionHeading(title, firstSection ? 15 : 12), first, ...rest);
    firstSection = false;
  };

  if (cv.objectif) {
    pushSection(
      labels.objective,
      objectivePdfContent(cv, V5_BODY_SIZE, {
        lineHeight: 1.32,
        alignment: language === "ar" ? "right" : undefined,
      }),
    );
  }

  const competences = cv.competences.filter(Boolean);
  if (competences.length)
    pushSection(
      labels.skills,
      v5List(richListItems(competences, cv.competences_format), 18, cv.competences_format),
    );

  const experiences = cv.experiences.filter(
    (experience) => experience.titre || experience.employeur || experience.dates,
  );
  if (experiences.length) {
    const [first, ...rest] = experiences;
    pushSection(
      labels.experience,
      v5ExperienceBlock(first, language),
      rest.map((item) => v5ExperienceBlock(item, language)),
    );
  }

  const formations = cv.formations.filter((formation) => formation.titre || formation.institution);
  if (formations.length) {
    const [first, ...rest] = formations;
    pushSection(
      labels.training,
      v5FormationBlock(first, language),
      rest.map((item) => v5FormationBlock(item, language)),
    );
  }

  const educations = cv.educations.filter((education) => education.titre || education.institution);
  if (educations.length) {
    const [first, ...rest] = educations;
    pushSection(
      labels.education,
      v5EducationBlock(first, language),
      rest.map((item) => v5EducationBlock(item, language)),
    );
  }

  const participations = cv.participations.filter(Boolean);
  if (participations.length) {
    pushSection(
      labels.participation,
      v5List(richListItems(participations, cv.participations_format), 18, cv.participations_format),
    );
  }

  const certifications = cv.certifications.filter(Boolean);
  if (certifications.length)
    pushSection(
      labels.certifications,
      v5List(richListItems(certifications, cv.certifications_format), 18, cv.certifications_format),
    );

  const interests = cv.interets.filter(Boolean);
  if (interests.length)
    pushSection(
      labels.interests,
      v5List(richListItems(interests, cv.interets_format), 18, cv.interets_format),
    );

  const extras = additionalInformation(cv, language);
  if (extras.length) pushSection(labels.additional, v5List(extras));

  const references = cv.references.filter(Boolean);
  if (references.length) pushSection(labels.references, v5List(references));

  const langues = cvLanguages(cv, language, false).map(([label, value]) => `${label}: ${value}`);
  if (langues.length) pushSection(labels.languages, v5List(langues));

  return {
    info: {
      title: cv.nom_complet ? `CV ATS A4 - ${cv.nom_complet}` : "CV ATS A4",
      author: cv.nom_complet || "",
      subject: cv.titre_poste || "Curriculum Vitae",
    },
    pageSize: "A4",
    pageMargins: [V5_MARGIN_X, 48, V5_MARGIN_X, 45],
    pageBreakBefore: (currentNode, nodeQueries) =>
      currentNode.headlineLevel === 1 &&
      (currentNode.startPosition.verticalRatio > 0.88 ||
        nodeQueries.getFollowingNodesOnPage().length === 0),
    defaultStyle: {
      font: documentFont(language),
      fontSize: V5_BODY_SIZE,
      color: "#000000",
      lineHeight: 1.32,
    },
    content,
  };
}

const ARABIC_PRO_ACCENT = "#ff4761";
const ARABIC_PRO_DARK = "#172033";
const ARABIC_PRO_MUTED = "#8b94a3";
const ARABIC_PRO_RULE = "#374151";

const ARABIC_PRO_ICONS = {
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="#172033" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22V4"/><path d="M5 5h10l-1.5 3L15 11H5"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="#172033" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.8-5.4 10-7.3 11.6a1.1 1.1 0 0 1-1.4 0C9.4 20 4 14.8 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.6"/></svg>',
  calendar:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#172033" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="#172033" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="3"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>',
  car: '<svg viewBox="0 0 24 24" fill="none" stroke="#172033" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14l1-5-2-5H6l-2 5 1 5Z"/><path d="M7 17v2M17 17v2M4 12h16"/><circle cx="8" cy="14.5" r="1"/><circle cx="16" cy="14.5" r="1"/></svg>',
  phone: CONTACT_ICONS.phone.replaceAll("#52525b", ARABIC_PRO_DARK),
  mail: CONTACT_ICONS.mail.replaceAll("#52525b", ARABIC_PRO_DARK),
} as const;

function arabicProContact(
  icon: keyof typeof ARABIC_PRO_ICONS,
  text: string,
  rtl: boolean,
): Content {
  const textIsArabic = /\p{Script=Arabic}/u.test(text);
  const iconNode = {
    width: 11,
    svg: ARABIC_PRO_ICONS[icon],
    fit: [10, 10],
    margin: [0, 0.5, 0, 0],
  } as Content;
  const textNode = {
    width: "auto",
    text: textIsArabic ? arabicProPdfText(text, rtl, 30) : text,
    font: textIsArabic ? "NotoSansArabic" : "CalibriSupplied",
    fontSize: 7.8,
    bold: true,
    color: ARABIC_PRO_DARK,
    alignment: rtl ? "right" : "left",
  } as Content;
  return {
    columns: rtl ? [textNode, iconNode] : [iconNode, textNode],
    columnGap: 3,
    alignment: "center",
  } as Content;
}

function arabicProLabels(language: DocumentLanguage) {
  const labels = {
    fr: {
      objective: ["PROFIL", "PROFESSIONNEL"],
      experience: ["EXPÉRIENCES", "PROFESSIONNELLES"],
      education: ["FORMATION", "ET QUALIFICATIONS"],
      skills: ["COMPÉTENCES", "CLÉS"],
      languages: ["LANGUES", ""],
      interests: ["INTÉRÊTS", "ET ACTIVITÉS"],
      certifications: ["CERTIFICATIONS", ""],
      participation: ["ENGAGEMENTS", "ET ACTIVITÉS"],
      additional: ["INFORMATIONS", "COMPLÉMENTAIRES"],
      references: ["RÉFÉRENCES", ""],
    },
    en: {
      objective: ["PROFESSIONAL", "PROFILE"],
      experience: ["PROFESSIONAL", "EXPERIENCE"],
      education: ["EDUCATION", "AND QUALIFICATIONS"],
      skills: ["KEY", "SKILLS"],
      languages: ["LANGUAGES", ""],
      interests: ["INTERESTS", "AND ACTIVITIES"],
      certifications: ["CERTIFICATIONS", ""],
      participation: ["VOLUNTEERING", "AND ACTIVITIES"],
      additional: ["ADDITIONAL", "INFORMATION"],
      references: ["REFERENCES", ""],
    },
    es: {
      objective: ["PERFIL", "PROFESIONAL"],
      experience: ["EXPERIENCIA", "PROFESIONAL"],
      education: ["EDUCACIÓN", "Y CUALIFICACIONES"],
      skills: ["COMPETENCIAS", "CLAVE"],
      languages: ["IDIOMAS", ""],
      interests: ["INTERESES", "Y ACTIVIDADES"],
      certifications: ["CERTIFICACIONES", ""],
      participation: ["VOLUNTARIADO", "Y ACTIVIDADES"],
      additional: ["INFORMACIÓN", "ADICIONAL"],
      references: ["REFERENCIAS", ""],
    },
    de: {
      objective: ["BERUFLICHES", "PROFIL"],
      experience: ["BERUFS", "ERFAHRUNG"],
      education: ["AUSBILDUNG", "UND QUALIFIKATIONEN"],
      skills: ["KERN", "KOMPETENZEN"],
      languages: ["SPRACHEN", ""],
      interests: ["INTERESSEN", "UND AKTIVITÄTEN"],
      certifications: ["ZERTIFIKATE", ""],
      participation: ["ENGAGEMENT", "UND AKTIVITÄTEN"],
      additional: ["ZUSÄTZLICHE", "INFORMATIONEN"],
      references: ["REFERENZEN", ""],
    },
    it: {
      objective: ["PROFILO", "PROFESSIONALE"],
      experience: ["ESPERIENZA", "PROFESSIONALE"],
      education: ["ISTRUZIONE", "E QUALIFICHE"],
      skills: ["COMPETENZE", "CHIAVE"],
      languages: ["LINGUE", ""],
      interests: ["INTERESSI", "E ATTIVITÀ"],
      certifications: ["CERTIFICAZIONI", ""],
      participation: ["VOLONTARIATO", "E ATTIVITÀ"],
      additional: ["INFORMAZIONI", "AGGIUNTIVE"],
      references: ["REFERENZE", ""],
    },
    zh: {
      objective: ["职业", "概述"],
      experience: ["工作", "经历"],
      education: ["教育", "与资历"],
      skills: ["核心", "技能"],
      languages: ["语言", "能力"],
      interests: ["兴趣", "与活动"],
      certifications: ["专业", "认证"],
      participation: ["志愿", "与活动"],
      additional: ["其他", "信息"],
      references: ["推荐", "人"],
    },
    ar: {
      objective: ["نبذة", "عني"],
      experience: ["الخبرات", "المهنية"],
      education: ["التعليم", "والمؤهلات"],
      skills: ["المهارات", ""],
      languages: ["اللغات", ""],
      interests: ["الهوايات", "والاهتمامات"],
      certifications: ["الشهادات", ""],
      participation: ["التطوع", "والأنشطة"],
      additional: ["معلومات", "إضافية"],
      references: ["المراجع", ""],
    },
  } as const;
  return labels[language];
}

function arabicProSectionTitle(
  parts: readonly [string, string],
  rtl: boolean,
  options: { alignment?: "left" | "center" | "right"; ruleWidth?: number; accent?: string } = {},
): Content {
  const title = [parts[0], parts[1]].filter(Boolean).join("\u00a0");
  const alignment = options.alignment ?? (rtl ? "right" : "left");
  return {
    stack: [
      {
        text: arabicProPdfText(title, rtl, 34),
        color: options.accent ?? ARABIC_PRO_ACCENT,
        bold: true,
        fontSize: 11.8,
        alignment,
      },
      {
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 2,
            x2: options.ruleWidth ?? 527,
            y2: 2,
            lineWidth: 0.7,
            lineColor: ARABIC_PRO_RULE,
          },
        ],
      },
    ],
    headlineLevel: 1,
    margin: [0, 2.25, 0, 1.35],
  } as Content;
}

function arabicProSafeText(text: string, rtl: boolean) {
  if (!rtl) return text;
  const technicalTerms: ReadonlyArray<readonly [RegExp, string]> = [
    [/TechNova Solutions/gi, "تك نوفا سوليوشنز"],
    [/DigitalDZ Studio/gi, "ديجيتال دي زد ستوديو"],
    [/Startup InnovIT/gi, "ستارت أب إنوفيت"],
    [/USTHB/gi, "يو إس تي إتش بي"],
    [/Node\.js/gi, "نود جي إس"],
    [/JavaScript/gi, "جافاسكريبت"],
    [/TypeScript/gi, "تايب سكريبت"],
    [/PostgreSQL/gi, "بوستغريس كيو إل"],
    [/GraphQL/gi, "غراف كيو إل"],
    [/NoSQL/gi, "نو إس كيو إل"],
    [/Dockerfile/gi, "ملف دوكر"],
    [/CI\/CD/gi, "التكامل والتسليم المستمران"],
    [/DevOps/gi, "ديف أوبس"],
    [/Docker/gi, "دوكر"],
    [/React/gi, "رياكت"],
    [/Laravel/gi, "لارافيل"],
    [/HTML/gi, "إتش تي إم إل"],
    [/CSS/gi, "سي إس إس"],
    [/REST/gi, "ريست"],
    [/SQL/gi, "إس كيو إل"],
    [/SaaS/gi, "البرمجيات كخدمة"],
    [/PHP/gi, "بي إتش بي"],
    [/Agile/gi, "أجايل"],
    [/Scrum/gi, "سكرم"],
    [/GitHub/gi, "غيت هب"],
  ];
  const localized = technicalTerms.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    text,
  );
  return localized.replace(/[A-Za-z][A-Za-z0-9.+/#-]*/g, (token) => `\u200e${token}\u200e`);
}

function arabicProPdfText(text: string, rtl: boolean, maxLineLength = 82) {
  const safeText = arabicProSafeText(text, rtl);
  return rtl ? toPdfRtlVisualText(safeText, maxLineLength) : safeText;
}

function arabicAtsTextLayers(
  cv: CV,
  arabicFont = "HacenTunisia",
  latinFont = "CalibriSupplied",
): Content[] {
  const text = [
    "نبذة عني",
    "الخبرات المهنية",
    "التعليم والمؤهلات",
    "المهارات",
    "اللغات",
    "الشهادات",
    "التطوع والأنشطة",
    "الهوايات والاهتمامات",
    cv.nom_complet,
    cv.titre_poste,
    cv.objectif,
    cv.adresse,
    cv.wilaya,
    cv.pays,
    ...cv.competences,
    ...Object.values(cv.langues),
    ...cv.experiences.flatMap((item) => [
      item.titre,
      item.employeur,
      item.lieu,
      item.dates,
      ...item.descriptions,
    ]),
    ...cv.formations.flatMap((item) => [
      item.titre,
      item.institution,
      item.lieu,
      item.date,
      item.competences,
    ]),
    ...cv.educations.flatMap((item) => [
      item.titre,
      item.institution,
      item.lieu,
      item.date,
      item.option,
      item.equivalence,
    ]),
    ...cv.participations,
    ...cv.certifications,
    ...cv.interets,
    ...cv.references,
  ]
    .filter(Boolean)
    .join("\n")
    .replaceAll(" ", "\u00a0");
  const common = {
    fontSize: 0.1,
    color: "#ffffff",
    lineHeight: 0.1,
    absolutePosition: { x: 1, y: 1 },
  };
  return [
    { ...common, font: arabicFont, text } as Content,
    {
      ...common,
      font: latinFont,
      text: [cv.email, cv.telephone].filter(Boolean).join("\n"),
    } as Content,
  ];
}

function arabicProPlainInline(text: RichInline) {
  return typeof text === "string" ? text : text.map((run) => run.text).join("");
}

function arabicProDate(value: string, language: DocumentLanguage, rtl: boolean) {
  const formatted = formatCvDate(value, language);
  if (!rtl) return formatted;
  return formatted.replace(/([\p{L}]+)\s+(\d{4})/gu, "$2 $1");
}

function arabicProBullet(text: RichInline, rtl: boolean, experience?: Experience): Content {
  const marker = {
    width: 9,
    text: "•",
    color: ARABIC_PRO_ACCENT,
    bold: true,
    alignment: "center",
    margin: [0, 0, 0, 0],
  } as Content;
  const body = rtl
    ? ({
        width: "*",
        text: arabicProPdfText(arabicProPlainInline(text), true, 76),
        alignment: "right",
        fontSize: 7.35,
        lineHeight: 1.08,
      } as Content)
    : experience
      ? achievementText(experience, text, 7.35, {
          width: "*",
          alignment: rtl ? "right" : "left",
          lineHeight: 1.08,
        })
      : ({
          width: "*",
          text: arabicProPdfText(arabicProPlainInline(text), false, 76),
          alignment: rtl ? "right" : "left",
          fontSize: 7.35,
          lineHeight: 1.08,
        } as Content);
  return {
    columns: rtl ? [body, marker] : [marker, body],
    columnGap: 3,
    margin: [0, 0, 0, 0.5],
  } as Content;
}

function arabicProExperience(
  experience: Experience,
  language: DocumentLanguage,
  rtl: boolean,
  bulletLimit = 2,
): Content {
  const descriptions = experienceRichDescriptions(experience);
  const main = {
    width: "*",
    stack: [
      {
        text: arabicProPdfText(experience.titre || " ", rtl, 55),
        bold: true,
        fontSize: 9.1,
        color: ARABIC_PRO_DARK,
        alignment: rtl ? "right" : "left",
      },
      companyLine(
        experience,
        arabicProPdfText(
          [experience.employeur, experience.lieu].filter(Boolean).join(", "),
          rtl,
          68,
        ),
        8,
        {
          color: ARABIC_PRO_MUTED,
          fontSize: 7.35,
          alignment: rtl ? "right" : "left",
          margin: [0, 0.3, 0, 1],
        },
        rtl,
      ),
      ...descriptions.slice(0, bulletLimit).map((item) => arabicProBullet(item, rtl, experience)),
    ],
  } as Content;
  const dates = {
    width: 92,
    stack: [
      {
        text: arabicProPdfText(arabicProDate(experience.dates || "", language, rtl), rtl, 28),
        color: ARABIC_PRO_MUTED,
        fontSize: 7.2,
        alignment: rtl ? "left" : "right",
      },
      {
        text: arabicProPdfText(experience.lieu || "", rtl, 28),
        color: ARABIC_PRO_MUTED,
        fontSize: 7.2,
        alignment: rtl ? "left" : "right",
        margin: [0, 0.3, 0, 0],
      },
    ],
  } as Content;
  return {
    columns: rtl ? [dates, main] : [main, dates],
    columnGap: 9,
    margin: [0, 0, 0, 2],
    unbreakable: true,
  } as Content;
}

function arabicProEducation(
  item: Education | Formation,
  language: DocumentLanguage,
  rtl: boolean,
): Content {
  const isEducation = "equivalence" in item;
  const detail = isEducation
    ? [item.option, item.equivalence].filter(Boolean)
    : [item.competences].filter(Boolean);
  const main = {
    width: "*",
    stack: [
      {
        text: arabicProPdfText(item.titre || " ", rtl, 58),
        bold: true,
        fontSize: 8.6,
        color: ARABIC_PRO_DARK,
        alignment: rtl ? "right" : "left",
      },
      {
        text: arabicProPdfText([item.institution, item.lieu].filter(Boolean).join(", "), rtl, 68),
        color: ARABIC_PRO_MUTED,
        fontSize: 7.1,
        alignment: rtl ? "right" : "left",
        margin: [0, 0.2, 0, 0.4],
      },
      ...detail.slice(0, 1).map((text) => ({
        text: arabicProPdfText(text, rtl, 72),
        alignment: rtl ? "right" : "left",
        fontSize: 7,
        lineHeight: 1.05,
        margin: [0, 0.2, 0, 0],
      })),
    ],
  } as Content;
  const dates = {
    width: 92,
    stack: [
      {
        text: arabicProPdfText(arabicProDate(item.date || "", language, rtl), rtl, 28),
        color: ARABIC_PRO_MUTED,
        fontSize: 7.1,
        alignment: rtl ? "left" : "right",
      },
      {
        text: arabicProPdfText(item.lieu || "", rtl, 28),
        color: ARABIC_PRO_MUTED,
        fontSize: 7.1,
        alignment: rtl ? "left" : "right",
        margin: [0, 0.2, 0, 0],
      },
    ],
  } as Content;
  return {
    columns: rtl ? [dates, main] : [main, dates],
    columnGap: 9,
    margin: [0, 0, 0, 1.5],
    unbreakable: true,
  } as Content;
}

function arabicProGrid(
  items: RichInline[],
  rtl: boolean,
  columns = 3,
  format?: ObjectiveFormat,
): Content {
  const rows: Content[] = [];
  for (let index = 0; index < items.length; index += columns) {
    const row = items.slice(index, index + columns);
    rows.push({
      columns: [
        ...row.map((item) => {
          const body = rtl
            ? ({
                width: "*",
                text: arabicProPdfText(arabicProPlainInline(item), true, columns >= 4 ? 24 : 46),
                bold: true,
                fontSize: 7,
                alignment: "right",
                margin: [0, 0, 4, 1],
              } as Content)
            : format
              ? richListText(format, item, 7, {
                  width: "*",
                  bold: true,
                  alignment: rtl ? "right" : "left",
                  margin: [0, 0, 4, 1],
                })
              : ({
                  width: "*",
                  text: arabicProPdfText(arabicProPlainInline(item), false, 46),
                  bold: true,
                  fontSize: 7,
                  alignment: rtl ? "right" : "left",
                  margin: [0, 0, 4, 1],
                } as Content);
          const marker = {
            width: 6,
            text: "•",
            bold: true,
            color: ARABIC_PRO_ACCENT,
            alignment: "center",
          } as Content;
          return {
            width: "*",
            columns: rtl ? [body, marker] : [marker, body],
            columnGap: 2,
          } as Content;
        }),
        ...Array.from({ length: columns - row.length }, () => ({ width: "*", text: "" })),
      ],
      columnGap: 6,
    } as Content);
  }
  return { stack: rows } as Content;
}

function arabicProLanguageLevel(value: string) {
  const normalized = value.toLocaleLowerCase();
  if (/matern|native|biling|courant|fluent|متقن|أم|母语|流利/.test(normalized)) return 5;
  if (/avanc|advanced|fortgeschritten|avanz|متقدم|高级/.test(normalized)) return 4;
  if (/interm|mittel|medio|متوسط|中级/.test(normalized)) return 3;
  if (/notion|basic|base|grund|مبتد|基础/.test(normalized)) return 2;
  return 3;
}

function arabicProLanguages(cv: CV, language: DocumentLanguage, rtl: boolean): Content {
  const items = cvLanguages(cv, language, false).slice(0, 3);
  const rows: Content[] = [];
  for (let index = 0; index < items.length; index += 3) {
    const row = items.slice(index, index + 3);
    rows.push({
      columns: [
        ...row.map(([name, value]) => {
          const level = arabicProLanguageLevel(value as string);
          return {
            width: "*",
            stack: [
              {
                text: arabicProPdfText(name, rtl, 22),
                bold: true,
                fontSize: 7.1,
                alignment: rtl ? "right" : "left",
              },
              {
                text: arabicProPdfText(value as string, rtl, 24),
                color: ARABIC_PRO_MUTED,
                fontSize: 6.8,
                alignment: rtl ? "right" : "left",
                margin: [0, 0.1, 0, 0.3],
              },
              {
                canvas: Array.from({ length: 5 }, (_, dot) => ({
                  type: "ellipse" as const,
                  x: rtl ? 110 - dot * 7 : dot * 7 + 2,
                  y: 2,
                  r1: 2.1,
                  r2: 2.1,
                  color: dot < level ? ARABIC_PRO_ACCENT : "#e5e7eb",
                })),
                margin: [0, 0, 0, 0.8],
              },
            ],
          };
        }),
        ...Array.from({ length: 3 - row.length }, () => ({ width: "*", text: "" })),
      ],
      columnGap: 8,
    } as Content);
  }
  return { stack: rows } as Content;
}

type ArabicProVariant = "v2" | "v3" | "v5";

function buildCvPdfArabicProClassic(
  cv: CV,
  language: DocumentLanguage,
  variant: ArabicProVariant,
): TDocumentDefinitions {
  const rtl = language === "ar";
  const labels = arabicProLabels(language);
  const font = rtl ? "NotoSansArabic" : documentFont(language);
  const content: Content[] = [
    ...arabicAtsTextLayers(cv),
    {
      stack: [
        {
          text: arabicProPdfText(cv.nom_complet || " ", rtl, 44),
          bold: true,
          fontSize: 20,
          color: ARABIC_PRO_DARK,
          alignment: "center",
          lineHeight: 1.05,
        },
        {
          text: arabicProPdfText(cv.titre_poste || " ", rtl, 48),
          bold: true,
          fontSize: 10.2,
          color: ARABIC_PRO_ACCENT,
          alignment: "center",
          margin: [0, 0.5, 0, 3],
        },
      ],
    },
  ];

  const nationality =
    rtl && cv.wilaya.includes("الجزائر")
      ? "جزائرية"
      : (cv.pays || cv.wilaya).split(/[,(،]/)[0].trim();
  const birthYear = Number.parseInt(cv.date_naissance.match(/\b\d{4}\b/)?.[0] || "", 10);
  const birthText =
    rtl && Number.isFinite(birthYear)
      ? `${new Date().getFullYear() - birthYear} سنة`
      : cv.date_naissance;
  const licenceCategory = cv.permis_conduire.match(/\b[A-Z]\b/i)?.[0]?.toUpperCase();
  const arabicLicenceCategory = licenceCategory
    ? ({ A: "ألف", B: "باء", C: "جيم", D: "دال", E: "هاء" } as const)[
        licenceCategory as "A" | "B" | "C" | "D" | "E"
      ] || licenceCategory
    : "";
  const licenceText =
    rtl && licenceCategory
      ? `رخصة قيادة من نوع ${arabicLicenceCategory}`.replaceAll(" ", "\u00a0")
      : cv.permis_conduire;
  const primaryContacts: Array<[keyof typeof ARABIC_PRO_ICONS, string]> = [
    ["flag", nationality],
    ["pin", cv.wilaya || cv.adresse],
    ["calendar", birthText],
    ["user", cv.situation_familiale],
    ["car", licenceText],
  ].filter((item): item is [keyof typeof ARABIC_PRO_ICONS, string] => Boolean(item[1]));
  const secondaryContacts: Array<[keyof typeof ARABIC_PRO_ICONS, string]> = [
    ["mail", cv.email],
    ["phone", cv.telephone],
    ["pin", cv.adresse || cv.wilaya],
  ].filter((item): item is [keyof typeof ARABIC_PRO_ICONS, string] => Boolean(item[1]));

  const contactRow = (items: Array<[keyof typeof ARABIC_PRO_ICONS, string]>): Content => ({
    columns: (rtl ? [...items].reverse() : items).map(([icon, value]) => ({
      width: "*",
      stack: [arabicProContact(icon, value, rtl)],
      alignment: "center",
    })),
    columnGap: 5,
    margin: [0, 0, 0, 2],
  });
  if (primaryContacts.length) content.push(contactRow(primaryContacts));
  if (secondaryContacts.length) content.push(contactRow(secondaryContacts));

  const pushSection = (title: readonly [string, string], blocks: Content[]) => {
    if (!blocks.length) return;
    content.push(arabicProSectionTitle(title, rtl), ...blocks);
  };

  if (cv.objectif.trim()) {
    content.push(
      objectivePdfContent(
        cv,
        8.8,
        {
          alignment: rtl ? "right" : "left",
          lineHeight: rtl ? 1.2 : 1.08,
        },
        (text) => arabicProPdfText(text, rtl, 88),
      ),
    );
  }

  const experiences = cv.experiences
    .filter((item) => item.titre || item.employeur || item.dates)
    .slice(0, 2);
  pushSection(
    labels.experience,
    experiences.map((item) => arabicProExperience(item, language, rtl, 3)),
  );

  const education = cv.educations
    .filter((item) => item.titre || item.institution || item.date)
    .slice(0, 1);
  pushSection(
    labels.education,
    education.map((item) => arabicProEducation(item, language, rtl)),
  );

  const skills = richListItems(cv.competences, cv.competences_format).slice(0, 6);
  if (skills.length)
    pushSection(labels.skills, [arabicProGrid(skills, rtl, 2, cv.competences_format)]);

  const languages = cvLanguages(cv, language, false);
  if (languages.length) pushSection(labels.languages, [arabicProLanguages(cv, language, rtl)]);

  const references = cv.references.filter(Boolean).slice(0, 2);
  if (references.length) pushSection(["المراجع", ""], [arabicProGrid(references, rtl, 2)]);

  return {
    info: {
      title: cv.nom_complet
        ? `CV PRO Arabe ${variant.toUpperCase()} - ${cv.nom_complet}`
        : `CV PRO Arabe ${variant.toUpperCase()}`,
      author: cv.nom_complet || "",
      subject: cv.titre_poste || "Curriculum Vitae",
    },
    pageSize: "A4",
    pageMargins: variant === "v5" ? [36, 14, 36, 14] : [30, 10, 30, 10],
    defaultStyle: {
      font,
      fontSize: 7.5,
      color: ARABIC_PRO_DARK,
      lineHeight: 1.08,
    },
    content,
  };
}

function arabicProMinimalSectionTitle(title: string, withRule = false): Content {
  return {
    stack: [
      {
        text: arabicProPdfText(title, true, 34),
        bold: true,
        fontSize: 12,
        color: ARABIC_PRO_ACCENT,
        alignment: "center",
        margin: [0, 2.5, 0, withRule ? 1 : 0.8],
      },
      ...(withRule
        ? [
            {
              canvas: [
                {
                  type: "line" as const,
                  x1: 0,
                  y1: 0,
                  x2: 520,
                  y2: 0,
                  lineWidth: 0.55,
                  lineColor: ARABIC_PRO_RULE,
                },
              ],
              margin: [0, 0, 0, 2.5],
            } as Content,
          ]
        : []),
    ],
  } as Content;
}

function arabicProPlainContactLine(cv: CV): Content {
  const values = [cv.email, cv.telephone, cv.adresse || cv.wilaya].filter(Boolean);
  return {
    table: {
      widths: values.map(() => "*"),
      body: [
        values.map((value) => {
          const isArabic = /\p{Script=Arabic}/u.test(value);
          return {
            text: isArabic ? arabicProPdfText(value, true, 34) : value,
            font: isArabic ? "NotoSansArabic" : "CalibriSupplied",
            fontSize: 7.5,
            alignment: "center",
            color: ARABIC_PRO_DARK,
            margin: [2, 1.5, 2, 1.5],
          };
        }),
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0,
      hLineColor: () => ARABIC_PRO_RULE,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
    margin: [0, 1, 0, 3],
  } as Content;
}

function arabicProCompactEducation(cv: CV, language: DocumentLanguage): Content[] {
  return [...cv.educations, ...cv.formations]
    .filter((item) => item.titre || item.institution || item.date)
    .slice(0, 1)
    .map((item) => arabicProEducation(item, language, true));
}

function buildCvPdfArabicProV3(cv: CV, language: DocumentLanguage): TDocumentDefinitions {
  const content: Content[] = [
    ...arabicAtsTextLayers(cv),
    {
      text: arabicProPdfText(cv.nom_complet || " ", true, 44),
      bold: true,
      fontSize: 21,
      alignment: "center",
      color: ARABIC_PRO_DARK,
    },
    {
      text: arabicProPdfText(cv.titre_poste || " ", true, 44),
      fontSize: 10,
      alignment: "center",
      color: ARABIC_PRO_MUTED,
      margin: [0, 0, 0, 2],
    },
    arabicProMinimalSectionTitle("بيانات الاتصال"),
    arabicProPlainContactLine(cv),
  ];

  if (cv.objectif.trim()) {
    content.push(
      arabicProMinimalSectionTitle("الملخص المهني"),
      objectivePdfContent(
        cv,
        8.8,
        { alignment: "right", lineHeight: 1.18, margin: [0, 0, 0, 1] },
        (text) => arabicProPdfText(text, true, 88),
      ),
    );
  }
  const experiences = cv.experiences
    .filter((item) => item.titre || item.employeur || item.dates)
    .slice(0, 2);
  if (experiences.length)
    content.push(
      arabicProMinimalSectionTitle("الخبرة العملية"),
      ...experiences.map((item) => arabicProExperience(item, language, true, 2)),
    );
  const education = arabicProCompactEducation(cv, language);
  if (education.length)
    content.push(arabicProMinimalSectionTitle("التاريخ الأكاديمي"), ...education);
  const skills = richListItems(cv.competences, cv.competences_format).slice(0, 6);
  if (skills.length)
    content.push(
      arabicProMinimalSectionTitle("المهارات"),
      arabicProGrid(skills, true, 2, cv.competences_format),
    );
  const certifications = richListItems(cv.certifications, cv.certifications_format).slice(0, 3);
  if (certifications.length)
    content.push(
      arabicProMinimalSectionTitle("الشهادات"),
      arabicProGrid(certifications, true, 1, cv.certifications_format),
    );
  return {
    info: {
      title: `CV PRO Arabe V3 - ${cv.nom_complet || "CV"}`,
      author: cv.nom_complet || "",
    },
    pageSize: "A4",
    pageMargins: [38, 10, 38, 10],
    defaultStyle: {
      font: "NotoSansArabic",
      fontSize: 7.5,
      color: ARABIC_PRO_DARK,
      lineHeight: 1.08,
    },
    content,
  };
}

function buildCvPdfArabicProV5(cv: CV, language: DocumentLanguage): TDocumentDefinitions {
  // V5 deliberately uses the official Arial family end to end. The font files
  // are embedded in pdfMake so preview, export and selectable ATS text do not
  // depend on a browser or operating-system fallback.
  const V5_FONT = "ArialOfficial";
  const V5_CONTENT_WIDTH = 539.28;
  const V5_TWO_COLUMN_GAP = 18;
  const V5_HALF_RULE_WIDTH = (V5_CONTENT_WIDTH - V5_TWO_COLUMN_GAP) / 2;
  const V5_RULE_CONTENT_GAP = 8;
  const V5_JOB_TITLE_COLOR = "#707070";
  const V5_SECTION_TITLES: Record<string, string> = {
    "نبذة عني": "نبــــذة عنــــي",
    "الخبرة المهنية": "الخبــــرة المهنيــــة",
    التعليم: "التعليــــم",
    "المهارات التقنية": "المهــــارات التقنيــــة",
    المشاركات: "المشاركــــات",
    "الشهادات المهنية": "الشهــــادات المهنيــــة",
    الاهتمامات: "الاهتمامــــات",
    المراجع: "المراجــــع",
    "معلومات إضافية": "معلومــــات إضافيــــة",
    اللغات: "اللغــــات",
  };

  // pdfMake mirrors neutral parentheses in this RTL line; pre-mirroring keeps
  // the opening and closing glyphs around the education qualifier on output.
  const educationText = (value: string, maxChars: number) =>
    arabicProPdfText(
      value.replace(/[()]/g, (character) => (character === "(" ? ")" : "(")),
      true,
      maxChars,
    );

  // Keep the institution/employer and its location on one metadata line when
  // they fit. Sample data may already end with the city (for example
  // "DigitalDZ Studio، الجزائر العاصمة"), so remove that city from the
  // following location before joining the remaining province/country.
  const organizationAndPlace = (organization: string, place: string) => {
    const cleanOrganization = organization.trim();
    const placeParts = place
      .split(/[،,]/u)
      .map((part) => part.trim())
      .filter(Boolean);
    const normalizedOrganization = cleanOrganization
      .normalize("NFC")
      .replace(/\s+/gu, " ")
      .toLocaleLowerCase();

    while (
      placeParts.length &&
      normalizedOrganization.endsWith(
        placeParts[0].normalize("NFC").replace(/\s+/gu, " ").toLocaleLowerCase(),
      )
    ) {
      placeParts.shift();
    }

    const parts = [cleanOrganization, ...placeParts].filter(Boolean);
    const separator = parts.some((part) => /\p{Script=Arabic}/u.test(part)) ? "، " : ", ";
    return parts.join(separator);
  };

  // Hacen Tunisia gives the display text a warmer editorial character. A
  // restrained tatweel is added only to long Arabic name words; the original
  // value remains unchanged in the ATS layer and PDF metadata.
  const displayNameWord = (word: string, firstWord: boolean) => {
    const characters = Array.from(word);
    if (characters.length < 4 || !/\p{Script=Arabic}/u.test(word)) return word;
    const insertionIndex = firstWord ? characters.length - 1 : 1;
    characters.splice(insertionIndex, 0, firstWord ? "ــ" : "ـ");
    return characters.join("");
  };

  const timelineDate = (value: string): Content => {
    const formatted = formatCvDate(value, language);
    const endpoints = formatted
      .split(/\s+-\s+/u)
      .map((part) => part.trim())
      .filter(Boolean);
    const parsed = endpoints.map((endpoint) => endpoint.match(/^(.+?)\s+(\d{4})$/u));
    if (endpoints.length === 2 && parsed.every(Boolean)) {
      const dateColumns: Content[] = [];
      [...parsed].reverse().forEach((match, index) => {
        if (!match) return;
        dateColumns.push(
          {
            width: "auto",
            text: match[2],
            font: V5_FONT,
            fontSize: 7.7,
            color: "#666666",
            noWrap: true,
          } as Content,
          {
            width: "auto",
            text: arabicProPdfText(match[1], true, 20),
            font: V5_FONT,
            fontSize: 7.7,
            color: "#666666",
            noWrap: true,
          } as Content,
        );
        if (index === 0) {
          dateColumns.push({
            width: "auto",
            text: "-",
            font: V5_FONT,
            fontSize: 7.7,
            color: "#666666",
            noWrap: true,
          } as Content);
        }
      });
      return { columns: dateColumns, columnGap: 3, margin: [0, 1.6, 0, 0] } as Content;
    }
    return {
      text: arabicProPdfText(arabicProDate(value, language, true), true, 30),
      fontSize: 7.7,
      color: "#666666",
      alignment: "left",
      margin: [0, 1.6, 0, 0],
    } as Content;
  };

  const sectionTitle = (
    title: string,
    alignment: "left" | "right" = "right",
    ruleWidth = V5_CONTENT_WIDTH,
  ): Content => ({
    stack: [
      {
        text: arabicProPdfText(V5_SECTION_TITLES[title] || title, true, 44),
        font: V5_FONT,
        bold: true,
        fontSize: 12,
        color: ARABIC_PRO_ACCENT,
        alignment,
        lineHeight: 1.12,
        margin: [0, 5, 4, 2.8],
      },
      {
        canvas: [
          {
            type: "line" as const,
            x1: 0,
            y1: 0,
            x2: ruleWidth,
            y2: 0,
            lineWidth: 0.55,
            lineColor: "#111111",
          },
        ],
        margin: [0, 0, 0, V5_RULE_CONTENT_GAP],
      },
    ],
  });

  const bullet = (value: RichInline, fontSize = 6.8, maxChars = 140): Content => ({
    columns: [
      {
        width: "*",
        text: arabicProPdfText(arabicProPlainInline(value), true, maxChars),
        alignment: "right",
        fontSize,
        lineHeight: 1.28,
      },
      {
        width: 9,
        text: "•",
        bold: true,
        fontSize: 8,
        color: ARABIC_PRO_ACCENT,
        alignment: "center",
      },
    ],
    columnGap: 4,
    margin: [0, 0.2, 0, 1.25],
  });

  const experience = (item: Experience): Content => {
    const details = experienceRichDescriptions(item);
    const employerAndPlace = organizationAndPlace(item.employeur || "", item.lieu || "");
    return {
      stack: [
        {
          columns: [
            {
              width: 122,
              stack: [timelineDate(item.dates || "")],
            },
            {
              width: "*",
              stack: [
                {
                  text: arabicProPdfText(item.titre || " ", true, 48),
                  bold: true,
                  fontSize: 9.1,
                  alignment: "right",
                  lineHeight: 1.16,
                  margin: [0, 0, 0, 0.7],
                },
                companyLine(
                  item,
                  arabicProPdfText(employerAndPlace, true, 96),
                  10,
                  {
                    fontSize: 8.1,
                    color: "#666666",
                    alignment: "right",
                    lineHeight: 1.18,
                    margin: [0, 0.3, 0, 1.6],
                  },
                  true,
                ),
              ],
            },
          ],
          columnGap: 10,
        },
        ...details.map((detail) => bullet(detail)),
      ],
      margin: [0, 0, 0, 5.2],
      // Keep ordinary entries together, but allow an unusually long visible
      // achievement list to continue on the next page instead of overflowing.
      unbreakable: details.length <= 6,
    } as Content;
  };

  const educationBlock = (item: Education | Formation): Content => {
    const isEducation = "equivalence" in item;
    const details = isEducation
      ? [item.option, item.equivalence].filter(Boolean)
      : [item.competences].filter(Boolean);
    const institutionAndPlace = organizationAndPlace(item.institution || "", item.lieu || "");
    return {
      stack: [
        {
          columns: [
            {
              width: 122,
              stack: [timelineDate(item.date || "")],
            },
            {
              width: "*",
              stack: [
                {
                  text: educationText(item.titre || " ", 90),
                  bold: true,
                  fontSize: 8.8,
                  alignment: "right",
                  lineHeight: 1.16,
                  margin: [0, 0, 0, 0.7],
                },
                {
                  text: educationText(institutionAndPlace || " ", 108),
                  fontSize: 8,
                  color: "#666666",
                  alignment: "right",
                  lineHeight: 1.18,
                  margin: [0, 0.3, 0, 1.4],
                },
              ],
            },
          ],
          columnGap: 10,
        },
        ...details.map((value) => bullet(value, 6.9, 140)),
      ],
      margin: [0, 0, 0, 4.2],
      unbreakable: true,
    } as Content;
  };

  // Build the V5 contact band from data instead of fixed slots. New contact
  // entries can be appended here and will automatically share the same row.
  const locationValue = cv.adresse || cv.wilaya || cv.pays;
  const contactEntries = [
    { label: "الهاتف:", value: cv.telephone, latin: true },
    { label: "البريد الإلكتروني:", value: cv.email, latin: true },
    { label: "العنوان:", value: locationValue, latin: false },
  ].filter((entry) => entry.value.trim());
  const contactBandWidth = V5_CONTENT_WIDTH;
  const contactGroupWidth = contactBandWidth / Math.max(1, contactEntries.length);
  const widestContactUnit = Math.max(
    1,
    ...contactEntries.map(
      (entry) =>
        Array.from(entry.label).length * 0.52 +
        Array.from(entry.value).length * (entry.latin ? 0.5 : 0.48),
    ),
  );
  // Every group uses the same calculated size, so all baselines and spaces
  // remain identical. Adding another contact shrinks the full row uniformly.
  const contactFontSize = Math.max(
    5.5,
    Math.min(9.2, (contactGroupWidth - 10) / widestContactUnit),
  );
  const contactColumns: Content[] = [];
  contactEntries.forEach((entry, index) => {
    const labelWidth = Array.from(entry.label).length * contactFontSize * 0.52 + 3;
    const preferredValueWidth =
      Array.from(entry.value).length * contactFontSize * (entry.latin ? 0.5 : 0.48) + 3;
    const valueWidth = Math.max(
      24,
      Math.min(preferredValueWidth, contactGroupWidth - labelWidth - 3),
    );
    const contactInset = Math.max(0, (contactGroupWidth - valueWidth - labelWidth - 3) / 2);
    const lastContactIndex = contactEntries.length - 1;
    const contactMargins: [number, number, number, number] =
      contactEntries.length === 1
        ? [contactInset, 0, contactInset, 0]
        : index === 0
          ? [0, 0, contactInset * 2, 0]
          : index === lastContactIndex
            ? [contactInset * 2, 0, 0, 0]
            : [contactInset, 0, contactInset, 0];
    contactColumns.push({
      width: contactGroupWidth,
      columns: [
        {
          width: valueWidth,
          text: entry.latin
            ? entry.value
            : arabicProPdfText(entry.value, true, Math.max(20, Array.from(entry.value).length)),
          // A single font family is essential here: mixing Calibri and an
          // Arabic font produces different baselines at different PDF zooms.
          font: V5_FONT,
          fontSize: contactFontSize,
          alignment: "right",
          noWrap: true,
          margin: [0, 0, 0, 0],
        },
        {
          width: labelWidth,
          text: arabicProPdfText(entry.label, true, 28),
          font: V5_FONT,
          fontSize: contactFontSize,
          bold: true,
          color: ARABIC_PRO_ACCENT,
          alignment: "left",
          noWrap: true,
        },
      ],
      columnGap: 3,
      margin: contactMargins,
    } as Content);
  });

  const nameParts = cv.nom_complet.trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts.shift() || " ";
  const familyName = nameParts.join(" ") || " ";
  const displayFirstName = displayNameWord(firstName, true);
  const displayFamilyName = familyName
    .split(/\s+/u)
    .map((word) => displayNameWord(word, false))
    .join(" ");
  const content: Content[] = [
    ...arabicAtsTextLayers(cv, V5_FONT, V5_FONT),
    ...profilePhotoBlock(cv, 62, 5),
    ...(cv.nom_complet.trim()
      ? ([
          {
            columns: [
              { width: "*", text: "" },
              {
                width: "auto",
                text: arabicProPdfText(displayFamilyName, true, 32),
                font: V5_FONT,
                bold: true,
                fontSize: 23,
                color: "#111111",
                lineHeight: 1.05,
              },
              {
                width: "auto",
                text: arabicProPdfText(displayFirstName, true, 24),
                font: V5_FONT,
                bold: true,
                fontSize: 23,
                color: ARABIC_PRO_ACCENT,
                lineHeight: 1.05,
              },
              { width: "*", text: "" },
            ],
            columnGap: 5,
            margin: [0, 0, 0, cv.titre_poste.trim() ? 2.2 : 5],
          } as Content,
        ] as Content[])
      : []),
    ...(cv.titre_poste.trim()
      ? ([
          {
            text: arabicProPdfText(cv.titre_poste, true, 70),
            font: V5_FONT,
            bold: true,
            fontSize: 9.8,
            color: V5_JOB_TITLE_COLOR,
            alignment: "center",
            lineHeight: 1.15,
            margin: [0, 0.3, 0, 5],
          } as Content,
        ] as Content[])
      : []),
    ...(contactColumns.length
      ? ([
          {
            table: {
              widths: ["*"],
              body: [
                [
                  {
                    columns: contactColumns,
                    columnGap: 0,
                    margin: [0, 4.2, 0, 4.2],
                  },
                ],
              ],
            },
            layout: {
              hLineWidth: () => 0.55,
              vLineWidth: () => 0,
              hLineColor: () => "#111111",
              paddingLeft: () => 0,
              paddingRight: () => 0,
              paddingTop: () => 0,
              paddingBottom: () => 0,
            },
            // Keep a consistent breathing space after the lower contact rule,
            // matching the gap below every section rule in this template.
            margin: [0, 0, 0, V5_RULE_CONTENT_GAP],
          } as Content,
        ] as Content[])
      : []),
  ];
  if (cv.objectif.trim())
    content.push(
      sectionTitle("نبذة عني"),
      objectivePdfContent(
        cv,
        7.8,
        { alignment: "right", lineHeight: 1.3, margin: [0, 0, 0, 4.5] },
        // Arial is more compact than the former Arabic font. Let the objective
        // use the full content measure before starting its final RTL line.
        (text) => arabicProPdfText(text, true, 190),
      ),
    );
  const experiences = cv.experiences.filter(
    (item) => item.titre || item.employeur || item.dates || item.lieu || item.descriptions.length,
  );
  if (experiences.length)
    content.push(sectionTitle("الخبرة المهنية"), ...experiences.map(experience));
  const educationItems = [...cv.educations, ...cv.formations].filter((item) =>
    Boolean(
      item.titre ||
      item.institution ||
      item.date ||
      item.lieu ||
      ("equivalence" in item ? item.option || item.equivalence : item.competences),
    ),
  );
  if (educationItems.length)
    content.push(sectionTitle("التعليم"), ...educationItems.map(educationBlock));
  const skills = richListItems(cv.competences, cv.competences_format);
  const skillsMidpoint = Math.ceil(skills.length / 2);
  if (skills.length)
    content.push({
      stack: [
        sectionTitle("المهارات التقنية"),
        skills.length <= 14
          ? {
              columns: [
                {
                  width: "*",
                  stack: skills.slice(skillsMidpoint).map((item) => bullet(item, 6.5, 92)),
                },
                {
                  width: "*",
                  stack: skills.slice(0, skillsMidpoint).map((item) => bullet(item, 6.5, 92)),
                },
              ],
              columnGap: 24,
              margin: [6, 4.2, 6, 3],
            }
          : {
              stack: skills.map((item) => bullet(item, 6.5, 140)),
              margin: [0, 4.2, 0, 3],
            },
      ],
      unbreakable: skills.length <= 14,
    });
  const certifications = richListItems(cv.certifications, cv.certifications_format);
  const participations = richListItems(cv.participations, cv.participations_format);
  if (
    certifications.length &&
    participations.length &&
    certifications.length <= 6 &&
    participations.length <= 6
  ) {
    content.push({
      columns: [
        {
          width: "*",
          stack: [
            sectionTitle("المشاركات", "right", V5_HALF_RULE_WIDTH),
            {
              stack: participations.map((item) => bullet(item, 6.2, 84)),
              margin: [0, 4, 0, 2.2],
            },
          ],
        },
        {
          width: "*",
          stack: [
            sectionTitle("الشهادات المهنية", "right", V5_HALF_RULE_WIDTH),
            {
              stack: certifications.map((item) => bullet(item, 6.2, 84)),
              margin: [0, 4, 0, 2.2],
            },
          ],
        },
      ],
      columnGap: V5_TWO_COLUMN_GAP,
      margin: [0, 0, 0, 3.5],
    });
  } else {
    if (participations.length) {
      content.push(sectionTitle("المشاركات"), {
        stack: participations.map((item) => bullet(item, 6.2, 140)),
        margin: [0, 4, 0, 2.5],
      });
    }
    if (certifications.length) {
      content.push(sectionTitle("الشهادات المهنية"), {
        stack: certifications.map((item) => bullet(item, 6.2, 140)),
        margin: [0, 4, 0, 2.5],
      });
    }
  }
  const interests = richListItems(cv.interets, cv.interets_format);
  if (interests.length)
    content.push({
      stack: [
        sectionTitle("الاهتمامات"),
        {
          stack: interests.map((item) => bullet(item, 6.5, 140)),
          margin: [0, 4, 0, 2.5],
        },
      ],
      unbreakable: true,
    });
  const references = cv.references.filter((item) => item.trim());
  if (references.length)
    content.push(sectionTitle("المراجع"), {
      stack: references.map((item) => bullet(item, 6.5, 140)),
      margin: [0, 4, 0, 2.5],
    });
  const additionalPersonal = [
    ["الاستعداد للانتقال", cv.statut_relocation],
    ["تاريخ الميلاد", cv.date_naissance],
    ["الحالة العائلية", cv.situation_familiale],
    ["رخصة السياقة", cv.permis_conduire],
    ["الخدمة الوطنية", cv.service_national],
    ["الولاية", cv.wilaya],
    ["البلد", cv.pays],
    ["الترشح", cv.candidature],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()));
  if (additionalPersonal.length) {
    const midpoint = Math.ceil(additionalPersonal.length / 2);
    const personalBullet = ([label, value]: [string, string]) =>
      bullet(`${label}: ${value}`, 6.5, 90);
    content.push(sectionTitle("معلومات إضافية"), {
      columns: [
        {
          width: "*",
          stack: additionalPersonal.slice(midpoint).map(personalBullet),
        },
        {
          width: "*",
          stack: additionalPersonal.slice(0, midpoint).map(personalBullet),
        },
      ],
      columnGap: 24,
      margin: [0, 4, 0, 2.5],
    });
  }
  const languages = [
    ["اللغة العربية", cv.langues.ar],
    ["اللغة الفرنسية", cv.langues.fr],
    ["اللغة الإنجليزية", cv.langues.en],
    ["اللغة الألمانية", cv.langues.de],
    ["اللغة الإسبانية", cv.langues.es],
    ["اللغة القبائلية", cv.langues.kab],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()));
  const languageFontSize = languages.length > 5 ? 6.1 : 6.9;
  const languageColumns: Content[] = [];
  [...languages].reverse().forEach(([name, level], index) => {
    const languageParts: Content[] = [];
    if (index > 0) languageParts.push({ width: "*", text: "" } as Content);
    languageParts.push(
      {
        width: "auto",
        text: arabicProPdfText(level, true, 36),
        fontSize: languageFontSize,
        noWrap: true,
      } as Content,
      { width: "auto", text: ":", fontSize: languageFontSize, noWrap: true } as Content,
      {
        width: "auto",
        text: arabicProPdfText(name, true, 36),
        fontSize: languageFontSize,
        bold: true,
        noWrap: true,
      } as Content,
    );
    if (index < languages.length - 1) languageParts.push({ width: "*", text: "" } as Content);
    languageColumns.push({
      width: "*",
      columns: languageParts,
      columnGap: 1,
    } as Content);
  });
  if (languages.length)
    content.push({
      stack: [
        sectionTitle("اللغات"),
        {
          columns: languageColumns,
          columnGap: 0,
          margin: [0, 4.2, 0, 4.2],
        },
        {
          canvas: [
            {
              type: "line" as const,
              x1: 0,
              y1: 0,
              x2: V5_CONTENT_WIDTH,
              y2: 0,
              lineWidth: 0.55,
              lineColor: "#111111",
            },
          ],
        },
      ],
      unbreakable: true,
    });
  return {
    info: {
      title: `CV Pro Arabe V1 - ${cv.nom_complet || "CV"}`,
      author: cv.nom_complet || "",
    },
    pageSize: "A4",
    pageMargins: [28, 12, 28, 18],
    defaultStyle: {
      font: V5_FONT,
      fontSize: 7.7,
      color: "#111111",
      lineHeight: 1.2,
    },
    content,
  };
}

const ARABIC_V4_BLUE = "#0070c0";
const ARABIC_V4_PAPER = "#eef6fb";

function arabicV4SideItem(item: Education | Formation, language: DocumentLanguage): Content {
  return {
    stack: [
      {
        text: arabicProPdfText(item.titre || " ", true, 28),
        bold: true,
        fontSize: 7.4,
        alignment: "right",
        color: ARABIC_PRO_DARK,
      },
      {
        text: arabicProPdfText([item.institution, item.lieu].filter(Boolean).join("، "), true, 32),
        fontSize: 6.55,
        color: ARABIC_PRO_MUTED,
        alignment: "right",
        margin: [0, 0.5, 0, 0],
      },
      {
        text: arabicProPdfText(arabicProDate(item.date || "", language, true), true, 24),
        fontSize: 6.4,
        color: ARABIC_PRO_MUTED,
        alignment: "right",
        margin: [0, 0.35, 0, 2.5],
      },
    ],
  } as Content;
}

function arabicV4SideSection(title: string, blocks: Content[]): Content[] {
  if (!blocks.length) return [];
  return [
    {
      text: arabicProPdfText(title, true, 28),
      bold: true,
      fontSize: 9,
      color: ARABIC_V4_BLUE,
      alignment: "right",
      margin: [0, 7, 0, 2],
    } as Content,
    {
      canvas: [
        { type: "line", x1: 0, y1: 1, x2: 130, y2: 1, lineWidth: 0.55, lineColor: "#9dbed7" },
      ],
      margin: [0, 0, 0, 1.8],
    } as Content,
    ...blocks,
  ];
}

function buildCvPdfArabicProV4(cv: CV, language: DocumentLanguage): TDocumentDefinitions {
  const labels = arabicProLabels(language);
  const rtl = language === "ar";
  const experienceBlocks = cv.experiences
    .filter((item) => item.titre || item.employeur || item.dates)
    .slice(0, 1)
    .map((item) => arabicProExperience(item, language, rtl, 2));
  const skillItems = richListItems(cv.competences, cv.competences_format).slice(0, 6);
  const left: Content[] = [];
  const pushMainSection = (title: readonly [string, string], blocks: Content[]) => {
    if (!blocks.length) return;
    left.push(
      arabicProSectionTitle(title, true, { ruleWidth: 360, accent: ARABIC_V4_BLUE }),
      ...blocks,
    );
  };

  if (cv.objectif.trim()) {
    pushMainSection(labels.objective, [
      objectivePdfContent(
        cv,
        8.3,
        { alignment: "right", lineHeight: 1.32, margin: [0, 0, 0, 2] },
        (text) => arabicProPdfText(text, true, 61),
      ),
    ]);
  }
  if (skillItems.length)
    pushMainSection(labels.skills, [arabicProGrid(skillItems, true, 2, cv.competences_format)]);
  if (experienceBlocks.length) pushMainSection(labels.experience, experienceBlocks);
  const participations = richListItems(cv.participations, cv.participations_format).slice(0, 4);
  if (participations.length)
    pushMainSection(labels.participation, [
      arabicProGrid(participations, true, 1, cv.participations_format),
    ]);

  const education = [...cv.educations, ...cv.formations]
    .filter((item) => item.titre || item.institution || item.date)
    .slice(0, 2)
    .map((item) => arabicV4SideItem(item, language));
  const languageItems = cvLanguages(cv, language, false).map(([name, value]) => ({
    text: arabicProPdfText(`${name}: ${value}`, true, 29),
    fontSize: 6.7,
    alignment: "right",
    margin: [0, 0, 0, 1.2],
  })) as Content[];
  const certifications = richListItems(cv.certifications, cv.certifications_format)
    .slice(0, 3)
    .map((item) => ({
      text: arabicProPdfText(`• ${arabicProPlainInline(item)}`, true, 30),
      fontSize: 6.7,
      alignment: "right",
      margin: [0, 0, 0, 1.2],
    })) as Content[];
  const interests = richListItems(cv.interets, cv.interets_format)
    .slice(0, 3)
    .map((item) => ({
      text: arabicProPdfText(`• ${arabicProPlainInline(item)}`, true, 30),
      fontSize: 6.7,
      alignment: "right",
      margin: [0, 0, 0, 1.2],
    })) as Content[];
  const right: Content[] = [
    ...arabicV4SideSection(labels.education.filter(Boolean).join(" "), education),
    ...arabicV4SideSection(labels.languages.filter(Boolean).join(" "), languageItems),
    ...arabicV4SideSection(labels.certifications.filter(Boolean).join(" "), certifications),
    ...arabicV4SideSection(labels.interests.filter(Boolean).join(" "), interests),
  ];

  const contactParts = [cv.email, cv.telephone, cv.adresse || cv.wilaya].filter(Boolean);
  return {
    info: {
      title: cv.nom_complet ? `CV PRO Arabe V4 - ${cv.nom_complet}` : "CV PRO Arabe V4",
      author: cv.nom_complet || "",
      subject: cv.titre_poste || "Curriculum Vitae",
    },
    pageSize: "A4",
    pageMargins: [34, 24, 34, 28],
    defaultStyle: {
      font: rtl ? "NotoSansArabic" : documentFont(language),
      fontSize: 7.3,
      color: ARABIC_PRO_DARK,
      lineHeight: 1.12,
    },
    content: [
      {
        canvas: [
          { type: "rect", x: 0, y: 0, w: 595, h: 842, color: ARABIC_V4_PAPER },
          { type: "rect", x: 26, y: 150, w: 386, h: 660, color: "#ffffff" },
          { type: "rect", x: 34, y: 86, w: 527, h: 22, color: ARABIC_V4_BLUE },
        ],
        absolutePosition: { x: 0, y: 0 },
      },
      ...arabicAtsTextLayers(cv),
      {
        stack: [
          {
            canvas: [
              { type: "ellipse", x: 505, y: 2, r1: 23, r2: 23, color: ARABIC_V4_BLUE },
              { type: "ellipse", x: 505, y: 0, r1: 8, r2: 8, color: "#ffffff" },
              { type: "rect", x: 490, y: 11, w: 30, h: 13, r: 6, color: "#ffffff" },
            ],
            margin: [0, 0, 0, -30],
          },
          {
            text: arabicProPdfText(cv.nom_complet || " ", rtl, 42),
            fontSize: 20,
            bold: true,
            alignment: "center",
            color: ARABIC_PRO_DARK,
            margin: [0, 0, 0, 1],
          },
          {
            text: arabicProPdfText(cv.titre_poste || " ", rtl, 48),
            fontSize: 9.5,
            alignment: "center",
            color: ARABIC_PRO_MUTED,
            margin: [0, 0, 0, 7],
          },
          {
            table: {
              widths: contactParts.map(() => "*"),
              body: [
                [
                  ...[...contactParts].reverse().map((value) => {
                    const valueIsArabic = /\p{Script=Arabic}/u.test(value);
                    return {
                      text: valueIsArabic ? arabicProPdfText(value, rtl, 34) : value,
                      font: valueIsArabic ? "NotoSansArabic" : "CalibriSupplied",
                      color: "#ffffff",
                      fillColor: ARABIC_V4_BLUE,
                      fontSize: 7.1,
                      alignment: "center" as const,
                      margin: [4, 3.5, 4, 3.5] as [number, number, number, number],
                    };
                  }),
                ],
              ],
            },
            layout: "noBorders",
            margin: [0, 0, 0, 8],
          },
        ],
      },
      {
        columns: [
          { width: "*", stack: left, margin: [8, 0, 12, 0] },
          { width: 138, stack: right, margin: [8, 0, 3, 0] },
        ],
        columnGap: 0,
      },
    ],
  };
}

export async function createCvPdfBlob(
  cv: CV,
  templateId: CvTemplateId = "canadian-v1",
  language: DocumentLanguage = "fr",
  accentColor?: string,
  designerSettings?: TemplateDesignerSettings,
): Promise<Blob> {
  const normalizedTemplateId = normalizeCvTemplateForLanguage(templateId, language);
  await ensureFontsForDocument(normalizedTemplateId, language);
  const effectiveDesign = designerSettings
    ? effectiveDesignerSettings(designerSettings, language)
    : undefined;
  if (effectiveDesign?.fontFamily && effectiveDesign.fontFamily !== "template") {
    await ensureFontFamily(effectiveDesign.fontFamily);
  }
  const pdfCv = cv.photo?.dataUrl
    ? {
        ...cv,
        photo: {
          ...cv.photo,
          dataUrl: await profilePhotoDataUrlForPdf(cv.photo),
        },
      }
    : cv;
  const document =
    normalizedTemplateId === "arabic-pro-v1"
      ? buildCvPdfArabicProV5(pdfCv, language)
      : normalizedTemplateId === "arabic-pro-v2"
        ? buildCvPdfArabicProV2(pdfCv)
        : normalizedTemplateId === "ats-a4"
          ? buildCvPdfAtsA4(pdfCv, language)
          : normalizedTemplateId === "canadian-v4"
            ? buildCvPdfV4(pdfCv, language)
            : normalizedTemplateId === "canadian-v3"
              ? buildCvPdfV3(pdfCv, language)
              : normalizedTemplateId === "canadian-v2"
                ? buildCvPdfV2(pdfCv, language)
                : buildCvPdfV1(pdfCv, language);
  return pdfMake
    .createPdf(
      applyTemplateDesigner(
        applyPdfTheme(document, normalizedTemplateId, accentColor),
        effectiveDesign,
        normalizedTemplateId,
      ),
    )
    .getBlob();
}

export function downloadCvPdf(blob: Blob, cv: CV) {
  const filename = `${safeFilename(cv.nom_complet || "cv")}.pdf`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function safeFilename(value: string) {
  return (
    value
      .trim()
      .replace(/[<>:"/\\|?*]/g, "")
      .split("")
      .filter((character) => character.charCodeAt(0) >= 32)
      .join("")
      .replace(/\s+/g, "_") || "cv"
  );
}
