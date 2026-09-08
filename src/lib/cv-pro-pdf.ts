import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { CV, Education, Experience, Formation, SoftwareIcon } from "./cv-types";
import { documentFont, type DocumentLanguage } from "./document-language";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const ACCENT = "#5c0632";
const INK = "#595959";
const DARK = "#404040";
const PAPER = "#fbfbfb";
const SIDEBAR_W = 203;
const COLUMN_GAP = 22;
const MAIN_SECTION_W = 180;
const SIDEBAR_SECTION_W = 150;
const PAGE_TOP = 90;
const FIRST_PAGE_BODY_OFFSET = 76;
const BODY_LINE_HEIGHT = 1.3;
const META_LINE_HEIGHT = 1.18;

const LABELS: Record<
  DocumentLanguage,
  {
    objective: string;
    experience: string;
    training: string;
    education: string;
    skills: string;
    software: string;
    languages: string;
    participation: string;
    certifications: string;
    references: string;
  }
> = {
  fr: {
    objective: "OBJECTIF",
    experience: "EXPÉRIENCES",
    training: "FORMATIONS",
    education: "ÉDUCATION",
    skills: "COMPÉTENCES",
    software: "LOGICIELS",
    languages: "LANGUES",
    participation: "PARTICIPATION",
    certifications: "CERTIFICATIONS",
    references: "RÉFÉRENCES",
  },
  en: {
    objective: "OBJECTIVE",
    experience: "EXPERIENCE",
    training: "TRAINING",
    education: "EDUCATION",
    skills: "SKILLS",
    software: "SOFTWARE",
    languages: "LANGUAGES",
    participation: "ACTIVITIES",
    certifications: "CERTIFICATIONS",
    references: "REFERENCES",
  },
  es: {
    objective: "OBJETIVO",
    experience: "EXPERIENCIA",
    training: "FORMACIÓN",
    education: "EDUCACIÓN",
    skills: "COMPETENCIAS",
    software: "PROGRAMAS",
    languages: "IDIOMAS",
    participation: "PARTICIPACIÓN",
    certifications: "CERTIFICACIONES",
    references: "REFERENCIAS",
  },
  de: {
    objective: "BERUFSZIEL",
    experience: "BERUFSERFAHRUNG",
    training: "WEITERBILDUNG",
    education: "AUSBILDUNG",
    skills: "KOMPETENZEN",
    software: "SOFTWARE",
    languages: "SPRACHEN",
    participation: "ENGAGEMENT",
    certifications: "ZERTIFIZIERUNGEN",
    references: "REFERENZEN",
  },
  it: {
    objective: "OBIETTIVO",
    experience: "ESPERIENZA",
    training: "FORMAZIONE",
    education: "ISTRUZIONE",
    skills: "COMPETENZE",
    software: "SOFTWARE",
    languages: "LINGUE",
    participation: "ATTIVITÀ",
    certifications: "CERTIFICAZIONI",
    references: "REFERENZE",
  },
  zh: {
    objective: "职业目标",
    experience: "工作经历",
    training: "专业培训",
    education: "教育背景",
    skills: "核心技能",
    software: "软件",
    languages: "语言",
    participation: "参与活动",
    certifications: "证书",
    references: "推荐人",
  },
  ar: {
    objective: "الهدف المهني",
    experience: "الخبرة المهنية",
    training: "التكوين المهني",
    education: "التعليم",
    skills: "المهارات",
    software: "البرامج",
    languages: "اللغات",
    participation: "المشاركة",
    certifications: "الشهادات",
    references: "المراجع",
  },
};

const ICONS = {
  phone:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#5c0632" stroke-width="1.9"><path d="M5 3h4l2 5-3 2c2 4 4 6 8 8l2-3 5 2v4c0 1-1 2-2 2C11 23 1 13 1 3c0-1 1-2 2-2Z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="#5c0632" stroke-width="1.9"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m3 6 9 7 9-7"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="#5c0632" stroke-width="1.9"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="#5c0632" stroke-width="1.9"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="9" r="2.5"/><path d="M7.5 18c.8-3 2.3-4.5 4.5-4.5s3.7 1.5 4.5 4.5"/></svg>',
  car: '<svg viewBox="0 0 24 24" fill="none" stroke="#5c0632" stroke-width="1.9"><path d="m5 11 2-5h10l2 5 2 2v6h-2v2h-3v-2H8v2H5v-2H3v-6Z"/><circle cx="7" cy="15" r="1"/><circle cx="17" cy="15" r="1"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="#5c0632" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><path d="m12 6 1.8 3.7 4.1.6-3 2.9.7 4.1-3.6-1.9-3.6 1.9.7-4.1-3-2.9 4.1-.6Z"/></svg>',
} as const;

