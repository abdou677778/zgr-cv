"use client";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  FileCheck2,
  FileText,
  LoaderCircle,
  LockKeyhole,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  fileCategoryIds,
  fileCategoryLabels,
  type FileCategoryId,
  serviceIds,
  serviceLabels,
  type ServiceId,
} from "@/lib/order-constants";
import type { ClientPortalLocale } from "@/components/client-portal-shell";

const formCopy = {
  fr: {
    byte: "o",
    kiloByte: "Ko",
    megaByte: "Mo",
    genericError: "Erreur",
    uploadError: "Erreur pendant l’envoi.",
    connectionInterrupted: "Connexion interrompue pendant l’envoi.",
    unavailable: "Ce lien client est indisponible.",
    invitationRequired: "Invitation nécessaire",
    reservedPortal: "Ce portail est réservé aux clients.",
    invitationHelp:
      "Ouvrez le lien personnel transmis par CV PRO TEAM. Chaque invitation protège un seul dossier pendant 5 jours.",
    secureOpening: "Ouverture sécurisée du dossier…",
    linkUnavailable: "Lien indisponible",
    renewLink: "Demandez un nouveau lien à CV PRO TEAM si les 5 jours sont terminés.",
    invalidName: "Renseignez votre nom et prénom.",
    invalidEmail: "Renseignez un email valide.",
    serviceRequired: "Sélectionnez au moins un service.",
    fileRequired: "Ajoutez au moins un document.",
    consentRequired: "Confirmez votre accord avant l’envoi.",
    invalidForm: "Création du dossier impossible.",
    sendFailed: "Envoi impossible.",
    deleteFailed: "Suppression impossible.",
    received: "Dossier reçu",
    thankYou: "Merci, votre commande est enregistrée.",
    referenceIntro:
      "Vos documents et vos consignes sont maintenant regroupés sous la référence suivante.",
    copyReference: "Copier la référence",
    bonusReady: "Votre cadeau de bienvenue est prêt",
    bonusDetails:
      "Ce dossier gratuit est réservé à votre première confirmation. Les livres payants ne sont jamais inclus automatiquement.",
    openBonus: "Ouvrir mon cadeau",
    usableUntil: "Ce même lien reste utilisable pour consulter et modifier votre dossier jusqu’au",
    fiveDayTerm: "terme des 5 jours",
    editOrder: "Modifier ma commande",
    progressLabel: "Progression du dépôt",
    steps: ["Vos besoins", "Vos fichiers", "Confirmation"],
    prepare: "Préparer votre dossier",
    addDocuments: "Ajouter vos documents",
    prepareDescription: "Les informations resteront associées à votre numéro de commande.",
    addDescription: "Classez les fichiers avant de confirmer l’envoi.",
    fullName: "Nom et prénom *",
    fullNamePlaceholder: "Ex. Amine Bensalem",
    email: "Email *",
    emailPlaceholder: "nom@exemple.com",
    phone: "Téléphone / WhatsApp",
    communicationLanguage: "Langue de communication",
    desiredDocuments: "Documents souhaités *",
    multiService: "Vous pouvez sélectionner plusieurs services.",
    selected: "sélectionné(s)",
    notes: "Remarques et consignes",
    notesPlaceholder:
      "Ex. Basez-vous sur mon ancien CV, ajoutez mes nouveaux diplômes et retirez l’expérience...",
    dropDocuments: "Déposez vos documents ici",
    dropDetails: "Ancien CV, diplômes, certificats, photos et documents PDF ou Word.",
    chooseFiles: "Choisir les fichiers",
    limits: "100 Mo maximum par fichier · 500 Mo par commande",
    file: "fichier(s)",
    alreadySaved: "déjà enregistré",
    sent: "envoyé",
    deleteFile: "Supprimer",
    removeFile: "Retirer",
    consent:
      "J’autorise CV PRO TEAM à traiter ces documents uniquement pour préparer les services sélectionnés.",
    secureUpload: "Envoi sécurisé en cours",
    reviewHint: "Vous pourrez vérifier chaque document avant l’envoi.",
    privacyHint: "Aucun autre client ne peut consulter votre dossier.",
    back: "Retour",
    continue: "Continuer",
    sending: "Envoi…",
    sendFolder: "Envoyer le dossier",
    locale: "fr-DZ",
  },
  ar: {
    byte: "بايت",
    kiloByte: "ك.ب",
    megaByte: "م.ب",
    genericError: "خطأ",
    uploadError: "حدث خطأ أثناء الإرسال.",
    connectionInterrupted: "انقطع الاتصال أثناء رفع الملفات.",
    unavailable: "رابط العميل غير متاح.",
    invitationRequired: "الدعوة مطلوبة",
    reservedPortal: "هذا الفضاء مخصّص لعملاء CV PRO TEAM.",
    invitationHelp:
      "افتح الرابط الشخصي الذي أرسلته لك CV PRO TEAM. كل دعوة تحمي ملفًا واحدًا لمدة خمسة أيام.",
    secureOpening: "جارٍ فتح الملف بطريقة آمنة…",
    linkUnavailable: "الرابط غير متاح",
    renewLink: "اطلب رابطًا جديدًا من CV PRO TEAM إذا انتهت مدة الخمسة أيام.",
    invalidName: "يرجى إدخال الاسم واللقب.",
    invalidEmail: "يرجى إدخال بريد إلكتروني صحيح.",
    serviceRequired: "اختر خدمة واحدة على الأقل.",
    fileRequired: "أضف وثيقة واحدة على الأقل.",
    consentRequired: "يرجى تأكيد موافقتك قبل الإرسال.",
    invalidForm: "تعذّر إنشاء الملف.",
    sendFailed: "تعذّر إرسال الملف.",
    deleteFailed: "تعذّر حذف الوثيقة.",
    received: "تم استلام الملف",
    thankYou: "شكرًا، تم تسجيل طلبك بنجاح.",
    referenceIntro: "جُمعت وثائقك وتعليماتك تحت الرقم المرجعي الآتي.",
    copyReference: "نسخ الرقم المرجعي",
    bonusReady: "هدية الترحيب الخاصة بك جاهزة",
    bonusDetails:
      "هذا المجلد المجاني مخصّص لأول تأكيد للطلب، ولا تُضاف الكتب المدفوعة تلقائيًا.",
    openBonus: "فتح الهدية",
    usableUntil: "يبقى هذا الرابط صالحًا للاطلاع على ملفك وتعديله إلى غاية",
    fiveDayTerm: "نهاية مدة الخمسة أيام",
    editOrder: "تعديل طلبي",
    progressLabel: "مراحل إرسال الملف",
    steps: ["احتياجاتك", "وثائقك", "التأكيد"],
    prepare: "حضّر ملفك",
    addDocuments: "أضف وثائقك",
    prepareDescription: "ستبقى هذه المعلومات مرتبطة برقم طلبك.",
    addDescription: "صنّف الملفات قبل تأكيد الإرسال.",
    fullName: "الاسم واللقب *",
    fullNamePlaceholder: "مثال: أمين بن سالم",
    email: "البريد الإلكتروني *",
    emailPlaceholder: "name@example.com",
    phone: "الهاتف / واتساب",
    communicationLanguage: "لغة التواصل",
    desiredDocuments: "الخدمات المطلوبة *",
    multiService: "يمكنك اختيار أكثر من خدمة.",
    selected: "خدمة محددة",
    notes: "ملاحظات وتعليمات",
    notesPlaceholder:
      "مثال: اعتمدوا على سيرتي القديمة، وأضيفوا الشهادات الجديدة، واحذفوا الخبرة...",
    dropDocuments: "ضع وثائقك هنا",
    dropDetails: "السيرة القديمة، الشهادات، الصور، وملفات PDF أو Word.",
    chooseFiles: "اختيار الملفات",
    limits: "الحد الأقصى 100 م.ب لكل ملف · 500 م.ب لكل طلب",
    file: "ملف",
    alreadySaved: "محفوظ مسبقًا",
    sent: "تم الإرسال",
    deleteFile: "حذف",
    removeFile: "إزالة",
    consent: "أوافق على معالجة CV PRO TEAM لهذه الوثائق فقط من أجل إعداد الخدمات المختارة.",
    secureUpload: "جارٍ الإرسال الآمن",
    reviewHint: "يمكنك التحقق من كل وثيقة قبل إرسالها.",
    privacyHint: "لا يمكن لأي عميل آخر الاطلاع على ملفك.",
    back: "رجوع",
    continue: "متابعة",
    sending: "جارٍ الإرسال…",
    sendFolder: "إرسال الملف",
    locale: "ar-DZ",
  },
} as const;

