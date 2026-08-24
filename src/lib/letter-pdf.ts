import type {
  Content,
  TDocumentDefinitions,
  TFontDictionary,
  TVirtualFileSystem,
} from "pdfmake/interfaces";
import pdfMake from "pdfmake/build/pdfmake";
import calibriRegularUrl from "@/assets/fonts/Calibri.ttf?inline";
import calibriItalicUrl from "@/assets/fonts/Calibriitalic.ttf?inline";
import calibriBoldUrl from "@/assets/fonts/Calibribold.ttf?inline";
import calibriBoldItalicUrl from "@/assets/fonts/Calibribolditalic.ttf?inline";
import type { CV } from "./cv-types";
import { documentFont, languageInfo, type DocumentLanguage } from "./document-language";
import { applyPdfTheme } from "./pdf-theme";
import notoSansScUrl from "@/assets/fonts/NotoSansSC-VF.ttf?inline";
import notoSansArabicUrl from "@/assets/fonts/NotoSansArabic-VF.ttf?inline";

export type CoverLetterTemplateId =
  | "cover-letter-v1"
  | "cover-letter-v2"
  | "cover-letter-v3"
  | "cover-letter-v4"
  | "cover-letter-v5";

export const COVER_LETTER_TEMPLATES: ReadonlyArray<{
  id: CoverLetterTemplateId;
  name: string;
}> = [
  { id: "cover-letter-v1", name: "Cover Letter V1 Canada" },
  { id: "cover-letter-v2", name: "Cover Letter V2" },
  { id: "cover-letter-v3", name: "Cover Letter V3" },
  { id: "cover-letter-v4", name: "Cover Letter V4" },
  { id: "cover-letter-v5", name: "Cover Letter V5 Europass" },
];

const A4_W = 595.28;
const A4_H = 841.89;
let fontsRegistered = false;

const fonts: TFontDictionary = {
  Calibri: {
    normal: "Calibri.ttf",
    bold: "Calibribold.ttf",
    italics: "Calibriitalic.ttf",
    bolditalics: "Calibribolditalic.ttf",
  },
  NotoSansSC: {
    normal: "NotoSansSC-VF.ttf",
    bold: "NotoSansSC-VF.ttf",
    italics: "NotoSansSC-VF.ttf",
    bolditalics: "NotoSansSC-VF.ttf",
  },
  NotoSansArabic: {
    normal: "NotoSansArabic-VF.ttf",
    bold: "NotoSansArabic-VF.ttf",
    italics: "NotoSansArabic-VF.ttf",
    bolditalics: "NotoSansArabic-VF.ttf",
  },
};

function registerFonts() {
  if (fontsRegistered) return;
  const base64 = (url: string) => url.slice(url.indexOf("base64,") + 7);
  const vfs: TVirtualFileSystem = {
    "Calibri.ttf": base64(calibriRegularUrl),
    "Calibriitalic.ttf": base64(calibriItalicUrl),
    "Calibribold.ttf": base64(calibriBoldUrl),
    "Calibribolditalic.ttf": base64(calibriBoldItalicUrl),
    "NotoSansSC-VF.ttf": base64(notoSansScUrl),
    "NotoSansArabic-VF.ttf": base64(notoSansArabicUrl),
  };
  pdfMake.addVirtualFileSystem(vfs);
  pdfMake.addFonts(fonts);
  fontsRegistered = true;
}

const LETTER_COPY = {
  fr: {
    address: "Adresse",
    phone: "Téléphone",
    email: "Email",
    region: "Région",
    subject: "Objet",
    sincerely: "Cordialement,",
  },
  en: {
    address: "Address",
    phone: "Phone",
    email: "Email",
    region: "Region",
    subject: "Subject",
    sincerely: "Sincerely,",
  },
  es: {
    address: "Dirección",
    phone: "Teléfono",
    email: "Correo electrónico",
    region: "Región",
    subject: "Asunto",
    sincerely: "Atentamente,",
  },
  de: {
    address: "Adresse",
    phone: "Telefon",
    email: "E-Mail",
    region: "Region",
    subject: "Betreff",
    sincerely: "Mit freundlichen Grüßen",
  },
  it: {
    address: "Indirizzo",
    phone: "Telefono",
    email: "E-mail",
    region: "Regione",
    subject: "Oggetto",
    sincerely: "Cordiali saluti,",
  },
  zh: {
    address: "地址",
    phone: "电话",
    email: "电子邮箱",
    region: "地区",
    subject: "主题",
    sincerely: "此致敬礼",
  },
  ar: {
    address: "العنوان",
    phone: "الهاتف",
    email: "البريد الإلكتروني",
    region: "المنطقة",
    subject: "الموضوع",
    sincerely: "مع خالص التحية،",
  },
} as const;

