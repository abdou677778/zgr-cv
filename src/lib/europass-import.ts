import {
  emptyCV,
  emptyEuropassProfile,
  newId,
  type CV,
  type EuropassProfile,
  type ProfilePhoto,
} from "./cv-types";
import { type DocumentLanguage } from "./document-language";
import { analyzeEuropassCoverage } from "./europass-coverage";
import { parseEuropassXml } from "./europass-xml";
import { processProfilePhoto } from "./profile-photo";

const SUPPORTED_LANGUAGES = ["fr", "en", "es", "de", "it", "zh", "ar"] as const;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_FILES = 4;

export type EuropassImportSource = {
  fileName: string;
  language: DocumentLanguage;
  format: "xml" | "pdf-xml" | "pdf-text";
  cv: CV;
  coverage: number;
  missing: string[];
  warnings: string[];
};

export type EuropassBatchImport = {
  documents: Partial<Record<DocumentLanguage, CV>>;
  languages: DocumentLanguage[];
  sources: EuropassImportSource[];
  photoFound: boolean;
  driveUrls: string[];
  warnings: string[];
};

type PdfExtraction = {
  xml?: string;
  text: string;
  urls: string[];
  photo?: ProfilePhoto;
};

type PdfImageData = {
  width?: number;
  height?: number;
  kind?: number;
  data?: Uint8Array | Uint8ClampedArray;
  bitmap?: ImageBitmap;
};

function isPdfImageData(value: unknown): value is PdfImageData {
  if (!value || typeof value !== "object") return false;
  const image = value as PdfImageData;
  return (
    Boolean(image.bitmap) || (Boolean(image.data) && Boolean(image.width) && Boolean(image.height))
  );
}

async function canvasBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type));
}

async function pdfImageToProfilePhoto(
  image: PdfImageData,
  imageKind: { RGB_24BPP: number; RGBA_32BPP: number },
): Promise<ProfilePhoto | undefined> {
  const width = image.bitmap?.width || image.width || 0;
  const height = image.bitmap?.height || image.height || 0;
  if (width < 160 || height < 160 || width > 2_500 || height > 2_500) return undefined;
  const ratio = width / height;
  if (ratio < 0.5 || ratio > 1.45) return undefined;

  const canvas = window.document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return undefined;
  if (image.bitmap) {
    context.drawImage(image.bitmap, 0, 0, width, height);
  } else if (image.data && image.kind === imageKind.RGBA_32BPP) {
    const rgba = new Uint8ClampedArray(new ArrayBuffer(image.data.byteLength));
    rgba.set(image.data);
    context.putImageData(new ImageData(rgba, width, height), 0, 0);
  } else if (image.data && image.kind === imageKind.RGB_24BPP) {
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let source = 0, target = 0; source + 2 < image.data.length; source += 3, target += 4) {
      rgba[target] = image.data[source];
      rgba[target + 1] = image.data[source + 1];
      rgba[target + 2] = image.data[source + 2];
      rgba[target + 3] = 255;
    }
    context.putImageData(new ImageData(rgba, width, height), 0, 0);
  } else {
    return undefined;
  }

  const blob = await canvasBlob(canvas, "image/png");
  if (!blob) return undefined;
  try {
    return await processProfilePhoto(new File([blob], "photo-europass.png", { type: "image/png" }));
  } catch {
    return undefined;
  }
}