const PRO_ICONS = {
  experience:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#5c0632" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/></svg>',
  training:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#5c0632" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="15" rx="2"/><path d="M8 7h8M8 11h6"/><path d="m9 18-1 4 4-2 4 2-1-4"/></svg>',
  education:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#5c0632" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m2 9 10-5 10 5-10 5Z"/><path d="M6 11.5V17c3 2.5 9 2.5 12 0v-5.5M22 9v6"/></svg>',
} as const;

type ProIcon = keyof typeof PRO_ICONS;

const proIconSvg = (icon: ProIcon, color = ACCENT) => PRO_ICONS[icon].replaceAll(ACCENT, color);

const LANGUAGE_FLAGS: Record<keyof CV["langues"], string> = {
  fr: '<svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg"><rect width="10" height="20" fill="#0055a4"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ef4135"/><rect x=".5" y=".5" width="29" height="19" fill="none" stroke="#cbd5e1"/></svg>',
  en: '<svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg"><rect width="30" height="20" fill="#012169"/><path d="M0 0 30 20M30 0 0 20" stroke="#fff" stroke-width="5"/><path d="M0 0 30 20M30 0 0 20" stroke="#c8102e" stroke-width="2"/><path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="7"/><path d="M15 0v20M0 10h30" stroke="#c8102e" stroke-width="4"/><rect x=".5" y=".5" width="29" height="19" fill="none" stroke="#cbd5e1"/></svg>',
  ar: '<svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg"><rect width="15" height="20" fill="#006233"/><rect x="15" width="15" height="20" fill="#fff"/><circle cx="15" cy="10" r="5" fill="#d21034"/><circle cx="16.8" cy="10" r="4" fill="#fff"/><path d="m16 6.5.9 2.1 2.3.2-1.8 1.5.6 2.2-2-1.2-1.9 1.2.5-2.2-1.7-1.5 2.3-.2Z" fill="#d21034"/><rect x=".5" y=".5" width="29" height="19" fill="none" stroke="#cbd5e1"/></svg>',
  de: '<svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg"><rect width="30" height="6.67" fill="#111"/><rect y="6.67" width="30" height="6.67" fill="#dd0000"/><rect y="13.34" width="30" height="6.66" fill="#ffce00"/><rect x=".5" y=".5" width="29" height="19" fill="none" stroke="#cbd5e1"/></svg>',
  es: '<svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg"><rect width="30" height="20" fill="#aa151b"/><rect y="5" width="30" height="10" fill="#f1bf00"/><rect x="8" y="8" width="2" height="5" fill="#aa151b"/><rect x=".5" y=".5" width="29" height="19" fill="none" stroke="#cbd5e1"/></svg>',
  kab: '<svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg"><rect width="30" height="6.67" fill="#42a5f5"/><rect y="6.67" width="30" height="6.67" fill="#4caf50"/><rect y="13.34" width="30" height="6.66" fill="#f5d547"/><path d="M15 3v14M11.5 6 18.5 14M18.5 6 11.5 14" fill="none" stroke="#d71920" stroke-width="1.8" stroke-linecap="round"/><rect x=".5" y=".5" width="29" height="19" fill="none" stroke="#cbd5e1"/></svg>',
};

const CONTACT_LABELS: Record<DocumentLanguage, { driving: string; service: string }> = {
  fr: { driving: "Permis de conduire", service: "Service national" },
  en: { driving: "Driving licence", service: "National service" },
  es: { driving: "Permiso de conducir", service: "Servicio nacional" },
  de: { driving: "Führerschein", service: "Wehrdienst" },
  it: { driving: "Patente di guida", service: "Servizio nazionale" },
  zh: { driving: "驾驶证", service: "兵役情况" },
  ar: { driving: "رخصة القيادة", service: "الخدمة الوطنية" },
};