const LETTER_DEFAULTS = {
  fr: {
    subject: "Candidature au poste de",
    salutation: "Madame, Monsieur,",
    closing: "Je vous prie d’agréer mes salutations distinguées.",
    regards: "Cordialement,",
  },
  en: {
    subject: "Application for the position of",
    salutation: "Dear Sir or Madam,",
    closing: "Yours sincerely",
    regards: "Kind regards,",
  },
  es: {
    subject: "Candidatura para el puesto de",
    salutation: "Estimado/a señor/a:",
    closing: "Le saluda atentamente.",
    regards: "Atentamente,",
  },
  de: {
    subject: "Bewerbung um die Position als",
    salutation: "Sehr geehrte Damen und Herren,",
    closing: "Mit freundlichen Grüßen",
    regards: "Mit freundlichen Grüßen",
  },
  it: {
    subject: "Candidatura per la posizione di",
    salutation: "Gentile Signora, Egregio Signore,",
    closing: "Distinti saluti.",
    regards: "Cordiali saluti,",
  },
  zh: {
    subject: "应聘职位：",
    salutation: "尊敬的招聘负责人：",
    closing: "谨致诚挚的问候。",
    regards: "此致敬礼",
  },
  ar: {
    subject: "طلب الترشح لمنصب",
    salutation: "السيدة المحترمة، السيد المحترم،",
    closing: "وتفضلوا بقبول فائق الاحترام والتقدير.",
    regards: "مع خالص التحية،",
  },
} as const;

const copy = (language: DocumentLanguage) => LETTER_COPY[language];

function letterSubject(cv: CV, language: DocumentLanguage) {
  return cv.lettre_motivation.objet || `${LETTER_DEFAULTS[language].subject} ${cv.titre_poste}`;
}

function letterDate(cv: CV, language: DocumentLanguage) {
  return (
    cv.lettre_motivation.date ||
    new Intl.DateTimeFormat(languageInfo(language).locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date())
  );
}

function letterBody(cv: CV, language: DocumentLanguage, fontSize = 10.8): Content[] {
  const effectiveFontSize = language === "ar" ? fontSize * 0.82 : fontSize;
  const effectiveLineHeight = language === "ar" ? 1.12 : 1.32;
  const salutation = cv.lettre_motivation.salutation || LETTER_DEFAULTS[language].salutation;
  const closing = cv.lettre_motivation.formule_politesse || LETTER_DEFAULTS[language].closing;
  return [
    { text: salutation, margin: [0, 0, 0, 13] },
    ...cv.lettre_motivation.paragraphes.filter(Boolean).map((paragraph) => ({
      text: paragraph,
      alignment: "justify" as const,
      margin: [0, 0, 0, 12] as [number, number, number, number],
    })),
    { text: closing, margin: [0, 2, 0, 13] },
    { text: cv.nom_complet, bold: true },
  ].map((item) => ({
    ...item,
    fontSize: effectiveFontSize,
    lineHeight: effectiveLineHeight,
  })) as Content[];
}

function canadaFlagSvg() {
  return `<svg viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="60" fill="#fff"/><rect width="30" height="60" fill="#d80621"/><rect x="90" width="30" height="60" fill="#d80621"/><path fill="#d80621" d="M60 5l4 11 7-4-2 10 10-3-4 9 10 1-7 7 6 4-19 4 2 9-5-2v6h-4v-6l-5 2 2-9-19-4 6-4-7-7 10-1-4-9 10 3-2-10 7 4z"/><rect x=".5" y=".5" width="119" height="59" fill="none" stroke="#d6d6d6"/></svg>`;
}