async function extractPdfProfilePhoto(
  page: {
    getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
    objs: { get: (id: string, callback: (data: unknown) => void) => unknown };
  },
  pdfjs: {
    OPS: {
      paintImageXObject: number;
      paintImageXObjectRepeat: number;
      paintInlineImageXObject: number;
    };
    ImageKind: { RGB_24BPP: number; RGBA_32BPP: number };
  },
) {
  const operatorList = await page.getOperatorList();
  const candidates: PdfImageData[] = [];
  const objectIds = new Set<string>();

  for (let index = 0; index < operatorList.fnArray.length; index += 1) {
    const operation = operatorList.fnArray[index];
    const args = operatorList.argsArray[index] || [];
    if (operation === pdfjs.OPS.paintInlineImageXObject && isPdfImageData(args[0])) {
      candidates.push(args[0]);
      continue;
    }
    if (
      operation !== pdfjs.OPS.paintImageXObject &&
      operation !== pdfjs.OPS.paintImageXObjectRepeat
    ) {
      continue;
    }
    const id = typeof args[0] === "string" ? args[0] : "";
    if (id) objectIds.add(id);
  }

  await Promise.all(
    [...objectIds].map(
      (id) =>
        new Promise<void>((resolve) => {
          try {
            page.objs.get(id, (data) => {
              if (isPdfImageData(data)) candidates.push(data);
              resolve();
            });
          } catch {
            resolve();
          }
        }),
    ),
  );

  const ranked = candidates
    .filter((image) => {
      const width = image.bitmap?.width || image.width || 0;
      const height = image.bitmap?.height || image.height || 0;
      const ratio = height ? width / height : 0;
      return width >= 160 && height >= 160 && ratio >= 0.5 && ratio <= 1.45;
    })
    .sort((left, right) => {
      const leftArea =
        (left.bitmap?.width || left.width || 0) * (left.bitmap?.height || left.height || 0);
      const rightArea =
        (right.bitmap?.width || right.width || 0) * (right.bitmap?.height || right.height || 0);
      return rightArea - leftArea;
    });

  for (const candidate of ranked) {
    const photo = await pdfImageToProfilePhoto(candidate, pdfjs.ImageKind);
    if (photo) return photo;
  }
  return undefined;
}

let importerPdfWorkerUrl: string | null = null;

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function xmlLooksLikeEuropass(value: string) {
  const sample = value.slice(0, 120_000);
  return (
    /^\s*(?:<\?xml[^>]*>\s*)?</i.test(sample) &&
    /<(?:[\w.-]+:)?(?:Candidate|SkillsPassport|LearnerInfo)\b/i.test(sample)
  );
}

function decodeXmlBytes(bytes: Uint8Array) {
  const utf8 = new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "");
  if (xmlLooksLikeEuropass(utf8)) return utf8;
  const utf16 = new TextDecoder("utf-16le").decode(bytes).replace(/^\uFEFF/, "");
  return xmlLooksLikeEuropass(utf16) ? utf16 : "";
}

function languageFromCode(value: string | undefined): DocumentLanguage | undefined {
  const code = normalizeText(value || "").replace(/[^a-z]/g, "");
  const aliases: Record<string, DocumentLanguage> = {
    fr: "fr",
    fra: "fr",
    fre: "fr",
    french: "fr",
    francais: "fr",
    en: "en",
    eng: "en",
    english: "en",
    anglais: "en",
    es: "es",
    spa: "es",
    spanish: "es",
    espanol: "es",
    de: "de",
    deu: "de",
    ger: "de",
    german: "de",
    deutsch: "de",
    it: "it",
    ita: "it",
    italian: "it",
    italiano: "it",
    zh: "zh",
    zho: "zh",
    chi: "zh",
    chinese: "zh",
    ar: "ar",
    ara: "ar",
    arabic: "ar",
    arabe: "ar",
  };
  return aliases[code];
}