const SOFTWARE: Record<SoftwareIcon, { color: string; letter: string }> = {
  word: { color: "#2b579a", letter: "W" },
  excel: { color: "#217346", letter: "X" },
  powerpoint: { color: "#d24726", letter: "P" },
  generic: { color: ACCENT, letter: "•" },
};

const clean = (value: string) => value.trim();

function withTerminalPeriod(value: string) {
  return value
    .split(/\r?\n/u)
    .map((line) => {
      const normalized = line.trim();
      if (!normalized || /[.!?…؟]$/u.test(normalized)) return normalized;
      return `${normalized}.`;
    })
    .join("\n");
}

function abbreviateDateMonths(value: string, language: DocumentLanguage) {
  if (language !== "fr") return value;
  return value.replace(
    /(?<!\p{L})(janvier|février|fevrier|avril|juillet|septembre|octobre|novembre|décembre|decembre)(?!\p{L})/giu,
    (month) => Array.from(month).slice(0, 3).join(""),
  );
}

type PdfTextRun = { text: string; bold?: boolean; color?: string };
type PdfText = string | PdfTextRun[];

function rtlVisualLine(words: string[]): PdfTextRun[] {
  const groups: Array<{ ltr: boolean; words: string[] }> = [];
  for (const word of words) {
    const ltr = /[\p{Script=Latin}\d]/u.test(word) && !/\p{Script=Arabic}/u.test(word);
    const previous = groups.at(-1);
    if (ltr && previous?.ltr) previous.words.push(word);
    else groups.push({ ltr, words: [word] });
  }
  return groups
    .reverse()
    .flatMap((group) => group.words)
    .flatMap((word, index) => {
      const mirrored = /\p{Script=Arabic}/u.test(word)
        ? word.replace(
            /[()[\]{}]/g,
            (character) =>
              ({ "(": ")", ")": "(", "[": "]", "]": "[", "{": "}", "}": "{" })[character] ||
              character,
          )
        : word;
      const containsArabic = /\p{Script=Arabic}/u.test(mirrored);
      const containsLtr = /[\p{Script=Latin}\d]/u.test(mirrored);
      const pieces =
        containsArabic && containsLtr
          ? (
              mirrored.match(/[\p{Script=Arabic}\p{Mark}]+|[^\p{Script=Arabic}\p{Mark}]+/gu) || [
                mirrored,
              ]
            ).reverse()
          : [mirrored];
      return index
        ? [{ text: "\u00a0" }, ...pieces.map((text) => ({ text }))]
        : pieces.map((text) => ({ text }));
    });
}

function rtlMixedText(value: string, maxChars: number): PdfTextRun[] {
  const paragraphs = value.normalize("NFC").split(/\r?\n/u);
  const output: PdfTextRun[] = [];
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const words = paragraph.trim().split(/\s+/u).filter(Boolean);
    const lines: string[][] = [];
    let line: string[] = [];
    let length = 0;
    for (const word of words) {
      const nextLength = length + (line.length ? 1 : 0) + Array.from(word).length;
      if (line.length && nextLength > maxChars) {
        lines.push(line);
        line = [word];
        length = Array.from(word).length;
      } else {
        line.push(word);
        length = nextLength;
      }
    }
    if (line.length) lines.push(line);
    lines.forEach((logicalLine, lineIndex) => {
      if (paragraphIndex || lineIndex) output.push({ text: "\n" });
      output.push(...rtlVisualLine(logicalLine));
    });
  });
  return output;
}

function displayText(value: string, language: DocumentLanguage, maxChars = 55) {
  const normalized = value.trim();
  return language === "ar" && /\p{Script=Arabic}/u.test(normalized)
    ? rtlMixedText(normalized, maxChars)
    : normalized;
}

function withRunStyle(value: PdfText, style: Omit<PdfTextRun, "text">): PdfTextRun[] {
  return (typeof value === "string" ? [{ text: value }] : value).map((run) => ({
    ...run,
    ...style,
  }));
}

function adaptiveNameSize(name: string) {
  const length = Array.from(name.trim()).length;
  if (length <= 14) return 40;
  if (length <= 20) return 30;
  if (length <= 28) return 27;
  if (length <= 38) return 24;
  return 21;
}