function v1ContactIcon(kind: "address" | "phone" | "email") {
  if (kind === "address") {
    return `<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="#cf1645"/><path fill="#fff" d="M10 4.5a4 4 0 0 0-4 4c0 3 4 7 4 7s4-4 4-7a4 4 0 0 0-4-4zm0 5.7a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6z"/></svg>`;
  }
  if (kind === "phone") {
    return `<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="#cf1645"/><path fill="#fff" d="M6.1 4.8l2.1-.5 1.1 3-1.2.9c.7 1.5 2 2.8 3.6 3.6l.9-1.2 3 1.1-.5 2.1c-.2.8-.9 1.4-1.8 1.3-4.5-.5-8-4-8.5-8.5-.1-.9.5-1.6 1.3-1.8z"/></svg>`;
  }
  return `<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="#cf1645"/><path fill="#fff" d="M4.7 6.1h10.6v7.8H4.7z"/><path fill="none" stroke="#cf1645" stroke-width="1" d="M5 6.5l5 4 5-4"/></svg>`;
}

function v1ContactRow(label: string, value: string, kind: "address" | "phone" | "email") {
  return {
    columns: [
      { width: 15, svg: v1ContactIcon(kind), fit: [13, 13], margin: [0, 0.5, 0, 0] },
      {
        width: "*",
        text: [{ text: `${label} : `, bold: true, color: "#cf1645" }, { text: value }],
        fontSize: 10.2,
        lineHeight: 1.2,
      },
    ],
    columnGap: 5,
    margin: [0, 0, 0, 4],
  } as Content;
}

function v1LetterBody(cv: CV, language: DocumentLanguage): Content[] {
  const salutation = cv.lettre_motivation.salutation || LETTER_DEFAULTS[language].salutation;
  const paragraphs = cv.lettre_motivation.paragraphes.filter(Boolean);
  const closing = cv.lettre_motivation.formule_politesse || LETTER_DEFAULTS[language].closing;
  const characterCount = [salutation, ...paragraphs, closing].join(" ").length;
  const calculatedFontSize =
    characterCount > 1500
      ? 10.2
      : characterCount > 1200
        ? 10.8
        : characterCount > 850
          ? 11.2
          : 11.7;
  const fontSize = language === "ar" ? calculatedFontSize * 0.82 : calculatedFontSize;
  const lineHeight =
    language === "ar"
      ? 1.12
      : characterCount > 1500
        ? 1.34
        : characterCount > 1200
          ? 1.45
          : characterCount > 850
            ? 1.55
            : 1.65;
  const paragraphGap =
    characterCount > 1500 ? 11 : characterCount > 1200 ? 16 : characterCount > 850 ? 22 : 28;

  return [
    {
      text: salutation,
      fontSize,
      lineHeight,
      margin: [0, 0, 0, paragraphGap],
    },
    ...paragraphs.map(
      (paragraph) =>
        ({
          text: paragraph,
          alignment: "justify",
          fontSize,
          lineHeight,
          margin: [0, 0, 0, paragraphGap],
        }) as Content,
    ),
    {
      text: closing,
      fontSize,
      lineHeight,
      margin: [0, 1, 0, paragraphGap],
    },
    {
      text: (cv.nom_complet || " ").toLocaleUpperCase(language),
      bold: true,
      color: "#cf1645",
      fontSize: 11.5,
      lineHeight: 1.1,
    },
  ] as Content[];
}

function canadaBackground(): Content {
  return {
    svg: `<svg width="${A4_W}" height="${A4_H}" viewBox="0 0 ${A4_W} ${A4_H}"><rect x="0" y="59" width="29" height="108" fill="#cf1645"/><rect x="0" y="167" width="32" height="10" fill="#c8a898" opacity=".8"/><path d="M0 790 C130 755 260 825 420 770 C500 743 555 750 595 724 L595 842 L0 842Z" fill="#f9bfd0"/><path d="M135 806 C270 770 390 824 595 735 L595 842 L135 842Z" fill="#e75a7b" opacity=".75"/><path d="M250 820 C390 792 470 805 595 755 L595 842 L250 842Z" fill="#ca1746" opacity=".9"/></svg>`,
    absolutePosition: { x: 0, y: 0 },
  } as Content;
}

