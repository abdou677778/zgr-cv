import { useMemo, useState } from "react";
import { Copy, Download, ImageDown, Settings2, X } from "lucide-react";
import { Button } from "./ui/button";
import type { TechService } from "@/lib/tech-orders";
import { techLogoSource, type TechLogo } from "@/lib/tech-order-logos";
import {
  TECH_CATALOG_TITLE,
  TECH_CATALOG_COMMERCIAL_LINES,
  publicTechServices,
  publicTechArabicText,
  publicTechPrice,
  publicTechCatalogPeriod,
  techCatalogPeriodConflict,
  techCatalogPages,
} from "@/lib/tech-service-catalog";

export function TechServiceCatalogPanel({
  services,
  logos,
  onClose,
  onEdit,
}: {
  services: TechService[];
  logos: Record<string, TechLogo>;
  onClose: () => void;
  onEdit: () => void;
}) {
  const items = useMemo(() => publicTechServices(services), [services]);
  const text = useMemo(() => publicTechArabicText(items), [items]);
  const conflicts = items.filter(techCatalogPeriodConflict);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [page, setPage] = useState(0);
  const pages = techCatalogPages(items),
    current = Math.min(page, Math.max(0, pages.length - 1));
  const logo = (id: string) =>
    techLogoSource(
      services.find((s) => s.id === id),
      logos[id],
    );
  const exportImage = async (all: boolean) => {
    if (busy) return;
    setBusy(true);
    setMessage("Préparation des logos et des images…");
    try {
      const tools = await import("@/lib/tech-service-catalog-image");
      if (all) {
        const result = await tools.exportTechCatalog(items, logo);
        setMessage(
          `Pack téléchargé : ${result.pages} image(s) PNG et le texte arabe.${result.missing.length ? ` Logos indisponibles : ${[...new Set(result.missing)].join(", ")}. Importez-les dans Services et marges.` : ""}`,
        );
      } else {
        const result = await tools.drawTechCatalogPage(
          pages[current],
          logo,
          current + 1,
          pages.length,
        );
        tools.saveTechCatalogBlob(result.blob, `Services-ZGR-Tech-${current + 1}.png`);
        setMessage(
          `Image téléchargée.${result.missing.length ? ` Logos indisponibles : ${result.missing.join(", ")}.` : ""}`,
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export impossible.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="space-y-4 rounded-xl border border-amber-200 bg-white p-4"
      aria-label="Catalogue client ZGR Tech"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">Catalogue client — {TECH_CATALOG_TITLE}</h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Fermer le catalogue client"
          disabled={busy}
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        Généré depuis les tarifs et logos cloud enregistrés. Aucun coût, marge ou document
        fournisseur n’est exporté. Les nouveaux services visibles sont ajoutés automatiquement ;
        aucune modification des ventes passées.
      </p>
      {conflicts.length > 0 && (
        <p role="status" className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
          Durée à vérifier : {conflicts.map((s) => s.name).join(", ")}. Le nom et la durée
          enregistrée ne concordent pas ; l’export indique une durée à confirmer, sans modifier les
          ventes.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !items.length} onClick={() => void exportImage(true)}>
          <Download className="h-4 w-4" />
          Pack client : PNG + texte arabe
        </Button>
        <Button
          variant="outline"
          disabled={busy || !items.length}
          onClick={() => void exportImage(false)}
        >
          <ImageDown className="h-4 w-4" />
          Image PNG {current + 1}/{pages.length || 1}
        </Button>
        <Button variant="outline" disabled={busy} onClick={onEdit}>
          <Settings2 className="h-4 w-4" />
          Modifier les services / tarifs
        </Button>
      </div>
      {pages.length > 1 && (
        <div className="flex items-center gap-2 text-xs">
          <Button
            size="sm"
            variant="outline"
            disabled={busy || current === 0}
            onClick={() => setPage(current - 1)}
          >
            Précédente
          </Button>
          <span>
            Image {current + 1} sur {pages.length} · 18 services maximum par image
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || current >= pages.length - 1}
            onClick={() => setPage(current + 1)}
          >
            Suivante
          </Button>
        </div>
      )}
      {message && (
        <p role="status" className="rounded-lg bg-slate-50 p-2 text-xs text-indigo-800">
          {message}
        </p>
      )}
      <div className="overflow-hidden rounded-xl border bg-slate-50">
        <div className="flex items-center gap-3 border-b-4 border-yellow-400 bg-slate-950 p-4 text-white">
          <img
            src="/branding/zgr-tech-logo.jpg"
            alt="ZGR Tech"
            className="h-12 w-12 rounded-full object-contain"
          />
          <div>
            <h3 className="text-xl font-black">{TECH_CATALOG_TITLE}</h3>
            <p className="text-xs text-slate-300" dir="rtl">
              اشتراكات وخدمات رقمية أصلية
            </p>
          </div>
        </div>
        <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
          {(pages[current] || []).map((item) => (
            <article key={item.id} className="min-w-0 rounded-xl border bg-white p-3">
              <div className="flex items-center gap-2">
                <img
                  src={logo(item.id) || "/branding/zgr-tech-logo.jpg"}
                  alt=""
                  className="h-9 w-9 shrink-0 object-contain"
                />
                <strong className="min-w-0 break-words text-sm">{item.name}</strong>
              </div>
              <div className="mt-3 text-right" dir="rtl">
                <strong className="text-lg text-emerald-700">{publicTechPrice(item)}</strong>
                <span className="mr-2 text-xs text-slate-500">
                  / {publicTechCatalogPeriod(item)}
                </span>
                {item.invoiceAvailable && (
                  <p className="mt-1 text-xs text-indigo-700">فاتورة رسمية متاحة بعد التأكيد</p>
                )}
              </div>
            </article>
          ))}
        </div>
        {!items.length && (
          <p className="p-4 text-center text-sm text-slate-500">
            Aucun service visible dans le catalogue client.
          </p>
        )}
        <p className="px-4 pb-3 text-xs text-slate-600" dir="rtl">
          {TECH_CATALOG_COMMERCIAL_LINES.join(" ")}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold">Texte commercial arabe — prêt à copier</h3>
        <Button
          variant="outline"
          disabled={!items.length}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setMessage("Texte arabe copié.");
            } catch {
              setMessage(
                "Copie automatique indisponible : sélectionnez et copiez le texte ci-dessous.",
              );
            }
          }}
        >
          <Copy className="h-4 w-4" />
          Copier le texte arabe
        </Button>
      </div>
      <textarea
        readOnly
        aria-label="Texte commercial arabe des services"
        dir="rtl"
        value={text}
        className="min-h-64 w-full rounded-lg border bg-white p-3 text-sm leading-7"
      />
      <p className="text-[11px] text-slate-500">
        « Facture officielle disponible » est une déclaration de l’administrateur à confirmer pour
        chaque service, pas une certification automatique des fournisseurs. Les noms commerciaux
        personnalisés ne sont pas présentés comme des formules officielles vérifiées.
      </p>
    </section>
  );
}