const arabicServiceLabels: Record<ServiceId, string> = {
  CV_EUROPASS: "سيرة ذاتية Europass",
  CV_CANADIEN: "سيرة ذاتية كندية",
  CV_ATS: "سيرة متوافقة مع ATS",
  CV_ARABE: "سيرة ذاتية بالعربية",
  LETTRE_FR: "رسالة تحفيز بالفرنسية",
  LETTRE_ENG: "رسالة تحفيز بالإنجليزية",
  CONSEILS: "استشارة مهنية",
};

const arabicFileCategoryLabels: Record<FileCategoryId, string> = {
  ANCIEN_CV: "سيرة ذاتية قديمة",
  DIPLOMES_CERTIFICATS: "الشهادات والدبلومات",
  PHOTOS: "الصور",
  DOCUMENTS_PROFESSIONNELS: "وثائق مهنية",
  AUTRES: "وثائق أخرى",
};

interface PendingFile {
  id: string;
  file: File;
  category: FileCategoryId;
  uploaded: boolean;
}

interface OrderSession {
  id: string;
  uploadToken: string;
}

interface ExistingFile {
  id: string;
  category: FileCategoryId;
  originalName: string;
  sizeBytes: number;
}

interface ExistingOrder {
  id: string;
  clientName: string;
  email: string;
  phone: string;
  language: "fr" | "en" | "ar";
  notes: string;
  services: ServiceId[];
  status: string;
}