export function detectEuropassLanguage(
  fileName: string,
  content: string,
  fallback: DocumentLanguage,
): DocumentLanguage {
  const xmlLanguage =
    content.match(/<CandidateProfile\b[^>]*\blanguageCode=["']([^"']+)["']/i)?.[1] ||
    content.match(/\b(?:xml:lang|locale|languageCode|language)=["']([^"']+)["']/i)?.[1] ||
    content.match(/<(?:[\w.-]+:)?LanguageCode\b[^>]*>([^<]+)</i)?.[1];
  const fromXml = languageFromCode(xmlLanguage);
  if (fromXml) return fromXml;

  const fileToken = fileName
    .replace(/\.[^.]+$/, "")
    .split(/[^\p{L}]+/u)
    .map(languageFromCode)
    .find(Boolean);
  if (fileToken) return fileToken;

  const sample = normalizeText(content.slice(0, 80_000));
  const scores: Record<DocumentLanguage, number> = {
    fr: [
      "experience professionnelle",
      "formation et education",
      "competences",
      "a propos de moi",
    ].filter((token) => sample.includes(token)).length,
    en: ["work experience", "education and training", "language skills", "about me"].filter(
      (token) => sample.includes(token),
    ).length,
    es: ["experiencia laboral", "educacion y formacion", "competencias", "sobre mi"].filter(
      (token) => sample.includes(token),
    ).length,
    de: ["berufserfahrung", "allgemeine und berufliche bildung", "sprachkenntnisse"].filter(
      (token) => sample.includes(token),
    ).length,
    it: ["esperienza lavorativa", "istruzione e formazione", "competenze linguistiche"].filter(
      (token) => sample.includes(token),
    ).length,
    zh: /[\u3400-\u9fff]/u.test(content) ? 2 : 0,
    ar: /[\u0600-\u06ff]/u.test(content) ? 2 : 0,
  };
  const best = (Object.entries(scores) as Array<[DocumentLanguage, number]>).sort(
    (left, right) => right[1] - left[1],
  )[0];
  return best && best[1] > 0 ? best[0] : fallback;
}

function extractUrls(value: string) {
  return unique(
    Array.from(value.matchAll(/https?:\/\/[^\s<>"')\]]+/gi), (match) =>
      match[0].replace(/[.,;:!?]+$/, ""),
    ),
  );
}

function addExternalLinks(cv: CV, urls: string[]): CV {
  if (!urls.length) return cv;
  const profile: EuropassProfile = {
    ...structuredClone(cv.europass || emptyEuropassProfile),
    social_profiles: [...(cv.europass?.social_profiles || [])],
  };
  const socialRules: Array<[RegExp, string]> = [
    [/drive\.google\.com/i, "Google Drive"],
    [/linkedin\.com/i, "LinkedIn"],
    [/facebook\.com/i, "Facebook"],
    [/github\.com/i, "GitHub"],
  ];
  for (const url of urls) {
    const match = socialRules.find(([pattern]) => pattern.test(url));
    if (match) {
      if (!profile.social_profiles.some((item) => item.url === url)) {
        profile.social_profiles.push({ platform: match[1], username: "", url });
      }
    } else if (!profile.website) {
      profile.website = url;
    }
  }
  return { ...cv, europass: profile };
}

function linesFromPdfText(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function sectionIndex(lines: string[], patterns: RegExp[]) {
  return lines.findIndex((line) => patterns.some((pattern) => pattern.test(normalizeText(line))));
}

function sectionLines(lines: string[], startPatterns: RegExp[], allHeadings: RegExp) {
  const start = sectionIndex(lines, startPatterns);
  if (start < 0) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => allHeadings.test(normalizeText(line)));
  return rest.slice(0, end < 0 ? rest.length : end);
}

function firstValueAfterLabel(lines: string[], labels: RegExp[]) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const normalized = normalizeText(line);
    const label = labels.find((pattern) => pattern.test(normalized));
    if (!label) continue;
    const inline = line
      .replace(label, "")
      .replace(/^\s*[:|\-–—]\s*/, "")
      .trim();
    if (inline) return inline;
    return lines[index + 1] || "";
  }
  return "";
}

