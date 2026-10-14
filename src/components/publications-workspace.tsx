import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Bot,
  CalendarClock,
  Check,
  Clipboard,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  Image as ImageIcon,
  LoaderCircle,
  MessageCircleMore,
  Newspaper,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Upload,
} from "lucide-react";

import { FullPageWorkspace } from "@/components/full-page-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AiSettings } from "@/lib/ai-types";
import {
  PUBLICATION_PAGES,
  buildLocalPublicationBatch,
  collectPublicationEvidence,
  generatePublicationBatch,
  getBaselinePublicationEvidence,
  normalizePublicationBatch,
  publicationImagePrompt,
  publicationPrompt,
  type PublicationBatch,
  type PublicationDraft,
  type PublicationEvidence,
  type PublicationMarket,
  type PublicationPage,
  type PublicationPageId,
} from "@/lib/publication-studio";

const STORAGE_KEY = "zgr-publication-studio-v2";
const IMAGE_DB_NAME = "zgr-publication-images-v1";
const IMAGE_STORE = "assets";
const MAX_PUBLICATION_IMAGE_BYTES = 8 * 1024 * 1024;

type GeneratorMode = "zgr_local" | "project_ai" | "codex_local";

function openPublicationImageDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(IMAGE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(IMAGE_STORE))
        request.result.createObjectStore(IMAGE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Stockage d’image indisponible."));
  });
}

async function savePublicationImage(postId: string, image: Blob) {
  const db = await openPublicationImageDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(IMAGE_STORE, "readwrite");
    transaction.objectStore(IMAGE_STORE).put(image, postId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Image non enregistrée."));
  });
  db.close();
}

async function readPublicationImage(postId: string) {
  const db = await openPublicationImageDb();
  const image = await new Promise<Blob | null>((resolve, reject) => {
    const request = db.transaction(IMAGE_STORE, "readonly").objectStore(IMAGE_STORE).get(postId);
    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
    request.onerror = () => reject(request.error || new Error("Image non lisible."));
  });
  db.close();
  return image;
}

function readStoredBatches() {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") as Record<
      string,
      PublicationBatch
    >;
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([pageId, batch]) =>
          PUBLICATION_PAGES.some((page) => page.id === pageId) &&
          batch?.version === 4 &&
          Array.isArray(batch.posts) &&
          batch.posts.length === 10 &&
          batch.posts.every((post) => post?.format === "visual" && post?.visual),
      ),
    ) as Partial<Record<PublicationPageId, PublicationBatch>>;
  } catch {
    return {};
  }
}

function formattedDate(value: string | null | undefined) {
  if (!value) return "Non publié";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

function exactDeadline(value: string | null) {
  if (!value) return "Deadline non publié";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? `Deadline ${value}`
    : `Deadline ${date.toLocaleDateString("fr-FR")}`;
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Logo indisponible."));
    image.src = src;
  });
}

function canvasLines(
  context: CanvasRenderingContext2D,
  value: string,
  maximumWidth: number,
  maximumLines: number,
) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= maximumWidth || !current) current = candidate;
    else {
      lines.push(current);
      current = word;
      if (lines.length === maximumLines - 1) break;
    }
  }
  if (current && lines.length < maximumLines) lines.push(current);
  return lines;
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const renderedWidth = image.naturalWidth * scale;
  const renderedHeight = image.naturalHeight * scale;
  context.drawImage(
    image,
    (width - renderedWidth) / 2,
    (height - renderedHeight) / 2,
    renderedWidth,
    renderedHeight,
  );
}

function campaignServices(post: PublicationDraft) {
  const context = `${post.visual?.title || ""} ${post.visual?.subtitle || ""} ${
    post.sourceLabel
  }`.toLowerCase();
  if (/italie|italy|flussi/.test(context)) {
    return [
      "توجيه نحو المسار الإيطالي الرسمي",
      "ترتيب وثائق ملف الترشح",
      "سيرة ذاتية ورسالة تحفيزية مكيّفتان",
      "مراجعة الملف قبل الإرسال",
    ];
  }
  return [
    "مرافقة في الاستمارة الرسمية",
    "سيرة ذاتية مكيّفة مع العرض",
    "رسالة تحفيزية حسب الاختصاص",
    "ترتيب ملف الترشح قبل الإرسال",
  ];
}

