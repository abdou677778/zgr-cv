// Bulk mechanical fixture update. Only synthetic test documents are modified.
import { readFile, writeFile } from "node:fs/promises";
const folder = new URL("../test-data/json-multilingue/", import.meta.url);
const names = {
  fr: "FR_Francais",
  en: "EN_English",
  es: "ES_Espanol",
  de: "DE_Deutsch",
  it: "IT_Italiano",
  zh: "ZH_Chinois",
  ar: "AR_Arabe",
};
const localized = {
  fr: [
    "Projets",
    "Création d’un tableau de suivi des candidatures — 2025.",
    "Organisation des documents de candidature.",
  ],
  en: [
    "Projects",
    "Created an application tracking spreadsheet — 2025.",
    "Organized application documents.",
  ],
  es: [
    "Proyectos",
    "Creación de una hoja de seguimiento de candidaturas — 2025.",
    "Organización de los documentos de candidatura.",
  ],
  de: [
    "Projekte",
    "Erstellung einer Tabelle zur Nachverfolgung von Bewerbungen — 2025.",
    "Organisation der Bewerbungsunterlagen.",
  ],
  it: [
    "Progetti",
    "Creazione di un foglio per monitorare le candidature — 2025.",
    "Organizzazione dei documenti di candidatura.",
  ],
  zh: ["项目", "制作求职申请跟踪表 — 2025。", "整理求职申请材料。"],
  ar: ["المشاريع", "إنشاء جدول لمتابعة طلبات التوظيف — 2025.", "تنظيم وثائق الترشح."],
};
const studyOption = {
  fr: "Sciences et technologies industrielles",
  en: "Industrial science and technology",
  es: "Ciencias y tecnologías industriales",
  de: "Industriewissenschaften und -technologien",
  it: "Scienze e tecnologie industriali",
  zh: "工业科学与技术",
  ar: "العلوم والتكنولوجيا الصناعية",
};
const globalUrl = new URL("CV_TEST_GLOBAL_7_LANGUES.json", folder);
const pack = JSON.parse(await readFile(globalUrl, "utf8"));
for (const [language, name] of Object.entries(names)) {
  const enrich = (document) => {
    document.logiciels = [
      { id: "software-word", label: "Microsoft Word", icon: "microsoftword" },
      { id: "software-excel", label: "Microsoft Excel", icon: "microsoftexcel" },
      { id: "software-canva", label: "Canva", icon: "canva" },
    ];
    const [title, ...items] = localized[language];
    document.custom_sections = [{ id: "custom-projects", title, items }];
    const education = document.educations.find((item) => item.id === "education-03");
    if (education) education.option = studyOption[language];
  };
  enrich(pack.documents[language]);
  const file = new URL(`CV_TEST_${name}.json`, folder);
  const individual = JSON.parse(await readFile(file, "utf8"));
  enrich(individual.document);
  await writeFile(file, JSON.stringify(individual, null, 2) + "\n");
}
await writeFile(globalUrl, JSON.stringify(pack, null, 2) + "\n");