function parsePdfTextFallback(text: string, urls: string[]): CV {
  const lines = linesFromPdfText(text);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const phone = text.match(/(?:\+\d{1,3}[\s().-]*)?(?:\d[\s().-]*){7,14}\d/)?.[0].trim() || "";
  const headings =
    /^(?:work experience|experience professionnelle|experiencia laboral|berufserfahrung|esperienza lavorativa|education(?: and training)?|formation et education|educacion y formacion|allgemeine und berufliche bildung|istruzione e formazione|language skills|competences linguistiques|competencias linguisticas|sprachkenntnisse|competenze linguistiche|about me|a propos de moi|sobre mi|uber mich|su di me|digital skills|competences numeriques|skills|competences)$/i;
  const excluded =
    /europass|curriculum vitae|personal information|informations personnelles|page \d+/i;
  const nameCandidate = lines.find((line, index) => {
    if (index > 28 || excluded.test(normalizeText(line)) || headings.test(normalizeText(line)))
      return false;
    if (line.includes("@") || /https?:\/\//i.test(line) || /\d{4}/.test(line)) return false;
    const words = line.split(/\s+/).filter(Boolean);
    return words.length >= 2 && words.length <= 7 && line.length >= 5 && line.length <= 80;
  });
  const address = firstValueAfterLabel(lines, [
    /\baddress\b/i,
    /\badresse\b/i,
    /\bdireccion\b/i,
    /\banschrift\b/i,
    /\bindirizzo\b/i,
  ]);
  const birthDate = firstValueAfterLabel(lines, [
    /date of birth/i,
    /date de naissance/i,
    /fecha de nacimiento/i,
    /geburtsdatum/i,
    /data di nascita/i,
  ]);
  const about = sectionLines(
    lines,
    [/^about me$/i, /^a propos de moi$/i, /^sobre mi$/i, /^uber mich$/i, /^su di me$/i],
    headings,
  );
  const skills = sectionLines(
    lines,
    [/^digital skills$/i, /^competences numeriques$/i, /^skills$/i, /^competences$/i],
    headings,
  )
    .flatMap((line) => line.split(/[•·|]/))
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 30);

  const experienceLines = sectionLines(
    lines,
    [
      /^work experience$/i,
      /^experience professionnelle$/i,
      /^experiencia laboral$/i,
      /^berufserfahrung$/i,
      /^esperienza lavorativa$/i,
    ],
    headings,
  );
  const dateLine =
    /(?:19|20)\d{2}.*(?:19|20)\d{2}|(?:19|20)\d{2}.*(?:present|aujourd'hui|actual|heute|oggi)/i;
  const experienceStarts = experienceLines
    .map((line, index) => (dateLine.test(normalizeText(line)) ? index : -1))
    .filter((index) => index >= 0);
  const experiences = experienceStarts.slice(0, 20).map((start, itemIndex) => {
    const end = experienceStarts[itemIndex + 1] ?? experienceLines.length;
    const block = experienceLines.slice(start, end);
    const hasPlace = Boolean(block[3] && block[3].length < 90);
    return {
      id: newId(),
      dates: block[0] || "",
      titre: block[1] || "",
      employeur: block[2] || "",
      lieu: hasPlace ? block[3] : "",
      descriptions: block.slice(hasPlace ? 4 : 3).filter(Boolean),
    };
  });

  const educationLines = sectionLines(
    lines,
    [
      /^education(?: and training)?$/i,
      /^formation et education$/i,
      /^educacion y formacion$/i,
      /^allgemeine und berufliche bildung$/i,
      /^istruzione e formazione$/i,
    ],
    headings,
  );
  const educationStarts = educationLines
    .map((line, index) => (dateLine.test(normalizeText(line)) ? index : -1))
    .filter((index) => index >= 0);
  const educations = educationStarts.slice(0, 20).map((start, itemIndex) => {
    const end = educationStarts[itemIndex + 1] ?? educationLines.length;
    const block = educationLines.slice(start, end);
    const hasPlace = Boolean(block[3] && block[3].length < 90);
    return {
      id: newId(),
      date: block[0] || "",
      titre: block[1] || "",
      institution: block[2] || "",
      lieu: hasPlace ? block[3] : "",
      option: block.slice(hasPlace ? 4 : 3).join(" · "),
      equivalence: "",
    };
  });

  const city = address.split(",")[0]?.trim() || "";
  const cv: CV = {
    ...structuredClone(emptyCV),
    nom_complet: nameCandidate || "",
    email,
    telephone: phone,
    adresse: address,
    wilaya: city,
    date_naissance: birthDate,
    objectif: about.join(" "),
    competences: skills,
    experiences,
    educations,
  };
  return addExternalLinks(cv, urls.length ? urls : extractUrls(text));
}

async function extractPdf(file: File): Promise<PdfExtraction> {
  const [pdfjs, workerModule] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  if (!importerPdfWorkerUrl) importerPdfWorkerUrl = workerModule.default;
  pdfjs.GlobalWorkerOptions.workerSrc = importerPdfWorkerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const document = await loadingTask.promise;
  try {
    let xml: string | undefined;
    const attachments = await document.getAttachments();
    if (attachments) {
      for (const [id, attachment] of attachments) {
        const content = attachment.content ?? (await document.getAttachmentContent(id));
        if (!content) continue;
        const candidate = decodeXmlBytes(content);
        if (candidate) {
          xml = candidate;
          break;
        }
      }
    }

    const firstPage = await document.getPage(1);
    const photo = await extractPdfProfilePhoto(firstPage, pdfjs).catch(() => undefined);
    if (xml) {
      firstPage.cleanup();
      return { xml, text: "", urls: extractUrls(xml), photo };
    }

    const lines: string[] = [];
    const urls: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = pageNumber === 1 ? firstPage : await document.getPage(pageNumber);
      const content = await page.getTextContent();
      let line = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        line += `${line ? " " : ""}${item.str}`;
        if (item.hasEOL) {
          if (line.trim()) lines.push(line.trim());
          line = "";
        }
      }
      if (line.trim()) lines.push(line.trim());
      const annotations = await page.getAnnotations();
      for (const annotation of annotations) {
        if ("url" in annotation && typeof annotation.url === "string") urls.push(annotation.url);
      }
      page.cleanup();
    }
    const text = lines.join("\n");
    return { text, urls: unique([...urls, ...extractUrls(text)]), photo };
  } finally {
    await loadingTask.destroy();
  }
}