async function renderTunisiaCampaignVisual(
  post: PublicationDraft,
  page: PublicationPage,
  imageUrl?: string,
) {
  if (!post.visual) return;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponible.");
  context.fillStyle = "#fffdf8";
  context.fillRect(0, 0, 1080, 1350);
  context.fillStyle = "#d80b3b";
  context.fillRect(0, 0, 1080, 250);
  context.fillRect(0, 1190, 1080, 160);
  context.textAlign = "right";
  context.direction = "rtl";
  context.fillStyle = "#fde86e";
  context.font = "900 47px Arial, Tahoma";
  context.fillText("التسجيلات مفتوحة رسميا", 980, 88);
  context.fillStyle = "#ffffff";
  context.font = "900 61px Arial, Tahoma";
  canvasLines(context, post.visual.title, 900, 2).forEach((line, index) =>
    context.fillText(line, 980, 158 + index * 76),
  );
  const logo = await loadImage(new URL(page.logoUrl, window.location.origin).toString());
  context.save();
  context.beginPath();
  context.arc(82, 120, 46, 0, Math.PI * 2);
  context.clip();
  context.drawImage(logo, 36, 74, 92, 92);
  context.restore();
  context.strokeStyle = "rgba(255,255,255,.9)";
  context.lineWidth = 4;
  context.beginPath();
  context.arc(82, 120, 47, 0, Math.PI * 2);
  context.stroke();

  if (imageUrl) {
    const image = await loadImage(imageUrl);
    context.save();
    context.beginPath();
    context.roundRect(70, 330, 375, 430, 28);
    context.clip();
    drawCover(context, image, 375, 430);
    context.restore();
  } else {
    context.fillStyle = "#f3f4f6";
    context.beginPath();
    context.roundRect(70, 330, 375, 430, 28);
    context.fill();
    context.font = "900 118px Arial, Tahoma";
    context.textAlign = "center";
    context.fillText("🇨🇦", 258, 555);
    context.font = "800 31px Arial, Tahoma";
    context.fillStyle = "#b91c1c";
    context.fillText("فرصة موثوقة", 258, 630);
  }

  context.textAlign = "right";
  context.fillStyle = "#111827";
  context.font = "900 43px Arial, Tahoma";
  context.fillText("خدماتنا المتاحة", 985, 360);
  context.fillStyle = "#dc2626";
  context.font = "800 34px Arial, Tahoma";
  context.fillText("نرافقك خطوة بخطوة", 985, 410);
  context.fillStyle = "#1f2937";
  context.font = "700 31px Arial, Tahoma";
  campaignServices(post).forEach((service, index) => {
    const y = 500 + index * 118;
    context.fillStyle = "#f9d94d";
    context.beginPath();
    context.arc(925, y - 10, 16, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#1f2937";
    canvasLines(context, service, 540, 2).forEach((line, lineIndex) =>
      context.fillText(line, 875, y + lineIndex * 35),
    );
  });

  context.fillStyle = "#fff08a";
  context.beginPath();
  context.roundRect(90, 965, 900, 108, 26);
  context.fill();
  context.fillStyle = "#111827";
  context.font = "900 38px Arial, Tahoma";
  context.fillText(post.visual.subtitle, 950, 1032);
  context.fillStyle = "#fde86e";
  context.font = "900 43px Arial, Tahoma";
  context.fillText("سارعوا قبل غلق التسجيلات", 970, 1260);
  context.fillStyle = "#ffffff";
  context.font = "700 25px Arial, Tahoma";
  context.fillText(page.name, 970, 1310);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("Export PNG impossible."))),
      "image/png",
      0.94,
    ),
  );
}

async function renderVisualBlob(post: PublicationDraft, page: PublicationPage, imageUrl?: string) {
  void post;
  void page;
  if (!imageUrl)
    throw new Error("Importez d’abord l’image créée avec GPT Image avant de l’exporter.");
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error("L’image GPT n’est plus disponible. Importez-la de nouveau.");
  return response.blob();
}

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 5_000);
}

async function downloadVisual(post: PublicationDraft, page: PublicationPage, imageUrl?: string) {
  const blob = await renderVisualBlob(post, page, imageUrl);
  if (!blob) return;
  downloadBlob(blob, `${page.id}-${post.id.slice(-8)}.png`);
}