interface InvitationSessionResponse {
  state: "NEW" | "EXISTING";
  expiresAt: string;
  order?: ExistingOrder;
  files?: ExistingFile[];
}

const acceptedExtensions = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif";

function formatBytes(value: number, locale: ClientPortalLocale) {
  const t = formCopy[locale];
  if (value < 1024) return `${value} ${t.byte}`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} ${t.kiloByte}`;
  return `${(value / 1024 / 1024).toFixed(1)} ${t.megaByte}`;
}

async function apiError(response: Response, locale: ClientPortalLocale) {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  if (locale === "ar") {
    if (response.status === 401 || response.status === 403)
      return "رابط الدعوة غير صالح أو انتهت مدة صلاحيته.";
    if (response.status === 404) return "تعذّر العثور على الطلب المرتبط بهذا الرابط.";
    if (response.status === 413) return "حجم الملفات يتجاوز الحد المسموح به.";
    if (response.status === 422) return "يرجى التحقق من المعلومات والوثائق المطلوبة.";
    if (response.status >= 500) return "الخدمة غير متاحة مؤقتًا. يرجى المحاولة بعد قليل.";
  }
  return payload?.error || `Erreur ${response.status}`;
}

function clientApiUrl(path: string) {
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/c/")) {
    return `/c/api${path.replace(/^\/api/, "")}`;
  }
  return path;
}

function uploadFile(
  session: OrderSession,
  item: PendingFile,
  onProgress: (ratio: number) => void,
  locale: ClientPortalLocale,
) {
  const t = formCopy[locale];
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", clientApiUrl(`/api/orders/${encodeURIComponent(session.id)}/files`));
    xhr.setRequestHeader("x-upload-token", session.uploadToken);
    xhr.setRequestHeader("x-file-name", encodeURIComponent(item.file.name));
    xhr.setRequestHeader("x-file-category", item.category);
    xhr.setRequestHeader("Content-Type", item.file.type || "application/octet-stream");
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve();
        return;
      }
      try {
        const payload = JSON.parse(xhr.responseText) as { error?: string };
        reject(new Error(payload.error || `${t.genericError} ${xhr.status}`));
      } catch {
        reject(new Error(`${t.genericError} ${xhr.status}. ${t.uploadError}`));
      }
    });
    xhr.addEventListener("error", () => reject(new Error(t.connectionInterrupted)));
    xhr.send(item.file);
  });
}

export function ClientIntakeForm({
  invitationToken,
  locale,
}: {
  invitationToken: string;
  locale: ClientPortalLocale;
}) {
  const t = formCopy[locale];
  const ar = locale === "ar";
  const labels = ar ? arabicServiceLabels : serviceLabels;
  const categoryLabels = ar ? arabicFileCategoryLabels : fileCategoryLabels;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [clientName, setClientName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState<"fr" | "en" | "ar">(() =>
    locale === "ar" ? "ar" : "fr",
  );
  const [notes, setNotes] = useState("");
  const [services, setServices] = useState<ServiceId[]>([]);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [existingFiles, setExistingFiles] = useState<ExistingFile[]>([]);
  const [consent, setConsent] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [session, setSession] = useState<OrderSession | null>(null);
  const [completedOrderId, setCompletedOrderId] = useState("");
  const [bonusShareUrl, setBonusShareUrl] = useState("");
  const [restoring, setRestoring] = useState(Boolean(invitationToken));
  const [accessDenied, setAccessDenied] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");

  const totalBytes = useMemo(
    () =>
      files.reduce((sum, item) => sum + item.file.size, 0) +
      existingFiles.reduce((sum, item) => sum + item.sizeBytes, 0),
    [existingFiles, files],
  );

  useEffect(() => {
    if (!invitationToken) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(clientApiUrl("/api/orders/session"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invitationToken }),
        });
        if (!response.ok) throw new Error(await apiError(response, locale));
        const payload = (await response.json()) as InvitationSessionResponse;
        if (cancelled) return;
        setExpiresAt(payload.expiresAt);
        if (payload.state === "EXISTING" && payload.order) {
          const order = payload.order;
          setClientName(order.clientName);
          setEmail(order.email);
          setPhone(order.phone);
          setLanguage(order.language);
          setNotes(order.notes);
          setServices(order.services);
          setExistingFiles(payload.files ?? []);
          setSession({ id: order.id, uploadToken: invitationToken });
          setCompletedOrderId(order.id);
        }
      } catch (error) {
        if (cancelled) return;
        setAccessDenied(true);
        setMessage(error instanceof Error ? error.message : t.unavailable);
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invitationToken, locale, t.unavailable]);

  if (!invitationToken) {
    return (
      <Card className="border-0 text-center shadow-[0_22px_70px_-48px_rgba(13,38,63,.55)] ring-primary/10">
        <CardContent className="px-6 py-10 sm:px-10 sm:py-14">
          <div className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-amber-100 text-amber-800">
            <LockKeyhole className="size-8" />
          </div>
          <Badge className="mb-4 bg-amber-100 text-amber-900">{t.invitationRequired}</Badge>
          <h2 className="text-2xl font-black text-primary">{t.reservedPortal}</h2>
          <p className="mx-auto mt-3 max-w-xl leading-7 text-muted-foreground">
            {t.invitationHelp}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (restoring) {
    return (
      <Card className="border-0 text-center shadow-[0_22px_70px_-48px_rgba(13,38,63,.55)] ring-primary/10">
        <CardContent className="grid min-h-64 place-items-center px-6 py-10">
          <div>
            <LoaderCircle className="mx-auto size-9 animate-spin text-accent" />
            <p className="mt-4 font-bold text-primary">{t.secureOpening}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (accessDenied) {
    return (
      <Card className="border-0 text-center shadow-[0_22px_70px_-48px_rgba(13,38,63,.55)] ring-primary/10">
        <CardContent className="px-6 py-10 sm:px-10 sm:py-14">
          <div className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-red-100 text-red-700">
            <LockKeyhole className="size-8" />
          </div>
          <h2 className="text-2xl font-black text-primary">{t.linkUnavailable}</h2>
          <p className="mx-auto mt-3 max-w-xl leading-7 text-muted-foreground">{message}</p>
          <p className="mt-3 text-sm text-muted-foreground">
            {t.renewLink}
          </p>
        </CardContent>
      </Card>
    );
  }

  const toggleService = (service: ServiceId) => {
    setServices((current) =>
      current.includes(service)
        ? current.filter((candidate) => candidate !== service)
        : [...current, service],
    );
  };

  const addFiles = (incoming: FileList | File[]) => {
    const nextFiles = [...incoming];
    setFiles((current) => {
      const signatures = new Set(
        current.map((item) => `${item.file.name}:${item.file.size}:${item.file.lastModified}`),
      );
      const accepted = nextFiles
        .filter((file) => !signatures.has(`${file.name}:${file.size}:${file.lastModified}`))
        .slice(0, Math.max(0, 50 - existingFiles.length - current.length))
        .map((file) => ({
          id: crypto.randomUUID(),
          file,
          category: "AUTRES" as FileCategoryId,
          uploaded: false,
        }));
      return [...current, ...accepted];
    });
    setMessage("");
  };

  const moveToFiles = () => {
    if (clientName.trim().length < 2) return setMessage(t.invalidName);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setMessage(t.invalidEmail);
    if (!services.length) return setMessage(t.serviceRequired);
    setMessage("");
    setStep(2);
  };

  const submit = async () => {
    if (!files.length && !existingFiles.length) return setMessage(t.fileRequired);
    if (!consent) return setMessage(t.consentRequired);
    setSubmitting(true);
    setMessage("");
    try {
      let activeSession = session;
      if (!activeSession) {
        const response = await fetch(clientApiUrl("/api/orders"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invitationToken,
            clientName,
            email,
            phone,
            language,
            notes,
            services,
          }),
        });
        if (!response.ok) throw new Error(await apiError(response, locale));
        activeSession = (await response.json()) as OrderSession;
        setSession(activeSession);
      } else {
        const response = await fetch(
          clientApiUrl(`/api/orders/${encodeURIComponent(activeSession.id)}`),
          {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-upload-token": activeSession.uploadToken,
          },
          body: JSON.stringify({
            clientName,
            email,
            phone,
            language,
            notes,
            services,
          }),
          },
        );
        if (!response.ok) throw new Error(await apiError(response, locale));
      }

      const pending = files.filter((item) => !item.uploaded);
      for (let index = 0; index < pending.length; index += 1) {
        const item = pending[index];
        await uploadFile(
          activeSession,
          item,
          (ratio) => {
            setProgress(pending.length ? ((index + ratio) / pending.length) * 100 : 100);
          },
          locale,
        );
        setFiles((current) =>
          current.map((candidate) =>
            candidate.id === item.id ? { ...candidate, uploaded: true } : candidate,
          ),
        );
      }

      const response = await fetch(
        clientApiUrl(`/api/orders/${encodeURIComponent(activeSession.id)}/complete`),
        {
          method: "POST",
          headers: { "x-upload-token": activeSession.uploadToken },
        },
      );
      if (!response.ok) throw new Error(await apiError(response, locale));
      const completion = (await response.json()) as {
        bonusShareUrl?: string;
        bonusFileCount?: number;
      };
      setProgress(100);
      setCompletedOrderId(activeSession.id);
      setBonusShareUrl(completion.bonusShareUrl || "");
      const restored = await fetch(clientApiUrl("/api/orders/session"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationToken }),
      });
      if (restored.ok) {
        const payload = (await restored.json()) as InvitationSessionResponse;
        setExistingFiles(payload.files ?? []);
        setFiles([]);
      }
      setStep(3);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.sendFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteExistingFile = async (file: ExistingFile) => {
    if (!session || submitting) return;
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch(
        clientApiUrl(
          `/api/orders/${encodeURIComponent(session.id)}/files/${encodeURIComponent(file.id)}`,
        ),
        {
          method: "DELETE",
          headers: { "x-upload-token": session.uploadToken },
        },
      );
      if (!response.ok) throw new Error(await apiError(response, locale));
      setExistingFiles((current) => current.filter((candidate) => candidate.id !== file.id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.deleteFailed);
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 3) {
    return (
      <Card className="border-0 text-center shadow-[0_22px_70px_-48px_rgba(13,38,63,.55)] ring-primary/10">
        <CardContent className="px-6 py-10 sm:px-10 sm:py-14">
          <div className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="size-9" />
          </div>
          <Badge className="mb-4 bg-emerald-100 text-emerald-800">{t.received}</Badge>
          <h2 className="text-2xl font-black text-primary sm:text-3xl">
            {t.thankYou}
          </h2>
          <p className="mx-auto mt-3 max-w-xl leading-7 text-muted-foreground">
            {t.referenceIntro}
          </p>
          <div className="mx-auto mt-7 flex max-w-md items-center justify-between gap-3 rounded-2xl border border-primary/15 bg-muted px-4 py-4">
            <code className="overflow-hidden text-ellipsis text-sm font-black text-primary sm:text-base">
              {completedOrderId}
            </code>
            <Button
              variant="outline"
              size="icon"
              aria-label={t.copyReference}
              onClick={() => navigator.clipboard.writeText(completedOrderId)}
            >
              <Copy />
            </Button>
          </div>
          {bonusShareUrl && (
            <div
              className={`mx-auto mt-5 max-w-md rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 ${
                ar ? "text-right" : "text-left"
              }`}
            >
              <p className="font-black text-amber-950">{t.bonusReady}</p>
              <p className="mt-1 text-sm leading-7 text-amber-800">{t.bonusDetails}</p>
              <Button
                type="button"
                className="mt-3 w-full"
                onClick={() => window.open(bonusShareUrl, "_blank", "noopener,noreferrer")}
              >
                {t.openBonus}
              </Button>
            </div>
          )}
          <p className="mt-5 text-sm text-muted-foreground">
            {t.usableUntil}{" "}
            {expiresAt ? new Date(expiresAt).toLocaleString(t.locale) : t.fiveDayTerm}.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-6"
            onClick={() => {
              setConsent(false);
              setMessage("");
              setStep(1);
            }}
          >
            {t.editOrder}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="mb-5 grid grid-cols-3 gap-2" aria-label={t.progressLabel}>
        {t.steps.map((label, index) => {
          const number = index + 1;
          const active = number === step;
          const completed = number < step;
          return (
            <div
              key={label}
              className={`rounded-2xl border px-2 py-3 text-center text-[11px] font-bold sm:px-3 sm:text-sm ${
                active || completed
                  ? "border-accent bg-accent/10 text-primary"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              <span
                className={`inline-grid size-5 place-items-center rounded-full bg-white/80 text-[11px] shadow-sm ${
                  ar ? "ml-1 sm:ml-1.5" : "mr-1 sm:mr-1.5"
                }`}
              >
                {completed ? "✓" : number}
              </span>
              {label}
            </div>
          );
        })}
      </div>

      <Card className="border-0 shadow-[0_22px_70px_-48px_rgba(13,38,63,.55)] ring-primary/10">
        <CardHeader className="border-b border-border px-5 pb-5 sm:px-7">
          <CardTitle className="text-xl font-black text-primary">
            {step === 1 ? t.prepare : t.addDocuments}
          </CardTitle>
          <CardDescription>
            {step === 1
              ? t.prepareDescription
              : t.addDescription}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-7 px-5 sm:px-7">
          {step === 1 ? (
            <>
              <section className="grid gap-4 sm:grid-cols-2">
                <label htmlFor="client-name" className="space-y-2 text-sm font-bold text-primary">
                  {t.fullName}
                  <Input
                    id="client-name"
                    className="h-11 bg-white"
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                    placeholder={t.fullNamePlaceholder}
                  />
                </label>
                <label htmlFor="client-email" className="space-y-2 text-sm font-bold text-primary">
                  {t.email}
                  <Input
                    id="client-email"
                    className="h-11 bg-white text-left"
                    dir="ltr"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={t.emailPlaceholder}
                  />
                </label>
                <label htmlFor="client-phone" className="space-y-2 text-sm font-bold text-primary">
                  {t.phone}
                  <Input
                    id="client-phone"
                    className="h-11 bg-white text-left"
                    dir="ltr"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+213 ..."
                  />
                </label>
                <label
                  htmlFor="client-language"
                  className="space-y-2 text-sm font-bold text-primary"
                >
                  {t.communicationLanguage}
                  <select
                    id="client-language"
                    className="h-11 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
                    value={language}
                    onChange={(event) => setLanguage(event.target.value as "fr" | "en" | "ar")}
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                    <option value="ar">العربية</option>
                  </select>
                </label>
              </section>

              <section>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h2 className="font-black text-primary">{t.desiredDocuments}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{t.multiService}</p>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {services.length} {t.selected}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {serviceIds.map((service) => {
                    const checked = services.includes(service);
                    return (
                      <label
                        key={service}
                        className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm font-bold transition ${
                          checked
                            ? "border-accent bg-accent/10 text-primary"
                            : "border-border bg-white text-primary hover:border-accent"
                        }`}
                      >
                        <input
                          className="size-4 accent-[var(--primary)]"
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleService(service)}
                        />
                        {labels[service]}
                      </label>
                    );
                  })}
                </div>
              </section>

              <label
                htmlFor="client-notes"
                className="block space-y-2 text-sm font-bold text-primary"
              >
                {t.notes}
                <Textarea
                  id="client-notes"
                  className="min-h-28 resize-y bg-white font-normal leading-6"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder={t.notesPlaceholder}
                />
              </label>
            </>
          ) : (
            <>
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                multiple
                accept={acceptedExtensions}
                onChange={(event) => {
                  if (event.target.files) addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              <section
                className={`rounded-2xl border-2 border-dashed px-5 py-8 text-center transition sm:py-10 ${
                  dragging ? "border-accent bg-accent/10" : "border-accent/45 bg-accent/5"
                }`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  addFiles(event.dataTransfer.files);
                }}
              >
                <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-white text-accent shadow-sm">
                  <UploadCloud className="size-7" />
                </div>
                <h2 className="font-black text-primary">{t.dropDocuments}</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  {t.dropDetails}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 h-10 border-primary/20 bg-white px-5 text-primary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {t.chooseFiles}
                </Button>
                <p className="mt-3 text-xs text-muted-foreground">
                  {t.limits}
                </p>
              </section>

              {(files.length > 0 || existingFiles.length > 0) && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-black text-primary">
                      {files.length + existingFiles.length} {t.file}
                    </h2>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {formatBytes(totalBytes, locale)}
                    </span>
                  </div>
                  {existingFiles.map((item) => (
                    <div
                      key={item.id}
                      className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-center"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-emerald-700">
                          <FileCheck2 className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-primary">
                            {item.originalName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatBytes(item.sizeBytes, locale)} · {t.alreadySaved}
                          </p>
                        </div>
                      </div>
                      <div className="flex h-10 items-center rounded-lg border border-input bg-white px-3 text-sm">
                        {categoryLabels[item.category] ?? item.category}
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={submitting}
                        aria-label={`${t.deleteFile} ${item.originalName}`}
                        onClick={() => void deleteExistingFile(item)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                  {files.map((item) => (
                    <div
                      key={item.id}
                      className="grid gap-3 rounded-xl border border-border bg-white p-3 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-center"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-primary">
                          <FileText className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-primary">
                            {item.file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatBytes(item.file.size, locale)}
                            {item.uploaded ? ` · ${t.sent}` : ""}
                          </p>
                        </div>
                      </div>
                      <select
                        className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
                        value={item.category}
                        disabled={submitting || item.uploaded}
                        onChange={(event) =>
                          setFiles((current) =>
                            current.map((candidate) =>
                              candidate.id === item.id
                                ? {
                                    ...candidate,
                                    category: event.target.value as FileCategoryId,
                                  }
                                : candidate,
                            ),
                          )
                        }
                      >
                        {fileCategoryIds.map((category) => (
                          <option key={category} value={category}>
                            {categoryLabels[category]}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={submitting || item.uploaded}
                        aria-label={`${t.removeFile} ${item.file.name}`}
                        onClick={() =>
                          setFiles((current) =>
                            current.filter((candidate) => candidate.id !== item.id),
                          )
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </section>
              )}

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/55 p-4 text-sm leading-6 text-muted-foreground">
                <input
                  className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                {t.consent}
              </label>

              {submitting && (
                <Progress value={progress}>
                  <ProgressLabel>{t.secureUpload}</ProgressLabel>
                  <ProgressValue>
                    {(_formattedValue, value) => `${Math.round(value ?? progress)} %`}
                  </ProgressValue>
                </Progress>
              )}
            </>
          )}

          {message && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
            >
              {message}
            </p>
          )}

          <div className="flex flex-col gap-4 rounded-2xl bg-muted/65 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              {step === 1 ? (
                <FileCheck2 className="mt-0.5 size-5 shrink-0 text-accent" />
              ) : (
                <LockKeyhole className="mt-0.5 size-5 shrink-0 text-accent" />
              )}
              <p>
                {step === 1
                  ? t.reviewHint
                  : t.privacyHint}
              </p>
            </div>
            <div className="flex gap-2">
              {step === 2 && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 px-4"
                  disabled={submitting}
                  onClick={() => {
                    setStep(1);
                    setMessage("");
                  }}
                >
                  {ar ? <ArrowRight /> : <ArrowLeft />} {t.back}
                </Button>
              )}
              <Button
                type="button"
                className="h-11 min-w-44 gap-2 px-5"
                disabled={submitting}
                onClick={step === 1 ? moveToFiles : submit}
              >
                {submitting ? (
                  <>
                    <LoaderCircle className="animate-spin" /> {t.sending}
                  </>
                ) : step === 1 ? (
                  <>
                    {t.continue} {ar ? <ArrowLeft /> : <ArrowRight />}
                  </>
                ) : (
                  <>
                    {t.sendFolder} <UploadCloud />
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