const commonStringFields = [
  "nom_complet",
  "telephone",
  "email",
  "adresse",
  "statut_relocation",
  "date_naissance",
  "situation_familiale",
  "permis_conduire",
  "service_national",
  "wilaya",
  "pays",
] as const satisfies ReadonlyArray<keyof CV>;

function mergeCommonFacts(target: CV, source: CV): CV {
  const merged = structuredClone(target);
  for (const field of commonStringFields) {
    if (!merged[field] && source[field]) merged[field] = source[field];
  }
  if (!merged.photo?.dataUrl && source.photo?.dataUrl) merged.photo = structuredClone(source.photo);
  const targetEuropass = structuredClone(merged.europass || emptyEuropassProfile);
  const sourceEuropass = source.europass || emptyEuropassProfile;
  for (const [key, value] of Object.entries(sourceEuropass)) {
    const current = targetEuropass[key as keyof EuropassProfile];
    if ((typeof current === "string" && !current) || (Array.isArray(current) && !current.length)) {
      Object.assign(targetEuropass, { [key]: structuredClone(value) });
    }
  }
  merged.europass = targetEuropass;
  return merged;
}

function requiredMissing(cv: CV) {
  const missing: string[] = [];
  if (!cv.nom_complet) missing.push("nom complet");
  if (!cv.email && !cv.telephone) missing.push("contact");
  if (!cv.adresse && !cv.wilaya && !cv.pays) missing.push("adresse");
  if (!cv.objectif) missing.push("à propos / objectif");
  if (!cv.experiences.length) missing.push("expériences");
  if (!cv.educations.length && !cv.formations.length) missing.push("formations / études");
  if (!cv.competences.filter(Boolean).length) missing.push("compétences");
  return missing;
}