async function downloadVisualArchive(
  batch: PublicationBatch,
  page: PublicationPage,
  imageUrls: Record<string, string>,
) {
  const { strToU8, zipSync } = await import("fflate");
  const files: Record<string, Uint8Array> = {};
  const root = `PUBLICATIONS/${page.id}`;
  const manifest = [
    "ZGR PUBLICATIONS",
    `Page: ${page.name}`,
    "Format: Facebook vertical 4:5 - 1080x1350 PNG",
    "Source: brouillons vérifiés dans ZGR CV",
    "",
  ];

  for (const [index, post] of batch.posts.entries()) {
    const blob = await renderVisualBlob(post, page, imageUrls[post.id]);
    if (!blob) continue;
    const filename = `${String(index + 1).padStart(2, "0")}_${page.id}_${post.id.slice(-8)}.png`;
    files[`${root}/${filename}`] = new Uint8Array(await blob.arrayBuffer());
    manifest.push(`${filename} | ${post.sourceUrl}`);
  }
  files[`${root}/MANIFEST.txt`] = strToU8(`${manifest.join("\n")}\n`);
  const archive = zipSync(files, { level: 6 });
  downloadBlob(
    new Blob([archive.buffer as ArrayBuffer], { type: "application/zip" }),
    `PUBLICATIONS_${page.id}_${batch.generatedAt.slice(0, 10)}.zip`,
  );
}

function PageLogo({ page, size = "md" }: { page: PublicationPage; size?: "sm" | "md" | "lg" }) {
  const classes = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-9 w-9" : "h-12 w-12";
  return (
    <img
      src={page.logoUrl}
      alt={`Logo ${page.name}`}
      className={`${classes} shrink-0 rounded-full border-2 border-white object-cover shadow-md`}
    />
  );
}

function VisualPreview({
  post,
  page,
  imageUrl,
}: {
  post: PublicationDraft;
  page: PublicationPage;
  imageUrl?: string;
}) {
  if (!post.visual) return null;
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-inner">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={`Image GPT associée à ${post.visual.title}`}
          className="aspect-[4/5] w-full object-cover"
        />
      ) : (
        <div className="flex aspect-[4/5] flex-col items-center justify-center gap-4 px-8 text-center">
          <ImageIcon className="size-12" style={{ color: page.accent }} />
          <div className="font-black text-slate-900">Image GPT à créer et importer</div>
          <p className="max-w-sm text-sm leading-6 text-slate-600">
            Copiez le prompt GPT Image, générez l’image originale en 4:5 puis importez-la ici. Aucun
            faux visuel automatique n’est exporté.
          </p>
        </div>
      )}
    </div>
  );
}