function buildV1(cv: CV, language: DocumentLanguage): TDocumentDefinitions {
  const labels = copy(language);
  const contacts = [
    [labels.address, cv.adresse, "address"],
    [labels.phone, cv.telephone, "phone"],
    [labels.email, cv.email, "email"],
  ].filter(([, value]) => value) as Array<[string, string, "address" | "phone" | "email"]>;

  return {
    info: { title: `Cover Letter V1 - ${cv.nom_complet}`, author: cv.nom_complet },
    pageSize: "A4",
    pageMargins: [43, 51, 45, 76],
    background: () => canadaBackground(),
    defaultStyle: {
      font: documentFont(language),
      fontSize: 10.8,
      color: "#383838",
      lineHeight: 1.4,
      alignment: language === "ar" ? "right" : undefined,
    },
    content: [
      {
        columns: [
          {
            width: "*",
            stack: [
              {
                text: (cv.nom_complet || " ").toLocaleUpperCase(language),
                fontSize: 21,
                bold: true,
                color: "#cf1645",
                margin: [0, 0, 0, 7],
              },
              {
                canvas: [
                  {
                    type: "line",
                    x1: 0,
                    y1: 0,
                    x2: 252,
                    y2: 0,
                    lineWidth: 1.2,
                    lineColor: "#c8a898",
                  },
                ],
                margin: [0, 0, 0, 9],
              },
              ...contacts.map(([label, value, kind]) => v1ContactRow(label, value, kind)),
            ],
          },
          {
            width: 116,
            svg: canadaFlagSvg(),
            fit: [108, 54],
            margin: [8, 5, 0, 0],
          },
        ],
        columnGap: 15,
        margin: [0, 0, 0, 37],
      } as Content,
      {
        text: [
          { text: `${labels.subject} : `, bold: true },
          { text: letterSubject(cv, language), bold: true },
        ],
        color: "#cf1645",
        fontSize: 11.6,
        margin: [0, 0, 0, 30],
      },
      {
        stack: v1LetterBody(cv, language),
        margin: [18, 0, 18, 0],
      } as Content,
    ],
  };
}

const palette = {
  "cover-letter-v2": ["#0d6070", "#4bd381"],
  "cover-letter-v3": ["#4d006f", "#d30a87"],
  "cover-letter-v4": ["#0064a7", "#0bc4b0"],
} as const;

function coloredHeaderBackground(templateId: keyof typeof palette): Content {
  const [from, to] = palette[templateId];
  return {
    svg: `<svg width="${A4_W}" height="170" viewBox="0 0 ${A4_W} 170"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="595.28" height="126" fill="url(#g)"/><g fill="none" stroke="#ffffff" opacity=".13"><path d="M0 46 C90 0 120 100 230 44 S430 12 595 78"/><path d="M0 57 C100 10 130 110 240 54 S440 22 595 88"/><path d="M365 126 C425 93 448 176 520 131 S575 136 595 142"/></g></svg>`,
    absolutePosition: { x: 0, y: 0 },
  } as Content;
}

function coloredHeader(cv: CV, language: DocumentLanguage): Content {
  const labels = copy(language);
  const items = [
    [labels.phone.toLocaleUpperCase(language), cv.telephone],
    [labels.region.toLocaleUpperCase(language), cv.wilaya || cv.pays],
    [labels.address.toLocaleUpperCase(language), cv.adresse],
    [labels.email.toLocaleUpperCase(language), cv.email],
  ];
  return {
    stack: [
      {
        text: (cv.nom_complet || " ").toLocaleUpperCase(language),
        alignment: "right",
        color: "#ffffff",
        fontSize: 25,
        lineHeight: 1,
        margin: [0, 10, 0, 3],
      },
      {
        text: (cv.titre_poste || " ").toLocaleUpperCase(language),
        alignment: "right",
        color: "#ffffff",
        bold: true,
        fontSize: 9.5,
        characterSpacing: 1,
        margin: [0, 0, 0, 15],
      },
      {
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: 500,
            y2: 0,
            lineWidth: 1,
            lineColor: "#ffffff",
            opacity: 0.55,
          },
        ],
        margin: [0, 0, 0, 8],
      },
      {
        columns: items.map(([label, value]) => ({
          width: "*",
          stack: [
            { text: label, alignment: "center", color: "#dff9f3", fontSize: 7.2, bold: true },
            {
              text: value || " ",
              alignment: "center",
              color: "#ffffff",
              fontSize: 7.4,
              bold: true,
              margin: [0, 2, 0, 0],
            },
          ],
        })),
        columnGap: 7,
      },
    ],
    margin: [48, 17, 42, 0],
  } as Content;
}

