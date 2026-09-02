import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Trash2,
  Download,
  RotateCcw,
  LoaderCircle,
  Upload,
  Languages,
  Archive,
  ChevronDown,
  FileDown,
  Palette,
  Eye,
  EyeOff,
  Bot,
  Settings,
  Sparkles,
  Database,
  Save,
  Check,
  FileText,
  FileCode,
  ExternalLink,
  CircleCheck,
  Globe2,
  LogOut,
  UserCog,
  BookOpenText,
  ClipboardList,
} from "lucide-react";
import {
  analyzeEuropassCoverage,
  convertCvToEuropassXml,
  downloadEuropassXml,
  downloadEuropassMultilingualZip,
  parseEuropassXml,
} from "@/lib/europass-xml";
import { EUROPASS_TEMPLATE_ID } from "@/lib/document-templates";
import {
  type CV,
  type Experience,
  type Formation,
  type Education,
  type CompanyLogo,
  type ProfilePhoto,
  type ObjectiveFormat,
  emptyCV,
  newId,
} from "@/lib/cv-types";
import { importCvJson, importCvJsonSet } from "@/lib/cv-json";
import { sampleCVByLanguage } from "@/lib/sample-cv";
import { DOCUMENT_LANGUAGES, type DocumentLanguage } from "@/lib/document-language";
import { FORM_COPY, INTERFACE_COPY } from "@/lib/interface-copy";
import { applyCvVisibility, cvElementIsVisible, type HiddenCvElements } from "@/lib/cv-visibility";
import {
  DEFAULT_TEMPLATE_COLORS,
  TEMPLATE_DEFAULT_COLORS,
  paletteForTemplate,
  type TemplateColorMap,
  type ThemeTemplateId,
} from "@/lib/pdf-theme";
import {
  createCompletePackZip,
  createCurrentTemplateMultilingualZip,
  createDocumentPdfBlob,
  defaultTemplateFor,
  downloadCompletePackArchive,
  downloadCurrentMultilingualArchive,
  downloadPdfDocument,
  getDocumentKinds,
  getTemplates,
  type DocumentKind,
  type PdfTemplateId,
} from "@/lib/document-pdf";
import { isArabicCvTemplate, normalizeCvTemplateForLanguage } from "@/lib/document-templates";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AiSettingsDialog } from "@/components/ai-settings-dialog";
import { AiFieldDialog, type AiFieldRequest } from "@/components/ai-field-dialog";
import { AiImportAssistant } from "@/components/ai-import-assistant";
import { defaultAiSettings, normalizeAiSettings, type AiSettings } from "@/lib/ai-types";
import { ClientDatabaseDialog } from "@/components/client-database-dialog";
import { ClientOrdersDialog } from "@/components/client-orders-dialog";
import { AdminLogin } from "@/components/admin-login";
import { AccountSettingsDialog } from "@/components/account-settings-dialog";
import { PromptMasterDialog } from "@/components/prompt-master-dialog";
import { CvRichTextEditor } from "@/components/cv-rich-text-editor";
import { ProfilePhotoField } from "@/components/profile-photo-field";
import { PreviewControlDock, type PreviewDockSection } from "@/components/preview-control-dock";
import { ExperienceWorkspace } from "@/components/cv-experience-workspace";
import { EducationWorkspace, FormationWorkspace } from "@/components/cv-learning-workspaces";
import { normalizeObjectiveFormat } from "@/lib/cv-objective-format";
import {
  CvSectionPanel,
  DEFAULT_SECTION_APPEARANCE,
  HiddenSectionTray,
  normalizeSectionAppearance,
  type SectionAppearance,
  type SectionAppearanceMap,
} from "@/components/cv-section-panel";
import {
  CLIENTS_API_ENDPOINT,
  clearAdminSession,
  getAdminSession,
  getCurrentUser,
  subscribeToSessionChanges,
  verifyAdminSession,
  type SessionUser,
} from "@/lib/auth-client";
import {
  getClientProfile,
  newClientProfileId,
  putCloudProfile,
  saveClientProfile,
  type ClientProfile,
} from "@/lib/client-profile-db";
import { importClientOrderJson, type ClientOrderSummary } from "@/lib/client-orders";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZGR CV — Modèle Canadien (FR) avec export PDF ATS" },
      {
        name: "description",
        content:
          "Créez un CV au format canadien (FR) et exportez un PDF compatible ATS avec texte sélectionnable.",
      },
    ],
  }),
  component: Index,
});

const STORAGE_KEY = "zgr-cv-canadien-v1";
const STORAGE_VERSION = 4;
const TEMPLATE_STORAGE_KEY = "zgr-cv-selected-template";
const COLOR_STORAGE_KEY = "zgr-cv-template-colors-v1";
const VISIBILITY_STORAGE_KEY = "zgr-cv-hidden-elements-v1";
const AI_STORAGE_KEY = "zgr-cv-ai-settings-v1";
const SECTION_APPEARANCE_STORAGE_KEY = "zgr-cv-section-appearance-v1";
const PDF_GENERATION_TIMEOUT_MS = 90_000;

async function pdfWithDeadline<T>(operation: Promise<T>) {
  let timeoutId = 0;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(
          () =>
            reject(
              new Error(
                "Le chargement PDF a dépassé 90 secondes. Vérifiez la connexion puis utilisez Réessayer.",
              ),
            ),
          PDF_GENERATION_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}
const LANGUAGE_VISUALS: Record<DocumentLanguage, { color: string }> = {
  fr: { color: "from-blue-500 to-indigo-600" },
  en: { color: "from-sky-500 to-blue-600" },
  es: { color: "from-amber-400 to-red-500" },
  de: { color: "from-zinc-700 to-amber-500" },
  it: { color: "from-emerald-500 to-red-500" },
  zh: { color: "from-red-500 to-amber-400" },
  ar: { color: "from-emerald-500 to-emerald-700" },
};
const EUROPASS_EDITOR_LANGUAGE: Record<DocumentLanguage, string> = {
  fr: "fr",
  en: "en",
  es: "es",
  de: "de",
  it: "it",
  zh: "en",
  ar: "en",
};

function europassEditorUrl(language: DocumentLanguage) {
  return `https://europa.eu/europass/eportfolio/screen/cv-editor?lang=${EUROPASS_EDITOR_LANGUAGE[language]}`;
}
let pdfWorkerUrl: string | null = null;

type RichListValueKey = "competences" | "participations" | "certifications" | "interets";
type RichListFormatKey =
  | "competences_format"
  | "participations_format"
  | "certifications_format"
  | "interets_format";

function escapeRichListHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function richListHtml(items: string[]) {
  return `<ul>${items
    .filter(Boolean)
    .map((item) => `<li>${escapeRichListHtml(item)}</li>`)
    .join("")}</ul>`;
}

function richListItemsFromText(value: string, maxItems = 40, maxItemLength = 500) {
  return value
    .split(/\n+/u)
    .map((item) => item.replace(/^\s*(?:[•·▪◦*-]|\d+[.)])\s*/u, "").trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => item.slice(0, maxItemLength));
}

function richListEditorFormat(items: string[], format: ObjectiveFormat | undefined) {
  const normalized = normalizeObjectiveFormat(format);
  return normalized.html ? normalized : { ...normalized, html: richListHtml(items) };
}

function replaceLegacyEnglishDefaults(
  stored: unknown,
  english: unknown,
  localized: unknown,
): unknown {
  if (typeof stored === "string") return stored === english ? localized : stored;
  if (Array.isArray(stored)) {
    const englishItems = Array.isArray(english) ? english : [];
    const localizedItems = Array.isArray(localized) ? localized : [];
    return stored.map((item, index) =>
      replaceLegacyEnglishDefaults(item, englishItems[index], localizedItems[index] ?? item),
    );
  }
  if (stored && typeof stored === "object") {
    const storedRecord = stored as Record<string, unknown>;
    const englishRecord =
      english && typeof english === "object" ? (english as Record<string, unknown>) : {};
    const localizedRecord =
      localized && typeof localized === "object" ? (localized as Record<string, unknown>) : {};
    return Object.fromEntries(
      Object.entries(storedRecord).map(([key, value]) => [
        key,
        replaceLegacyEnglishDefaults(value, englishRecord[key], localizedRecord[key] ?? value),
      ]),
    );
  }
  return stored;
}

function migrateLegacyLanguage(value: unknown, language: Exclude<DocumentLanguage, "fr" | "en">) {
  const stored = importCvJson(value, "auto").cv;
  return replaceLegacyEnglishDefaults(
    stored,
    sampleCVByLanguage.en,
    sampleCVByLanguage[language],
  ) as CV;
}

const UI_COPY = {
  fr: {
    subtitle: "CV · Lettres de motivation · Plan professionnel · PDF bilingue sélectionnable",
    document: "Document",
    template: "Modèle",
    palette: "Couleur du modèle",
    originalColor: "Couleur originale",
    customColor: "Couleur personnalisée",
    language: "Langue du document",
    importJson: "Importer JSON",
    example: "Exemple",
    reset: "Réinitialiser",
    preparingPdf: "Préparation PDF",
    downloadPdf: "Télécharger PDF",
    downloadCurrent: "Modèle actuel · 7 langues (.zip)",
    downloadCurrentHint: "FR · EN · ES · DE · IT · 中文 · AR",
    downloadPack: "Télécharger le pack complet (.zip)",
    downloadPackHint: "81 PDF · modèles arabes réservés à l’arabe",
    preparingPack: "Création du pack",
    packReady: "Pack téléchargé : 81 PDF, dont 4 modèles arabes dédiés.",
    currentPackReady: "Modèle actuel téléchargé dans les 7 langues.",
    packError: "Impossible de créer le pack complet.",
    resetConfirm: "Réinitialiser les données françaises ?",
    previewError: "Impossible de générer l’aperçu PDF.",
    jsonImported: "JSON importé :",
    importError: "Erreur inconnue pendant l’import.",
    personal: "Informations personnelles",
    letterTitle: "Lettre de motivation",
    letterActive: "Ces champs alimentent directement la lettre de motivation sélectionnée.",
    letterAnnex: "Conservée comme annexe lorsque le document actif est un CV.",
    date: "Date",
    subject: "Objet",
    recipient: "Destinataire",
    greeting: "Salutation",
    paragraphs: "Paragraphes",
    closing: "Formule de politesse",
    planTitle: "Plan de développement professionnel",
    planActive: "Ces actions alimentent directement le modèle Advises.",
    planAnnex: "Conservé comme annexe modifiable lorsque le document actif est un CV.",
    previewPreparing: "Préparation de l’aperçu PDF…",
    previewUpdating: "Mise à jour du PDF…",
    exactPreview: "Aperçu du PDF réel — le téléchargement utilise exactement ce même document.",
  },
  en: {
    subtitle: "Résumé · Cover letters · Professional plan · Selectable bilingual PDF",
    document: "Document",
    template: "Template",
    palette: "Template color",
    originalColor: "Original color",
    customColor: "Custom color",
    language: "Document language",
    importJson: "Import JSON",
    example: "Example",
    reset: "Reset",
    preparingPdf: "Preparing PDF",
    downloadPdf: "Download PDF",
    downloadCurrent: "Current template · 7 languages (.zip)",
    downloadCurrentHint: "FR · EN · ES · DE · IT · 中文 · AR",
    downloadPack: "Download complete pack (.zip)",
    downloadPackHint: "81 PDFs · Arabic templates are Arabic-only",
    preparingPack: "Building pack",
    packReady: "Pack downloaded: 81 PDFs, including 4 dedicated Arabic templates.",
    currentPackReady: "Current template downloaded in all 7 languages.",
    packError: "Unable to create the complete pack.",
    resetConfirm: "Reset the English data?",
    previewError: "Unable to generate the PDF preview.",
    jsonImported: "JSON imported:",
    importError: "Unknown import error.",
    personal: "Personal information",
    letterTitle: "Cover letter",
    letterActive: "These fields directly populate the selected cover letter.",
    letterAnnex: "Kept as an editable annex while a résumé template is active.",
    date: "Date",
    subject: "Subject",
    recipient: "Recipient",
    greeting: "Greeting",
    paragraphs: "Paragraphs",
    closing: "Closing",
    planTitle: "Professional development plan",
    planActive: "These actions directly populate the Advises template.",
    planAnnex: "Kept as an editable annex while a résumé template is active.",
    previewPreparing: "Preparing the PDF preview…",
    previewUpdating: "Updating PDF…",
    exactPreview: "Real PDF preview — the download uses this exact same document.",
  },
} as const;

function Index() {
  const [authUser, setAuthUser] = useState<SessionUser | null>(() => getCurrentUser());

  useEffect(() => {
    let active = true;
    let lastValidationAt = 0;
    const validate = () => {
      lastValidationAt = Date.now();
      void verifyAdminSession().then((user) => {
        if (active) setAuthUser(user);
      });
    };
    const validateWhenActive = () => {
      if (
        document.visibilityState === "visible" &&
        getAdminSession() &&
        Date.now() - lastValidationAt > 60_000
      )
        validate();
    };
    const unsubscribe = subscribeToSessionChanges((user) => {
      if (!active) return;
      setAuthUser(user);
    });
    const validationTimer = window.setTimeout(validate, 150);
    window.addEventListener("online", validateWhenActive);
    document.addEventListener("visibilitychange", validateWhenActive);
    return () => {
      active = false;
      window.clearTimeout(validationTimer);
      window.removeEventListener("online", validateWhenActive);
      document.removeEventListener("visibilitychange", validateWhenActive);
      unsubscribe();
    };
  }, []);

  if (!authUser)
    return (
      <AdminLogin
        onAuthenticated={(user) => {
          setAuthUser(user);
        }}
      />
    );
  return (
    <Workspace
      user={authUser}
      onLogout={() => {
        clearAdminSession();
        setAuthUser(null);
      }}
    />
  );
}

