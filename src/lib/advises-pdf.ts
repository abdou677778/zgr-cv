import type {
  Content,
  TDocumentDefinitions,
  TFontDictionary,
  TVirtualFileSystem,
} from "pdfmake/interfaces";
import pdfMake from "pdfmake/build/pdfmake";
import calibriRegularUrl from "@/assets/fonts/Calibri.ttf?inline";
import calibriBoldUrl from "@/assets/fonts/Calibribold.ttf?inline";
import type { CV } from "./cv-types";
import { documentFont, type DocumentLanguage } from "./document-language";
import { applyPdfTheme } from "./pdf-theme";
import notoSansScUrl from "@/assets/fonts/NotoSansSC-VF.ttf?inline";
import notoSansArabicUrl from "@/assets/fonts/NotoSansArabic-VF.ttf?inline";

export const ADVISES_TEMPLATE_ID = "advises-v1" as const;
let fontsRegistered = false;

function registerFonts() {
  if (fontsRegistered) return;
  const base64 = (url: string) => url.slice(url.indexOf("base64,") + 7);
  const vfs: TVirtualFileSystem = {
    "Calibri.ttf": base64(calibriRegularUrl),
    "Calibribold.ttf": base64(calibriBoldUrl),
    "NotoSansSC-VF.ttf": base64(notoSansScUrl),
    "NotoSansArabic-VF.ttf": base64(notoSansArabicUrl),
  };
  const fonts: TFontDictionary = {
    Calibri: {
      normal: "Calibri.ttf",
      bold: "Calibribold.ttf",
      italics: "Calibri.ttf",
      bolditalics: "Calibribold.ttf",
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
  pdfMake.addVirtualFileSystem(vfs);
  pdfMake.addFonts(fonts);
  fontsRegistered = true;
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
  registerFonts();
  return pdfMake
    .createPdf(applyPdfTheme(buildAdvises(cv, language), ADVISES_TEMPLATE_ID, accentColor))
    .getBlob();
}