function buildColored(
  cv: CV,
  language: DocumentLanguage,
  templateId: "cover-letter-v2" | "cover-letter-v3" | "cover-letter-v4",
): TDocumentDefinitions {
  const labels = copy(language);
  const body = letterBody(cv, language, templateId === "cover-letter-v4" ? 9.8 : 9.45);
  if (templateId === "cover-letter-v2") body.shift();
  return {
    info: {
      title: `${COVER_LETTER_TEMPLATES.find((item) => item.id === templateId)?.name} - ${cv.nom_complet}`,
      author: cv.nom_complet,
    },
    pageSize: "A4",
    pageMargins: [48, 160, 48, 46],
    background: () => coloredHeaderBackground(templateId),
    header: () => coloredHeader(cv, language),
    defaultStyle: {
      font: documentFont(language),
      fontSize: 9.5,
      color: "#171717",
      lineHeight: 1.28,
      alignment: language === "ar" ? "right" : undefined,
    },
    content: [
      { text: letterDate(cv, language), margin: [0, 0, 0, 13], fontSize: 9.5 },
      {
        text: `${labels.subject} : ${letterSubject(cv, language)}`,
        bold: true,
        margin: [0, 0, 0, 15],
        fontSize: 9.5,
      },
      ...(cv.lettre_motivation.destinataire
        ? [
            {
              text: cv.lettre_motivation.destinataire,
              margin: [0, 0, 0, 12],
              fontSize: 9.5,
            } as Content,
          ]
        : []),
      ...body,
    ],
  };
}

function euFlagSvg() {
  const stars = Array.from({ length: 12 }, (_, index) => {
    const angle = (index * Math.PI * 2) / 12 - Math.PI / 2;
    const cx = 60 + Math.cos(angle) * 25;
    const cy = 40 + Math.sin(angle) * 25;
    const points = Array.from({ length: 10 }, (_, pointIndex) => {
      const pointAngle = -Math.PI / 2 + (pointIndex * Math.PI) / 5;
      const radius = pointIndex % 2 === 0 ? 4.2 : 1.75;
      return `${cx + Math.cos(pointAngle) * radius},${cy + Math.sin(pointAngle) * radius}`;
    }).join(" ");
    return `<polygon points="${points}" fill="#ffcc00"/>`;
  }).join("");
  return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#003399"/>${stars}</svg>`;
}

function europassBackground(): Content {
  return {
    svg: `<svg width="${A4_W}" height="${A4_H}" viewBox="0 0 ${A4_W} ${A4_H}"><rect x="0" y="30" width="42" height="91" fill="#063b9f"/></svg>`,
    absolutePosition: { x: 0, y: 0 },
  } as Content;
}

function europassSubject(cv: CV, language: DocumentLanguage): Content {
  const labels = copy(language);
  const subject = letterSubject(cv, language);
  const jobTitle = cv.titre_poste?.trim();
  if (!jobTitle) {
    return { text: [{ text: `${labels.subject} : `, bold: true }, { text: subject }] } as Content;
  }

  const titleIndex = subject
    .toLocaleLowerCase(language)
    .lastIndexOf(jobTitle.toLocaleLowerCase(language));
  if (titleIndex < 0) {
    return { text: [{ text: `${labels.subject} : `, bold: true }, { text: subject }] } as Content;
  }

  return {
    text: [
      { text: `${labels.subject} : `, bold: true },
      { text: subject.slice(0, titleIndex) },
      { text: subject.slice(titleIndex), bold: true },
    ],
  } as Content;
}