function Workspace({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [language, setLanguage] = useState<DocumentLanguage>("fr");
  const [cvByLanguage, setCvByLanguage] = useState<Record<DocumentLanguage, CV>>({
    ...sampleCVByLanguage,
  });
  const [documentKind, setDocumentKind] = useState<DocumentKind>("cv");
  const [templateId, setTemplateId] = useState<PdfTemplateId>("canadian-v1");
  const [templateColors, setTemplateColors] = useState<TemplateColorMap>({
    ...DEFAULT_TEMPLATE_COLORS,
  });
  const [hiddenElements, setHiddenElements] = useState<HiddenCvElements>({});
  const [sectionAppearance, setSectionAppearance] = useState<SectionAppearanceMap>(() =>
    normalizeSectionAppearance(DEFAULT_SECTION_APPEARANCE),
  );
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    objective: true,
  });
  const [editingExperienceId, setEditingExperienceId] = useState<string | null>(null);
  const [editingFormationId, setEditingFormationId] = useState<string | null>(null);
  const [editingEducationId, setEditingEducationId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<{ blob: Blob; url: string; key: string } | null>(
    null,
  );
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewFocusMode, setPreviewFocusMode] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(65);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [pdfRetryNonce, setPdfRetryNonce] = useState(0);
  const [packLoading, setPackLoading] = useState(false);
  const [packProgress, setPackProgress] = useState({ completed: 0, total: 81 });
  const [packMessage, setPackMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [importMessage, setImportMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [aiSettings, setAiSettings] = useState<AiSettings>(() => defaultAiSettings());
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [promptMasterOpen, setPromptMasterOpen] = useState(false);
  const [aiFieldRequest, setAiFieldRequest] = useState<AiFieldRequest | null>(null);
  const [clientDatabaseOpen, setClientDatabaseOpen] = useState(false);
  const [clientOrdersOpen, setClientOrdersOpen] = useState(false);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [activeClientOrder, setActiveClientOrder] = useState<ClientOrderSummary | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const pdfUrlRef = useRef<string | null>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const cv = cvByLanguage[language];
  const templates = getTemplates(documentKind, documentKind === "cv" ? language : undefined);
  const isEuropassTemplate = documentKind === "cv" && templateId === EUROPASS_TEMPLATE_ID;
  const themeTemplateId = (
    isEuropassTemplate
      ? "canadian-v1"
      : Object.prototype.hasOwnProperty.call(TEMPLATE_DEFAULT_COLORS, templateId)
        ? templateId
        : defaultTemplateFor(documentKind)
  ) as ThemeTemplateId;
  const accentColor = templateColors[themeTemplateId] ?? TEMPLATE_DEFAULT_COLORS[themeTemplateId];
  const paletteColors = paletteForTemplate(themeTemplateId);
  // Language buttons translate only the form values and the generated document.
  // The application shell deliberately remains in French for a stable workflow.
  const ui = { ...UI_COPY.fr, ...INTERFACE_COPY.fr };
  const currentTemplateIsArabicOnly = documentKind === "cv" && isArabicCvTemplate(templateId);
  const currentArchiveLabel = currentTemplateIsArabicOnly
    ? "Modèle arabe actuel · AR (.zip)"
    : ui.downloadCurrent;
  const currentArchiveHint = currentTemplateIsArabicOnly
    ? "Export arabe uniquement"
    : ui.downloadCurrentHint;
  const form = FORM_COPY.fr;
  const outputCv = useMemo(() => applyCvVisibility(cv, hiddenElements), [cv, hiddenElements]);
  const outputCvByLanguage = useMemo(
    () =>
      Object.fromEntries(
        DOCUMENT_LANGUAGES.map((item) => [
          item.id,
          applyCvVisibility(cvByLanguage[item.id], hiddenElements),
        ]),
      ) as Record<DocumentLanguage, CV>,
    [cvByLanguage, hiddenElements],
  );
  const cvKey = JSON.stringify({
    cv: outputCv,
    templateId,
    documentKind,
    language,
    accentColor,
  });
  const setCv: Dispatch<SetStateAction<CV>> = (value) =>
    setCvByLanguage((current) => {
      const active = current[language];
      const next = typeof value === "function" ? value(active) : value;
      return { ...current, [language]: next };
    });

  useEffect(() => {
    const availableTemplates = getTemplates(
      documentKind,
      documentKind === "cv" ? language : undefined,
    );
    const nextTemplate =
      documentKind === "cv"
        ? templateId === EUROPASS_TEMPLATE_ID
          ? EUROPASS_TEMPLATE_ID
          : normalizeCvTemplateForLanguage(templateId, language)
        : availableTemplates.some((template) => template.id === templateId)
          ? templateId
          : defaultTemplateFor(documentKind);
    if (nextTemplate !== templateId) setTemplateId(nextTemplate);
  }, [documentKind, language, templateId]);

  useEffect(() => {
    if (isEuropassTemplate && !previewVisible) setPreviewVisible(true);
  }, [isEuropassTemplate, previewVisible]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          version?: number;
          language?: DocumentLanguage;
          byLanguage?: Partial<Record<DocumentLanguage, unknown>>;
        };
        if (saved.version === STORAGE_VERSION && saved.byLanguage) {
          const restored = { ...sampleCVByLanguage };
          for (const item of DOCUMENT_LANGUAGES) {
            const stored = saved.byLanguage[item.id];
            if (stored) restored[item.id] = importCvJson(stored, "auto").cv;
          }
          setCvByLanguage(restored);
          if (saved.language && DOCUMENT_LANGUAGES.some((item) => item.id === saved.language)) {
            setLanguage(saved.language);
          }
        } else if (saved.version === 3 && saved.byLanguage) {
          const restored = { ...sampleCVByLanguage };
          for (const item of DOCUMENT_LANGUAGES) {
            const stored = saved.byLanguage[item.id];
            if (stored) restored[item.id] = importCvJson(stored, "auto").cv;
          }
          // Version 3 still carried the Latin sample name in the Arabic dataset.
          // Translate only that untouched legacy default and preserve user-entered names.
          if (restored.ar.nom_complet === sampleCVByLanguage.en.nom_complet) {
            restored.ar.nom_complet = sampleCVByLanguage.ar.nom_complet;
          }
          setCvByLanguage(restored);
          if (saved.language && DOCUMENT_LANGUAGES.some((item) => item.id === saved.language)) {
            setLanguage(saved.language);
          }
        } else if (saved.version === 2 && saved.byLanguage) {
          // Version 2 stored the additional languages before their complete
          // contextual translations existed. Replace only values that still
          // equal the English defaults; preserve every manual user edit.
          const restored = { ...sampleCVByLanguage };
          for (const preservedLanguage of ["fr", "en"] as const) {
            const stored = saved.byLanguage[preservedLanguage];
            if (stored) restored[preservedLanguage] = importCvJson(stored, "auto").cv;
          }
          for (const migratedLanguage of ["es", "de", "it", "zh", "ar"] as const) {
            const stored = saved.byLanguage[migratedLanguage];
            if (stored)
              restored[migratedLanguage] = migrateLegacyLanguage(stored, migratedLanguage);
          }
          setCvByLanguage(restored);
          if (saved.language && DOCUMENT_LANGUAGES.some((item) => item.id === saved.language)) {
            setLanguage(saved.language);
          }
        } else {
          setCvByLanguage((current) => ({ ...current, fr: importCvJson(saved, "auto").cv }));
        }
      }

      const savedTemplate = localStorage.getItem(TEMPLATE_STORAGE_KEY);
      if (savedTemplate) {
        try {
          const settings = JSON.parse(savedTemplate) as {
            documentKind?: DocumentKind;
            templateId?: PdfTemplateId;
          };
          if (settings.documentKind && settings.templateId) {
            setDocumentKind(settings.documentKind);
            setTemplateId(
              isArabicCvTemplate(String(settings.templateId))
                ? "arabic-pro-v1"
                : settings.templateId,
            );
          }
        } catch {
          const migratedTemplate = isArabicCvTemplate(savedTemplate)
            ? "arabic-pro-v1"
            : savedTemplate;
          if (getTemplates("cv").some((template) => template.id === migratedTemplate)) {
            setTemplateId(migratedTemplate as PdfTemplateId);
          }
        }
      }

      const savedColors = localStorage.getItem(COLOR_STORAGE_KEY);
      if (savedColors) {
        const parsed = JSON.parse(savedColors) as Partial<TemplateColorMap>;
        const restored: TemplateColorMap = { ...DEFAULT_TEMPLATE_COLORS };
        (Object.keys(restored) as ThemeTemplateId[]).forEach((id) => {
          const color = parsed[id];
          if (color && /^#[0-9a-f]{6}$/i.test(color)) restored[id] = color.toLowerCase();
        });
        setTemplateColors(restored);
      }

      const savedVisibility = localStorage.getItem(VISIBILITY_STORAGE_KEY);
      if (savedVisibility) {
        const parsed = JSON.parse(savedVisibility) as Record<string, unknown>;
        setHiddenElements(
          Object.fromEntries(
            Object.entries(parsed).filter(
              ([path, hidden]) => path.length > 0 && path.length <= 180 && hidden === true,
            ),
          ) as HiddenCvElements,
        );
      }

      const savedAiSettings = localStorage.getItem(AI_STORAGE_KEY);
      if (savedAiSettings) setAiSettings(normalizeAiSettings(JSON.parse(savedAiSettings)));

      const savedSectionAppearance = localStorage.getItem(SECTION_APPEARANCE_STORAGE_KEY);
      if (savedSectionAppearance)
        setSectionAppearance(normalizeSectionAppearance(JSON.parse(savedSectionAppearance)));
    } catch (error) {
      console.warn("Les données locales du CV n’ont pas pu être chargées.", error);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: STORAGE_VERSION, language, byLanguage: cvByLanguage }),
      );
    } catch (error) {
      console.warn("Le CV n’a pas pu être sauvegardé localement.", error);
    }
  }, [cvByLanguage, language, loaded]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify({ documentKind, templateId }));
    } catch (error) {
      console.warn("Le modèle sélectionné n’a pas pu être sauvegardé localement.", error);
    }
  }, [documentKind, loaded, templateId]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify(templateColors));
    } catch (error) {
      console.warn("Les couleurs des modèles n’ont pas pu être sauvegardées.", error);
    }
  }, [loaded, templateColors]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify(hiddenElements));
    } catch (error) {
      console.warn("La visibilité des champs n’a pas pu être sauvegardée localement.", error);
    }
  }, [hiddenElements, loaded]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(aiSettings));
    } catch (error) {
      console.warn("Les paramètres IA n’ont pas pu être sauvegardés localement.", error);
    }
  }, [aiSettings, loaded]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(SECTION_APPEARANCE_STORAGE_KEY, JSON.stringify(sectionAppearance));
    } catch (error) {
      console.warn("Le style des sections n’a pas pu être sauvegardé localement.", error);
    }
  }, [loaded, sectionAppearance]);

  useEffect(() => {
    if (isEuropassTemplate) {
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = null;
      }
      setPdfPreview(null);
      setPdfLoading(false);
      setPdfError("");
      return;
    }
    if (!previewVisible) {
      setPdfLoading(false);
      setPdfError("");
      return;
    }
    if (pdfPreview?.key === cvKey) {
      setPdfLoading(false);
      setPdfError("");
      return;
    }

    let cancelled = false;
    setPdfLoading(true);
    setPdfError("");

    const timeout = window.setTimeout(async () => {
      try {
        const blob = await pdfWithDeadline(
          createDocumentPdfBlob(outputCv, documentKind, templateId, language, accentColor),
        );
        if (cancelled) return;

        const url = URL.createObjectURL(blob);
        if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = url;
        setPdfPreview({ blob, url, key: cvKey });
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setPdfError(error instanceof Error ? error.message : ui.previewError);
        }
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [
    accentColor,
    cvKey,
    documentKind,
    isEuropassTemplate,
    language,
    outputCv,
    pdfPreview,
    pdfRetryNonce,
    previewVisible,
    templateId,
    ui.previewError,
  ]);

  useEffect(
    () => () => {
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    },
    [],
  );

  const set = <K extends keyof CV>(k: K, v: CV[K]) => setCv((c) => ({ ...c, [k]: v }));
  const setObjectiveText = (value: string, html = "") =>
    setCv((current) => ({
      ...current,
      objectif: value.slice(0, 800),
      objectif_format: {
        ...normalizeObjectiveFormat(current.objectif_format),
        html: html.slice(0, 12_000),
      },
    }));
  const setRichListText = (
    valueKey: RichListValueKey,
    formatKey: RichListFormatKey,
    visibilityPrefix: string,
    value: string,
    html: string,
    maxItems = 40,
    maxItemLength = 500,
  ) => {
    const items = richListItemsFromText(value, maxItems, maxItemLength);
    const previousItems = cv[valueKey];
    for (let index = previousItems.length - 1; index >= items.length; index -= 1) {
      removeIndexedVisibility(visibilityPrefix, index);
    }
    setCv((current) => ({
      ...current,
      [valueKey]: items,
      [formatKey]: {
        ...normalizeObjectiveFormat(current[formatKey]),
        html: html.slice(0, 30_000),
      },
    }));
  };
  const openAiField = (label: string, value: string, onApply: (next: string) => void) =>
    setAiFieldRequest({ label, value, onApply });
  const aiFieldProps = (label: string, value: string, onApply: (next: string) => void) => ({
    onAi: () => openAiField(label, value, onApply),
  });
  const isVisible = (path: string) => cvElementIsVisible(hiddenElements, path);
  const toggleVisibility = (path: string) =>
    setHiddenElements((current) => {
      if (current[path]) {
        const next = { ...current };
        delete next[path];
        return next;
      }
      return { ...current, [path]: true };
    });
  const visibilityProps = (path: string) => ({
    visible: isVisible(path),
    onToggleVisibility: () => toggleVisibility(path),
  });
  const sectionIsVisible = (id: string) => isVisible(`section.${id}`);
  const setSectionVisible = (id: string, visible: boolean) => {
    if (sectionIsVisible(id) !== visible) toggleVisibility(`section.${id}`);
  };
  const sectionIsOpen = (id: string) => openSections[id] === true;
  const setSectionOpen = (id: string, open: boolean) =>
    setOpenSections((current) => ({ ...current, [id]: open }));
  const appearanceFor = (id: string): SectionAppearance =>
    sectionAppearance[id] || DEFAULT_SECTION_APPEARANCE[id] || { title: "", icon: "document" };
  const setAppearanceFor = (id: string, appearance: SectionAppearance) =>
    setSectionAppearance((current) => ({ ...current, [id]: appearance }));
  const removeIndexedVisibility = (prefix: string, removedIndex: number) =>
    setHiddenElements((current) => {
      const next: HiddenCvElements = {};
      const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`^${escapedPrefix}\\.(\\d+)(\\..+)?$`);
      for (const [path, hidden] of Object.entries(current)) {
        const match = path.match(pattern);
        if (!match) {
          next[path] = hidden;
          continue;
        }
        const index = Number(match[1]);
        const suffix = match[2] || "";
        if (index < removedIndex) next[path] = hidden;
        if (index > removedIndex) next[`${prefix}.${index - 1}${suffix}`] = hidden;
      }
      return next;
    });

  // experiences
  const addExp = () => {
    const id = newId();
    setCv((c) => ({
      ...c,
      experiences: [
        ...c.experiences,
        { id, dates: "", lieu: "", titre: "", employeur: "", descriptions: [""] },
      ],
    }));
    setEditingExperienceId(id);
  };
  const updateExp = (id: string, patch: Partial<Experience>) =>
    setCv((c) => ({
      ...c,
      experiences: c.experiences.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  const updateExperienceLogo = (index: number, logo?: CompanyLogo) =>
    setCvByLanguage((current) => {
      const next = { ...current };
      for (const item of DOCUMENT_LANGUAGES) {
        const languageCv = current[item.id];
        if (!languageCv.experiences[index]) continue;
        next[item.id] = {
          ...languageCv,
          experiences: languageCv.experiences.map((experience, experienceIndex) =>
            experienceIndex === index ? { ...experience, logo } : experience,
          ),
        };
      }
      return next;
    });
  const updateProfilePhoto = (photo?: ProfilePhoto) =>
    setCvByLanguage(
      (current) =>
        Object.fromEntries(
          DOCUMENT_LANGUAGES.map((item) => [
            item.id,
            { ...current[item.id], photo: photo ? structuredClone(photo) : undefined },
          ]),
        ) as Record<DocumentLanguage, CV>,
    );
  const removeExp = (id: string, index: number) => {
    removeIndexedVisibility("experience", index);
    setCv((c) => ({ ...c, experiences: c.experiences.filter((e) => e.id !== id) }));
    if (editingExperienceId === id) setEditingExperienceId(null);
  };

  // formations
  const addForm = () => {
    const id = newId();
    setCv((c) => ({
      ...c,
      formations: [
        ...c.formations,
        { id, date: "", lieu: "", titre: "", institution: "", competences: "" },
      ],
    }));
    setEditingFormationId(id);
  };
  const updateForm = (id: string, patch: Partial<Formation>) =>
    setCv((c) => ({
      ...c,
      formations: c.formations.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  const removeForm = (id: string, index: number) => {
    removeIndexedVisibility("formation", index);
    setCv((c) => ({ ...c, formations: c.formations.filter((f) => f.id !== id) }));
    if (editingFormationId === id) setEditingFormationId(null);
  };

  // educations
  const addEdu = () => {
    const id = newId();
    setCv((c) => ({
      ...c,
      educations: [
        ...c.educations,
        {
          id,
          date: "",
          lieu: "",
          titre: "",
          institution: "",
          option: "",
          equivalence: "",
        },
      ],
    }));
    setEditingEducationId(id);
  };
  const updateEdu = (id: string, patch: Partial<Education>) =>
    setCv((c) => ({
      ...c,
      educations: c.educations.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  const removeEdu = (id: string, index: number) => {
    removeIndexedVisibility("education", index);
    setCv((c) => ({ ...c, educations: c.educations.filter((e) => e.id !== id) }));
    if (editingEducationId === id) setEditingEducationId(null);
  };

  const reset = () => {
    if (confirm(ui.resetConfirm)) {
      setCv(emptyCV);
      updateProfilePhoto(undefined);
      setHiddenElements({});
      setActiveProfileId(null);
      setActiveClientOrder(null);
    }
  };
  const loadSample = () => {
    setCv(sampleCVByLanguage[language]);
    updateProfilePhoto(undefined);
    setHiddenElements({});
    setActiveProfileId(null);
    setActiveClientOrder(null);
  };

  const changeDocumentKind = (kind: DocumentKind) => {
    setDocumentKind(kind);
    setTemplateId(defaultTemplateFor(kind));
  };

  const importJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      if (file.size > 5_000_000) throw new Error("Le fichier dépasse la limite de 5 Mo.");
      const fileText = await file.text();

      // Support direct import of Europass XML files (.xml)
      if (file.name.toLowerCase().endsWith(".xml") || fileText.trim().startsWith("<")) {
        const importedCv = await parseEuropassXml(fileText);
        const next = { ...cvByLanguage, [language]: importedCv };
        setCvByLanguage(next);
        updateProfilePhoto(importedCv.photo);
        setHiddenElements({});
        setActiveProfileId(null);
        setActiveClientOrder(null);
        setImportMessage({
          ok: true,
          text: `🇪🇺 CV Europass XML importé avec succès : ${importedCv.nom_complet || "Candidat"} (${language.toUpperCase()})`,
        });
        return;
      }

      const parsed = JSON.parse(fileText) as unknown;
      const root =
        parsed !== null && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
      const next = { ...cvByLanguage };
      const importedLanguages: DocumentLanguage[] = [];
      const importedSet = importCvJsonSet(parsed);
      if (importedSet) {
        for (const importedLanguage of importedSet.languages) {
          next[importedLanguage] = importedSet.documents[importedLanguage]!;
          importedLanguages.push(importedLanguage);
        }
      } else if (root.CONTENU_FRANCAIS) {
        next.fr = importCvJson(parsed, "fr").cv;
        importedLanguages.push("fr");
      }
      if (root.CONTENU_ANGLAIS) {
        next.en = importCvJson(parsed, "en").cv;
        importedLanguages.push("en");
      }
      if (importedLanguages.length === 0) {
        next[language] = importCvJson(parsed, "auto").cv;
        importedLanguages.push(language);
      }
      const importedPhoto = importedLanguages
        .map((importedLanguage) => next[importedLanguage].photo)
        .find((photo) => photo?.dataUrl);
      for (const item of DOCUMENT_LANGUAGES) {
        next[item.id] = {
          ...next[item.id],
          photo: importedPhoto ? structuredClone(importedPhoto) : undefined,
        };
      }
      setCvByLanguage(next);
      setHiddenElements({});
      setActiveProfileId(null);
      setActiveClientOrder(null);
      const nextLanguage = importedSet?.defaultLanguage ?? importedLanguages[0];
      if (!importedLanguages.includes(language)) setLanguage(nextLanguage);
      const result =
        importedSet ??
        importCvJson(
          parsed,
          nextLanguage === "fr" || nextLanguage === "en" ? nextLanguage : "auto",
        );
      setImportMessage({
        ok: true,
        text: `${ui.jsonImported} ${importedLanguages.map((item) => item.toUpperCase()).join(" + ")} · ${result.summary}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : ui.importError;
      setImportMessage({ ok: false, text: message });
    }
  };

  const saveCurrentClient = async () => {
    if (profileSaving) return;
    setProfileSaving(true);
    try {
      const now = new Date().toISOString();
      const existing = activeProfileId ? await getClientProfile(activeProfileId) : undefined;
      const id = existing?.id ?? newClientProfileId();
      const profile: ClientProfile = {
        version: 1,
        id,
        name: cv.nom_complet.trim() || "Profil sans nom",
        email: cv.email.trim(),
        phone: cv.telephone.trim(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        language,
        cvByLanguage: structuredClone(cvByLanguage),
        hiddenElements: structuredClone(hiddenElements),
        documentKind,
        templateId,
        templateColors: structuredClone(templateColors),
      };
      await saveClientProfile(profile);
      let cloudError = "";
      let cloudSynced = false;
      const token = getAdminSession();
      if (token) {
        try {
          const photoAsset = await putCloudProfile(CLIENTS_API_ENDPOINT, token, profile);
          cloudSynced = true;
          if (photoAsset) {
            profile.photoAsset = photoAsset;
            for (const profileCv of Object.values(profile.cvByLanguage)) {
              if (profileCv.photo) profileCv.photo.r2Key = photoAsset.r2Key;
            }
            await saveClientProfile(profile);
            if (cv.photo) updateProfilePhoto({ ...cv.photo, r2Key: photoAsset.r2Key });
          }
        } catch (error) {
          cloudError = error instanceof Error ? error.message : "synchronisation R2 impossible";
        }
      }
      setActiveProfileId(id);
      let orderVersion = "";
      if (activeClientOrder) {
        const orderPayload = {
          version: "1.0",
          default_language: language,
          documents: cvByLanguage,
          _zgr: {
            order_id: activeClientOrder.id,
            hidden_elements: hiddenElements,
            document_kind: documentKind,
            template_id: templateId,
            template_colors: templateColors,
            section_appearance: sectionAppearance,
            saved_at: now,
          },
        };
        const orderJson = new File(
          [JSON.stringify(orderPayload, null, 2)],
          `${activeClientOrder.id}_CV_GLOBAL_7_LANGUES.json`,
          { type: "application/json" },
        );
        const imported = await importClientOrderJson(activeClientOrder.id, orderJson);
        orderVersion = ` · commande ${activeClientOrder.id} JSON v${String(
          imported.versionNumber,
        ).padStart(3, "0")}`;
      }
      setImportMessage({
        ok: !cloudError,
        text: cloudError
          ? `${existing ? "Profil mis à jour" : "Nouveau profil sauvegardé"} localement : ${profile.name} · R2 : ${cloudError}`
          : `${existing ? "Profil mis à jour" : "Nouveau profil sauvegardé"} ${cloudSynced ? "localement et dans R2" : "localement"} : ${profile.name} · ID ${id}${orderVersion}`,
      });
    } catch (error) {
      setImportMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Sauvegarde du profil impossible.",
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const openClientProfile = (profile: ClientProfile) => {
    setCvByLanguage(structuredClone(profile.cvByLanguage));
    setLanguage(profile.language);
    setHiddenElements(structuredClone(profile.hiddenElements));
    setDocumentKind(profile.documentKind);
    setTemplateId(
      profile.templateId === EUROPASS_TEMPLATE_ID
        ? EUROPASS_TEMPLATE_ID
        : profile.documentKind === "cv"
          ? normalizeCvTemplateForLanguage(String(profile.templateId), profile.language)
          : profile.templateId,
    );
    setTemplateColors({ ...DEFAULT_TEMPLATE_COLORS, ...structuredClone(profile.templateColors) });
    setActiveProfileId(profile.id);
    setActiveClientOrder(null);
    setImportMessage({
      ok: true,
      text: `Profil ouvert : ${profile.name} · ID ${profile.id}`,
    });
  };

  const openClientOrderJson = (value: unknown, order: ClientOrderSummary) => {
    try {
      const root =
        value && typeof value === "object" && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : {};
      const zgr =
        root._zgr && typeof root._zgr === "object" && !Array.isArray(root._zgr)
          ? (root._zgr as Record<string, unknown>)
          : null;
      const next = { ...cvByLanguage };
      const importedSet = importCvJsonSet(value);
      const importedLanguages: DocumentLanguage[] = [];
      if (importedSet) {
        for (const importedLanguage of importedSet.languages) {
          next[importedLanguage] = importedSet.documents[importedLanguage]!;
          importedLanguages.push(importedLanguage);
        }
      } else {
        next[language] = importCvJson(value, "auto").cv;
        importedLanguages.push(language);
      }
      const importedPhoto = importedLanguages
        .map((importedLanguage) => next[importedLanguage].photo)
        .find((photo) => photo?.dataUrl);
      for (const item of DOCUMENT_LANGUAGES) {
        next[item.id] = {
          ...next[item.id],
          photo: importedPhoto ? structuredClone(importedPhoto) : undefined,
        };
      }
      setCvByLanguage(next);
      setLanguage(importedSet?.defaultLanguage ?? importedLanguages[0]);
      const restoredVisibility =
        zgr?.hidden_elements &&
        typeof zgr.hidden_elements === "object" &&
        !Array.isArray(zgr.hidden_elements)
          ? (Object.fromEntries(
              Object.entries(zgr.hidden_elements as Record<string, unknown>).filter(
                ([path, hidden]) => path.length > 0 && path.length <= 180 && hidden === true,
              ),
            ) as HiddenCvElements)
          : {};
      setHiddenElements(restoredVisibility);
      if (
        zgr?.document_kind === "cv" ||
        zgr?.document_kind === "cover-letter" ||
        zgr?.document_kind === "advises"
      ) {
        setDocumentKind(zgr.document_kind);
      }
      if (typeof zgr?.template_id === "string") {
        setTemplateId(zgr.template_id as PdfTemplateId);
      }
      if (zgr?.template_colors && typeof zgr.template_colors === "object") {
        setTemplateColors({
          ...DEFAULT_TEMPLATE_COLORS,
          ...(zgr.template_colors as Partial<TemplateColorMap>),
        });
      }
      if (zgr?.section_appearance) {
        setSectionAppearance(normalizeSectionAppearance(zgr.section_appearance));
      }
      setActiveProfileId(null);
      setActiveClientOrder(order);
      setImportMessage({
        ok: true,
        text: `Commande ${order.id} ouverte dans ZGR CV · ${importedLanguages
          .map((item) => item.toUpperCase())
          .join(" + ")}. Vérifiez puis sauvegardez le profil client.`,
      });
    } catch (error) {
      setImportMessage({
        ok: false,
        text: error instanceof Error ? error.message : "JSON de commande incompatible.",
      });
    }
  };

  const createCurrentOrderDeliverable = async (order: ClientOrderSummary) => {
    if (activeClientOrder?.id !== order.id) {
      throw new Error(
        `Ouvrez d’abord le JSON de la commande ${order.id} dans ZGR afin d’éviter une livraison au mauvais client.`,
      );
    }
    const normalizedName = (outputCv.nom_complet || order.clientName || "document")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[<>:"/\\|?*]/g, "")
      .trim()
      .replace(/\s+/g, "_");
    if (isEuropassTemplate) {
      const xml = convertCvToEuropassXml(outputCv, language);
      return {
        file: new File([xml], `${normalizedName}_CV_Europass_${language.toUpperCase()}.xml`, {
          type: "application/xml",
        }),
        service: "CV_EUROPASS",
      };
    }
    const blob = await createDocumentPdfBlob(
      outputCv,
      documentKind,
      templateId,
      language,
      accentColor,
    );
    const suffix =
      documentKind === "cover-letter"
        ? language === "fr"
          ? "Lettre_FR"
          : "Lettre_ENG"
        : documentKind === "advises"
          ? "Conseils"
          : "CV";
    const service =
      documentKind === "cover-letter"
        ? language === "fr"
          ? "LETTRE_FR"
          : "LETTRE_ENG"
        : documentKind === "advises"
          ? "CONSEILS"
          : language === "ar"
            ? "CV_ARABE"
            : String(templateId).toLowerCase().includes("ats")
              ? "CV_ATS"
              : "CV_CANADIEN";
    return {
      file: new File([blob], `${normalizedName}_${suffix}_${language.toUpperCase()}.pdf`, {
        type: "application/pdf",
      }),
      service,
    };
  };

  const downloadCurrentPdf = async () => {
    if (pdfLoading || packLoading) return;
    setPdfLoading(true);
    setPdfError("");
    try {
      let blob = pdfPreview?.key === cvKey ? pdfPreview.blob : null;
      if (!blob) {
        blob = await pdfWithDeadline(
          createDocumentPdfBlob(outputCv, documentKind, templateId, language, accentColor),
        );
        const url = URL.createObjectURL(blob);
        if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = url;
        setPdfPreview({ blob, url, key: cvKey });
      }
      downloadPdfDocument(blob, outputCv, documentKind, language);
    } catch (error) {
      console.error(error);
      setPdfError(error instanceof Error ? error.message : ui.previewError);
    } finally {
      setPdfLoading(false);
    }
  };

  const downloadClientProfilePdf = async (profile: ClientProfile) => {
    const profileCv = applyCvVisibility(
      profile.cvByLanguage[profile.language],
      profile.hiddenElements,
    );
    const profileTemplateId =
      profile.templateId === EUROPASS_TEMPLATE_ID
        ? EUROPASS_TEMPLATE_ID
        : profile.documentKind === "cv"
          ? normalizeCvTemplateForLanguage(String(profile.templateId), profile.language)
          : profile.templateId;
    if (profileTemplateId === EUROPASS_TEMPLATE_ID) {
      await downloadEuropassXml(profileCv, profile.language);
      setImportMessage({
        ok: true,
        text: `XML Europass ${profile.language.toUpperCase()} téléchargé pour ${profile.name}.`,
      });
      return;
    }
    const color = profile.templateColors[profileTemplateId as ThemeTemplateId];
    const blob = await createDocumentPdfBlob(
      profileCv,
      profile.documentKind,
      profileTemplateId,
      profile.language,
      color,
    );
    downloadPdfDocument(blob, profileCv, profile.documentKind, profile.language);
  };

  const downloadCompletePack = async () => {
    if (packLoading) return;
    setPackLoading(true);
    setPackProgress({ completed: 0, total: 81 });
    setPackMessage(null);
    try {
      const blob = await createCompletePackZip(
        outputCvByLanguage,
        ({ completed, total }) => {
          setPackProgress({ completed, total });
        },
        templateColors,
      );
      downloadCompletePackArchive(blob, cv);
      setPackMessage({ ok: true, text: ui.packReady });
    } catch (error) {
      console.error(error);
      setPackMessage({ ok: false, text: ui.packError });
    } finally {
      setPackLoading(false);
    }
  };

  const downloadCurrentMultilingual = async () => {
    if (packLoading) return;
    setPackLoading(true);
    setPackProgress({
      completed: 0,
      total: currentTemplateIsArabicOnly ? 1 : DOCUMENT_LANGUAGES.length,
    });
    setPackMessage(null);
    try {
      const blob = await createCurrentTemplateMultilingualZip(
        outputCvByLanguage,
        documentKind,
        templateId,
        ({ completed, total }) => setPackProgress({ completed, total }),
        accentColor,
      );
      downloadCurrentMultilingualArchive(blob, cv);
      setPackMessage({
        ok: true,
        text: currentTemplateIsArabicOnly
          ? "Modèle arabe téléchargé en version AR."
          : ui.currentPackReady,
      });
    } catch (error) {
      console.error(error);
      setPackMessage({ ok: false, text: ui.packError });
    } finally {
      setPackLoading(false);
    }
  };

  const exportAndOpenEuropass = async () => {
    try {
      const editorWindow = window.open(europassEditorUrl(language), "_blank");
      if (editorWindow) editorWindow.opener = null;
      await downloadEuropassXml(outputCv, language);
      setPackMessage({
        ok: true,
        text: editorWindow
          ? `XML Europass ${language.toUpperCase()} téléchargé. Dans l’éditeur ouvert, sélectionnez ce fichier pour charger le profil.`
          : `XML Europass ${language.toUpperCase()} téléchargé. Autorisez les fenêtres contextuelles puis ouvrez l’éditeur Europass.`,
      });
    } catch (error) {
      console.error(error);
      setPackMessage({
        ok: false,
        text: "Impossible de générer le XML Europass. Vérifiez les données du profil.",
      });
    }
  };

  const previewSections: PreviewDockSection[] = [
    { id: "personal", title: ui.personal, visible: sectionIsVisible("personal") },
    {
      id: "objective",
      title: form.objective,
      count: cv.objectif.trim() ? 1 : 0,
      visible: sectionIsVisible("objective"),
    },
    {
      id: "experience",
      title: form.experience,
      count: cv.experiences.length,
      visible: sectionIsVisible("experience"),
    },
    {
      id: "training",
      title: form.training,
      count: cv.formations.length,
      visible: sectionIsVisible("training"),
    },
    {
      id: "education",
      title: form.education,
      count: cv.educations.length,
      visible: sectionIsVisible("education"),
    },
    {
      id: "skills",
      title: form.skills,
      count: cv.competences.length,
      visible: sectionIsVisible("skills"),
    },
    {
      id: "languages",
      title: form.languages,
      count: Object.values(cv.langues).filter((value) => value.trim()).length,
      visible: sectionIsVisible("languages"),
    },
    {
      id: "volunteering",
      title: form.volunteering,
      count: cv.participations.length,
      visible: sectionIsVisible("volunteering"),
    },
    {
      id: "certifications",
      title: form.certifications,
      count: cv.certifications.length,
      visible: sectionIsVisible("certifications"),
    },
    {
      id: "interests",
      title: form.interests,
      count: cv.interets.length,
      visible: sectionIsVisible("interests"),
    },
    {
      id: "references",
      title: form.references,
      count: cv.references.length,
      visible: sectionIsVisible("references"),
    },
    {
      id: "letter",
      title: ui.letterTitle,
      count: cv.lettre_motivation.paragraphes.length,
      visible: sectionIsVisible("letter"),
    },
    {
      id: "development",
      title: ui.planTitle,
      count: cv.plan_developpement.length,
      visible: sectionIsVisible("development"),
    },
  ];
  const previewSectionIds = previewSections.map((section) => section.id);
  const navigateToEditorSection = (sectionId: string) => {
    setPreviewFocusMode(false);
    setSectionVisible(sectionId, true);
    setSectionOpen(sectionId, true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document
          .getElementById(`cv-editor-section-${sectionId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  };
  const setAllEditorSectionsOpen = (open: boolean) => {
    setPreviewFocusMode(false);
    setOpenSections((current) => ({
      ...current,
      ...Object.fromEntries(previewSectionIds.map((id) => [id, open])),
    }));
  };

  return (
    <div lang="fr" dir="ltr" className="zgr-app-shell min-h-screen">
      <header className="zgr-app-header sticky top-0 z-20 border-b">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-4 py-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div className="flex shrink-0 items-center gap-3">
            <div className="zgr-brand-mark flex h-11 w-11 items-center justify-center rounded-2xl text-white">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="zgr-brand-title text-xl font-extrabold tracking-tight">ZGR CV</h1>
                <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">
                  Studio
                </span>
              </div>
              <p className="max-w-md text-xs text-muted-foreground">{ui.subtitle}</p>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center justify-start gap-2 2xl:w-auto 2xl:justify-end">
            <input
              ref={jsonInputRef}
              type="file"
              accept=".json,application/json,.xml,application/xml,text/xml"
              className="hidden"
              onChange={importJson}
            />
            <div className="zgr-control flex items-center gap-2 rounded-xl border px-3 py-1.5">
              <Label htmlFor="document-kind" className="text-xs font-medium text-muted-foreground">
                {ui.document}
              </Label>
              <select
                id="document-kind"
                aria-label={ui.document}
                value={documentKind}
                onChange={(event) => changeDocumentKind(event.target.value as DocumentKind)}
                className="h-7 min-w-40 cursor-pointer bg-transparent text-sm font-semibold outline-none"
              >
                {getDocumentKinds("fr").map((kind) => (
                  <option key={kind.id} value={kind.id}>
                    {kind.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="zgr-control flex items-center gap-2 rounded-xl border px-3 py-1.5">
              <Label htmlFor="pdf-template" className="text-xs font-medium text-muted-foreground">
                {ui.template}
              </Label>
              <select
                id="pdf-template"
                aria-label={ui.template}
                value={templateId}
                onChange={(event) => setTemplateId(event.target.value as PdfTemplateId)}
                className="h-7 min-w-40 cursor-pointer bg-transparent text-sm font-semibold outline-none"
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
            {!isEuropassTemplate && (
              <div
                className="zgr-control flex items-center gap-1.5 rounded-xl border px-2 py-1.5"
                aria-label={ui.palette}
                role="group"
              >
                <Palette className="mx-0.5 h-4 w-4 text-muted-foreground" />
                {paletteColors.map((color, index) => {
                  const selected = accentColor.toLowerCase() === color.toLowerCase();
                  const original = color.toLowerCase() === TEMPLATE_DEFAULT_COLORS[themeTemplateId];
                  return (
                    <button
                      key={color}
                      type="button"
                      className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                        selected ? "scale-110 border-white ring-2 ring-zinc-400" : "border-white/90"
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={`${ui.palette} — ${original ? ui.originalColor : color}`}
                      aria-pressed={selected}
                      title={original ? ui.originalColor : color}
                      onClick={() =>
                        setTemplateColors((current) => ({
                          ...current,
                          [themeTemplateId]: color,
                        }))
                      }
                    >
                      {index === 0 && <span className="sr-only">{ui.originalColor}</span>}
                    </button>
                  );
                })}
                <label
                  className="relative ml-0.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-zinc-400 bg-white"
                  title={ui.customColor}
                >
                  <span
                    className="h-4 w-4 rounded-full"
                    style={{
                      background: `conic-gradient(from 90deg, #ef4444, #f97316, #059669, #0891b2, #8b5cf6, #ef4444)`,
                    }}
                  />
                  <input
                    type="color"
                    value={accentColor}
                    aria-label={ui.customColor}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    onChange={(event) =>
                      setTemplateColors((current) => ({
                        ...current,
                        [themeTemplateId]: event.target.value.toLowerCase(),
                      }))
                    }
                  />
                </label>
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="zgr-control h-10 gap-2 rounded-xl border-primary/15 px-3"
                  aria-label={`${ui.language} : ${DOCUMENT_LANGUAGES.find((item) => item.id === language)?.name}`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br ${LANGUAGE_VISUALS[language].color} text-[10px] font-extrabold text-white shadow-sm`}
                  >
                    {DOCUMENT_LANGUAGES.find((item) => item.id === language)?.shortName}
                  </span>
                  <Languages className="h-4 w-4 text-primary" />
                  <span className="hidden text-left sm:block">
                    <span className="block text-[10px] font-medium uppercase leading-none text-muted-foreground">
                      Langue
                    </span>
                    <span className="mt-1 block text-xs font-bold leading-none">
                      {DOCUMENT_LANGUAGES.find((item) => item.id === language)?.name}
                    </span>
                  </span>
                  <span className="font-bold sm:hidden">
                    {DOCUMENT_LANGUAGES.find((item) => item.id === language)?.shortName}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-xl p-2 shadow-xl">
                <DropdownMenuLabel className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
                  <Languages className="h-4 w-4 text-primary" /> Langue du document et du formulaire
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {DOCUMENT_LANGUAGES.map((item) => (
                  <DropdownMenuItem
                    key={item.id}
                    onSelect={() => setLanguage(item.id)}
                    className={`my-1 gap-3 rounded-lg px-2.5 py-2.5 ${language === item.id ? "bg-primary/10 text-primary" : ""}`}
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${LANGUAGE_VISUALS[item.id].color} text-[10px] font-extrabold text-white shadow-sm`}
                    >
                      {item.shortName}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-semibold">{item.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        Code document : {item.shortName}
                      </span>
                    </span>
                    {language === item.id && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="sm"
              className="border-sky-200 bg-sky-50/80 text-sky-800 hover:bg-sky-100"
              onClick={() => jsonInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" /> {ui.importJson}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-emerald-200 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100"
              disabled={profileSaving}
              onClick={() => void saveCurrentClient()}
              title={
                activeProfileId ? `Mettre à jour ${activeProfileId}` : "Créer un profil client"
              }
            >
              {profileSaving ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {activeProfileId ? "Sauvegarder" : "Sauvegarder client"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-indigo-200 bg-indigo-50/80 text-indigo-800 hover:bg-indigo-100"
              onClick={() => setClientDatabaseOpen(true)}
            >
              <Database className="mr-2 h-4 w-4" /> Base de données
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-cyan-200 bg-cyan-50/80 text-cyan-900 hover:bg-cyan-100"
              onClick={() => setClientOrdersOpen(true)}
            >
              <ClipboardList className="mr-2 h-4 w-4" /> Commandes
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-violet-200 bg-violet-50/80 text-violet-800 hover:bg-violet-100"
              onClick={() => setAiAssistantOpen(true)}
            >
              <Bot className="mr-2 h-4 w-4 text-violet-600" /> Assistant IA
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-amber-200 bg-amber-50/80 text-amber-900 hover:bg-amber-100"
              onClick={() => setPromptMasterOpen(true)}
            >
              <BookOpenText className="mr-2 h-4 w-4 text-amber-600" /> Prompte
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Paramètres IA"
              title="Paramètres IA"
              onClick={() => setAiSettingsOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-sky-200 bg-sky-50/80 text-sky-900 hover:bg-sky-100"
              onClick={() => setAccountSettingsOpen(true)}
              title="Paramètres du compte"
            >
              <UserCog className="mr-2 h-4 w-4" /> {user.displayName}
            </Button>
            <Button variant="ghost" size="sm" onClick={loadSample}>
              {ui.example}
            </Button>
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="mr-2 h-4 w-4" /> {ui.reset}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewVisible((visible) => !visible)}
              aria-pressed={previewVisible}
              aria-controls="pdf-preview-panel"
            >
              {previewVisible ? (
                <EyeOff className="mr-2 h-4 w-4" />
              ) : (
                <Eye className="mr-2 h-4 w-4" />
              )}
              {previewVisible ? "Masquer l’aperçu" : "Afficher l’aperçu"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Se déconnecter"
              title="Se déconnecter"
              onClick={onLogout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
            {!isEuropassTemplate && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" disabled={packLoading} aria-label={ui.downloadPdf}>
                    {packLoading ? (
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    {packLoading
                      ? `${ui.preparingPack} ${packProgress.completed}/${packProgress.total}`
                      : ui.downloadPdf}
                    {!packLoading && <ChevronDown className="ml-2 h-3.5 w-3.5" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuItem
                    disabled={pdfLoading}
                    onSelect={() => void downloadCurrentPdf()}
                    className="items-start py-2.5"
                  >
                    {pdfLoading ? (
                      <LoaderCircle className="mt-0.5 animate-spin" />
                    ) : (
                      <Download className="mt-0.5" />
                    )}
                    <span className="flex flex-col">
                      <span className="font-medium">
                        {pdfLoading ? ui.preparingPdf : "Télécharger le PDF actuel"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Génération directe du document sélectionné
                      </span>
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={pdfLoading}
                    onSelect={() => void downloadCurrentMultilingual()}
                    className="items-start py-2.5"
                  >
                    <FileDown className="mt-0.5" />
                    <span className="flex flex-col">
                      <span className="font-medium">{currentArchiveLabel}</span>
                      <span className="text-xs text-muted-foreground">{currentArchiveHint}</span>
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={async () => {
                      try {
                        await downloadEuropassXml(outputCv, language);
                        setPackMessage({
                          ok: true,
                          text: "🇪🇺 XML Europass Candidate téléchargé. Les données disponibles sont préremplies ; complétez les champs signalés dans l’éditeur officiel.",
                        });
                      } catch (e) {
                        console.error(e);
                        setPackMessage({
                          ok: false,
                          text: "Erreur lors de la création du XML Europass.",
                        });
                      }
                    }}
                    className="items-start py-2.5"
                  >
                    <FileCode className="mt-0.5 text-blue-600" />
                    <span className="flex flex-col">
                      <span className="font-medium flex items-center gap-1.5">
                        <span>🇪🇺 Exporter pour Europass (.xml)</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Compatible officiel europa.eu ({language.toUpperCase()})
                      </span>
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={async () => {
                      try {
                        await downloadEuropassMultilingualZip(outputCvByLanguage, cv);
                        setPackMessage({
                          ok: true,
                          text: "🇪🇺 Pack Europass 7 langues (.zip) téléchargé avec succès !",
                        });
                      } catch (e) {
                        console.error(e);
                        setPackMessage({
                          ok: false,
                          text: "Erreur lors de la création du pack Europass.",
                        });
                      }
                    }}
                    className="items-start py-2.5"
                  >
                    <Archive className="mt-0.5 text-amber-500" />
                    <span className="flex flex-col">
                      <span className="font-medium">🇪🇺 Pack Europass XML 7 langues (.zip)</span>
                      <span className="text-xs text-muted-foreground">
                        7 fichiers XML officiels · FR, EN, ES, DE, IT, ZH, AR
                      </span>
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => void downloadCompletePack()}
                    className="items-start py-2.5"
                  >
                    <Archive className="mt-0.5" />
                    <span className="flex flex-col">
                      <span className="font-medium">{ui.downloadPack}</span>
                      <span className="text-xs text-muted-foreground">{ui.downloadPackHint}</span>
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        {importMessage && (
          <div
            role="status"
            aria-live="polite"
            className={`mx-auto mb-2 max-w-7xl rounded-lg px-3 py-2 text-xs font-medium shadow-sm ${
              importMessage.ok ? "zgr-status-success" : "zgr-status-error"
            }`}
          >
            {importMessage.text}
          </div>
        )}
        {packMessage && (
          <div
            role="status"
            aria-live="polite"
            className={`mx-auto mb-2 max-w-7xl rounded-lg px-3 py-2 text-xs font-medium shadow-sm ${
              packMessage.ok ? "zgr-status-success" : "zgr-status-error"
            }`}
          >
            {packMessage.text}
          </div>
        )}
      </header>

      <main
        className={`mx-auto grid min-w-0 gap-6 px-4 py-7 ${
          previewVisible && !previewFocusMode
            ? "max-w-7xl lg:grid-cols-2"
            : previewVisible
              ? "max-w-[1500px] lg:grid-cols-1"
              : "max-w-7xl lg:grid-cols-1"
        }`}
      >
        {/* Form */}
        <section
          className={`zgr-editor-panel min-w-0 space-y-3 rounded-3xl border border-slate-200 bg-slate-100/75 p-3 sm:p-4 ${
            previewVisible && previewFocusMode
              ? "lg:hidden"
              : previewVisible
                ? ""
                : "lg:mx-auto lg:w-full lg:max-w-5xl"
          }`}
        >
          <CvSectionPanel
            id="personal"
            fallbackTitle={ui.personal}
            appearance={appearanceFor("personal")}
            onAppearanceChange={(appearance) => setAppearanceFor("personal", appearance)}
            open={sectionIsOpen("personal")}
            onOpenChange={(open) => setSectionOpen("personal", open)}
            visible={sectionIsVisible("personal")}
            onVisibleChange={(visible) => setSectionVisible("personal", visible)}
            complete={Boolean(cv.nom_complet.trim() && cv.titre_poste.trim())}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Photo du profil" {...visibilityProps("personal.photo")}>
                  <ProfilePhotoField photo={cv.photo} onChange={updateProfilePhoto} />
                </Field>
              </div>
              <Field
                label={form.fullName}
                {...visibilityProps("personal.nom_complet")}
                {...aiFieldProps(form.fullName, cv.nom_complet, (value) =>
                  set("nom_complet", value.slice(0, 100)),
                )}
              >
                <Input
                  value={cv.nom_complet}
                  placeholder={form.fullName}
                  onChange={(e) => set("nom_complet", e.target.value.slice(0, 100))}
                />
              </Field>
              <Field
                label={form.jobTitle}
                {...visibilityProps("personal.titre_poste")}
                {...aiFieldProps(form.jobTitle, cv.titre_poste, (value) =>
                  set("titre_poste", value.slice(0, 120)),
                )}
              >
                <Input
                  value={cv.titre_poste}
                  placeholder={form.jobTitle}
                  onChange={(e) => set("titre_poste", e.target.value.slice(0, 120))}
                />
              </Field>
              <Field
                label={form.phone}
                {...visibilityProps("personal.telephone")}
                {...aiFieldProps(form.phone, cv.telephone, (value) =>
                  set("telephone", value.slice(0, 40)),
                )}
              >
                <Input
                  value={cv.telephone}
                  placeholder="+1 514 000 0000"
                  onChange={(e) => set("telephone", e.target.value.slice(0, 40))}
                />
              </Field>
              <Field
                label="Email"
                {...visibilityProps("personal.email")}
                {...aiFieldProps("Email", cv.email, (value) => set("email", value.slice(0, 255)))}
              >
                <Input
                  type="email"
                  value={cv.email}
                  placeholder="name@example.com"
                  onChange={(e) => set("email", e.target.value.slice(0, 255))}
                />
              </Field>
              <Field
                label={form.address}
                {...visibilityProps("personal.adresse")}
                {...aiFieldProps(form.address, cv.adresse, (value) =>
                  set("adresse", value.slice(0, 160)),
                )}
              >
                <Input
                  value={cv.adresse}
                  placeholder={form.address}
                  onChange={(e) => set("adresse", e.target.value.slice(0, 160))}
                />
              </Field>
              <Field
                label={form.relocation}
                {...visibilityProps("personal.statut_relocation")}
                {...aiFieldProps(form.relocation, cv.statut_relocation, (value) =>
                  set("statut_relocation", value.slice(0, 120)),
                )}
              >
                <Input
                  value={cv.statut_relocation}
                  placeholder={form.relocation}
                  onChange={(e) => set("statut_relocation", e.target.value.slice(0, 120))}
                />
              </Field>
              <Field
                label={form.birthDate}
                {...visibilityProps("personal.date_naissance")}
                {...aiFieldProps(form.birthDate, cv.date_naissance, (value) =>
                  set("date_naissance", value.slice(0, 60)),
                )}
              >
                <Input
                  value={cv.date_naissance}
                  placeholder={form.birthDate}
                  onChange={(e) => set("date_naissance", e.target.value.slice(0, 60))}
                />
              </Field>
              <Field
                label={form.maritalStatus}
                {...visibilityProps("personal.situation_familiale")}
                {...aiFieldProps(form.maritalStatus, cv.situation_familiale, (value) =>
                  set("situation_familiale", value.slice(0, 80)),
                )}
              >
                <Input
                  value={cv.situation_familiale}
                  placeholder={form.maritalStatus}
                  onChange={(e) => set("situation_familiale", e.target.value.slice(0, 80))}
                />
              </Field>
              <Field
                label={form.drivingLicence}
                {...visibilityProps("personal.permis_conduire")}
                {...aiFieldProps(form.drivingLicence, cv.permis_conduire, (value) =>
                  set("permis_conduire", value.slice(0, 80)),
                )}
              >
                <Input
                  value={cv.permis_conduire}
                  placeholder={form.drivingLicence}
                  onChange={(e) => set("permis_conduire", e.target.value.slice(0, 80))}
                />
              </Field>
              <Field
                label={form.nationalService}
                {...visibilityProps("personal.service_national")}
                {...aiFieldProps(form.nationalService, cv.service_national, (value) =>
                  set("service_national", value.slice(0, 80)),
                )}
              >
                <Input
                  value={cv.service_national}
                  placeholder={form.nationalService}
                  onChange={(e) => set("service_national", e.target.value.slice(0, 80))}
                />
              </Field>
              <Field
                label={form.region}
                {...visibilityProps("personal.wilaya")}
                {...aiFieldProps(form.region, cv.wilaya, (value) =>
                  set("wilaya", value.slice(0, 80)),
                )}
              >
                <Input
                  value={cv.wilaya}
                  placeholder={form.region}
                  onChange={(e) => set("wilaya", e.target.value.slice(0, 80))}
                />
              </Field>
              <Field
                label={form.country}
                {...visibilityProps("personal.pays")}
                {...aiFieldProps(form.country, cv.pays, (value) => set("pays", value.slice(0, 80)))}
              >
                <Input
                  value={cv.pays}
                  placeholder={form.country}
                  onChange={(e) => set("pays", e.target.value.slice(0, 80))}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field
                  label={form.applicationInfo}
                  {...visibilityProps("personal.candidature")}
                  {...aiFieldProps(form.applicationInfo, cv.candidature, (value) =>
                    set("candidature", value.slice(0, 500)),
                  )}
                >
                  <Textarea
                    rows={2}
                    value={cv.candidature}
                    placeholder={form.applicationInfo}
                    onChange={(e) => set("candidature", e.target.value.slice(0, 500))}
                  />
                </Field>
              </div>
            </div>
          </CvSectionPanel>

          <CvSectionPanel
            id="objective"
            fallbackTitle={form.objective}
            appearance={appearanceFor("objective")}
            onAppearanceChange={(appearance) => setAppearanceFor("objective", appearance)}
            open={sectionIsOpen("objective")}
            onOpenChange={(open) => setSectionOpen("objective", open)}
            visible={sectionIsVisible("objective")}
            onVisibleChange={(visible) => setSectionVisible("objective", visible)}
            complete={Boolean(cv.objectif.trim())}
          >
            <CvRichTextEditor
              value={cv.objectif}
              format={normalizeObjectiveFormat(cv.objectif_format)}
              defaultAlignment={language === "ar" ? "right" : "left"}
              onChange={(value, html) => setObjectiveText(value, html)}
              onFormatChange={(format) => set("objectif_format", format)}
              onAi={() =>
                openAiField(form.objective, cv.objectif, (value) => setObjectiveText(value))
              }
            />
          </CvSectionPanel>

          <CvSectionPanel
            id="skills"
            fallbackTitle={form.skills}
            appearance={appearanceFor("skills")}
            onAppearanceChange={(appearance) => setAppearanceFor("skills", appearance)}
            open={sectionIsOpen("skills")}
            onOpenChange={(open) => setSectionOpen("skills", open)}
            visible={sectionIsVisible("skills")}
            onVisibleChange={(visible) => setSectionVisible("skills", visible)}
            count={cv.competences.length}
          >
            <CvRichTextEditor
              value={cv.competences.join("\n")}
              format={richListEditorFormat(cv.competences, cv.competences_format)}
              onChange={(value, html) =>
                setRichListText("competences", "competences_format", "skills", value, html, 40, 300)
              }
              onFormatChange={(format) => set("competences_format", format)}
              onAi={() =>
                openAiField(form.skills, cv.competences.join("\n"), (value) => {
                  const items = richListItemsFromText(value, 40, 300);
                  setRichListText(
                    "competences",
                    "competences_format",
                    "skills",
                    items.join("\n"),
                    richListHtml(items),
                    40,
                    300,
                  );
                })
              }
              defaultAlignment={language === "ar" ? "right" : "left"}
              maxLength={8_000}
              placeholder={`${form.skill} — une compétence par ligne…`}
              contextLabel="compétences clés"
            />
            <p className="text-[11px] leading-relaxed text-slate-400">
              Une ligne correspond à une puce dans tous les modèles et dans le PDF ATS.
            </p>
          </CvSectionPanel>

          <CvSectionPanel
            id="languages"
            fallbackTitle={form.languages}
            appearance={appearanceFor("languages")}
            onAppearanceChange={(appearance) => setAppearanceFor("languages", appearance)}
            open={sectionIsOpen("languages")}
            onOpenChange={(open) => setSectionOpen("languages", open)}
            visible={sectionIsVisible("languages")}
            onVisibleChange={(visible) => setSectionVisible("languages", visible)}
            count={Object.values(cv.langues).filter((value) => value.trim()).length}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["fr", form.french],
                  ["en", form.english],
                  ["ar", form.arabic],
                  ["de", form.german],
                  ["es", form.spanish],
                  ["kab", "Kabyle"],
                ] as const
              ).map(([key, label]) => (
                <Field
                  key={key}
                  label={label}
                  {...visibilityProps(`languages.${key}`)}
                  {...aiFieldProps(label, cv.langues[key], (value) =>
                    set("langues", { ...cv.langues, [key]: value.slice(0, 40) }),
                  )}
                >
                  <Input
                    value={cv.langues[key]}
                    placeholder={form.fluentExample}
                    onChange={(e) =>
                      set("langues", { ...cv.langues, [key]: e.target.value.slice(0, 40) })
                    }
                  />
                </Field>
              ))}
            </div>
          </CvSectionPanel>

          <CvSectionPanel
            id="experience"
            fallbackTitle={form.experience}
            appearance={appearanceFor("experience")}
            onAppearanceChange={(appearance) => setAppearanceFor("experience", appearance)}
            open={sectionIsOpen("experience")}
            onOpenChange={(open) => {
              setSectionOpen("experience", open);
              if (!open) setEditingExperienceId(null);
            }}
            visible={sectionIsVisible("experience")}
            onVisibleChange={(visible) => setSectionVisible("experience", visible)}
            count={cv.experiences.length}
            onAdd={addExp}
          >
            <ExperienceWorkspace
              experiences={cv.experiences}
              editingId={editingExperienceId}
              labels={{
                dates: form.dates,
                place: form.place,
                title: form.title,
                employer: form.employer,
                achievements: form.achievements,
                addLine: form.addLine,
                delete: form.delete,
              }}
              onEdit={setEditingExperienceId}
              onUpdate={updateExp}
              onRemove={removeExp}
              isVisible={isVisible}
              onToggleVisibility={toggleVisibility}
              onRemoveIndexedVisibility={removeIndexedVisibility}
              onLogoChange={updateExperienceLogo}
              onAi={openAiField}
            />
          </CvSectionPanel>

          <CvSectionPanel
            id="training"
            fallbackTitle={form.training}
            appearance={appearanceFor("training")}
            onAppearanceChange={(appearance) => setAppearanceFor("training", appearance)}
            open={sectionIsOpen("training")}
            onOpenChange={(open) => {
              setSectionOpen("training", open);
              if (!open) setEditingFormationId(null);
            }}
            visible={sectionIsVisible("training")}
            onVisibleChange={(visible) => setSectionVisible("training", visible)}
            count={cv.formations.length}
            onAdd={addForm}
          >
            <FormationWorkspace
              items={cv.formations}
              editingId={editingFormationId}
              labels={{
                date: ui.date,
                place: form.place,
                title: form.title,
                institution: form.institution,
                delete: form.delete,
              }}
              acquiredSkillsLabel={form.acquiredSkills}
              onEdit={setEditingFormationId}
              onUpdate={updateForm}
              onRemove={removeForm}
              isVisible={isVisible}
              onToggleVisibility={toggleVisibility}
              onAi={openAiField}
            />
          </CvSectionPanel>

          <CvSectionPanel
            id="education"
            fallbackTitle={form.education}
            appearance={appearanceFor("education")}
            onAppearanceChange={(appearance) => setAppearanceFor("education", appearance)}
            open={sectionIsOpen("education")}
            onOpenChange={(open) => {
              setSectionOpen("education", open);
              if (!open) setEditingEducationId(null);
            }}
            visible={sectionIsVisible("education")}
            onVisibleChange={(visible) => setSectionVisible("education", visible)}
            count={cv.educations.length}
            onAdd={addEdu}
          >
            <EducationWorkspace
              items={cv.educations}
              editingId={editingEducationId}
              labels={{
                date: ui.date,
                place: form.place,
                title: form.title,
                institution: form.institution,
                delete: form.delete,
              }}
              optionLabel={form.option}
              equivalenceLabel={form.equivalence}
              onEdit={setEditingEducationId}
              onUpdate={updateEdu}
              onRemove={removeEdu}
              isVisible={isVisible}
              onToggleVisibility={toggleVisibility}
              onAi={openAiField}
            />
          </CvSectionPanel>

          <CvSectionPanel
            id="volunteering"
            fallbackTitle={form.volunteering}
            appearance={appearanceFor("volunteering")}
            onAppearanceChange={(appearance) => setAppearanceFor("volunteering", appearance)}
            open={sectionIsOpen("volunteering")}
            onOpenChange={(open) => setSectionOpen("volunteering", open)}
            visible={sectionIsVisible("volunteering")}
            onVisibleChange={(visible) => setSectionVisible("volunteering", visible)}
            count={cv.participations.length}
          >
            <CvRichTextEditor
              value={cv.participations.join("\n")}
              format={richListEditorFormat(cv.participations, cv.participations_format)}
              onChange={(value, html) =>
                setRichListText(
                  "participations",
                  "participations_format",
                  "participations",
                  value,
                  html,
                )
              }
              onFormatChange={(format) => set("participations_format", format)}
              onAi={() =>
                openAiField(form.volunteering, cv.participations.join("\n"), (value) => {
                  const items = richListItemsFromText(value);
                  setRichListText(
                    "participations",
                    "participations_format",
                    "participations",
                    items.join("\n"),
                    richListHtml(items),
                  );
                })
              }
              defaultAlignment={language === "ar" ? "right" : "left"}
              maxLength={12_000}
              placeholder={`${form.volunteering} — une participation par ligne…`}
              contextLabel="participations professionnelles et bénévoles"
            />
            <p className="text-[11px] leading-relaxed text-slate-400">
              Une ligne correspond à une puce dans tous les modèles et dans le PDF ATS.
            </p>
          </CvSectionPanel>

          <CvSectionPanel
            id="certifications"
            fallbackTitle={form.certifications}
            appearance={appearanceFor("certifications")}
            onAppearanceChange={(appearance) => setAppearanceFor("certifications", appearance)}
            open={sectionIsOpen("certifications")}
            onOpenChange={(open) => setSectionOpen("certifications", open)}
            visible={sectionIsVisible("certifications")}
            onVisibleChange={(visible) => setSectionVisible("certifications", visible)}
            count={cv.certifications.length}
          >
            <CvRichTextEditor
              value={cv.certifications.join("\n")}
              format={richListEditorFormat(cv.certifications, cv.certifications_format)}
              onChange={(value, html) =>
                setRichListText(
                  "certifications",
                  "certifications_format",
                  "certifications",
                  value,
                  html,
                )
              }
              onFormatChange={(format) => set("certifications_format", format)}
              onAi={() =>
                openAiField(form.certifications, cv.certifications.join("\n"), (value) => {
                  const items = richListItemsFromText(value);
                  setRichListText(
                    "certifications",
                    "certifications_format",
                    "certifications",
                    items.join("\n"),
                    richListHtml(items),
                  );
                })
              }
              defaultAlignment={language === "ar" ? "right" : "left"}
              maxLength={12_000}
              placeholder={`${form.certifications} — une certification par ligne…`}
              contextLabel="certifications professionnelles"
            />
            <p className="text-[11px] leading-relaxed text-slate-400">
              Une ligne correspond à une puce dans tous les modèles et dans le PDF ATS.
            </p>
          </CvSectionPanel>

          <CvSectionPanel
            id="interests"
            fallbackTitle={form.interests}
            appearance={appearanceFor("interests")}
            onAppearanceChange={(appearance) => setAppearanceFor("interests", appearance)}
            open={sectionIsOpen("interests")}
            onOpenChange={(open) => setSectionOpen("interests", open)}
            visible={sectionIsVisible("interests")}
            onVisibleChange={(visible) => setSectionVisible("interests", visible)}
            count={cv.interets.length}
          >
            <CvRichTextEditor
              value={cv.interets.join("\n")}
              format={richListEditorFormat(cv.interets, cv.interets_format)}
              onChange={(value, html) =>
                setRichListText("interets", "interets_format", "interets", value, html)
              }
              onFormatChange={(format) => set("interets_format", format)}
              onAi={() =>
                openAiField(form.interests, cv.interets.join("\n"), (value) => {
                  const items = richListItemsFromText(value);
                  setRichListText(
                    "interets",
                    "interets_format",
                    "interets",
                    items.join("\n"),
                    richListHtml(items),
                  );
                })
              }
              defaultAlignment={language === "ar" ? "right" : "left"}
              maxLength={12_000}
              placeholder={`${form.interests} — un centre d’intérêt par ligne…`}
              contextLabel="centres d’intérêt"
            />
            <p className="text-[11px] leading-relaxed text-slate-400">
              Une ligne correspond à une puce dans tous les modèles et dans le PDF ATS.
            </p>
          </CvSectionPanel>

          <CvSectionPanel
            id="references"
            fallbackTitle={form.references}
            appearance={appearanceFor("references")}
            onAppearanceChange={(appearance) => setAppearanceFor("references", appearance)}
            open={sectionIsOpen("references")}
            onOpenChange={(open) => setSectionOpen("references", open)}
            visible={sectionIsVisible("references")}
            onVisibleChange={(visible) => setSectionVisible("references", visible)}
            count={cv.references.length}
            onAdd={() => set("references", [...cv.references, ""])}
          >
            <ListCard
              title={form.references}
              items={cv.references}
              onChange={(v) => set("references", v)}
              visibilityPrefix="references"
              isVisible={isVisible}
              onToggleVisibility={toggleVisibility}
              onRemoveVisibility={removeIndexedVisibility}
              language={language}
              onAiItem={(index, value) =>
                openAiField(`${form.references} ${index + 1}`, value, (nextValue) => {
                  const next = [...cv.references];
                  next[index] = nextValue.slice(0, 240);
                  set("references", next);
                })
              }
            />
          </CvSectionPanel>

          <CvSectionPanel
            id="letter"
            fallbackTitle={ui.letterTitle}
            appearance={appearanceFor("letter")}
            onAppearanceChange={(appearance) => setAppearanceFor("letter", appearance)}
            open={sectionIsOpen("letter") || documentKind === "cover-letter"}
            onOpenChange={(open) => setSectionOpen("letter", open)}
            visible={sectionIsVisible("letter")}
            onVisibleChange={(visible) => setSectionVisible("letter", visible)}
            count={cv.lettre_motivation.paragraphes.length}
            onAdd={() =>
              set("lettre_motivation", {
                ...cv.lettre_motivation,
                paragraphes: [...cv.lettre_motivation.paragraphes, ""],
              })
            }
          >
            <p className="text-xs text-muted-foreground">
              {documentKind === "cover-letter" ? ui.letterActive : ui.letterAnnex}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={ui.date}
                {...visibilityProps("letter.date")}
                {...aiFieldProps(ui.date, cv.lettre_motivation.date, (value) =>
                  set("lettre_motivation", { ...cv.lettre_motivation, date: value.slice(0, 80) }),
                )}
              >
                <Input
                  value={cv.lettre_motivation.date}
                  onChange={(e) =>
                    set("lettre_motivation", {
                      ...cv.lettre_motivation,
                      date: e.target.value.slice(0, 80),
                    })
                  }
                />
              </Field>
              <Field
                label={ui.recipient}
                {...visibilityProps("letter.destinataire")}
                {...aiFieldProps(ui.recipient, cv.lettre_motivation.destinataire, (value) =>
                  set("lettre_motivation", {
                    ...cv.lettre_motivation,
                    destinataire: value.slice(0, 160),
                  }),
                )}
              >
                <Input
                  value={cv.lettre_motivation.destinataire}
                  placeholder={form.recipientPlaceholder}
                  onChange={(e) =>
                    set("lettre_motivation", {
                      ...cv.lettre_motivation,
                      destinataire: e.target.value.slice(0, 160),
                    })
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <Field
                  label={ui.subject}
                  {...visibilityProps("letter.objet")}
                  {...aiFieldProps(ui.subject, cv.lettre_motivation.objet, (value) =>
                    set("lettre_motivation", {
                      ...cv.lettre_motivation,
                      objet: value.slice(0, 240),
                    }),
                  )}
                >
                  <Input
                    value={cv.lettre_motivation.objet}
                    onChange={(e) =>
                      set("lettre_motivation", {
                        ...cv.lettre_motivation,
                        objet: e.target.value.slice(0, 240),
                      })
                    }
                  />
                </Field>
              </div>
            </div>
            <Field
              label={ui.greeting}
              {...visibilityProps("letter.salutation")}
              {...aiFieldProps(ui.greeting, cv.lettre_motivation.salutation, (value) =>
                set("lettre_motivation", {
                  ...cv.lettre_motivation,
                  salutation: value.slice(0, 160),
                }),
              )}
            >
              <Input
                value={cv.lettre_motivation.salutation}
                placeholder={form.greetingPlaceholder}
                onChange={(e) =>
                  set("lettre_motivation", {
                    ...cv.lettre_motivation,
                    salutation: e.target.value.slice(0, 160),
                  })
                }
              />
            </Field>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-muted-foreground">{ui.paragraphs}</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    set("lettre_motivation", {
                      ...cv.lettre_motivation,
                      paragraphes: [...cv.lettre_motivation.paragraphes, ""],
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" /> {form.add}
                </Button>
              </div>
              {cv.lettre_motivation.paragraphes.map((paragraph, index) => (
                <div key={index} className="flex items-start gap-2">
                  <AiFieldButton
                    label={`${ui.paragraphs} ${index + 1}`}
                    onClick={() =>
                      openAiField(`${ui.paragraphs} ${index + 1}`, paragraph, (value) => {
                        const paragraphes = [...cv.lettre_motivation.paragraphes];
                        paragraphes[index] = value.slice(0, 1500);
                        set("lettre_motivation", { ...cv.lettre_motivation, paragraphes });
                      })
                    }
                  />
                  <VisibilityButton
                    label={`${ui.paragraphs} ${index + 1}`}
                    visible={isVisible(`letter.paragraphes.${index}`)}
                    onToggle={() => toggleVisibility(`letter.paragraphes.${index}`)}
                  />
                  <div
                    className={`min-w-0 flex-1 ${
                      isVisible(`letter.paragraphes.${index}`) ? "" : "opacity-55 grayscale-[20%]"
                    }`}
                  >
                    <Textarea
                      rows={3}
                      value={paragraph}
                      onChange={(e) => {
                        const paragraphes = [...cv.lettre_motivation.paragraphes];
                        paragraphes[index] = e.target.value.slice(0, 1500);
                        set("lettre_motivation", { ...cv.lettre_motivation, paragraphes });
                      }}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      removeIndexedVisibility("letter.paragraphes", index);
                      set("lettre_motivation", {
                        ...cv.lettre_motivation,
                        paragraphes: cv.lettre_motivation.paragraphes.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Field
              label={ui.closing}
              {...visibilityProps("letter.formule_politesse")}
              {...aiFieldProps(ui.closing, cv.lettre_motivation.formule_politesse, (value) =>
                set("lettre_motivation", {
                  ...cv.lettre_motivation,
                  formule_politesse: value.slice(0, 500),
                }),
              )}
            >
              <Textarea
                rows={2}
                value={cv.lettre_motivation.formule_politesse}
                onChange={(e) =>
                  set("lettre_motivation", {
                    ...cv.lettre_motivation,
                    formule_politesse: e.target.value.slice(0, 500),
                  })
                }
              />
            </Field>
          </CvSectionPanel>

          <CvSectionPanel
            id="development"
            fallbackTitle={ui.planTitle}
            appearance={appearanceFor("development")}
            onAppearanceChange={(appearance) => setAppearanceFor("development", appearance)}
            open={sectionIsOpen("development") || documentKind === "advises"}
            onOpenChange={(open) => setSectionOpen("development", open)}
            visible={sectionIsVisible("development")}
            onVisibleChange={(visible) => setSectionVisible("development", visible)}
            count={cv.plan_developpement.length}
            onAdd={() => set("plan_developpement", [...cv.plan_developpement, ""])}
          >
            <ListCard
              title={ui.planTitle}
              items={cv.plan_developpement}
              onChange={(v) => set("plan_developpement", v)}
              visibilityPrefix="plan_developpement"
              isVisible={isVisible}
              onToggleVisibility={toggleVisibility}
              onRemoveVisibility={removeIndexedVisibility}
              language={language}
              onAiItem={(index, value) =>
                openAiField(`${ui.planTitle} ${index + 1}`, value, (nextValue) => {
                  const next = [...cv.plan_developpement];
                  next[index] = nextValue.slice(0, 240);
                  set("plan_developpement", next);
                })
              }
            />
            <p className="mt-2 px-1 text-xs text-muted-foreground">
              {documentKind === "advises" ? ui.planActive : ui.planAnnex}
            </p>
          </CvSectionPanel>

          <HiddenSectionTray
            sections={[
              ["personal", ui.personal],
              ["objective", form.objective],
              ["experience", form.experience],
              ["training", form.training],
              ["education", form.education],
              ["skills", form.skills],
              ["languages", form.languages],
              ["volunteering", form.volunteering],
              ["certifications", form.certifications],
              ["interests", form.interests],
              ["references", form.references],
              ["letter", ui.letterTitle],
              ["development", ui.planTitle],
            ]
              .filter(([id]) => !sectionIsVisible(id))
              .map(([id, title]) => ({
                id,
                title,
                appearance: appearanceFor(id),
                onRestore: () => setSectionVisible(id, true),
              }))}
          />
        </section>

        {/* Preview */}
        {previewVisible && (
          <section
            id="pdf-preview-panel"
            className={`min-w-0 lg:sticky lg:top-20 lg:self-start ${
              previewFocusMode ? "lg:mx-auto lg:w-full lg:max-w-6xl" : ""
            }`}
          >
            <div className="relative min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-md shadow-slate-900/10">
              {isEuropassTemplate ? (
                <EuropassPreview
                  cv={outputCv}
                  language={language}
                  onExportAndOpen={exportAndOpenEuropass}
                />
              ) : pdfPreview ? (
                <PdfPreview
                  blob={pdfPreview.blob}
                  templateId={templateId}
                  documentKind={documentKind}
                  zoom={previewZoom}
                />
              ) : (
                <div className="flex min-h-[720px] items-center justify-center bg-white text-sm text-muted-foreground">
                  {ui.previewPreparing}
                </div>
              )}
              {!isEuropassTemplate && pdfLoading && pdfPreview && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/85 text-sm font-medium text-zinc-700 backdrop-blur-[1px]">
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> {ui.previewUpdating}
                </div>
              )}
              {!isEuropassTemplate && pdfError && (
                <div className="absolute inset-x-4 top-4 flex flex-wrap items-center justify-between gap-2 rounded-md bg-destructive px-3 py-2 text-sm text-destructive-foreground shadow">
                  <span>{pdfError}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setPdfError("");
                      setPdfRetryNonce((value) => value + 1);
                    }}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" /> Réessayer
                  </Button>
                </div>
              )}
              <PreviewControlDock
                templates={templates}
                templateId={templateId}
                onTemplateChange={(nextTemplateId) =>
                  setTemplateId(nextTemplateId as PdfTemplateId)
                }
                focusMode={previewFocusMode}
                onFocusModeChange={setPreviewFocusMode}
                sections={previewSections}
                onNavigateSection={navigateToEditorSection}
                onSectionVisibilityChange={setSectionVisible}
                onExpandAllSections={() => setAllEditorSectionsOpen(true)}
                onCollapseAllSections={() => setAllEditorSectionsOpen(false)}
                paletteColors={paletteColors}
                accentColor={accentColor}
                onAccentColorChange={(color) =>
                  setTemplateColors((current) => ({
                    ...current,
                    [themeTemplateId]: color,
                  }))
                }
                paletteDisabled={isEuropassTemplate}
                zoom={previewZoom}
                onZoomChange={setPreviewZoom}
                zoomDisabled={isEuropassTemplate}
              />
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {isEuropassTemplate
                ? "Le profil reste modifiable dans l’éditeur officiel après l’import du XML."
                : ui.exactPreview}
            </p>
          </section>
        )}
      </main>
      <AiSettingsDialog
        open={aiSettingsOpen}
        onOpenChange={setAiSettingsOpen}
        value={aiSettings}
        onSave={setAiSettings}
        canManageKeys={user.role === "admin"}
      />
      <PromptMasterDialog open={promptMasterOpen} onOpenChange={setPromptMasterOpen} />
      <AccountSettingsDialog
        open={accountSettingsOpen}
        onOpenChange={setAccountSettingsOpen}
        user={user}
        onSessionInvalidated={onLogout}
      />
      <AiFieldDialog
        request={aiFieldRequest}
        language={language}
        cv={cv}
        settings={aiSettings}
        onSettingsChange={setAiSettings}
        onClose={() => setAiFieldRequest(null)}
        onOpenSettings={() => setAiSettingsOpen(true)}
      />
      <AiImportAssistant
        open={aiAssistantOpen}
        onOpenChange={setAiAssistantOpen}
        language={language}
        settings={aiSettings}
        onSettingsChange={setAiSettings}
        onOpenSettings={() => setAiSettingsOpen(true)}
        onApply={(mappedCv) => {
          setCv({ ...mappedCv, photo: cv.photo });
          setHiddenElements({});
          setImportMessage({
            ok: true,
            text: `Assistant IA : données réparties dans le formulaire ${language.toUpperCase()}.`,
          });
        }}
      />
      <ClientDatabaseDialog
        open={clientDatabaseOpen}
        onOpenChange={setClientDatabaseOpen}
        activeProfileId={activeProfileId}
        onOpenProfile={openClientProfile}
        onDownloadPdf={downloadClientProfilePdf}
      />
      <ClientOrdersDialog
        open={clientOrdersOpen}
        onOpenChange={setClientOrdersOpen}
        onOpenJson={openClientOrderJson}
        activeOrderId={activeClientOrder?.id}
        onCreateCurrentDeliverable={createCurrentOrderDeliverable}
      />
    </div>
  );
}

function EuropassPreview({
  cv,
  language,
  onExportAndOpen,
}: {
  cv: CV;
  language: DocumentLanguage;
  onExportAndOpen: () => void;
}) {
  const coverage = analyzeEuropassCoverage(cv);
  const selectedLanguage = DOCUMENT_LANGUAGES.find((item) => item.id === language);
  const editorFallsBackToEnglish = language === "zh" || language === "ar";
  const visibleMissing = coverage.missing.slice(0, 4);

  return (
    <div className="min-h-[720px] bg-gradient-to-b from-[#eef3fb] to-white p-5 sm:p-8">
      <div className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-[#cbd8ee] bg-white shadow-xl shadow-[#173b73]/10">
        <div className="relative overflow-hidden bg-[#164194] px-6 py-7 text-white sm:px-8">
          <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full border-[18px] border-[#ffcc00]/20" />
          <div className="relative flex items-start justify-between gap-5">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#ffdf54]">
                <Globe2 className="h-4 w-4" /> Espace Europass
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight">CV Europass</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-blue-100">
                Le profil ZGR est préparé au format XML Candidate pour être repris dans l’éditeur
                officiel.
              </p>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 border-[#ffcc00] bg-[#103777] text-sm font-black text-[#ffdf54] shadow-lg">
              EU
            </div>
          </div>
        </div>

        <div className="space-y-6 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              {cv.photo?.dataUrl && (
                <img
                  src={cv.photo.dataUrl}
                  alt="Photo du profil Europass"
                  className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 bg-white object-cover"
                />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Profil actif
                </p>
                <p className="mt-1 truncate font-bold text-slate-900" dir="auto">
                  {cv.nom_complet || "Profil sans nom"}
                </p>
                {cv.titre_poste && (
                  <p className="mt-0.5 truncate text-xs text-slate-600" dir="auto">
                    {cv.titre_poste}
                  </p>
                )}
              </div>
            </div>
            <div className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#164194]">
              {selectedLanguage?.name || language.toUpperCase()} · {language.toUpperCase()}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-slate-900">Données prêtes pour Europass</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {coverage.mapped.length} groupes renseignés sur{" "}
                  {coverage.mapped.length + coverage.missing.length}
                </p>
              </div>
              <span className="text-2xl font-black text-[#164194]">{coverage.percent}%</span>
            </div>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-label="Couverture des données Europass"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={coverage.percent}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#164194] to-[#2d72d9] transition-[width]"
                style={{ width: `${coverage.percent}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              [cv.experiences.length, "Expériences"],
              [cv.educations.length + cv.formations.length, "Études"],
              [Object.values(cv.langues).filter(Boolean).length, "Langues"],
            ].map(([value, label]) => (
              <div key={String(label)} className="rounded-xl border border-slate-200 px-2 py-3">
                <p className="text-xl font-black text-[#164194]">{value}</p>
                <p className="mt-1 text-[11px] font-medium text-slate-500">{label}</p>
              </div>
            ))}
          </div>

          {visibleMissing.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950">
              <span className="font-bold">À compléter dans Europass :</span>{" "}
              {visibleMissing.join(", ")}
              {coverage.missing.length > visibleMissing.length ? "…" : "."}
            </div>
          )}

          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4">
            <div className="flex gap-3">
              <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#164194]" />
              <div className="text-xs leading-5 text-slate-700">
                <p className="font-bold text-slate-900">Une seule action</p>
                <p className="mt-1">
                  Le bouton télécharge le XML {language.toUpperCase()} puis ouvre Europass. Dans la
                  fenêtre officielle, choisissez le fichier qui vient d’être téléchargé pour charger
                  le profil.
                </p>
                {editorFallsBackToEnglish && (
                  <p className="mt-2 font-medium text-amber-800">
                    L’interface Europass s’ouvrira en anglais, car elle n’est pas proposée en
                    {language === "ar" ? " arabe" : " chinois"}. Les données exportées proviennent
                    bien du formulaire {language.toUpperCase()}.
                  </p>
                )}
              </div>
            </div>
          </div>

          <Button
            type="button"
            size="lg"
            className="h-auto w-full bg-[#164194] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-900/15 hover:bg-[#103777]"
            onClick={onExportAndOpen}
          >
            <FileCode className="mr-2 h-5 w-5" />
            Télécharger le XML {language.toUpperCase()} et ouvrir Europass
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>

          <p className="text-center text-[11px] leading-4 text-slate-500">
            Le navigateur protège le téléversement entre deux sites : la sélection du XML dans
            Europass reste la seule étape manuelle.
          </p>
        </div>
      </div>
    </div>
  );
}

function PdfPreview({
  blob,
  templateId,
  documentKind,
  zoom,
}: {
  blob: Blob;
  templateId: PdfTemplateId;
  documentKind: DocumentKind;
  zoom: number;
}) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  const [rendering, setRendering] = useState(true);
  const [renderError, setRenderError] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [sha256, setSha256] = useState("");

  useEffect(() => {
    zoomRef.current = zoom;
    const pages = pagesRef.current?.querySelectorAll<HTMLCanvasElement>("canvas[data-base-width]");
    pages?.forEach((canvas) => {
      const baseWidth = Number(canvas.dataset.baseWidth);
      const baseHeight = Number(canvas.dataset.baseHeight);
      if (!Number.isFinite(baseWidth) || !Number.isFinite(baseHeight)) return;
      canvas.style.width = `${((baseWidth * zoom) / 100).toFixed(2)}px`;
      canvas.style.height = `${((baseHeight * zoom) / 100).toFixed(2)}px`;
    });
  }, [zoom]);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: { destroy: () => Promise<void> } | null = null;
    const renderTasks: Array<{ cancel: () => void; promise: Promise<void> }> = [];

    const renderPdf = async () => {
      setRendering(true);
      setRenderError("");

      try {
        const [pdfjs, workerModule] = await Promise.all([
          import("pdfjs-dist"),
          import("pdfjs-dist/build/pdf.worker.min.mjs?raw"),
        ]);
        if (!pdfWorkerUrl) {
          pdfWorkerUrl = URL.createObjectURL(
            new Blob([workerModule.default], { type: "text/javascript" }),
          );
        }
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

        const buffer = await blob.arrayBuffer();
        const digest = await crypto.subtle.digest("SHA-256", buffer.slice(0));
        const hash = Array.from(new Uint8Array(digest))
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("");

        const task = pdfjs.getDocument({ data: new Uint8Array(buffer) });
        loadingTask = task;
        const document = await task.promise;
        if (cancelled || !pagesRef.current) return;

        setSha256(hash);
        setPageCount(document.numPages);
        pagesRef.current.replaceChildren();

        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          const page = await document.getPage(pageNumber);
          if (cancelled || !pagesRef.current) return;

          const baseViewport = page.getViewport({ scale: 1 });
          const cssWidth = 794;
          const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
          const viewport = page.getViewport({
            scale: (cssWidth / baseViewport.width) * pixelRatio,
          });
          const canvas = window.document.createElement("canvas");
          const context = canvas.getContext("2d", { alpha: false });
          if (!context) throw new Error("Canvas 2D indisponible.");

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const cssHeight = viewport.height / pixelRatio;
          canvas.dataset.baseWidth = String(cssWidth);
          canvas.dataset.baseHeight = String(cssHeight);
          canvas.style.width = `${((cssWidth * zoomRef.current) / 100).toFixed(2)}px`;
          canvas.style.height = `${((cssHeight * zoomRef.current) / 100).toFixed(2)}px`;
          canvas.className = "block rounded-md bg-white shadow-lg ring-1 ring-black/10";
          canvas.setAttribute("aria-label", `Page ${pageNumber} sur ${document.numPages}`);
          pagesRef.current.appendChild(canvas);

          const renderTask = page.render({ canvas, canvasContext: context, viewport });
          renderTasks.push(renderTask);
          await renderTask.promise;
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setRenderError("Le PDF a été généré, mais son aperçu n’a pas pu être affiché.");
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    };

    void renderPdf();

    return () => {
      cancelled = true;
      renderTasks.forEach((task) => task.cancel());
      void loadingTask?.destroy();
    };
  }, [blob]);

  return (
    <div
      aria-label="Aperçu exact du PDF"
      data-pdf-bytes={blob.size}
      data-pdf-pages={pageCount || undefined}
      data-pdf-sha256={sha256 || undefined}
      data-template-id={templateId}
      data-document-kind={documentKind}
      data-preview-zoom={zoom}
      className="relative h-[calc(100vh-12.5rem)] min-h-[560px] w-full min-w-0 max-w-full overflow-auto bg-slate-50 p-4"
      style={{
        backgroundImage: "radial-gradient(#d9e2ec 0.7px, transparent 0.7px)",
        backgroundSize: "18px 18px",
      }}
    >
      <div ref={pagesRef} className="mx-auto flex w-max min-w-full flex-col items-center gap-4" />
      {rendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/85 text-sm font-medium text-zinc-700 backdrop-blur-[1px]">
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Rendu du PDF réel…
        </div>
      )}
      {renderError && (
        <div className="absolute inset-x-4 top-4 rounded-md bg-destructive px-3 py-2 text-sm text-destructive-foreground shadow">
          {renderError}
        </div>
      )}
    </div>
  );
}

function VisibilityButton({
  label,
  visible,
  onToggle,
}: {
  label: string;
  visible: boolean;
  onToggle: () => void;
}) {
  const action = visible ? `Masquer ${label}` : `Afficher ${label}`;
  return (
    <button
      type="button"
      aria-label={action}
      aria-pressed={!visible}
      title={action}
      onClick={onToggle}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
        visible
          ? "border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground"
          : "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
      }`}
    >
      {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
    </button>
  );
}

function Field({
  label,
  children,
  visible = true,
  onToggleVisibility,
  onAi,
}: {
  label: string;
  children: React.ReactNode;
  visible?: boolean;
  onToggleVisibility?: () => void;
  onAi?: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
        <div className="flex items-center gap-1">
          {onAi && <AiFieldButton label={label} onClick={onAi} />}
          {onToggleVisibility && (
            <VisibilityButton label={label} visible={visible} onToggle={onToggleVisibility} />
          )}
        </div>
      </div>
      <div className={visible ? undefined : "opacity-55 grayscale-[20%]"}>{children}</div>
    </div>
  );
}

function AiFieldButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Améliorer ${label} avec l’IA`}
      title={`Améliorer ${label} avec l’IA`}
      onClick={onClick}
      className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md border border-violet-200 bg-violet-50 px-1.5 text-[10px] font-bold text-violet-700 transition-colors hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1"
    >
      <Sparkles className="mr-0.5 h-3 w-3" /> AI
    </button>
  );
}

function ListCard({
  title,
  items,
  onChange,
  visibilityPrefix,
  isVisible,
  onToggleVisibility,
  onRemoveVisibility,
  language = "fr",
  onAiItem,
}: {
  title: string;
  items: string[];
  onChange: (v: string[]) => void;
  visibilityPrefix: string;
  isVisible: (path: string) => boolean;
  onToggleVisibility: (path: string) => void;
  onRemoveVisibility: (prefix: string, index: number) => void;
  language?: DocumentLanguage;
  onAiItem?: (index: number, value: string) => void;
}) {
  const copy = FORM_COPY.fr;
  return (
    <div className="space-y-4">
      {items.length === 0 && <p className="text-sm text-muted-foreground">{copy.noItems}</p>}
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2">
            {onAiItem && (
              <AiFieldButton label={`${title} ${i + 1}`} onClick={() => onAiItem(i, it)} />
            )}
            <VisibilityButton
              label={`${title} ${i + 1}`}
              visible={isVisible(`${visibilityPrefix}.${i}`)}
              onToggle={() => onToggleVisibility(`${visibilityPrefix}.${i}`)}
            />
            <div
              className={`min-w-0 flex-1 ${
                isVisible(`${visibilityPrefix}.${i}`) ? "" : "opacity-55 grayscale-[20%]"
              }`}
            >
              <Input
                value={it}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = e.target.value.slice(0, 240);
                  onChange(next);
                }}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                onRemoveVisibility(visibilityPrefix, i);
                onChange(items.filter((_, j) => j !== i));
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Index;
