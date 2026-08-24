import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
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
  LogOut,
  UserCog,
  BookOpenText,
} from "lucide-react";
import * as pdfjs from "pdfjs-dist";
import pdfWorkerSource from "pdfjs-dist/build/pdf.worker.min.mjs?raw";
import {
  type CV,
  type Experience,
  type Formation,
  type Education,
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
import { AdminLogin } from "@/components/admin-login";
import { AccountSettingsDialog } from "@/components/account-settings-dialog";
import { PromptMasterDialog } from "@/components/prompt-master-dialog";
import {
  clearAdminSession,
  getCurrentUser,
  subscribeToSessionChanges,
  verifyAdminSession,
  type SessionUser,
} from "@/lib/auth-client";
import {
  getClientProfile,
  newClientProfileId,
  saveClientProfile,
  type ClientProfile,
} from "@/lib/client-profile-db";

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
const LANGUAGE_VISUALS: Record<DocumentLanguage, { color: string }> = {
  fr: { color: "from-blue-500 to-indigo-600" },
  en: { color: "from-sky-500 to-blue-600" },
  es: { color: "from-amber-400 to-red-500" },
  de: { color: "from-zinc-700 to-amber-500" },
  it: { color: "from-emerald-500 to-red-500" },
  zh: { color: "from-red-500 to-amber-400" },
  ar: { color: "from-emerald-500 to-emerald-700" },
};
const PDF_WORKER_URL = URL.createObjectURL(
  new Blob([pdfWorkerSource], { type: "text/javascript" }),
);

pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;

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
    downloadPackHint: "84 PDF · 12 modèles × 7 langues",
    preparingPack: "Création du pack",
    packReady: "Pack multilingue téléchargé : 84 PDF dans 7 langues.",
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
    downloadPackHint: "84 PDFs · 12 templates × 7 languages",
    preparingPack: "Building pack",
    packReady: "Multilingual pack downloaded: 84 PDFs in 7 languages.",
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
    const validate = () => {
      void verifyAdminSession().then((user) => {
        if (active) setAuthUser(user);
      });
    };
    const unsubscribe = subscribeToSessionChanges((user) => {
      if (!active) return;
      setAuthUser(user);
    });
    const validationTimer = window.setTimeout(validate, 150);
    return () => {
      active = false;
      window.clearTimeout(validationTimer);
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
  const [loaded, setLoaded] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<{ blob: Blob; url: string; key: string } | null>(
    null,
  );
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState("");
  const [packLoading, setPackLoading] = useState(false);
  const [packProgress, setPackProgress] = useState({ completed: 0, total: 84 });
  const [packMessage, setPackMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [importMessage, setImportMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [aiSettings, setAiSettings] = useState<AiSettings>(() => defaultAiSettings());
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [promptMasterOpen, setPromptMasterOpen] = useState(false);
  const [aiFieldRequest, setAiFieldRequest] = useState<AiFieldRequest | null>(null);
  const [clientDatabaseOpen, setClientDatabaseOpen] = useState(false);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const pdfUrlRef = useRef<string | null>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const cv = cvByLanguage[language];
  const templates = getTemplates(documentKind);
  const themeTemplateId = templateId as ThemeTemplateId;
  const accentColor = templateColors[themeTemplateId];
  const paletteColors = paletteForTemplate(themeTemplateId);
  // Language buttons translate only the form values and the generated document.
  // The application shell deliberately remains in French for a stable workflow.
  const ui = { ...UI_COPY.fr, ...INTERFACE_COPY.fr };
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
            setTemplateId(settings.templateId);
          }
        } catch {
          if (getTemplates("cv").some((template) => template.id === savedTemplate)) {
            setTemplateId(savedTemplate as PdfTemplateId);
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
    let cancelled = false;
    setPdfLoading(true);
    setPdfError("");

    const timeout = window.setTimeout(async () => {
      try {
        const blob = await createDocumentPdfBlob(
          outputCv,
          documentKind,
          templateId,
          language,
          accentColor,
        );
        if (cancelled) return;

        const url = URL.createObjectURL(blob);
        if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = url;
        setPdfPreview({ blob, url, key: cvKey });
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setPdfError(ui.previewError);
        }
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [accentColor, cvKey, documentKind, language, outputCv, templateId, ui.previewError]);

  useEffect(
    () => () => {
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    },
    [],
  );

  const set = <K extends keyof CV>(k: K, v: CV[K]) => setCv((c) => ({ ...c, [k]: v }));
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
  const addExp = () =>
    setCv((c) => ({
      ...c,
      experiences: [
        ...c.experiences,
        { id: newId(), dates: "", lieu: "", titre: "", employeur: "", descriptions: [""] },
      ],
    }));
  const updateExp = (id: string, patch: Partial<Experience>) =>
    setCv((c) => ({
      ...c,
      experiences: c.experiences.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  const removeExp = (id: string, index: number) => {
    removeIndexedVisibility("experience", index);
    setCv((c) => ({ ...c, experiences: c.experiences.filter((e) => e.id !== id) }));
  };

  // formations
  const addForm = () =>
    setCv((c) => ({
      ...c,
      formations: [
        ...c.formations,
        { id: newId(), date: "", lieu: "", titre: "", institution: "", competences: "" },
      ],
    }));
  const updateForm = (id: string, patch: Partial<Formation>) =>
    setCv((c) => ({
      ...c,
      formations: c.formations.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  const removeForm = (id: string, index: number) => {
    removeIndexedVisibility("formation", index);
    setCv((c) => ({ ...c, formations: c.formations.filter((f) => f.id !== id) }));
  };

  // educations
  const addEdu = () =>
    setCv((c) => ({
      ...c,
      educations: [
        ...c.educations,
        {
          id: newId(),
          date: "",
          lieu: "",
          titre: "",
          institution: "",
          option: "",
          equivalence: "",
        },
      ],
    }));
  const updateEdu = (id: string, patch: Partial<Education>) =>
    setCv((c) => ({
      ...c,
      educations: c.educations.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  const removeEdu = (id: string, index: number) => {
    removeIndexedVisibility("education", index);
    setCv((c) => ({ ...c, educations: c.educations.filter((e) => e.id !== id) }));
  };

  const reset = () => {
    if (confirm(ui.resetConfirm)) {
      setCv(emptyCV);
      setHiddenElements({});
      setActiveProfileId(null);
    }
  };
  const loadSample = () => {
    setCv(sampleCVByLanguage[language]);
    setHiddenElements({});
    setActiveProfileId(null);
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
      if (file.size > 5_000_000) throw new Error("Le fichier JSON dépasse la limite de 5 Mo.");
      const parsed = JSON.parse(await file.text()) as unknown;
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
      setCvByLanguage(next);
      setHiddenElements({});
      setActiveProfileId(null);
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
      setActiveProfileId(id);
      setImportMessage({
        ok: true,
        text: `${existing ? "Profil mis à jour" : "Nouveau profil sauvegardé"} : ${profile.name} · ID ${id}`,
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
    setTemplateId(profile.templateId);
    setTemplateColors(structuredClone(profile.templateColors));
    setActiveProfileId(profile.id);
    setImportMessage({
      ok: true,
      text: `Profil ouvert : ${profile.name} · ID ${profile.id}`,
    });
  };

  const downloadClientProfilePdf = async (profile: ClientProfile) => {
    const profileCv = applyCvVisibility(
      profile.cvByLanguage[profile.language],
      profile.hiddenElements,
    );
    const color = profile.templateColors[profile.templateId as ThemeTemplateId];
    const blob = await createDocumentPdfBlob(
      profileCv,
      profile.documentKind,
      profile.templateId,
      profile.language,
      color,
    );
    downloadPdfDocument(blob, profileCv, profile.documentKind, profile.language);
  };

  const downloadCompletePack = async () => {
    if (packLoading) return;
    setPackLoading(true);
    setPackProgress({ completed: 0, total: 84 });
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
    setPackProgress({ completed: 0, total: DOCUMENT_LANGUAGES.length });
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
      setPackMessage({ ok: true, text: ui.currentPackReady });
    } catch (error) {
      console.error(error);
      setPackMessage({ ok: false, text: ui.packError });
    } finally {
      setPackLoading(false);
    }
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
              accept=".json,application/json"
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
              variant="ghost"
              size="icon"
              aria-label="Se déconnecter"
              title="Se déconnecter"
              onClick={onLogout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  disabled={pdfLoading || packLoading || !pdfPreview || pdfPreview.key !== cvKey}
                  aria-label={ui.downloadPdf}
                >
                  {pdfLoading || packLoading ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  {packLoading
                    ? `${ui.preparingPack} ${packProgress.completed}/${packProgress.total}`
                    : pdfLoading
                      ? ui.preparingPdf
                      : ui.downloadPdf}
                  {!pdfLoading && !packLoading && <ChevronDown className="ml-2 h-3.5 w-3.5" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuItem
                  disabled={!pdfPreview || pdfPreview.key !== cvKey}
                  onSelect={() => void downloadCurrentMultilingual()}
                  className="items-start py-2.5"
                >
                  <FileDown className="mt-0.5" />
                  <span className="flex flex-col">
                    <span className="font-medium">{ui.downloadCurrent}</span>
                    <span className="text-xs text-muted-foreground">{ui.downloadCurrentHint}</span>
                  </span>
                </DropdownMenuItem>
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

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-7 lg:grid-cols-2">
        {/* Form */}
        <section className="zgr-editor-panel space-y-6">
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {ui.personal}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
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
          </Card>

          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {form.objective}
              </h2>
              <div className="flex items-center gap-1">
                <AiFieldButton
                  label={form.objective}
                  onClick={() =>
                    openAiField(form.objective, cv.objectif, (value) =>
                      set("objectif", value.slice(0, 800)),
                    )
                  }
                />
                <VisibilityButton
                  label={form.objective}
                  visible={isVisible("objective")}
                  onToggle={() => toggleVisibility("objective")}
                />
              </div>
            </div>
            <div className={isVisible("objective") ? "" : "opacity-55 grayscale-[20%]"}>
              <Textarea
                rows={3}
                value={cv.objectif}
                onChange={(e) => set("objectif", e.target.value.slice(0, 800))}
              />
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {form.skills}
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {cv.competences.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <AiFieldButton
                    label={`${form.skill} ${i + 1}`}
                    onClick={() =>
                      openAiField(`${form.skill} ${i + 1}`, c, (value) => {
                        const next = [...cv.competences];
                        next[i] = value.slice(0, 120);
                        set("competences", next);
                      })
                    }
                  />
                  <VisibilityButton
                    label={`${form.skill} ${i + 1}`}
                    visible={isVisible(`skills.${i}`)}
                    onToggle={() => toggleVisibility(`skills.${i}`)}
                  />
                  <div
                    className={`min-w-0 flex-1 ${
                      isVisible(`skills.${i}`) ? "" : "opacity-55 grayscale-[20%]"
                    }`}
                  >
                    <Input
                      value={c}
                      placeholder={`${form.skill} ${i + 1}`}
                      onChange={(e) => {
                        const next = [...cv.competences];
                        next[i] = e.target.value.slice(0, 120);
                        set("competences", next);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => set("competences", [...cv.competences, ""])}
              >
                <Plus className="mr-2 h-4 w-4" /> {form.add}
              </Button>
              {cv.competences.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    removeIndexedVisibility("skills", cv.competences.length - 1);
                    set("competences", cv.competences.slice(0, -1));
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> {form.remove}
                </Button>
              )}
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {form.languages}
            </h2>
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
          </Card>

          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {form.experience}
              </h2>
              <Button size="sm" variant="outline" onClick={addExp}>
                <Plus className="mr-2 h-4 w-4" /> {form.add}
              </Button>
            </div>
            {cv.experiences.map((e, experienceIndex) => (
              <div key={e.id} className="rounded-md border p-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label={form.dates}
                    {...visibilityProps(`experience.${experienceIndex}.dates`)}
                    {...aiFieldProps(form.dates, e.dates, (value) =>
                      updateExp(e.id, { dates: value.slice(0, 40) }),
                    )}
                  >
                    <Input
                      value={e.dates}
                      onChange={(ev) => updateExp(e.id, { dates: ev.target.value.slice(0, 40) })}
                    />
                  </Field>
                  <Field
                    label={form.place}
                    {...visibilityProps(`experience.${experienceIndex}.lieu`)}
                    {...aiFieldProps(form.place, e.lieu, (value) =>
                      updateExp(e.id, { lieu: value.slice(0, 80) }),
                    )}
                  >
                    <Input
                      value={e.lieu}
                      onChange={(ev) => updateExp(e.id, { lieu: ev.target.value.slice(0, 80) })}
                    />
                  </Field>
                  <Field
                    label={form.title}
                    {...visibilityProps(`experience.${experienceIndex}.titre`)}
                    {...aiFieldProps(form.title, e.titre, (value) =>
                      updateExp(e.id, { titre: value.slice(0, 120) }),
                    )}
                  >
                    <Input
                      value={e.titre}
                      onChange={(ev) => updateExp(e.id, { titre: ev.target.value.slice(0, 120) })}
                    />
                  </Field>
                  <Field
                    label={form.employer}
                    {...visibilityProps(`experience.${experienceIndex}.employeur`)}
                    {...aiFieldProps(form.employer, e.employeur, (value) =>
                      updateExp(e.id, { employeur: value.slice(0, 120) }),
                    )}
                  >
                    <Input
                      value={e.employeur}
                      onChange={(ev) =>
                        updateExp(e.id, { employeur: ev.target.value.slice(0, 120) })
                      }
                    />
                  </Field>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    {form.achievements}
                  </Label>
                  {e.descriptions.map((d, i) => (
                    <div key={i} className="flex gap-2">
                      <AiFieldButton
                        label={`${form.achievements} ${i + 1}`}
                        onClick={() =>
                          openAiField(`${form.achievements} ${i + 1}`, d, (value) => {
                            const next = [...e.descriptions];
                            next[i] = value.slice(0, 300);
                            updateExp(e.id, { descriptions: next });
                          })
                        }
                      />
                      <VisibilityButton
                        label={`${form.achievements} ${i + 1}`}
                        visible={isVisible(`experience.${experienceIndex}.description.${i}`)}
                        onToggle={() =>
                          toggleVisibility(`experience.${experienceIndex}.description.${i}`)
                        }
                      />
                      <div
                        className={`min-w-0 flex-1 ${
                          isVisible(`experience.${experienceIndex}.description.${i}`)
                            ? ""
                            : "opacity-55 grayscale-[20%]"
                        }`}
                      >
                        <Input
                          value={d}
                          onChange={(ev) => {
                            const next = [...e.descriptions];
                            next[i] = ev.target.value.slice(0, 300);
                            updateExp(e.id, { descriptions: next });
                          }}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          removeIndexedVisibility(`experience.${experienceIndex}.description`, i);
                          updateExp(e.id, {
                            descriptions: e.descriptions.filter((_, j) => j !== i),
                          });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateExp(e.id, { descriptions: [...e.descriptions, ""] })}
                  >
                    <Plus className="mr-2 h-4 w-4" /> {form.addLine}
                  </Button>
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeExp(e.id, experienceIndex)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> {form.delete}
                  </Button>
                </div>
              </div>
            ))}
          </Card>

          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {form.training}
              </h2>
              <Button size="sm" variant="outline" onClick={addForm}>
                <Plus className="mr-2 h-4 w-4" /> {form.add}
              </Button>
            </div>
            {cv.formations.map((f, formationIndex) => (
              <div key={f.id} className="rounded-md border p-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label={ui.date}
                    {...visibilityProps(`formation.${formationIndex}.date`)}
                    {...aiFieldProps(ui.date, f.date, (value) =>
                      updateForm(f.id, { date: value.slice(0, 40) }),
                    )}
                  >
                    <Input
                      value={f.date}
                      onChange={(ev) => updateForm(f.id, { date: ev.target.value.slice(0, 40) })}
                    />
                  </Field>
                  <Field
                    label={form.place}
                    {...visibilityProps(`formation.${formationIndex}.lieu`)}
                    {...aiFieldProps(form.place, f.lieu, (value) =>
                      updateForm(f.id, { lieu: value.slice(0, 80) }),
                    )}
                  >
                    <Input
                      value={f.lieu}
                      onChange={(ev) => updateForm(f.id, { lieu: ev.target.value.slice(0, 80) })}
                    />
                  </Field>
                  <Field
                    label={form.title}
                    {...visibilityProps(`formation.${formationIndex}.titre`)}
                    {...aiFieldProps(form.title, f.titre, (value) =>
                      updateForm(f.id, { titre: value.slice(0, 120) }),
                    )}
                  >
                    <Input
                      value={f.titre}
                      onChange={(ev) => updateForm(f.id, { titre: ev.target.value.slice(0, 120) })}
                    />
                  </Field>
                  <Field
                    label={form.institution}
                    {...visibilityProps(`formation.${formationIndex}.institution`)}
                    {...aiFieldProps(form.institution, f.institution, (value) =>
                      updateForm(f.id, { institution: value.slice(0, 120) }),
                    )}
                  >
                    <Input
                      value={f.institution}
                      onChange={(ev) =>
                        updateForm(f.id, { institution: ev.target.value.slice(0, 120) })
                      }
                    />
                  </Field>
                </div>
                <Field
                  label={form.acquiredSkills}
                  {...visibilityProps(`formation.${formationIndex}.competences`)}
                  {...aiFieldProps(form.acquiredSkills, f.competences, (value) =>
                    updateForm(f.id, { competences: value.slice(0, 400) }),
                  )}
                >
                  <Textarea
                    rows={2}
                    value={f.competences}
                    onChange={(ev) =>
                      updateForm(f.id, { competences: ev.target.value.slice(0, 400) })
                    }
                  />
                </Field>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeForm(f.id, formationIndex)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> {form.delete}
                  </Button>
                </div>
              </div>
            ))}
          </Card>

          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {form.education}
              </h2>
              <Button size="sm" variant="outline" onClick={addEdu}>
                <Plus className="mr-2 h-4 w-4" /> {form.add}
              </Button>
            </div>
            {cv.educations.map((e, educationIndex) => (
              <div key={e.id} className="rounded-md border p-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label={ui.date}
                    {...visibilityProps(`education.${educationIndex}.date`)}
                    {...aiFieldProps(ui.date, e.date, (value) =>
                      updateEdu(e.id, { date: value.slice(0, 40) }),
                    )}
                  >
                    <Input
                      value={e.date}
                      onChange={(ev) => updateEdu(e.id, { date: ev.target.value.slice(0, 40) })}
                    />
                  </Field>
                  <Field
                    label={form.place}
                    {...visibilityProps(`education.${educationIndex}.lieu`)}
                    {...aiFieldProps(form.place, e.lieu, (value) =>
                      updateEdu(e.id, { lieu: value.slice(0, 80) }),
                    )}
                  >
                    <Input
                      value={e.lieu}
                      onChange={(ev) => updateEdu(e.id, { lieu: ev.target.value.slice(0, 80) })}
                    />
                  </Field>
                  <Field
                    label={form.title}
                    {...visibilityProps(`education.${educationIndex}.titre`)}
                    {...aiFieldProps(form.title, e.titre, (value) =>
                      updateEdu(e.id, { titre: value.slice(0, 120) }),
                    )}
                  >
                    <Input
                      value={e.titre}
                      onChange={(ev) => updateEdu(e.id, { titre: ev.target.value.slice(0, 120) })}
                    />
                  </Field>
                  <Field
                    label={form.institution}
                    {...visibilityProps(`education.${educationIndex}.institution`)}
                    {...aiFieldProps(form.institution, e.institution, (value) =>
                      updateEdu(e.id, { institution: value.slice(0, 120) }),
                    )}
                  >
                    <Input
                      value={e.institution}
                      onChange={(ev) =>
                        updateEdu(e.id, { institution: ev.target.value.slice(0, 120) })
                      }
                    />
                  </Field>
                  <Field
                    label={form.option}
                    {...visibilityProps(`education.${educationIndex}.option`)}
                    {...aiFieldProps(form.option, e.option, (value) =>
                      updateEdu(e.id, { option: value.slice(0, 120) }),
                    )}
                  >
                    <Input
                      value={e.option}
                      onChange={(ev) => updateEdu(e.id, { option: ev.target.value.slice(0, 120) })}
                    />
                  </Field>
                  <Field
                    label={form.equivalence}
                    {...visibilityProps(`education.${educationIndex}.equivalence`)}
                    {...aiFieldProps(form.equivalence, e.equivalence, (value) =>
                      updateEdu(e.id, { equivalence: value.slice(0, 200) }),
                    )}
                  >
                    <Input
                      value={e.equivalence}
                      onChange={(ev) =>
                        updateEdu(e.id, { equivalence: ev.target.value.slice(0, 200) })
                      }
                    />
                  </Field>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => removeEdu(e.id, educationIndex)}>
                    <Trash2 className="mr-2 h-4 w-4" /> {form.delete}
                  </Button>
                </div>
              </div>
            ))}
          </Card>

          <ListCard
            title={form.volunteering}
            items={cv.participations}
            onChange={(v) => set("participations", v)}
            visibilityPrefix="participations"
            isVisible={isVisible}
            onToggleVisibility={toggleVisibility}
            onRemoveVisibility={removeIndexedVisibility}
            language={language}
            onAiItem={(index, value) =>
              openAiField(`${form.volunteering} ${index + 1}`, value, (nextValue) => {
                const next = [...cv.participations];
                next[index] = nextValue.slice(0, 240);
                set("participations", next);
              })
            }
          />
          <ListCard
            title={form.certifications}
            items={cv.certifications}
            onChange={(v) => set("certifications", v)}
            visibilityPrefix="certifications"
            isVisible={isVisible}
            onToggleVisibility={toggleVisibility}
            onRemoveVisibility={removeIndexedVisibility}
            language={language}
            onAiItem={(index, value) =>
              openAiField(`${form.certifications} ${index + 1}`, value, (nextValue) => {
                const next = [...cv.certifications];
                next[index] = nextValue.slice(0, 240);
                set("certifications", next);
              })
            }
          />
          <ListCard
            title={form.interests}
            items={cv.interets}
            onChange={(v) => set("interets", v)}
            visibilityPrefix="interets"
            isVisible={isVisible}
            onToggleVisibility={toggleVisibility}
            onRemoveVisibility={removeIndexedVisibility}
            language={language}
            onAiItem={(index, value) =>
              openAiField(`${form.interests} ${index + 1}`, value, (nextValue) => {
                const next = [...cv.interets];
                next[index] = nextValue.slice(0, 240);
                set("interets", next);
              })
            }
          />
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

          <Card
            className={`p-5 space-y-4 ${documentKind === "cover-letter" ? "ring-2 ring-primary/30" : ""}`}
          >
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {ui.letterTitle}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {documentKind === "cover-letter" ? ui.letterActive : ui.letterAnnex}
              </p>
            </div>
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
          </Card>

          <div className={documentKind === "advises" ? "rounded-md ring-2 ring-primary/30" : ""}>
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
          </div>
        </section>

        {/* Preview */}
        <section className="lg:sticky lg:top-20 lg:self-start">
          <div className="relative overflow-hidden rounded-md bg-zinc-200 shadow-md ring-1 ring-zinc-300">
            {pdfPreview ? (
              <PdfPreview
                blob={pdfPreview.blob}
                templateId={templateId}
                documentKind={documentKind}
              />
            ) : (
              <div className="flex min-h-[720px] items-center justify-center bg-white text-sm text-muted-foreground">
                {ui.previewPreparing}
              </div>
            )}
            {pdfLoading && pdfPreview && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/85 text-sm font-medium text-zinc-700 backdrop-blur-[1px]">
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> {ui.previewUpdating}
              </div>
            )}
            {pdfError && (
              <div className="absolute inset-x-4 top-4 rounded-md bg-destructive px-3 py-2 text-sm text-destructive-foreground shadow">
                {pdfError}
              </div>
            )}
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">{ui.exactPreview}</p>
        </section>
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
          setCv(mappedCv);
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
    </div>
  );
}

function PdfPreview({
  blob,
  templateId,
  documentKind,
}: {
  blob: Blob;
  templateId: PdfTemplateId;
  documentKind: DocumentKind;
}) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const [rendering, setRendering] = useState(true);
  const [renderError, setRenderError] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [sha256, setSha256] = useState("");

  useEffect(() => {
    let cancelled = false;
    let loadingTask: ReturnType<typeof pdfjs.getDocument> | null = null;
    const renderTasks: Array<{ cancel: () => void; promise: Promise<void> }> = [];

    const renderPdf = async () => {
      setRendering(true);
      setRenderError("");

      try {
        const buffer = await blob.arrayBuffer();
        const digest = await crypto.subtle.digest("SHA-256", buffer.slice(0));
        const hash = Array.from(new Uint8Array(digest))
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("");

        loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
        const document = await loadingTask.promise;
        if (cancelled || !pagesRef.current) return;

        setSha256(hash);
        setPageCount(document.numPages);
        pagesRef.current.replaceChildren();

        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          const page = await document.getPage(pageNumber);
          if (cancelled || !pagesRef.current) return;

          const baseViewport = page.getViewport({ scale: 1 });
          const cssWidth = Math.max(280, Math.min(pagesRef.current.clientWidth, 794));
          const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
          const viewport = page.getViewport({
            scale: (cssWidth / baseViewport.width) * pixelRatio,
          });
          const canvas = window.document.createElement("canvas");
          const context = canvas.getContext("2d", { alpha: false });
          if (!context) throw new Error("Canvas 2D indisponible.");

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.style.width = `${cssWidth}px`;
          canvas.style.height = `${(viewport.height / pixelRatio).toFixed(2)}px`;
          canvas.className = "block max-w-full bg-white shadow-sm ring-1 ring-black/10";
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
      className="relative h-[calc(100vh-7rem)] min-h-[720px] overflow-auto bg-zinc-300 p-3"
    >
      <div ref={pagesRef} className="mx-auto flex w-full flex-col items-center gap-3" />
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
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        <Button size="sm" variant="outline" onClick={() => onChange([...items, ""])}>
          <Plus className="mr-2 h-4 w-4" /> {copy.add}
        </Button>
      </div>
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
    </Card>
  );
}

export default Index;