function europassLetterBody(cv: CV, language: DocumentLanguage): Content[] {
  const salutation = cv.lettre_motivation.salutation || LETTER_DEFAULTS[language].salutation;
  const paragraphs = cv.lettre_motivation.paragraphes.filter(Boolean);
  const closing = cv.lettre_motivation.formule_politesse || LETTER_DEFAULTS[language].closing;
  const characterCount = [salutation, ...paragraphs, closing].join(" ").length;
  const calculatedFontSize =
    characterCount > 1700
      ? 10.3
      : characterCount > 1250
        ? 10.8
        : characterCount > 850
          ? 11.4
          : 11.8;
  const fontSize = language === "ar" ? calculatedFontSize * 0.82 : calculatedFontSize;
  const lineHeight =
    language === "ar"
      ? 1.12
      : characterCount > 1700
        ? 1.28
        : characterCount > 1250
          ? 1.34
          : characterCount > 850
            ? 1.43
            : 1.5;
  const paragraphGap =
    characterCount > 1700 ? 10 : characterCount > 1250 ? 13 : characterCount > 850 ? 17 : 20;

  return [
    { text: salutation, fontSize, lineHeight, margin: [0, 0, 0, paragraphGap] },
    ...paragraphs.map(
      (paragraph) =>
        ({
          text: paragraph,
          alignment: "justify",
          fontSize,
          lineHeight,
          margin: [0, 0, 0, paragraphGap],
        }) as Content,
    ),
    { text: closing, fontSize, lineHeight, margin: [0, 1, 0, paragraphGap] },
    {
      text: LETTER_DEFAULTS[language].regards,
      fontSize,
      lineHeight,
      margin: [0, 0, 0, paragraphGap],
    },
    {
      text: cv.nom_complet,
      bold: true,
      color: "#063b9f",
      fontSize: 12.3,
      lineHeight: 1.1,
    },
  ] as Content[];
}

function buildEuropass(cv: CV, language: DocumentLanguage): TDocumentDefinitions {
  const labels = copy(language);
  return {
    info: { title: `Cover Letter V5 Europass - ${cv.nom_complet}`, author: cv.nom_complet },
    pageSize: "A4",
    pageMargins: [60, 36, 44, 42],
    background: () => europassBackground(),
    defaultStyle: {
      font: documentFont(language),
      fontSize: 11.6,
      color: "#353535",
      lineHeight: 1.4,
      alignment: language === "ar" ? "right" : undefined,
    },
    content: [
      {
        columns: [
          {
            width: "*",
            stack: [
              {
                text: (cv.nom_complet || " ").toLocaleUpperCase(language),
                bold: true,
                fontSize: 13.7,
                lineHeight: 1.05,
                margin: [0, 0, 0, 3],
              },
              {
                text: `${labels.address} : ${cv.adresse}`,
                fontSize: 12.1,
                lineHeight: 1.17,
              },
              { text: `${labels.phone} : ${cv.telephone}`, fontSize: 12.1, lineHeight: 1.17 },
              { text: `${labels.email} : ${cv.email}`, fontSize: 12.1, lineHeight: 1.17 },
            ],
          },
          { width: 120, svg: euFlagSvg(), fit: [116, 77], margin: [0, -3, 0, 0] },
        ],
        columnGap: 20,
        margin: [0, 0, 0, 18],
      },
      {
        canvas: [{ type: "rect", x: 0, y: 0, w: 102, h: 4, color: "#d3b400" }],
        margin: [4, 0, 0, 31],
      },
      {
        stack: [europassSubject(cv, language)],
        fontSize: 12,
        margin: [0, 0, 0, 23],
      },
      ...europassLetterBody(cv, language),
    ],
  };
}

export async function createCoverLetterPdfBlob(
  cv: CV,
  templateId: CoverLetterTemplateId,
  language: DocumentLanguage,
  accentColor?: string,
) {
  registerFonts();
  const definition =
    templateId === "cover-letter-v1"
      ? buildV1(cv, language)
      : templateId === "cover-letter-v5"
        ? buildEuropass(cv, language)
        : buildColored(cv, language, templateId);
  return pdfMake.createPdf(applyPdfTheme(definition, templateId, accentColor)).getBlob();
}