async function importOne(file: File, fallback: DocumentLanguage): Promise<EuropassImportSource> {
  if (file.size > MAX_FILE_SIZE) throw new Error(`${file.name} dépasse la limite de 20 Mo.`);
  const lowerName = file.name.toLowerCase();
  let sourceContent = "";
  let format: EuropassImportSource["format"] = "xml";
  let urls: string[] = [];
  let cv: CV;
  const warnings: string[] = [];

  if (lowerName.endsWith(".pdf") || file.type === "application/pdf") {
    const pdf = await extractPdf(file);
    urls = pdf.urls;
    if (pdf.xml) {
      sourceContent = pdf.xml;
      format = "pdf-xml";
      cv = addExternalLinks(await parseEuropassXml(pdf.xml), urls);
    } else {
      sourceContent = pdf.text;
      format = "pdf-text";
      cv = parsePdfTextFallback(pdf.text, urls);
      warnings.push(
        "Ce PDF ne contient pas de XML Europass embarqué : les champs textuels ont été récupérés, mais la mise en page et la photo doivent être vérifiées.",
      );
    }
    if (!cv.photo?.dataUrl && pdf.photo?.dataUrl) cv.photo = pdf.photo;
  } else {
    sourceContent = await file.text();
    if (!xmlLooksLikeEuropass(sourceContent)) {
      throw new Error(`${file.name} n’est pas un XML Europass reconnu.`);
    }
    urls = extractUrls(sourceContent);
    cv = addExternalLinks(await parseEuropassXml(sourceContent), urls);
  }

  const language = detectEuropassLanguage(file.name, sourceContent, fallback);
  const coverage = analyzeEuropassCoverage(cv).percent;
  const missing = requiredMissing(cv);
  if (!cv.photo?.dataUrl) warnings.push("Aucune photo Europass exploitable n’a été trouvée.");
  if (missing.length) warnings.push(`Champs à vérifier : ${missing.join(", ")}.`);
  return { fileName: file.name, language, format, cv, coverage, missing, warnings };
}

export async function importEuropassFiles(
  files: File[],
  fallback: DocumentLanguage,
): Promise<EuropassBatchImport> {
  if (!files.length) throw new Error("Sélectionnez au moins un CV Europass PDF ou XML.");
  if (files.length > MAX_FILES)
    throw new Error(`Importez au maximum ${MAX_FILES} fichiers à la fois.`);
  if (files.some((file) => !/\.(?:pdf|xml)$/i.test(file.name))) {
    throw new Error("Formats acceptés : PDF Europass officiel et XML Europass.");
  }

  const sources = await Promise.all(files.map((file) => importOne(file, fallback)));
  const emails = unique(sources.map((source) => normalizeText(source.cv.email)).filter(Boolean));
  if (emails.length > 1) {
    throw new Error(
      "Les documents sélectionnés semblent appartenir à plusieurs personnes (adresses e-mail différentes). Import annulé pour éviter de mélanger deux profils.",
    );
  }

  const richest = [...sources].sort((left, right) => right.coverage - left.coverage)[0];
  const documents: Partial<Record<DocumentLanguage, CV>> = {};
  const warnings = sources.flatMap((source) =>
    source.warnings.map((warning) => `${source.fileName} : ${warning}`),
  );
  for (const source of sources) {
    const merged = mergeCommonFacts(source.cv, richest.cv);
    const existing = documents[source.language];
    if (!existing) {
      documents[source.language] = merged;
      continue;
    }
    const existingCoverage = analyzeEuropassCoverage(existing).percent;
    if (source.coverage > existingCoverage) documents[source.language] = merged;
    warnings.push(
      `${source.fileName} : un autre document ${source.language.toUpperCase()} a déjà été importé ; la version la plus complète a été conservée.`,
    );
  }

  const photo = sources.map((source) => source.cv.photo).find((item) => item?.dataUrl);
  if (photo) {
    for (const [language, document] of Object.entries(documents) as Array<
      [DocumentLanguage, CV | undefined]
    >) {
      if (document) documents[language] = { ...document, photo: structuredClone(photo) };
    }
  }

  const languages = SUPPORTED_LANGUAGES.filter((item) => documents[item]);
  const driveUrls = unique(
    sources.flatMap((source) =>
      (source.cv.europass?.social_profiles || [])
        .filter((profile) => /drive\.google\.com/i.test(profile.url))
        .map((profile) => profile.url),
    ),
  );
  return { documents, languages, sources, photoFound: Boolean(photo), driveUrls, warnings };
}