function sectionBar(label: string, language: DocumentLanguage, width: number): Content {
  const height = 22;
  return {
    stack: [
      {
        canvas: [
          {
            type: "rect",
            x: 0,
            y: 0,
            w: width,
            h: height,
            r: height / 2,
            color: ACCENT,
          },
        ],
      },
      {
        text: displayText(label, language, 28),
        color: "#ffffff",
        bold: true,
        fontSize: language === "zh" ? 13 : 15,
        lineHeight: 1,
        noWrap: true,
        alignment: language === "ar" ? "right" : "left",
        margin: [10, -16.5, 10, 1.5],
        preserveDesignerVerticalMargin: true,
      },
    ],
    margin: [0, 0, 0, 7],
  } as Content;
}

function bulletList(items: string[], language: DocumentLanguage, compact = false): Content {
  const rtl = language === "ar";
  return {
    stack: items.filter(clean).map((item) => {
      const markerRadius = compact ? 1.25 : 1.55;
      const marker = {
        width: 8,
        canvas: [
          {
            type: "ellipse",
            x: 3,
            y: compact ? 5.2 : 5.7,
            r1: markerRadius,
            r2: markerRadius,
            color: ACCENT,
          },
        ],
        margin: [0, 0, 0, 0],
      } as Content;
      const body = {
        width: "*",
        text: displayText(withTerminalPeriod(item), language, compact ? 30 : 58),
        alignment: rtl ? "right" : "left",
        fontSize: compact ? 8.2 : 9,
        lineHeight: BODY_LINE_HEIGHT,
      } as Content;
      return {
        columns: rtl ? [body, marker] : [marker, body],
        columnGap: 1,
        margin: [0, 0, 0, 0],
      } as Content;
    }),
  } as Content;
}

function mainSection(label: string, content: Content[], language: DocumentLanguage): Content {
  return {
    stack: [sectionBar(label, language, MAIN_SECTION_W), ...content],
    margin: [0, 0, 0, 8],
  } as Content;
}

function sidebarSection(label: string, content: Content[], language: DocumentLanguage): Content {
  return {
    stack: [sectionBar(label, language, SIDEBAR_SECTION_W), ...content],
    margin: [18, 0, 16, 10],
  } as Content;
}

function entryHeading(
  title: string,
  date: string,
  language: DocumentLanguage,
  icon: ProIcon,
  logo?: Experience["logo"],
): Content {
  const rtl = language === "ar";
  const normalizedTitle = title.trim().toLocaleUpperCase(language);
  const normalizedDate = abbreviateDateMonths(date.trim(), language).toLocaleUpperCase(language);
  const titleRuns = withRunStyle(displayText(normalizedTitle, language, 42), {
    bold: true,
    color: INK,
  });
  const dateRuns = withRunStyle(displayText(normalizedDate, language, 32), {
    bold: true,
    color: INK,
  });
  const separator = { text: "  |  ", bold: true, color: ACCENT };

  const heading = {
    width: "*",
    text:
      normalizedTitle && normalizedDate
        ? rtl
          ? [...dateRuns, separator, ...titleRuns]
          : [...titleRuns, separator, ...dateRuns]
        : normalizedTitle
          ? titleRuns
          : dateRuns,
    bold: true,
    color: INK,
    fontSize: 10.2,
    lineHeight: META_LINE_HEIGHT,
    alignment: rtl ? "right" : "left",
  } as Content;
  const iconNode = logo?.dataUrl
    ? ({
        width: 13,
        image: logo.dataUrl,
        fit: [9, 9],
        alignment: "center",
        margin: [0, 0, 0, 0],
      } as Content)
    : ({
        width: 13,
        svg: proIconSvg(icon),
        fit: [9, 9],
        alignment: "center",
        margin: [0, 0, 0, 0],
      } as Content);

  return {
    columns: rtl ? [heading, iconNode] : [iconNode, heading],
    columnGap: 3,
    margin: [0, 0, 0, 2],
  } as Content;
}

