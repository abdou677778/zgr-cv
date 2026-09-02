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
import { ADVISES_TEMPLATE_ID } from "./document-templates";

export { ADVISES_TEMPLATE_ID };
let fontsConfigured = false;
const fontPromises = new Map<string, Promise<void>>();

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  }
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
  try {
    await promise;
  } catch (error) {
    fontPromises.delete(filename);
    throw error;
  }
}

async function registerFonts(language: DocumentLanguage) {
  const fonts: TFontDictionary = {
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
  };
  if (!fontsConfigured) {
    pdfMake.addFonts(fonts);
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

function background(): Content {
  return {
    svg: `<svg width="595.28" height="841.89" viewBox="0 0 595.28 841.89"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#00653f"/><stop offset=".72" stop-color="#13b878"/><stop offset="1" stop-color="#8ed827"/></linearGradient></defs><rect width="595.28" height="128" fill="url(#g)"/><rect y="128" width="595.28" height="4" fill="#405522"/><rect y="837" width="595.28" height="5" fill="url(#g)"/></svg>`,
    absolutePosition: { x: 0, y: 0 },
  } as Content;
}

function actionCard(label: string, value: string): Content {
  return {
    unbreakable: true,
    table: {
      widths: [86, "*"],
      body: [
        [
          { text: label, bold: true, color: "#149d6a", margin: [8, 11, 4, 11] },
          {
            text: value || " ",
            color: "#4b5563",
            fillColor: "#f8fafc",
            margin: [12, 9, 12, 9],
          },
        ],
      ],
    },
    layout: {
      hLineColor: () => "#dce4eb",
      vLineColor: () => "#dce4eb",
      hLineWidth: () => 0.8,
      vLineWidth: () => 0.8,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
    margin: [0, 0, 0, 14],
  } as Content;
}

function buildAdvises(cv: CV, language: DocumentLanguage): TDocumentDefinitions {
  const labels = {
    fr: {
      title1: "PLAN DE DÉVELOPPEMENT",
      title2: "PROFESSIONNEL ET OBJECTIFS FUTURS",
      application: "CANDIDATURE",
      position: "POSTE",
      action: "Action",
      documentTitle: "Plan de développement",
    },
    en: {
      title1: "PROFESSIONAL DEVELOPMENT PLAN",
      title2: "AND FUTURE OBJECTIVES",
      application: "APPLICATION",
      position: "POSITION",
      action: "Action",
      documentTitle: "Development plan",
    },
    es: {
      title1: "PLAN DE DESARROLLO PROFESIONAL",
      title2: "Y OBJETIVOS FUTUROS",
      application: "CANDIDATURA",
      position: "PUESTO",
      action: "Acción",
      documentTitle: "Plan de desarrollo",
    },
    de: {
      title1: "BERUFLICHER ENTWICKLUNGSPLAN",
      title2: "UND ZUKÜNFTIGE ZIELE",
      application: "BEWERBUNG",
      position: "POSITION",
      action: "Maßnahme",
      documentTitle: "Entwicklungsplan",
    },
    it: {
      title1: "PIANO DI SVILUPPO PROFESSIONALE",
      title2: "E OBIETTIVI FUTURI",
      application: "CANDIDATURA",
      position: "POSIZIONE",
      action: "Azione",
      documentTitle: "Piano di sviluppo",
    },
    zh: {
      title1: "职业发展计划",
      title2: "与未来目标",
      application: "求职申请",
      position: "目标职位",
      action: "行动",
      documentTitle: "职业发展计划",
    },
    ar: {
      title1: "خطة التطوير المهني",
      title2: "والأهداف المستقبلية",
      application: "طلب التوظيف",
      position: "المنصب",
      action: "الإجراء",
      documentTitle: "خطة التطوير",
    },
  }[language];
  const actions = cv.plan_developpement.filter(Boolean);

  return {
    info: {
      title: `${labels.documentTitle} - ${cv.nom_complet}`,
      author: cv.nom_complet,
    },
    pageSize: "A4",
    pageMargins: [36, 158, 36, 42],
    background: () => background(),
    header: () => ({
      stack: [
        {
          text: labels.title1,
          alignment: "center",
          color: "#ffffff",
          bold: true,
          fontSize: 24,
          lineHeight: 1,
          margin: [0, 34, 0, 6],
        },
        {
          text: labels.title2,
          alignment: "center",
          color: "#ffffff",
          bold: true,
          fontSize: 19,
          lineHeight: 1,
        },
      ],
    }),
    defaultStyle: {
      font: documentFont(language),
      fontSize: 10.5,
      color: "#172033",
      lineHeight: 1.25,
      alignment: language === "ar" ? "right" : undefined,
    },
    content: [
      {
        table: {
          widths: [100, "*"],
          body: [
            [
              { text: `${labels.application} :`, bold: true, margin: [12, 7, 4, 7] },
              {
                text: cv.nom_complet,
                bold: true,
                color: "#149d6a",
                fillColor: "#e6fff4",
                margin: [10, 7, 10, 7],
              },
            ],
            [
              { text: `${labels.position} :`, bold: true, margin: [12, 7, 4, 7] },
              {
                text: cv.titre_poste,
                bold: true,
                color: "#149d6a",
                fillColor: "#e6fff4",
                margin: [10, 7, 10, 7],
              },
            ],
          ],
        },
        layout: {
          fillColor: (rowIndex: number, node: unknown, columnIndex: number) =>
            columnIndex === 0 ? "#f1f5f9" : undefined,
          hLineColor: () => "#dce4eb",
          vLineColor: () => "#dce4eb",
          hLineWidth: () => 0.8,
          vLineWidth: () => 0.8,
          paddingLeft: () => 0,
          paddingRight: () => 0,
          paddingTop: () => 0,
          paddingBottom: () => 0,
        },
        margin: [0, 0, 0, 26],
      } as Content,
      ...Array.from({ length: Math.max(5, actions.length) }, (_, index) =>
        actionCard(
          `${labels.action} ${String(index + 1).padStart(2, "0")} :`,
          actions[index] || "",
        ),
      ),
    ],
  };
}

export async function createAdvisesPdfBlob(
  cv: CV,
  language: DocumentLanguage,
  accentColor?: string,
) {
  await registerFonts(language);
  return pdfMake
    .createPdf(applyPdfTheme(buildAdvises(cv, language), ADVISES_TEMPLATE_ID, accentColor))
    .getBlob();
}
