import type {
  Content,
  TDocumentDefinitions,
  TFontDictionary,
  TVirtualFileSystem,
} from "pdfmake/interfaces";
import pdfMake from "pdfmake/build/pdfmake";
import calibriRegularUrl from "@/assets/fonts/CalibriLatin-Regular.ttf?url";
import calibriBoldUrl from "@/assets/fonts/CalibriLatin-Bold.ttf?url";
import arabicRegularUrl from "@/assets/fonts/ArialArabic-Regular.ttf?url";
import arabicBoldUrl from "@/assets/fonts/ArialArabic-Bold.ttf?url";
import type { CV } from "./cv-types";
import { documentFont, type DocumentLanguage } from "./document-language";
import { applyPdfTheme } from "./pdf-theme";
import { OPPORTUNITY_PLAN_TEMPLATE_ID } from "./document-templates";
import {
  safeApplicationUrl,
  type OpportunityMatch,
  type OpportunityPlan,
} from "./profile-opportunities";

let fontsConfigured = false;
const fontPromises = new Map<string, Promise<void>>();

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  return btoa(binary);
}

async function loadFont(filename: string, url: string) {
  const existing = fontPromises.get(filename);
  if (existing) return existing;
  const promise = fetch(url, { cache: "force-cache" }).then(async (response) => {
    if (!response.ok) throw new Error(`Police PDF indisponible (${response.status}).`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    pdfMake.addVirtualFileSystem({ [filename]: bytesToBase64(bytes) } as TVirtualFileSystem);
  });
  fontPromises.set(filename, promise);
  return promise;
}

async function registerFonts(language: DocumentLanguage) {
  if (!fontsConfigured) {
    pdfMake.addFonts({
      Calibri: {
        normal: "CalibriLatin-Regular.ttf",
        bold: "CalibriLatin-Bold.ttf",
        italics: "CalibriLatin-Regular.ttf",
        bolditalics: "CalibriLatin-Bold.ttf",
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
        italics: "ArialArabic-Regular.ttf",
        bolditalics: "ArialArabic-Bold.ttf",
      },
    } as TFontDictionary);
    fontsConfigured = true;
  }
  if (language === "zh") {
    const { default: notoSansScUrl } = await import("@/assets/fonts/NotoSansSC-VF.ttf?url");
    await loadFont("NotoSansSC-VF.ttf", notoSansScUrl);
  } else if (language === "ar") {
    await Promise.all([
      loadFont("ArialArabic-Regular.ttf", arabicRegularUrl),
      loadFont("ArialArabic-Bold.ttf", arabicBoldUrl),
    ]);
  } else {
    await Promise.all([
      loadFont("CalibriLatin-Regular.ttf", calibriRegularUrl),
      loadFont("CalibriLatin-Bold.ttf", calibriBoldUrl),
    ]);
  }
}

const labels = (language: DocumentLanguage) => {
  if (language === "ar")
    return {
      title: "خطة فرص العمل والتقديم",
      candidate: "المترشح",
      target: "المنصب المستهدف",
      country: "بلد المترشح",
      generated: "آخر تحقق",
      deadline: "آخر أجل",
      conditions: "الشروط الأساسية",
      apply: "التقديم المباشر",
      source: "المصدر الرسمي",
      none: "لم تتم إضافة أي فرصة إلى هذه الخطة بعد.",
      login: "يتطلب حسابا أو تسجيل الدخول",
      selected: "فرص مختارة وموثقة",
    };
  if (language === "en")
    return {
      title: "APPLICATION OPPORTUNITY PLAN",
      candidate: "Candidate",
      target: "Target position",
      country: "Candidate country",
      generated: "Last verified",
      deadline: "Deadline",
      conditions: "Key conditions",
      apply: "Apply directly",
      source: "Official source",
      none: "No opportunity has been added to this plan yet.",
      login: "Account or sign-in required",
      selected: "Selected and verified opportunities",
    };
  return {
    title: "PLAN D’OPPORTUNITÉS ET DE CANDIDATURE",
    candidate: "Candidat",
    target: "Poste ciblé",
    country: "Pays du candidat",
    generated: "Dernière vérification",
    deadline: "Dernier délai",
    conditions: "Conditions principales",
    apply: "Postuler directement",
    source: "Source officielle",
    none: "Aucune opportunité n’a encore été ajoutée à ce plan.",
    login: "Compte ou connexion requis",
    selected: "Opportunités sélectionnées et vérifiées",
  };
};

function flagSvg(code: string) {
  const candidate = code.toUpperCase();
  const normalized = /^[A-Z]{2,3}$/.test(candidate) ? candidate : "INT";
  if (normalized === "CA")
    return `<svg width="32" height="20" viewBox="0 0 36 24"><rect width="36" height="24" fill="#fff"/><rect width="8" height="24" fill="#d80621"/><rect x="28" width="8" height="24" fill="#d80621"/><path d="M18 4l1.2 3 2.3-1.1-.8 2.7 2.4.5-3.2 2.8.8 2.5-2.1-.5-.6 5.1-.6-5.1-2.1.5.8-2.5-3.2-2.8 2.4-.5-.8-2.7L16.8 7 18 4z" fill="#d80621"/></svg>`;
  if (normalized === "TN")
    return `<svg width="32" height="20" viewBox="0 0 36 24"><rect width="36" height="24" fill="#e70013"/><circle cx="18" cy="12" r="7" fill="#fff"/><circle cx="19" cy="12" r="4.4" fill="#e70013"/><circle cx="20.4" cy="12" r="3.5" fill="#fff"/></svg>`;
  if (normalized === "DZ")
    return `<svg width="32" height="20" viewBox="0 0 36 24"><rect width="18" height="24" fill="#067a46"/><rect x="18" width="18" height="24" fill="#fff"/><circle cx="18" cy="12" r="6" fill="#d21034"/><circle cx="19.5" cy="12" r="5" fill="#fff"/></svg>`;
  const verticalFlags: Record<string, [string, string, string]> = {
    IT: ["#009246", "#ffffff", "#ce2b37"],
    FR: ["#0055a4", "#ffffff", "#ef4135"],
    BE: ["#111111", "#ffd90c", "#ef3340"],
  };
  if (verticalFlags[normalized]) {
    const [left, center, right] = verticalFlags[normalized];
    return `<svg width="32" height="20" viewBox="0 0 36 24"><rect width="12" height="24" fill="${left}"/><rect x="12" width="12" height="24" fill="${center}"/><rect x="24" width="12" height="24" fill="${right}"/></svg>`;
  }
  if (normalized === "DE")
    return `<svg width="32" height="20" viewBox="0 0 36 24"><rect width="36" height="8" fill="#000"/><rect y="8" width="36" height="8" fill="#dd0000"/><rect y="16" width="36" height="8" fill="#ffce00"/></svg>`;
  if (normalized === "EU")
    return `<svg width="32" height="20" viewBox="0 0 36 24"><rect width="36" height="24" fill="#003399"/><circle cx="18" cy="12" r="5" fill="none" stroke="#ffcc00" stroke-width="2" stroke-dasharray="1.2 1.4"/></svg>`;
  return `<svg width="32" height="20" viewBox="0 0 36 24"><rect width="36" height="24" rx="2" fill="#e2e8f0"/><text x="18" y="15" text-anchor="middle" font-size="8" font-family="Arial" fill="#475569">${normalized || "INT"}</text></svg>`;
}

function humanDate(value: string | null, language: DocumentLanguage) {
  if (!value)
    return language === "ar" ? "غير منشور" : language === "en" ? "Not published" : "Non publié";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(language === "ar" ? "ar-DZ" : language === "en" ? "en-CA" : "fr-FR");
}

function linkContent(label: string, value: string): Content | null {
  const url = safeApplicationUrl(value);
  return url
    ? ({ text: label, link: url, color: "#b91c1c", bold: true, decoration: "underline" } as Content)
    : null;
}

function opportunityCard(item: OpportunityMatch, language: DocumentLanguage): Content {
  const copy = labels(language);
  const application = item.application.email
    ? `mailto:${item.application.email}`
    : item.application.url;
  const links = [
    linkContent(copy.apply, application),
    linkContent(copy.source, item.sourceUrl),
  ].filter(Boolean) as Content[];
  return {
    unbreakable: true,
    table: {
      widths: ["*"],
      body: [
        [
          {
            stack: [
              {
                columns: [
                  { svg: flagSvg(item.countryCode), width: 38 },
                  {
                    stack: [
                      {
                        text: item.countryName || "International",
                        bold: true,
                        color: "#475569",
                        fontSize: 9,
                      },
                      { text: item.source, color: "#64748b", fontSize: 8 },
                    ],
                  },
                  {
                    text: `${item.score}%`,
                    alignment: "right",
                    bold: true,
                    color: item.status === "strong" ? "#047857" : "#92400e",
                    width: 42,
                  },
                ],
              },
              {
                text: item.title,
                bold: true,
                fontSize: 14,
                color: "#0f172a",
                margin: [0, 7, 0, 2],
              },
              {
                text: [item.employer, item.location].filter(Boolean).join(" · "),
                bold: true,
                color: "#7f1d1d",
                margin: [0, 0, 0, 6],
              },
              {
                text: `${copy.deadline} : ${humanDate(item.deadlineAt, language)}`,
                bold: true,
                color: "#b91c1c",
                fillColor: "#fee2e2",
                margin: [7, 5, 7, 5],
              },
              ...(item.conditions.length
                ? [
                    { text: `${copy.conditions} :`, bold: true, margin: [0, 7, 0, 2] },
                    { ul: item.conditions.slice(0, 4), margin: [12, 0, 0, 4] },
                  ]
                : []),
              ...(item.application.loginRequired
                ? [{ text: copy.login, italics: true, color: "#92400e", margin: [0, 4, 0, 0] }]
                : []),
              ...(links.length ? [{ columns: links, columnGap: 14, margin: [0, 7, 0, 0] }] : []),
            ],
            margin: [10, 9, 10, 9],
          },
        ],
      ],
    },
    layout: {
      hLineColor: () => "#cbd5e1",
      vLineColor: () => "#cbd5e1",
      hLineWidth: () => 0.8,
      vLineWidth: () => 0.8,
    },
    margin: [0, 0, 0, 10],
  } as Content;
}

export function buildOpportunityPlanDefinition(
  cv: CV,
  plan: OpportunityPlan | undefined,
  language: DocumentLanguage,
): TDocumentDefinitions {
  const copy = labels(language);
  const items = plan?.selectedOpportunities || [];
  const grouped = new Map<string, OpportunityMatch[]>();
  for (const item of items) {
    const key = `${item.countryCode}|${item.countryName}`;
    grouped.set(key, [...(grouped.get(key) || []), item]);
  }
  const content: Content[] = [
    {
      table: {
        widths: [105, "*"],
        body: [
          [
            { text: `${copy.candidate} :`, bold: true, fillColor: "#f1f5f9", margin: [6, 5, 6, 5] },
            { text: cv.nom_complet || "-", bold: true, margin: [6, 5, 6, 5] },
          ],
          [
            { text: `${copy.target} :`, bold: true, fillColor: "#f1f5f9", margin: [6, 5, 6, 5] },
            {
              text: `${plan?.targetJob || cv.titre_poste || "-"}${plan?.noc?.code ? ` · CNP ${plan.noc.code} - TEER ${plan.noc.teer}` : ""}`,
              margin: [6, 5, 6, 5],
            },
          ],
          [
            { text: `${copy.country} :`, bold: true, fillColor: "#f1f5f9", margin: [6, 5, 6, 5] },
            { text: plan?.candidateCountry === "TN" ? "Tunisie" : "Algérie", margin: [6, 5, 6, 5] },
          ],
          [
            { text: `${copy.generated} :`, bold: true, fillColor: "#f1f5f9", margin: [6, 5, 6, 5] },
            {
              text: humanDate(plan?.generatedAt || new Date().toISOString(), language),
              margin: [6, 5, 6, 5],
            },
          ],
        ],
      },
      layout: {
        hLineColor: () => "#cbd5e1",
        vLineColor: () => "#cbd5e1",
        hLineWidth: () => 0.7,
        vLineWidth: () => 0.7,
      },
      margin: [0, 0, 0, 16],
    } as Content,
  ];
  if (!items.length)
    content.push({
      text: copy.none,
      alignment: "center",
      color: "#64748b",
      italics: true,
      margin: [0, 45, 0, 0],
    });
  for (const [key, countryItems] of grouped) {
    const [code, name] = key.split("|");
    content.push({
      columns: [
        { svg: flagSvg(code), width: 40 },
        { text: name, bold: true, fontSize: 16, color: "#0f172a", margin: [0, 2, 0, 0] },
      ],
      margin: [0, 8, 0, 8],
    });
    content.push(...countryItems.map((item) => opportunityCard(item, language)));
  }
  return {
    info: { title: `${copy.title} - ${cv.nom_complet}`, author: "ZGR CV Studio" },
    pageSize: "A4",
    pageMargins: [34, 82, 34, 38],
    header: () =>
      ({
        stack: [
          {
            canvas: [{ type: "rect", x: 0, y: 0, w: 595, h: 70, color: "#7f1d1d" }],
            absolutePosition: { x: 0, y: 0 },
          },
          {
            text: copy.title,
            bold: true,
            color: "#ffffff",
            fontSize: 20,
            alignment: "center",
            margin: [0, 23, 0, 3],
          },
          { text: copy.selected, color: "#fecaca", alignment: "center", fontSize: 9 },
        ],
      }) as Content,
    footer: (page, pages) => ({
      text: `${page} / ${pages}`,
      alignment: "center",
      color: "#94a3b8",
      fontSize: 8,
      margin: [0, 10, 0, 0],
    }),
    defaultStyle: {
      font: documentFont(language),
      fontSize: 9.5,
      color: "#334155",
      lineHeight: 1.2,
      alignment: language === "ar" ? "right" : undefined,
    },
    content,
  };
}

export async function createOpportunityPlanPdfBlob(
  cv: CV,
  plan: OpportunityPlan | undefined,
  language: DocumentLanguage,
  accentColor?: string,
) {
  await registerFonts(language);
  const definition = buildOpportunityPlanDefinition(cv, plan, language);
  return pdfMake
    .createPdf(applyPdfTheme(definition, OPPORTUNITY_PLAN_TEMPLATE_ID, accentColor))
    .getBlob();
}