export function PublicationsWorkspace({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
  onOpenAiSettings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: AiSettings;
  onSettingsChange: (settings: AiSettings) => void;
  onOpenAiSettings: () => void;
}) {
  const [market, setMarket] = useState<PublicationMarket>("DZ");
  const [pageId, setPageId] = useState<PublicationPageId>("cv-pro-algeria");
  const [mode, setMode] = useState<GeneratorMode>("zgr_local");
  const [focus, setFocus] = useState("");
  const [evidence, setEvidence] = useState<PublicationEvidence[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [evidenceCheckedAt, setEvidenceCheckedAt] = useState("");
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [batches, setBatches] = useState<Partial<Record<PublicationPageId, PublicationBatch>>>(() =>
    readStoredBatches(),
  );
  const [codexJson, setCodexJson] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState("");
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const abortRef = useRef<AbortController | null>(null);

  const pages = useMemo(() => PUBLICATION_PAGES.filter((page) => page.market === market), [market]);
  const page = useMemo(
    () => PUBLICATION_PAGES.find((item) => item.id === pageId) || PUBLICATION_PAGES[0],
    [pageId],
  );
  const currentBatch = batches[page.id];

  useEffect(() => {
    let disposed = false;
    const objectUrls: string[] = [];
    const loadImages = async () => {
      if (!currentBatch?.posts.length) {
        if (!disposed) setImageUrls({});
        return;
      }
      const entries = await Promise.all(
        currentBatch.posts.map(async (post) => {
          const blob = await readPublicationImage(post.id).catch(() => null);
          if (!blob) return null;
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          return [post.id, url] as const;
        }),
      );
      if (!disposed)
        setImageUrls(Object.fromEntries(entries.filter(Boolean) as Array<[string, string]>));
    };
    void loadImages();
    return () => {
      disposed = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [currentBatch]);

  useEffect(() => {
    if (page.market === market) return;
    const nextPage = PUBLICATION_PAGES.find((item) => item.market === market);
    if (nextPage) setPageId(nextPage.id);
  }, [market, page.market]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
  }, [batches]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const refreshEvidence = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoadingEvidence(true);
    setMessage(null);
    try {
      const result = await collectPublicationEvidence(page, controller.signal);
      setEvidence(result.evidence);
      setWarnings(result.warnings);
      setEvidenceCheckedAt(result.checkedAt);
      if (!result.evidence.length)
        setMessage({ ok: false, text: "Aucune opportunité vérifiée et ouverte n’est disponible." });
    } catch (error) {
      if (!controller.signal.aborted)
        setMessage({
          ok: false,
          text: error instanceof Error ? error.message : "Actualisation des sources impossible.",
        });
    } finally {
      if (!controller.signal.aborted) setLoadingEvidence(false);
    }
  }, [page]);

  useEffect(() => {
    if (!open) return;
    setEvidence([]);
    setWarnings([]);
    setEvidenceCheckedAt("");
    void refreshEvidence();
  }, [open, page.id, refreshEvidence]);

  const markCopied = (id: string) => {
    setCopied(id);
    window.setTimeout(() => setCopied((current) => (current === id ? "" : current)), 1_500);
  };

  const importPublicationImage = async (post: PublicationDraft, file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage({ ok: false, text: "Choisissez une image PNG, JPG ou WebP." });
      return;
    }
    if (file.size > MAX_PUBLICATION_IMAGE_BYTES) {
      setMessage({ ok: false, text: "L’image ne doit pas dépasser 8 Mo." });
      return;
    }
    try {
      await savePublicationImage(post.id, file);
      const url = URL.createObjectURL(file);
      setImageUrls((current) => {
        if (current[post.id]) URL.revokeObjectURL(current[post.id]);
        return { ...current, [post.id]: url };
      });
      setMessage({
        ok: true,
        text: "Image GPT associée au brouillon. Elle sera incluse dans le PNG et le ZIP exportés.",
      });
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Import de l’image impossible.",
      });
    }
  };

  const generate = async () => {
    if (!evidence.length) {
      setMessage({ ok: false, text: "Actualisez d’abord les opportunités vérifiées." });
      return;
    }
    setGenerating(true);
    setMessage(null);
    try {
      const result = await generatePublicationBatch({ page, evidence, settings, focus });
      setBatches((current) => ({ ...current, [page.id]: result.batch }));
      onSettingsChange(result.nextSettings);
      setMessage({
        ok: true,
        text: result.fallbackUsed
          ? "Les fournisseurs IA sont momentanément indisponibles. Le moteur éditorial local ZGR a généré 10 publications vérifiées avec visuel, sans perdre votre travail."
          : `10 publications avec visuel générées avec ${result.connectionLabel} · ${result.model}. Validation humaine requise avant Facebook.`,
      });
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Génération impossible.",
      });
    } finally {
      setGenerating(false);
    }
  };

  const generateLocally = () => {
    if (!evidence.length) {
      setMessage({ ok: false, text: "Actualisez d’abord les opportunités vérifiées." });
      return;
    }
    const batch = buildLocalPublicationBatch({ page, evidence, focus });
    setBatches((current) => ({ ...current, [page.id]: batch }));
    setMessage({
      ok: true,
      text: "10 publications avec visuel sont disponibles immédiatement avec le moteur éditorial local ZGR. Aucune clé API ni quota n’a été utilisé.",
    });
  };

  const generateAllPagesLocally = () => {
    abortRef.current?.abort();
    setGeneratingAll(true);
    setMessage(null);
    try {
      const dzEvidence =
        page.market === "DZ" && evidence.length ? evidence : getBaselinePublicationEvidence("DZ");
      const tnEvidence =
        page.market === "TN" && evidence.length ? evidence : getBaselinePublicationEvidence("TN");
      const generated = Object.fromEntries(
        PUBLICATION_PAGES.map((item) => {
          const source = item.market === "DZ" ? dzEvidence : tnEvidence;
          return [item.id, buildLocalPublicationBatch({ page: item, evidence: source, focus })];
        }),
      ) as Record<PublicationPageId, PublicationBatch>;
      setBatches((current) => ({ ...current, ...generated }));
      setMessage({
        ok: true,
        text: "30 publications prêtes : 10 pour CV PRO Algérie, 10 pour Emplois & Immigration et 10 pour Bissane Career Expert. Chaque brouillon possède son visuel 4:5. Aucun quota IA utilisé.",
      });
    } catch (error) {
      setMessage({
        ok: false,
        text:
          error instanceof Error
            ? error.message
            : "Préparation des trois pages momentanément impossible.",
      });
    } finally {
      setGeneratingAll(false);
    }
  };

  const copyCodexBrief = async () => {
    if (!evidence.length) {
      setMessage({ ok: false, text: "Actualisez d’abord les opportunités vérifiées." });
      return;
    }
    await copyText(publicationPrompt(page, evidence, focus));
    markCopied("codex-brief");
    setMessage({
      ok: true,
      text: "Brief vérifié copié. Collez-le dans Codex local puis importez uniquement sa réponse JSON.",
    });
  };

  const importCodexResult = () => {
    try {
      const batch = normalizePublicationBatch(JSON.parse(codexJson), page, evidence);
      setBatches((current) => ({ ...current, [page.id]: batch }));
      setCodexJson("");
      setMessage({
        ok: true,
        text: "Réponse Codex importée : 10 publications vérifiées avec visuel.",
      });
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "JSON Codex invalide.",
      });
    }
  };

  return (
    <FullPageWorkspace
      open={open}
      onOpenChange={onOpenChange}
      title="Publications"
      description="Studio éditorial relié aux opportunités vérifiées · aucune publication automatique sur Facebook."
      icon={<Newspaper className="h-5 w-5" />}
      iconClassName="bg-rose-100 text-rose-700"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={refreshEvidence} disabled={loadingEvidence}>
            {loadingEvidence ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Actualiser les sources
          </Button>
          <Button variant="outline" onClick={onOpenAiSettings}>
            <Settings2 className="mr-2 h-4 w-4" /> Paramètres IA
          </Button>
        </div>
      }
      bodyClassName="overflow-y-auto bg-[#f0f2f5]"
    >
      <div className="mx-auto grid w-full max-w-[1520px] gap-5 px-3 py-5 lg:grid-cols-[330px_minmax(0,760px)_300px] lg:px-5">
        <aside className="space-y-4 lg:sticky lg:top-5 lg:self-start">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Marché principal
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMarket("DZ")}
                className={`rounded-xl border px-3 py-3 text-left transition ${
                  market === "DZ"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span className="text-xl">🇩🇿</span>
                <span className="ml-2 font-black">Algérie</span>
              </button>
              <button
                type="button"
                onClick={() => setMarket("TN")}
                className={`rounded-xl border px-3 py-3 text-left transition ${
                  market === "TN"
                    ? "border-red-400 bg-red-50 text-red-900"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span className="text-xl">🇹🇳</span>
                <span className="ml-2 font-black">Tunisie</span>
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="px-2 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Page Facebook
            </div>
            <div className="space-y-2">
              {pages.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPageId(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                    item.id === page.id
                      ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                      : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <PageLogo page={item} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-black text-slate-950">{item.name}</span>
                    <span className="block text-xs text-slate-500">{item.location}</span>
                  </span>
                  {batches[item.id]?.posts.length === 5 && (
                    <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                  )}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 shadow-sm">
            <div className="flex items-center gap-2 font-black">
              <ShieldCheck className="h-5 w-5 text-emerald-700" /> Garde-fou éditorial
            </div>
            <p className="mt-2 leading-6">
              Les faits viennent des connecteurs d’opportunités. L’IA rédige, mais ne crée ni
              Deadline, ni poste, ni garantie de visa.
            </p>
          </section>
        </aside>

        <main className="min-w-0 space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <PageLogo page={page} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-black text-slate-950">{page.name}</h2>
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">
                    {page.market === "DZ" ? "Dialecte algérien" : "Dialecte tunisien"}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-600">{page.editorialAngle}</p>
              </div>
              <a
                href={page.facebookUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:underline"
              >
                Voir la page <ExternalLink className="h-4 w-4" />
              </a>
            </div>

            <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setMode("zgr_local")}
                className={`rounded-xl border p-3 text-left ${
                  mode === "zgr_local"
                    ? "border-emerald-500 bg-white ring-2 ring-emerald-100"
                    : "border-transparent hover:bg-white"
                }`}
              >
                <span className="flex items-center gap-2 font-black text-slate-950">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" /> Moteur ZGR fiable
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  Immédiat, sans API, sans quota et basé uniquement sur les sources vérifiées.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMode("project_ai")}
                className={`rounded-xl border p-3 text-left ${
                  mode === "project_ai"
                    ? "border-violet-500 bg-white ring-2 ring-violet-100"
                    : "border-transparent hover:bg-white"
                }`}
              >
                <span className="flex items-center gap-2 font-black text-slate-950">
                  <Sparkles className="h-4 w-4 text-violet-600" /> IA du projet
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  Auto-switch avec secours ZGR automatique si toutes les clés échouent.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMode("codex_local")}
                className={`rounded-xl border p-3 text-left ${
                  mode === "codex_local"
                    ? "border-sky-500 bg-white ring-2 ring-sky-100"
                    : "border-transparent hover:bg-white"
                }`}
              >
                <span className="flex items-center gap-2 font-black text-slate-950">
                  <Code2 className="h-4 w-4 text-sky-600" /> Codex local
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  Brief sécurisé à copier, puis réponse JSON à importer.
                </span>
              </button>
            </div>

            <div className="mt-4">
              <label htmlFor="publication-focus" className="text-sm font-bold text-slate-800">
                Priorité facultative
              </label>
              <Input
                id="publication-focus"
                className="mt-2"
                value={focus}
                onChange={(event) => setFocus(event.target.value)}
                placeholder="Exemple : métiers de la santé, Deadline proche, service CV ATS…"
              />
            </div>

            {mode !== "codex_local" ? (
              <div className="mt-4 space-y-2">
                <Button
                  className={`w-full ${
                    mode === "zgr_local"
                      ? "bg-emerald-700 hover:bg-emerald-800"
                      : "bg-violet-600 hover:bg-violet-700"
                  }`}
                  onClick={mode === "zgr_local" ? generateLocally : generate}
                  disabled={generating || generatingAll || loadingEvidence || !evidence.length}
                >
                  {generating ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : mode === "zgr_local" ? (
                    <ShieldCheck className="mr-2 h-4 w-4" />
                  ) : (
                    <Bot className="mr-2 h-4 w-4" />
                  )}
                  Générer 10 brouillons variés + prompts image
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                  onClick={generateAllPagesLocally}
                  disabled={generating || generatingAll || loadingEvidence}
                >
                  {generatingAll ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Newspaper className="mr-2 h-4 w-4" />
                  )}
                  Préparer 30 brouillons distincts pour les 3 pages
                </Button>
              </div>
            ) : (
              <div className="mt-4 space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-3">
                <Button
                  variant="outline"
                  className="w-full border-sky-300 bg-white"
                  onClick={copyCodexBrief}
                  disabled={!evidence.length}
                >
                  {copied === "codex-brief" ? (
                    <Check className="mr-2 h-4 w-4" />
                  ) : (
                    <Clipboard className="mr-2 h-4 w-4" />
                  )}
                  Copier le brief pour Codex
                </Button>
                <Textarea
                  value={codexJson}
                  onChange={(event) => setCodexJson(event.target.value)}
                  placeholder="Collez ici uniquement l’objet JSON renvoyé par Codex…"
                  className="min-h-28 bg-white font-mono text-xs"
                />
                <Button
                  className="w-full bg-sky-700 hover:bg-sky-800"
                  onClick={importCodexResult}
                  disabled={!codexJson.trim() || !evidence.length}
                >
                  <FileCheck2 className="mr-2 h-4 w-4" /> Importer les 10 publications
                </Button>
              </div>
            )}
          </section>

          {message && (
            <div
              role="status"
              className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                message.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {message.text}
            </div>
          )}

          {currentBatch?.posts.length ? (
            <>
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-black text-emerald-950">
                      Archive des images GPT importées
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-emerald-900">
                      Après import, exportez les images réelles en PNG ou WebP dans une archive
                      organisée sous
                      <span className="mx-1 rounded bg-white px-1.5 py-0.5 font-mono text-xs">
                        PUBLICATIONS/{page.id}
                      </span>
                      pour son import dans le dossier Google Drive correspondant.
                    </p>
                  </div>
                  <Button
                    className="shrink-0 bg-emerald-700 hover:bg-emerald-800"
                    onClick={() => void downloadVisualArchive(currentBatch, page, imageUrls)}
                    disabled={!currentBatch.posts.some((post) => imageUrls[post.id])}
                  >
                    <Download className="mr-2 h-4 w-4" /> Exporter les images GPT ZIP
                  </Button>
                </div>
              </section>
              {currentBatch.posts.map((post, index) => {
                const copyValue = `${post.headline}\n\n${post.body}\n\nالمصدر الرسمي\n${post.sourceUrl}${post.applicationUrl ? `\n\nرابط الترشح\n${post.applicationUrl}` : ""}`;
                return (
                  <article
                    key={post.id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <header className="flex items-start gap-3 p-4">
                      <PageLogo page={page} />
                      <div className="min-w-0 flex-1">
                        <div className="font-black text-slate-950">{page.name}</div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                          <span>Brouillon {index + 1}/10</span>
                          <span>·</span>
                          <span>Texte + prompt image 4:5</span>
                          <span>·</span>
                          <span
                            className={imageUrls[post.id] ? "text-emerald-700" : "text-amber-700"}
                          >
                            {imageUrls[post.id] ? "image IA associée" : "image IA à associer"}
                          </span>
                          <span>·</span>
                          <BadgeCheck className="h-3.5 w-3.5 text-blue-600" />
                          <span>source vérifiée</span>
                        </div>
                      </div>
                      <a
                        href={page.facebookUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Ouvrir la page Facebook"
                      >
                        <ExternalLink className="h-4 w-4 text-slate-400" />
                      </a>
                    </header>
                    <div
                      className="px-4 pb-4 sm:px-5"
                      dir="rtl"
                      style={{ fontFamily: "Tahoma, Arial, sans-serif" }}
                    >
                      <h3 className="text-right text-lg font-black leading-8 text-slate-950">
                        {post.headline}
                      </h3>
                      <p className="mt-2 whitespace-pre-wrap text-right text-[15px] font-medium leading-8 text-slate-800">
                        {post.body}
                      </p>
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        {post.highlightedTerms.map((term) => (
                          <span
                            key={term}
                            dir="ltr"
                            className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-900"
                          >
                            {term}
                          </span>
                        ))}
                      </div>
                      <VisualPreview post={post} page={page} imageUrl={imageUrls[post.id]} />
                    </div>
                    <div className="border-y border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600 sm:px-5">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <span className="inline-flex items-center gap-1.5 font-bold text-slate-800">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />{" "}
                          {post.sourceLabel}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock className="h-3.5 w-3.5" /> {exactDeadline(post.deadlineAt)}
                        </span>
                        <span>Vérifié {formattedDate(post.checkedAt)}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3">
                        <a
                          href={post.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-blue-700 hover:underline"
                        >
                          Source officielle
                        </a>
                        {post.applicationUrl && (
                          <a
                            href={post.applicationUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-emerald-700 hover:underline"
                          >
                            Lien de candidature
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-2 p-3 sm:grid-cols-5">
                      <Button
                        variant="outline"
                        onClick={async () => {
                          await copyText(copyValue);
                          markCopied(`post-${post.id}`);
                        }}
                      >
                        {copied === `post-${post.id}` ? (
                          <Check className="mr-2 h-4 w-4" />
                        ) : (
                          <Copy className="mr-2 h-4 w-4" />
                        )}
                        Copier la publication
                      </Button>
                      <Button
                        variant="outline"
                        onClick={async () => {
                          await copyText(
                            post.comments
                              .map((comment, commentIndex) => `${commentIndex + 1}. ${comment}`)
                              .join("\n\n"),
                          );
                          markCopied(`comments-${post.id}`);
                        }}
                      >
                        <MessageCircleMore className="mr-2 h-4 w-4" /> Copier 5 commentaires
                      </Button>
                      <Button
                        variant="outline"
                        onClick={async () => {
                          await copyText(publicationImagePrompt(post, page));
                          markCopied(`image-prompt-${post.id}`);
                        }}
                      >
                        {copied === `image-prompt-${post.id}` ? (
                          <Check className="mr-2 h-4 w-4" />
                        ) : (
                          <ImageIcon className="mr-2 h-4 w-4" />
                        )}
                        Copier prompt GPT Image
                      </Button>
                      <Button variant="outline" asChild>
                        <label className="cursor-pointer">
                          <Upload className="mr-2 h-4 w-4" />
                          {imageUrls[post.id] ? "Remplacer l’image" : "Importer image GPT"}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="sr-only"
                            onChange={(event) => {
                              void importPublicationImage(post, event.target.files?.[0] || null);
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => void downloadVisual(post, page, imageUrls[post.id])}
                        disabled={!imageUrls[post.id]}
                      >
                        <Download className="mr-2 h-4 w-4" /> Télécharger l’image GPT
                      </Button>
                    </div>
                    <details className="border-t border-slate-100 px-4 py-3 sm:px-5">
                      <summary className="cursor-pointer text-sm font-bold text-slate-700">
                        Voir les 5 commentaires proposés
                      </summary>
                      <ol
                        className="mt-3 space-y-2"
                        dir="rtl"
                        style={{ fontFamily: "Tahoma, Arial, sans-serif" }}
                      >
                        {post.comments.map((comment, commentIndex) => (
                          <li
                            key={`${post.id}-${commentIndex}`}
                            className="rounded-xl bg-slate-50 px-3 py-2 text-right text-sm leading-7 text-slate-700"
                          >
                            {comment}
                          </li>
                        ))}
                      </ol>
                    </details>
                  </article>
                );
              })}
            </>
          ) : (
            <section className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
              <div className="max-w-md">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-100 text-violet-700">
                  <Newspaper className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-lg font-black text-slate-950">
                  Votre fil éditorial est prêt
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Choisissez le moteur, puis générez dix publications propres à cette page. Chaque
                  brouillon comporte un visuel Facebook vertical 4:5. Les brouillons resteront ici
                  jusqu’à leur remplacement.
                </p>
              </div>
            </section>
          )}
        </main>

        <aside className="space-y-4 lg:sticky lg:top-5 lg:self-start">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 font-black text-slate-950">
                <BadgeCheck className="h-5 w-5 text-blue-600" /> Matière fiable
              </h3>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">
                {evidence.length}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Offres ouvertes et programmes récents admissibles au marché sélectionné.
            </p>
            {evidenceCheckedAt && (
              <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                Vérifié le {formattedDate(evidenceCheckedAt)}
              </div>
            )}
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
              {loadingEvidence ? (
                <div className="flex items-center justify-center py-8 text-sm text-slate-500">
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Vérification…
                </div>
              ) : (
                evidence.slice(0, 12).map((item) => (
                  <a
                    key={`${item.source}-${item.id}`}
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border border-slate-100 p-3 transition hover:border-blue-200 hover:bg-blue-50/50"
                  >
                    <div className="line-clamp-2 text-sm font-bold leading-5 text-slate-900">
                      {item.title}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{item.source}</div>
                    <div className="mt-1 text-xs font-semibold text-amber-700">
                      {exactDeadline(item.deadlineAt)}
                    </div>
                  </a>
                ))
              )}
            </div>
          </section>

          {warnings.length > 0 && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm">
              <h3 className="flex items-center gap-2 font-black">
                <TriangleAlert className="h-5 w-5" /> Sources partielles
              </h3>
              <ul className="mt-2 space-y-2 text-xs leading-5">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="flex items-center gap-2 font-black text-slate-950">
              <ImageIcon className="h-5 w-5 text-rose-600" /> Règle de diffusion
            </h3>
            <ol className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
              <li>
                <strong className="text-slate-900">1.</strong> Vérifier le Deadline et le lien
                source.
              </li>
              <li>
                <strong className="text-slate-900">2.</strong> Relire le dialecte et le nom de la
                page.
              </li>
              <li>
                <strong className="text-slate-900">3.</strong> Copier vers Facebook après validation
                humaine.
              </li>
            </ol>
          </section>
        </aside>
      </div>
    </FullPageWorkspace>
  );
}