function entryLocationLine(
  primary: string,
  location: string,
  language: DocumentLanguage,
): Content | null {
  const value = [primary, location].map(clean).filter(Boolean).join(", ");
  if (!value) return null;
  return {
    text: displayText(withTerminalPeriod(value), language, 58),
    color: INK,
    fontSize: 8.8,
    lineHeight: META_LINE_HEIGHT,
    alignment: language === "ar" ? "right" : "left",
    margin: [0, 0, 0, 3],
  } as Content;
}

function experienceBlock(item: Experience, language: DocumentLanguage): Content {
  const rtl = language === "ar";
  const locationLine = entryLocationLine(item.employeur, item.lieu, language);
  return {
    stack: [
      entryHeading(item.titre, item.dates, language, "experience", item.logo),
      ...(locationLine ? [locationLine] : []),
      ...(item.descriptions.some(clean) ? [bulletList(item.descriptions, language)] : []),
    ],
    margin: rtl ? [0, 0, 10, 8] : [10, 0, 0, 8],
  } as Content;
}

function learningBlock(item: Formation | Education, language: DocumentLanguage): Content {
  const rtl = language === "ar";
  const isEducation = "option" in item;
  const secondary = isEducation ? item.option : item.competences;
  const locationLine = entryLocationLine(item.institution, item.lieu, language);
  return {
    unbreakable: true,
    stack: [
      entryHeading(item.titre, item.date, language, isEducation ? "education" : "training"),
      ...(locationLine ? [locationLine] : []),
      ...(secondary
        ? [
            {
              text: displayText(withTerminalPeriod(secondary), language, 58),
              color: DARK,
              fontSize: 8.8,
              lineHeight: BODY_LINE_HEIGHT,
              alignment: rtl ? "right" : "left",
              margin: [0, 0, 0, 0],
            } as Content,
          ]
        : []),
      ...(isEducation && item.equivalence
        ? [
            {
              text: displayText(withTerminalPeriod(item.equivalence), language, 58),
              italics: true,
              fontSize: 8.4,
              lineHeight: BODY_LINE_HEIGHT,
              alignment: rtl ? "right" : "left",
              margin: [0, 1, 0, 0],
            } as Content,
          ]
        : []),
    ],
    margin: rtl ? [0, 0, 10, 8] : [10, 0, 0, 8],
  } as Content;
}

function softwareGrid(cv: CV, language: DocumentLanguage): Content {
  const items = cv.logiciels.filter((item) => item.label.trim());
  const rows: Content[][] = [];
  for (let index = 0; index < items.length; index += 3) {
    const slice = items.slice(index, index + 3);
    rows.push(
      slice.map((item) => {
        const icon = SOFTWARE[item.icon] || SOFTWARE.generic;
        const svg = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="4" fill="${icon.color}"/><text x="16" y="22" text-anchor="middle" font-family="Arial" font-size="18" font-weight="700" fill="white">${icon.letter}</text></svg>`;
        return {
          width: "*",
          stack: [
            { svg, fit: [24, 24], alignment: "center" },
            {
              text: displayText(item.label, language, 15),
              fontSize: 7.4,
              lineHeight: META_LINE_HEIGHT,
              alignment: "center",
              margin: [0, 2, 0, 0],
            },
          ],
        } as Content;
      }),
    );
  }
  return {
    stack: rows.map(
      (row) =>
        ({
          columns: [
            ...row,
            ...Array.from({ length: 3 - row.length }, () => ({ width: "*", text: "" })),
          ],
          columnGap: 5,
          margin: [0, 0, 0, 5],
        }) as Content,
    ),
  } as Content;
}

function languageRows(cv: CV, language: DocumentLanguage): Content[] {
  const labels: Record<keyof CV["langues"], Record<DocumentLanguage, string>> = {
    fr: {
      fr: "Français",
      en: "French",
      es: "Francés",
      de: "Französisch",
      it: "Francese",
      zh: "法语",
      ar: "الفرنسية",
    },
    en: {
      fr: "Anglais",
      en: "English",
      es: "Inglés",
      de: "Englisch",
      it: "Inglese",
      zh: "英语",
      ar: "الإنجليزية",
    },
    ar: {
      fr: "Arabe",
      en: "Arabic",
      es: "Árabe",
      de: "Arabisch",
      it: "Arabo",
      zh: "阿拉伯语",
      ar: "العربية",
    },
    de: {
      fr: "Allemand",
      en: "German",
      es: "Alemán",
      de: "Deutsch",
      it: "Tedesco",
      zh: "德语",
      ar: "الألمانية",
    },
    es: {
      fr: "Espagnol",
      en: "Spanish",
      es: "Español",
      de: "Spanisch",
      it: "Spagnolo",
      zh: "西班牙语",
      ar: "الإسبانية",
    },
    kab: {
      fr: "Kabyle",
      en: "Kabyle",
      es: "Cabilio",
      de: "Kabylisch",
      it: "Cabilo",
      zh: "卡拜尔语",
      ar: "القبائلية",
    },
  };
  const rtl = language === "ar";
  return (Object.keys(cv.langues) as Array<keyof CV["langues"]>)
    .filter((key) => cv.langues[key].trim())
    .map((key) => {
      const flag = {
        width: 18,
        svg: LANGUAGE_FLAGS[key],
        fit: [14, 9.3],
        alignment: "center",
        margin: [0, 0.25, 0, 0],
      } as Content;
      const body = {
        width: "*",
        text: rtl
          ? [
              ...withRunStyle(displayText(cv.langues[key], language, 20), {}),
              { text: "\u00a0\u00a0" },
              ...withRunStyle(displayText(labels[key][language], language, 16), { bold: true }),
            ]
          : [{ text: `${labels[key][language]}  `, bold: true }, { text: cv.langues[key] }],
        alignment: rtl ? "right" : "left",
        fontSize: 8.2,
        lineHeight: META_LINE_HEIGHT,
      } as Content;
      return {
        columns: rtl ? [body, flag] : [flag, body],
        columnGap: 4,
        margin: [0, 0, 0, 4],
      } as Content;
    });
}

function contactLine(icon: keyof typeof ICONS, value: string, language: DocumentLanguage): Content {
  const rtl = language === "ar";
  const length = Array.from(value.trim()).length;
  const fontSize = length > 48 ? 7.2 : length > 40 ? 7.8 : length > 32 ? 8.5 : 9.4;
  const iconNode = {
    svg: ICONS[icon],
    fit: [11, 11],
    verticalAlignment: "middle",
    alignment: "center",
  } as Content;
  const textNode = {
    text: displayText(value, language, 54),
    fontSize,
    lineHeight: 1,
    color: INK,
    noWrap: true,
    verticalAlignment: "middle",
    alignment: rtl ? "right" : "left",
  } as Content;
  const line = {
    width: "auto",
    table: {
      widths: rtl ? ["auto", 13] : [13, "auto"],
      body: [rtl ? [textNode, iconNode] : [iconNode, textNode]],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
      paddingLeft: (column: number) => (rtl ? (column === 1 ? 4 : 0) : 0),
      paddingRight: (column: number) => (rtl ? 0 : column === 0 ? 4 : 0),
    },
  } as Content;
  return {
    columns: [{ width: "*", text: "" }, line, { width: "*", text: "" }],
    columnGap: 0,
    margin: [0, 0, 0, 7],
  } as Content;
}

function labeledContact(value: string, label: string) {
  const normalizedValue = value.trim();
  if (!normalizedValue) return "";
  const comparableValue = normalizedValue
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase();
  const comparableLabel = label
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase();
  return comparableValue.includes(comparableLabel)
    ? normalizedValue
    : `${label}: ${normalizedValue}`;
}

function firstPageOverlay(cv: CV, language: DocumentLanguage): Content[] {
  const rtl = language === "ar";
  const capsuleX = rtl ? 376 : 16;
  const identityX = rtl ? 25 : 237;
  const contactLabels = CONTACT_LABELS[language];
  const birthAndFamily = [cv.date_naissance, cv.situation_familiale]
    .map(clean)
    .filter(Boolean)
    .join(", ");
  const location = cv.adresse.trim() || [cv.wilaya, cv.pays].map(clean).filter(Boolean).join(", ");
  const contacts = [
    cv.telephone ? contactLine("phone", cv.telephone, language) : null,
    cv.email ? contactLine("mail", cv.email, language) : null,
    birthAndFamily ? contactLine("user", birthAndFamily, language) : null,
    cv.permis_conduire
      ? contactLine("car", labeledContact(cv.permis_conduire, contactLabels.driving), language)
      : null,
    cv.service_national
      ? contactLine("star", labeledContact(cv.service_national, contactLabels.service), language)
      : null,
    location ? contactLine("pin", location, language) : null,
  ].filter((item): item is Content => Boolean(item));
  const noBorders = {
    hLineWidth: () => 0,
    vLineWidth: () => 0,
    paddingTop: () => 0,
    paddingBottom: () => 0,
    paddingLeft: () => 0,
    paddingRight: () => 0,
  };
  return [
    {
      table: {
        widths: [333],
        body: [
          [
            {
              stack: [
                {
                  text: displayText(
                    (cv.nom_complet || "CV PRO").toLocaleUpperCase(language),
                    language,
                    32,
                  ),
                  color: "#ffffff",
                  bold: true,
                  fontSize: adaptiveNameSize(cv.nom_complet || "CV PRO"),
                  lineHeight: 1,
                  alignment: rtl ? "right" : "left",
                  margin: [0, 0, 0, 8],
                },
                {
                  text: displayText(cv.titre_poste.toLocaleUpperCase(language), language, 42),
                  color: "#D9E2F3",
                  bold: true,
                  fontSize: 16,
                  lineHeight: 1,
                  alignment: rtl ? "right" : "left",
                },
              ],
            },
          ],
        ],
      },
      layout: noBorders,
      absolutePosition: { x: identityX, y: 48 },
    } as Content,
    {
      table: {
        widths: [184],
        body: [[{ stack: contacts }]],
      },
      layout: noBorders,
      absolutePosition: { x: capsuleX + 10, y: 220 },
    } as Content,
  ];
}

function headerContent(cv: CV, language: DocumentLanguage, currentPage: number): Content {
  const rtl = language === "ar";
  if (currentPage > 1) {
    const name = {
      width: "*",
      text: displayText((cv.nom_complet || "CV PRO").toLocaleUpperCase(language), language, 36),
      color: "#ffffff",
      bold: true,
      fontSize: 18,
      alignment: rtl ? "right" : "left",
    } as Content;
    const title = {
      width: "*",
      text: displayText(cv.titre_poste.toLocaleUpperCase(language), language, 30),
      color: "#D9E2F3",
      bold: true,
      fontSize: 10,
      alignment: rtl ? "left" : "right",
    } as Content;
    return {
      columns: rtl ? [title, name] : [name, title],
      columnGap: 24,
      margin: [32, 42, 32, 0],
    } as Content;
  }

  return { text: "", color: rtl ? "#ffffff" : "#ffffff" } as Content;
}

function background(cv: CV, language: DocumentLanguage, currentPage: number): Content {
  const rtl = language === "ar";
  const capsuleX = rtl ? 376 : 16;
  const headerHeight = currentPage === 1 ? 163.5 : 82;
  const content: Content[] = [
    {
      canvas: [
        { type: "rect", x: 0, y: 0, w: PAGE_W, h: PAGE_H, color: PAPER },
        { type: "rect", x: 0, y: 0, w: PAGE_W, h: headerHeight, color: ACCENT },
      ],
    } as Content,
  ];
  if (currentPage === 1) {
    content.push({
      svg: '<svg width="204" height="313" viewBox="0 0 204 313" xmlns="http://www.w3.org/2000/svg"><path d="M102 1C46 1 2 45 2 101V208C2 266 47 311 102 311C157 311 202 266 202 208V101C202 45 158 1 102 1Z" fill="#ffffff" stroke="#5c0632" stroke-width="2"/></svg>',
      width: 204,
      height: 313,
      absolutePosition: { x: capsuleX, y: 37 },
    } as Content);
    if (cv.photo?.dataUrl) {
      content.push({
        image: cv.photo.dataUrl,
        width: 140,
        height: 140,
        absolutePosition: { x: capsuleX + 32, y: 67 },
      } as Content);
    } else {
      content.push(
        {
          canvas: [
            {
              type: "ellipse",
              x: 74,
              y: 74,
              r1: 74,
              r2: 74,
              color: "#ffffff",
              lineColor: "#d6d6d6",
              lineWidth: 1,
            },
          ],
          absolutePosition: { x: capsuleX + 28, y: 63 },
        } as Content,
        {
          table: {
            widths: [148],
            body: [[{ text: "CV", color: ACCENT, bold: true, fontSize: 36, alignment: "center" }]],
          },
          layout: {
            hLineWidth: () => 0,
            vLineWidth: () => 0,
            paddingTop: () => 0,
            paddingBottom: () => 0,
            paddingLeft: () => 0,
            paddingRight: () => 0,
          },
          absolutePosition: { x: capsuleX + 28, y: 111 },
        } as Content,
      );
    }
  }
  return { stack: content } as Content;
}

export function buildCvProPdf(cv: CV, language: DocumentLanguage): TDocumentDefinitions {
  const rtl = language === "ar";
  const labels = LABELS[language];
  const main: Content[] = [];
  const sidebar: Content[] = [{ text: "", margin: [0, 0, 0, 185] } as Content];

  if (cv.objectif.trim()) {
    main.push(
      mainSection(
        labels.objective,
        [
          {
            text: displayText(withTerminalPeriod(cv.objectif), language, 64),
            fontSize: 9,
            lineHeight: BODY_LINE_HEIGHT,
            alignment: rtl ? "right" : "left",
            margin: rtl ? [0, 0, 10, 0] : [10, 0, 2, 0],
          } as Content,
        ],
        language,
      ),
    );
  }

  const experiences = cv.experiences.filter(
    (item) => item.titre || item.employeur || item.dates || item.descriptions.some(clean),
  );
  if (experiences.length) {
    main.push(
      mainSection(
        labels.experience,
        experiences.map((item) => experienceBlock(item, language)),
        language,
      ),
    );
  }

  const formations = cv.formations.filter((item) => item.titre || item.institution || item.date);
  if (formations.length) {
    main.push(
      mainSection(
        labels.training,
        formations.map((item) => learningBlock(item, language)),
        language,
      ),
    );
  }

  const educations = cv.educations.filter((item) => item.titre || item.institution || item.date);
  if (educations.length) {
    main.push(
      mainSection(
        labels.education,
        educations.map((item) => learningBlock(item, language)),
        language,
      ),
    );
  }

  const skills = cv.competences.filter(clean);
  if (skills.length)
    sidebar.push(sidebarSection(labels.skills, [bulletList(skills, language, true)], language));

  if (cv.logiciels.some((item) => item.label.trim()))
    sidebar.push(sidebarSection(labels.software, [softwareGrid(cv, language)], language));

  const languages = languageRows(cv, language);
  if (languages.length) sidebar.push(sidebarSection(labels.languages, languages, language));

  const participation = cv.participations.filter(clean);
  if (participation.length)
    sidebar.push(
      sidebarSection(labels.participation, [bulletList(participation, language, true)], language),
    );

  const certifications = cv.certifications.filter(clean);
  if (certifications.length)
    sidebar.push(
      sidebarSection(labels.certifications, [bulletList(certifications, language, true)], language),
    );

  const references = cv.references.filter(clean);
  if (references.length)
    sidebar.push(
      sidebarSection(labels.references, [bulletList(references, language, true)], language),
    );

  const sidebarColumn = { width: SIDEBAR_W, stack: sidebar } as Content;
  const mainColumn = { width: "*", stack: main } as Content;

  return {
    info: {
      title: cv.nom_complet ? `CV PRO - ${cv.nom_complet}` : "CV PRO",
      author: cv.nom_complet || "",
      subject: cv.titre_poste || "Curriculum Vitae",
    },
    pageSize: "A4",
    pageMargins: [16, PAGE_TOP, 16, 24],
    background: (currentPage) => background(cv, language, currentPage),
    header: (currentPage) => headerContent(cv, language, currentPage),
    defaultStyle: {
      font: documentFont(language),
      fontSize: 9,
      color: DARK,
      lineHeight: BODY_LINE_HEIGHT,
      alignment: rtl ? "right" : undefined,
    },
    content: [
      ...firstPageOverlay(cv, language),
      { text: "", margin: [0, 0, 0, FIRST_PAGE_BODY_OFFSET] } as Content,
      {
        columns: rtl ? [mainColumn, sidebarColumn] : [sidebarColumn, mainColumn],
        columnGap: COLUMN_GAP,
      } as Content,
    ],
  };
}
