import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Plus,
  RefreshCw,
  Settings2,
  ShoppingCart,
  MoreVertical,
  Pencil,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { FullPageWorkspace } from "./full-page-workspace";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { authenticatedFetch } from "@/lib/auth-client";
import { SOFTWARE_ICON_CATALOG } from "@/data/software-icon-catalog";
import { loadSharedSoftwareLogos } from "@/lib/shared-software-logos";
import { techLogoSource, type TechLogo } from "@/lib/tech-order-logos";
import { normalizedTechLogo } from "@/lib/tech-logo-upload";
import { techOrderError, techServiceError } from "@/lib/tech-orders-validation";
import { TechSearchSelect } from "./tech-search-select";
import { TechRenewalMessage } from "./tech-renewal-message";
import { TechMobileOrderCard } from "./tech-mobile-order-card";
import { formatTechMoney as money } from "@/lib/tech-order-display";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import {
  addTechMonths,
  lineTotals,
  newTechLine,
  orderTotals,
  techOrdersTotals,
  techMatchesSearch,
  techDatePresets,
  renewTechOrder,
  techLineStatus,
  todayAlgiers,
  techOrderState,
  techOrderLabel,
  techClients,
  filterTechOrders,
  emptyTechFilters,
  newTechOrderForClient,
  type TechState,
  type TechFilters,
  type TechLine,
  type TechOrder,
  type TechService,
} from "@/lib/tech-orders";

const numberValue = (n: number) => (Number.isFinite(n) ? n : "");
const parseNumber = (value: string) => (value.trim() === "" ? NaN : Number(value));
const blankService = (): TechService => ({
  id: crypto.randomUUID(),
  revision: 0,
  name: "",
  icon: "generic",
  logo: "",
  priceUsd: NaN,
  rate: 260,
  saleDzd: NaN,
  months: 1,
});
const blankOrder = (): TechOrder => ({
  id: crypto.randomUUID(),
  revision: 0,
  client: "",
  facebookUrl: "",
  notes: "",
  renewalOf: "",
  lines: [],
});
const presets = [
  { name: "ChatGPT Plus", icon: "openai" },
  { name: "Claude Pro", icon: "anthropic" },
  { name: "Gemini", icon: "googlegemini" },
  { name: "Canva Pro", icon: "canva" },
  { name: "Perplexity Pro", icon: "perplexity" },
];
function Logo({ service, override }: { service?: TechService; override?: TechLogo }) {
  const src = techLogoSource(service, override);
  const [failed, setFailed] = useState("");
  return src && failed !== src ? (
    <img
      src={src}
      alt=""
      onError={() => setFailed(src)}
      className="h-8 w-8 shrink-0 rounded border bg-white p-1 object-contain"
    />
  ) : (
    <span
      title="Logo indisponible : ouvrez le service pour importer votre image."
      className="grid h-8 w-8 shrink-0 place-items-center rounded border bg-slate-100 text-xs"
    >
      —
    </span>
  );
}
function StateBadge({ state }: { state: TechState }) {
  const text =
    state === "ending" ? "Expire sous 3 jours" : state === "active" ? "Actif" : "Inactif";
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold">
      <span
        aria-hidden="true"
        className={`h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10 ${state === "ending" ? "bg-yellow-400" : state === "active" ? "bg-green-500" : "bg-red-500"}`}
      />
      {text}
    </span>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1 text-xs font-semibold text-slate-600">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Amount({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        min="0"
        step="0.01"
        max="100000000"
        inputMode="decimal"
        required
        value={numberValue(value)}
        onChange={(e) => onChange(parseNumber(e.target.value))}
      />
    </Field>
  );
}
class TechCloudError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function cloudJson(path: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await authenticatedFetch(path, { cache: "no-store", ...init });
  } catch {
    throw Error(
      "Connexion cloud interrompue. Votre saisie est conservée à l’écran. Vérifiez la connexion ; en cas d’enregistrement incertain, contrôlez le registre avant de recréer la vente.",
    );
  }
  if (response.status === 401)
    throw Error("Session expirée. Reconnectez-vous avant de poursuivre.");
  if (response.status === 403) throw Error("Ce registre est réservé aux administrateurs.");
  let body;
  try {
    body = await response.json();
  } catch {
    throw Error(
      "Réponse cloud illisible. Votre saisie reste à l’écran ; réessayez après vérification de la connexion.",
    );
  }
  if (!response.ok) throw new TechCloudError(body.error || "Cloud indisponible.", response.status);
  return body;
}

export function TechOrdersWorkspace({
  open,
  onOpenChange,
  standalone = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  standalone?: boolean;
}) {
  const [services, setServices] = useState<TechService[]>([]),
    [orders, setOrders] = useState<TechOrder[]>([]);
  const [logos, setLogos] = useState<Record<string, TechLogo>>({});
  const [, refreshLogos] = useState(0);
  const logoInput = useRef<HTMLInputElement>(null);
  const writing = useRef(false);
  const [conflict, setConflict] = useState<"logos" | "services" | "orders">();
  const [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [catalog, setCatalog] = useState(false),
    [service, setService] = useState<TechService>();
  const [order, setOrder] = useState<TechOrder>(),
    [selected, setSelected] = useState(""),
    [renewMonths, setRenewMonths] = useState(1);
  const [filters, setFilters] = useState<TechFilters>({ ...emptyTechFilters });
  const [today, setToday] = useState(todayAlgiers);
  const [renewSource, setRenewSource] = useState<TechOrder>();
  const [renewLineIds, setRenewLineIds] = useState<string[]>([]);
  const [pendingLine, setPendingLine] = useState<TechLine>();
  const [visibleCount, setVisibleCount] = useState(25);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [messageOrderId, setMessageOrderId] = useState<string>();
  const messageOrder = orders.find((item) => item.id === messageOrderId);
  const messageReturnFocus = useRef<HTMLElement | null>(null);
  const messageOpening = useRef(false);
  const openRenewalMessage = (item: TechOrder, trigger: HTMLElement | null) => {
    messageReturnFocus.current = trigger;
    messageOpening.current = true;
    setMessageOrderId(item.id);
  };
  const hasDraft = !!(order || service);
  useEffect(() => {
    if (!hasDraft) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasDraft]);
  useEffect(() => {
    setVisibleCount(25);
  }, [filters, orders.length]);
  const load = useCallback(async () => {
    setBusy(true);
    setMessage("");
    try {
      const data = await cloudJson("/api/tech-orders");
      setServices(data.services);
      setOrders(data.orders);
      setLogos(data.logos || {});
      setLoaded(true);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    if (open) {
      void load();
      void loadSharedSoftwareLogos(true);
    }
    const update = () => refreshLogos((value) => value + 1);
    window.addEventListener("zgr-software-logos", update);
    return () => window.removeEventListener("zgr-software-logos", update);
  }, [open, load]);
  useEffect(() => {
    const sync = () => setToday(todayAlgiers());
    const timer = window.setInterval(sync, 60000);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  const editorId = order?.id || renewSource?.id;
  useEffect(() => {
    if (editorId)
      document
        .getElementById("tech-order-editor")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editorId]);
  const uploadLogo = async (file: File) => {
    if (!service || writing.current) return;
    writing.current = true;
    setConflict(undefined);
    const target = { id: service.id, icon: service.icon };
    setBusy(true);
    setMessage("Préparation du logo, puis enregistrement dans le cloud…");
    try {
      const dataUrl = await normalizedTechLogo(file);
      const data = await cloudJson(`/api/tech-orders/logos/${target.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...target, revision: logos[target.id]?.revision ?? 0, dataUrl }),
      });
      setLogos((current) => ({ ...current, [target.id]: data.record }));
      setService((current) =>
        current?.id === target.id && current.icon === target.icon
          ? { ...current, logo: data.record.dataUrl }
          : current,
      );
      setServices((current) =>
        current.map((item) =>
          item.id === target.id && item.icon === target.icon
            ? { ...item, logo: data.record.dataUrl }
            : item,
        ),
      );
      setMessage(
        "Logo enregistré dans le cloud Tech Orders. Enregistrez aussi la fiche du service si elle est nouvelle. Les prix et logos CV restent inchangés.",
      );
    } catch (error) {
      if (error instanceof TechCloudError && error.status === 409) setConflict("logos");
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      writing.current = false;
      setBusy(false);
    }
  };
  const clients = useMemo(() => techClients(orders), [orders]);
  const filtered = useMemo(
    () => filterTechOrders(orders, filters, today),
    [orders, filters, today],
  );
  const invalidDates = !!(filters.from && filters.to && filters.from > filters.to);
  const setFilter = <K extends keyof TechFilters>(key: K, value: TechFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const startSameClient = (source: TechOrder) => {
    setOrder(newTechOrderForClient(source));
    setRenewSource(undefined);
    setSelected("");
    setPendingLine(undefined);
    setMessage(
      "Nouvelle vente pour ce client : ajoutez un ou plusieurs services, sans modifier ses ventes précédentes.",
    );
  };
  const startRenewal = (source: TechOrder) => {
    setRenewSource(source);
    setRenewLineIds(source.lines.map((line) => line.id));
    setMessage(
      "Choisissez les services et la période, puis préparez le renouvellement. Aucune vente n’est encore enregistrée.",
    );
  };
  const editService = (next?: TechService) => {
    if (
      service &&
      next?.id !== service.id &&
      JSON.stringify(service) !== JSON.stringify(services.find((item) => item.id === service.id)) &&
      !window.confirm(
        "Abandonner les modifications non enregistrées de ce service ? Un logo déjà envoyé au cloud reste enregistré.",
      )
    )
      return;
    setService(next);
  };
  const actionsFor = (item: TechOrder) => (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={busy || !!order || !!renewSource}
        onClick={() => {
          setOrder(structuredClone(item));
          setMessage("");
          setSelected("");
          setPendingLine(undefined);
        }}
      >
        Modifier
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={busy || !!order || !!renewSource}
        onClick={() => startRenewal(item)}
      >
        Renouveler
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={busy || !!order || !!renewSource}
        onClick={() => startSameClient(item)}
      >
        Autre service / vente
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={busy || !!order || !!service || !!renewSource}
        onClick={(event) => openRenewalMessage(item, event.currentTarget)}
      >
        Message de renouvellement
      </Button>
    </div>
  );
  const mobileMenu = (item: TechOrder) => {
    const disabled = busy || !!order || !!service || !!renewSource;
    const triggerId = `tech-actions-${item.id}`;
    return (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            id={triggerId}
            size="icon"
            variant="ghost"
            disabled={busy}
            className="h-10 w-10 text-indigo-700"
            aria-label={`Actions pour ${item.client}`}
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="z-[160] w-64 rounded-xl p-1.5 shadow-xl"
          collisionPadding={12}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!messageOpening.current)
              document.getElementById(triggerId)?.focus({ preventScroll: true });
          }}
        >
          <DropdownMenuItem
            disabled={disabled}
            className="min-h-11 rounded-lg"
            onSelect={() => {
              setOrder(structuredClone(item));
              setMessage("");
              setSelected("");
              setPendingLine(undefined);
            }}
          >
            <Pencil />
            Modifier
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disabled}
            className="min-h-11 rounded-lg"
            onSelect={() => startRenewal(item)}
          >
            <RefreshCw />
            Renouveler
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disabled}
            className="min-h-11 rounded-lg"
            onSelect={() => startSameClient(item)}
          >
            <Plus />
            Autre service / vente
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disabled}
            className="min-h-11 rounded-lg"
            onSelect={() => openRenewalMessage(item, document.getElementById(triggerId))}
          >
            <MessageSquare />
            Message de renouvellement
          </DropdownMenuItem>
          {(item.facebookUrl || item.lines.some((line) => line.invoiceUrl)) && (
            <DropdownMenuSeparator />
          )}
          {item.facebookUrl && (
            <DropdownMenuItem asChild className="min-h-11 rounded-lg">
              <a href={item.facebookUrl} target="_blank" rel="noreferrer noopener">
                <ExternalLink />
                Profil du client
              </a>
            </DropdownMenuItem>
          )}
          {item.lines
            .filter((line) => line.invoiceUrl)
            .map((line) => (
              <DropdownMenuItem key={line.id} asChild className="min-h-11 rounded-lg">
                <a href={line.invoiceUrl} target="_blank" rel="noreferrer noopener">
                  <ExternalLink />
                  <span className="min-w-0 truncate">Facture — {line.name}</span>
                </a>
              </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };
  const totals = techOrdersTotals(filtered);
  const allTotals = techOrdersTotals(orders);
  const visible = filtered.slice(0, visibleCount);
  const stateCounts = useMemo(
    () =>
      orders.reduce(
        (counts, item) => {
          counts[techOrderState(item, today)]++;
          return counts;
        },
        { active: 0, ending: 0, inactive: 0 },
      ),
    [orders, today],
  );
  const mutateLine = (id: string, patch: Partial<TechLine>) =>
    setOrder((current) =>
      current
        ? {
            ...current,
            lines: current.lines.map((line) => (line.id === id ? { ...line, ...patch } : line)),
          }
        : current,
    );
  const saveService = async () => {
    if (!service || writing.current) return;
    const error = techServiceError(service);
    if (error) {
      setMessage(error);
      return;
    }
    writing.current = true;
    setConflict(undefined);
    setBusy(true);
    setMessage("");
    try {
      const data = await cloudJson(`/api/tech-orders/services/${service.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(service),
      });
      setServices((current) => [...current.filter((s) => s.id !== service.id), data.record]);
      setService(undefined);
      setMessage("Service et logo enregistrés dans le cloud Tech Orders.");
    } catch (e) {
      if (e instanceof TechCloudError && e.status === 409) setConflict("services");
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      writing.current = false;
      setBusy(false);
    }
  };
  const saveOrder = async (next = false) => {
    if (!order || writing.current) return;
    if (pendingLine) {
      setMessage(
        "Ajoutez le service sélectionné à la vente avant d’enregistrer, ou effacez sa sélection.",
      );
      return;
    }
    const error = techOrderError(order, services);
    if (error) {
      setMessage(error);
      return;
    }
    writing.current = true;
    setConflict(undefined);
    setBusy(true);
    setMessage("");
    try {
      const data = await cloudJson(`/api/tech-orders/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order),
      });
      setOrders((current) => [...current.filter((o) => o.id !== order.id), data.record]);
      setOrder(next ? blankOrder() : undefined);
      setPendingLine(undefined);
      setSelected("");
      setMessage(
        `Vente ${techOrderLabel(data.record)} enregistrée dans le cloud.${next ? " Saisissez le client suivant." : " Les filtres actuels restent appliqués au registre."}`,
      );
    } catch (e) {
      if (e instanceof TechCloudError && e.status === 409) setConflict("orders");
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      writing.current = false;
      setBusy(false);
    }
  };
  const recoverConflict = async () => {
    if (!conflict || busy) return;
    if (
      conflict !== "logos" &&
      !window.confirm(
        "Remplacer le brouillon concerné par sa version cloud ? Ses modifications non enregistrées seront abandonnées. Aucune vente ne sera supprimée.",
      )
    )
      return;
    setBusy(true);
    try {
      const data = await cloudJson("/api/tech-orders");
      setServices(data.services);
      setOrders(data.orders);
      setLogos(data.logos || {});
      if (conflict === "services" && service) {
        const fresh = data.services.find((s: TechService) => s.id === service.id);
        if (fresh) setService(fresh);
      }
      if (conflict === "orders" && order) {
        const fresh = data.orders.find((o: TechOrder) => o.id === order.id);
        if (fresh) setOrder(fresh);
        setPendingLine(undefined);
        setSelected("");
      }
      setMessage(
        conflict === "logos"
          ? "Logo cloud actuel récupéré, saisie des prix conservée. Vérifiez son aperçu avant de choisir une nouvelle image."
          : "Version cloud récupérée. Vérifiez son contenu avant de reprendre vos modifications.",
      );
      setConflict(undefined);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <FullPageWorkspace
      backLabel={standalone ? "Déconnexion" : "Retour à l’accueil"}
      wrapHeaderActions
      open={open}
      onOpenChange={(value) => {
        if (
          (order || service) &&
          !window.confirm("Quitter sans enregistrer le formulaire en cours ?")
        )
          return;
        onOpenChange(value);
      }}
      title="ZGR Tech Orders"
      description="Ventes et abonnements. Espace privé indépendant des dossiers CV."
      icon={<ShoppingCart className="h-5 w-5" />}
      iconClassName="bg-indigo-100 text-indigo-700"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy || !!order || !!service || !!renewSource}
            onClick={() => void load()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualiser
          </Button>
          <Button
            variant="outline"
            disabled={!loaded || busy}
            onClick={() => setCatalog((value) => !value)}
          >
            <Settings2 className="mr-2 h-4 w-4" />
            Services et marges
          </Button>
          <Button
            variant="outline"
            disabled={!loaded || busy || invalidDates}
            onClick={async () => {
              setBusy(true);
              try {
                const { buildTechOrdersXlsx } = await import("@/lib/tech-orders-excel");
                const bytes = buildTechOrdersXlsx(filtered);
                const { saveTechExcel } = await import("@/lib/tech-mobile-export");
                saveTechExcel(bytes, `zgr-tech-orders-${todayAlgiers()}.xlsx`);
                setMessage(
                  "Export préparé : confirmez son enregistrement sur votre appareil. Une ligne par service, sans double comptage.",
                );
              } catch (e) {
                setMessage(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Excel
          </Button>
          <Button
            disabled={!loaded || busy || !!order || !!renewSource}
            onClick={() => {
              setOrder(blankOrder());
              setSelected("");
              setPendingLine(undefined);
              setCatalog(false);
              setMessage("");
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle vente
          </Button>
        </div>
      }
      bodyClassName="overflow-y-auto"
    >
      <div className="mx-auto w-full max-w-[1800px] space-y-5 p-5 sm:p-8">
        <DialogPrimitive.Root
          open={!!messageOrder}
          onOpenChange={(open) => {
            if (!open) setMessageOrderId(undefined);
          }}
        >
          {messageOrder && (
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="fixed inset-0 z-[150] bg-slate-950/50" />
              <DialogPrimitive.Content
                className="fixed left-1/2 top-1/2 z-[151] flex max-h-[90dvh] w-[calc(100vw_-_16px)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl outline-none"
                onEscapeKeyDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setMessageOrderId(undefined);
                }}
                onCloseAutoFocus={(event) => {
                  event.preventDefault();
                  messageOpening.current = false;
                  messageReturnFocus.current?.focus({ preventScroll: true });
                }}
              >
                <DialogPrimitive.Title className="sr-only">
                  Message de renouvellement pour {messageOrder.client}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="sr-only">
                  Préparez et copiez votre message, puis fermez cette fenêtre pour retrouver votre
                  position dans la liste.
                </DialogPrimitive.Description>
                <div className="min-h-0 overflow-y-auto overscroll-contain">
                  <TechRenewalMessage
                    key={messageOrder.id}
                    order={messageOrder}
                    orders={orders}
                    today={today}
                    onClose={() => setMessageOrderId(undefined)}
                  />
                </div>
                <div className="flex shrink-0 justify-end border-t bg-white px-4 py-3">
                  <Button onClick={() => setMessageOrderId(undefined)}>Retour à la liste</Button>
                </div>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          )}
        </DialogPrimitive.Root>
        <div className="grid gap-3 sm:grid-cols-3" aria-label="Accès rapide par état">
          {(["active", "ending", "inactive"] as TechState[]).map((state) => (
            <button
              key={state}
              type="button"
              aria-pressed={filters.state === state}
              onClick={() => setFilters({ ...emptyTechFilters, state })}
              className={`flex items-center justify-between gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-indigo-300 ${filters.state === state ? "ring-2 ring-indigo-300" : ""}`}
            >
              <StateBadge state={state} />
              <strong className="text-2xl tabular-nums text-slate-900">{stateCounts[state]}</strong>
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Coût DA = USD × taux saisi. Marge brute = vente − coût, hors frais et taxes. Les prix sont
          saisis par vous ; aucune facture fournisseur n’est générée par ZGR.
        </p>
        {message && (
          <p role="status" className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm">
            {message}
          </p>
        )}
        {conflict && (
          <Button disabled={busy} variant="outline" onClick={() => void recoverConflict()}>
            {conflict === "logos"
              ? "Récupérer le logo cloud actuel — conserver les prix"
              : "Récupérer la version cloud du brouillon"}
          </Button>
        )}
        {renewSource && (
          <section
            id="tech-order-editor"
            className="space-y-3 rounded-xl border border-indigo-200 bg-white p-4"
          >
            <h2 className="font-bold">Renouvellement — {renewSource.client}</h2>
            <p className="text-xs text-slate-500">
              Cochez un ou plusieurs services à renouveler. Vous pourrez aussi ajouter d’autres
              services et corriger les prix avant l’enregistrement.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {renewSource.lines.map((line) => (
                <label
                  key={line.id}
                  className="flex items-center gap-2 rounded-lg border p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={renewLineIds.includes(line.id)}
                    onChange={(e) =>
                      setRenewLineIds((current) =>
                        e.target.checked
                          ? [...current, line.id]
                          : current.filter((id) => id !== line.id),
                      )
                    }
                  />
                  <Logo
                    service={services.find((s) => s.id === line.serviceId)}
                    override={logos[line.serviceId]}
                  />
                  <span>
                    {line.name}
                    <small className="block text-slate-500">Fin : {line.end}</small>
                  </span>
                </label>
              ))}
            </div>
            <Field label="Période à renouveler">
              <select
                className="h-9 rounded border px-2"
                value={renewMonths}
                onChange={(e) => setRenewMonths(Number(e.target.value))}
              >
                {[1, 3, 6, 12].map((m) => (
                  <option key={m} value={m}>
                    {m} mois
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy || !renewLineIds.length}
                onClick={() => {
                  setOrder(
                    renewTechOrder(
                      {
                        ...renewSource,
                        lines: renewSource.lines.filter((line) => renewLineIds.includes(line.id)),
                      },
                      services,
                      renewMonths,
                      today,
                    ),
                  );
                  setRenewSource(undefined);
                  setSelected("");
                  setPendingLine(undefined);
                  setMessage(
                    "Renouvellement préparé : vérifiez dates et prix, puis ajoutez d’autres services si nécessaire. Rien n’est encore enregistré.",
                  );
                }}
              >
                Préparer le renouvellement
              </Button>
              <Button variant="outline" onClick={() => startSameClient(renewSource)}>
                Ajouter seulement un nouveau service
              </Button>
              <Button variant="outline" onClick={() => setRenewSource(undefined)}>
                Annuler
              </Button>
            </div>
          </section>
        )}
        {catalog && (
          <section className="space-y-4 rounded-xl border bg-white p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <h2 className="font-bold">Catalogue privé des services</h2>
              <Button disabled={busy} variant="outline" onClick={() => editService(blankService())}>
                Ajouter un service
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Tarifs pour la durée standard indiquée. Le taux initial 260 DA/USD est une hypothèse
              modifiable. Modifier ici n’altère aucune vente passée. Un logo personnalisé reste
              propre à Tech Orders.
            </p>
            <Input
              aria-label="Rechercher dans le catalogue des services"
              placeholder="Rechercher un service ou une formule…"
              value={catalogQuery}
              onChange={(e) => setCatalogQuery(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {services
                .filter((s) => techMatchesSearch(s.name, catalogQuery))
                .map((s) => (
                  <button
                    key={s.id}
                    disabled={busy}
                    className="flex items-center gap-2 rounded-lg border p-2 text-sm"
                    onClick={() => editService({ ...s })}
                  >
                    <Logo service={s} override={logos[s.id]} />
                    <span>
                      {s.name}
                      <small className="block text-slate-500">
                        {money(s.saleDzd)} / {s.months} mois
                      </small>
                    </span>
                  </button>
                ))}
            </div>
            {service && (
              <form
                className="space-y-3 rounded-lg bg-slate-50 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveService();
                }}
              >
                <fieldset disabled={busy} className="min-w-0 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {presets.map((p) => (
                      <button
                        type="button"
                        key={p.name}
                        className="rounded border bg-white px-2 py-1 text-xs"
                        onClick={() =>
                          setService((current) =>
                            current ? { ...current, ...p, logo: "" } : current,
                          )
                        }
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <Field label="Nom / formule">
                      <Input
                        required
                        maxLength={120}
                        value={service.name}
                        onChange={(e) => setService({ ...service, name: e.target.value })}
                      />
                    </Field>
                    <Amount
                      label="Prix fournisseur USD / période"
                      value={service.priceUsd}
                      onChange={(value) => setService({ ...service, priceUsd: value })}
                    />
                    <Amount
                      label="Taux DA / USD"
                      value={service.rate}
                      onChange={(value) => setService({ ...service, rate: value })}
                    />
                    <Amount
                      label="Prix vente DA / période"
                      value={service.saleDzd}
                      onChange={(value) => setService({ ...service, saleDzd: value })}
                    />
                    <Field label="Durée standard (mois)">
                      <Input
                        type="number"
                        required
                        min={1}
                        max={36}
                        value={service.months}
                        onChange={(e) => setService({ ...service, months: Number(e.target.value) })}
                      />
                    </Field>
                    <Field label="Logo officiel du catalogue">
                      <TechSearchSelect
                        label="Logo officiel du catalogue"
                        disabled={busy}
                        value={service.icon}
                        options={[
                          { value: "generic", label: "Sans logo" },
                          ...SOFTWARE_ICON_CATALOG.map((s) => ({ value: s.slug, label: s.title })),
                        ]}
                        onChange={(icon) => setService({ ...service, icon, logo: "" })}
                        placeholder="Canva, ChatGPT, Adobe…"
                      />
                    </Field>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded-lg p-1 ring-indigo-300 hover:ring-2 focus-visible:ring-2"
                      aria-label={`Remplacer le logo cloud de ${service.name || "ce service"}`}
                      title="Cliquer pour choisir un logo local et l’enregistrer dans le cloud"
                      onClick={() => logoInput.current?.click()}
                    >
                      <Logo service={service} override={logos[service.id]} />
                    </button>
                    <Field label="Cliquer sur le logo ou choisir un fichier — sauvegarde cloud immédiate">
                      <input
                        ref={logoInput}
                        type="file"
                        disabled={busy}
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.currentTarget.value = "";
                          if (!file) return;
                          await uploadLogo(file);
                        }}
                      />
                    </Field>
                    <p className="text-sm">
                      Coût : {money(lineTotals(service).cost)} · Marge :{" "}
                      {money(lineTotals(service).margin)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button disabled={busy}>Enregistrer le service et le logo</Button>
                    <Button type="button" variant="outline" onClick={() => editService(undefined)}>
                      Annuler
                    </Button>
                  </div>
                  {message && <p className="text-sm text-indigo-800">{message}</p>}
                </fieldset>
              </form>
            )}
          </section>
        )}
        {order && (
          <form
            id="tech-order-editor"
            className="space-y-4 rounded-xl border border-indigo-200 bg-white p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void saveOrder();
            }}
          >
            <fieldset disabled={busy} className="min-w-0 space-y-4">
              <h2 className="font-bold">
                {order.revision
                  ? "Modifier la vente"
                  : order.renewalOf
                    ? "Nouveau renouvellement"
                    : "Nouvelle vente"}{" "}
                <small className="font-normal text-slate-500">
                  TECH-{order.id.slice(0, 8).toUpperCase()}
                </small>
              </h2>
              <Field label="Client existant (facultatif)">
                <TechSearchSelect
                  label="Client existant"
                  disabled={busy || !!order.revision}
                  value={
                    clients.find(
                      (c) => c.client === order.client && c.facebookUrl === order.facebookUrl,
                    )?.key || ""
                  }
                  options={clients.map((c) => ({
                    value: c.key,
                    label: c.client,
                    detail: c.facebookUrl,
                  }))}
                  onChange={(key) => {
                    const client = clients.find((c) => c.key === key);
                    if (client)
                      setOrder({
                        ...order,
                        client: client.client,
                        facebookUrl: client.facebookUrl,
                      });
                  }}
                  placeholder="Rechercher un client par nom ou Facebook…"
                />
                <small className="font-normal text-slate-500">
                  Nouveau client ? Saisissez directement son nom ci-dessous.
                </small>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Client">
                  <Input
                    required
                    maxLength={180}
                    value={order.client}
                    onChange={(e) => setOrder({ ...order, client: e.target.value })}
                  />
                </Field>
                <Field label="Lien Facebook (HTTPS, optionnel)">
                  <Input
                    type="url"
                    value={order.facebookUrl}
                    onChange={(e) => setOrder({ ...order, facebookUrl: e.target.value })}
                  />
                </Field>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="w-full sm:max-w-md">
                  <TechSearchSelect
                    label="Service à ajouter à la vente"
                    disabled={busy}
                    value={selected}
                    options={services.map((s) => ({
                      value: s.id,
                      label: s.name,
                      detail: `${money(s.saleDzd)} · ${s.months} mois`,
                      leading: <Logo service={s} override={logos[s.id]} />,
                    }))}
                    onChange={(id) => {
                      setSelected(id);
                      const service = services.find((s) => s.id === id);
                      setPendingLine(service ? newTechLine(service) : undefined);
                    }}
                    placeholder="Rechercher et choisir un service…"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    !pendingLine ||
                    !Number.isFinite(pendingLine.saleDzd) ||
                    pendingLine.saleDzd < 0 ||
                    pendingLine.saleDzd > 100000000 ||
                    busy ||
                    order.lines.length >= 30
                  }
                  onClick={() => {
                    if (pendingLine) {
                      setOrder({
                        ...order,
                        lines: [...order.lines, { ...pendingLine, id: crypto.randomUUID() }],
                      });
                      setPendingLine(undefined);
                      setSelected("");
                    }
                  }}
                >
                  Ajouter à la vente
                </Button>
                {!services.length && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCatalog(true);
                      setService(blankService());
                    }}
                  >
                    Créer d’abord un service
                  </Button>
                )}
              </div>
              {pendingLine && (
                <div
                  className="flex flex-wrap items-center gap-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3"
                  aria-label="Aperçu du service sélectionné"
                >
                  <Logo
                    service={services.find((s) => s.id === pendingLine.serviceId)}
                    override={logos[pendingLine.serviceId]}
                  />
                  <div className="min-w-36 text-sm">
                    <strong>{pendingLine.name}</strong>
                    <small className="block text-slate-500">
                      Prix du catalogue :{" "}
                      {money(services.find((s) => s.id === pendingLine.serviceId)?.saleDzd ?? NaN)}
                    </small>
                  </div>
                  <Amount
                    label="Prix de vente de ce service (DA) — modifiable"
                    value={pendingLine.saleDzd}
                    onChange={(value) => setPendingLine({ ...pendingLine, saleDzd: value })}
                  />
                  <p className="text-sm">
                    Coût : {money(lineTotals(pendingLine).cost)} · Marge :{" "}
                    <strong>{money(lineTotals(pendingLine).margin)}</strong>
                    <small className="block text-slate-500">
                      Ce prix s’applique uniquement à cette vente après « Ajouter à la vente ».
                    </small>
                  </p>
                  <button
                    type="button"
                    className="text-xs text-slate-600 underline"
                    onClick={() => {
                      setPendingLine(undefined);
                      setSelected("");
                    }}
                  >
                    Effacer cette sélection
                  </button>
                </div>
              )}
              {order.lines.map((line) => (
                <fieldset
                  key={line.id}
                  className="min-w-0 space-y-3 rounded-lg border bg-slate-50 p-3"
                >
                  <legend className="max-w-full px-2 text-sm font-bold">
                    <span className="inline-flex max-w-full items-center gap-2 break-words">
                      <Logo
                        service={services.find((s) => s.id === line.serviceId)}
                        override={logos[line.serviceId]}
                      />
                      {line.name}
                    </span>
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <Field label="Début inclus">
                      <Input
                        type="date"
                        required
                        value={line.start}
                        onChange={(e) => mutateLine(line.id, { start: e.target.value })}
                      />
                    </Field>
                    <Field label="Fin / renouveler le (exclue)">
                      <Input
                        type="date"
                        required
                        min={line.start}
                        value={line.end}
                        onChange={(e) => mutateLine(line.id, { end: e.target.value })}
                      />
                    </Field>
                    <Field label="Ajuster la fin par période">
                      <select
                        className="h-9 min-w-0 max-w-full rounded border bg-white px-2"
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value)
                            mutateLine(line.id, {
                              end: addTechMonths(line.start, Number(e.target.value)),
                            });
                          e.target.value = "";
                        }}
                      >
                        <option value="">Date personnalisée</option>
                        {[1, 3, 6, 12].map((m) => (
                          <option key={m} value={m}>
                            {m} mois depuis le début
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Amount
                      label="Coût fournisseur USD / période"
                      value={line.priceUsd}
                      onChange={(value) => mutateLine(line.id, { priceUsd: value })}
                    />
                    <Amount
                      label="Taux DA / USD"
                      value={line.rate}
                      onChange={(value) => mutateLine(line.id, { rate: value })}
                    />
                    <Amount
                      label="Prix vente DA / période"
                      value={line.saleDzd}
                      onChange={(value) => mutateLine(line.id, { saleDzd: value })}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Changer les dates ne change pas les montants : saisissez les prix réels pour
                    toute la période. La date de fin est le jour du renouvellement.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Référence facture réelle du fournisseur">
                      <Input
                        maxLength={180}
                        value={line.invoiceRef}
                        onChange={(e) => mutateLine(line.id, { invoiceRef: e.target.value })}
                      />
                    </Field>
                    <Field label="Lien HTTPS vers la facture fournisseur (optionnel)">
                      <Input
                        type="url"
                        value={line.invoiceUrl}
                        onChange={(e) => mutateLine(line.id, { invoiceUrl: e.target.value })}
                      />
                    </Field>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <span>
                      Coût : {money(lineTotals(line).cost)} · Marge :{" "}
                      <strong
                        className={
                          lineTotals(line).margin < 0 ? "text-red-700" : "text-emerald-700"
                        }
                      >
                        {money(lineTotals(line).margin)}
                      </strong>
                    </span>
                    <button
                      type="button"
                      className="text-xs text-red-700 underline"
                      onClick={() =>
                        setOrder({ ...order, lines: order.lines.filter((l) => l.id !== line.id) })
                      }
                    >
                      Retirer du formulaire
                    </button>
                  </div>
                </fieldset>
              ))}
              <Field label="Notes (ne pas saisir de mot de passe ou de numéro de carte)">
                <Input
                  maxLength={3000}
                  value={order.notes}
                  onChange={(e) => setOrder({ ...order, notes: e.target.value })}
                />
              </Field>
              <p className="font-bold">
                Total : {money(orderTotals(order).sale)} · Coût : {money(orderTotals(order).cost)} ·
                Marge : {money(orderTotals(order).margin)}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy || !order.lines.length}>Enregistrer la vente</Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !order.lines.length}
                  onClick={(e) => {
                    if (e.currentTarget.form?.reportValidity()) void saveOrder(true);
                  }}
                >
                  Enregistrer et saisir la suivante
                </Button>
                <Button type="button" variant="outline" onClick={() => setOrder(undefined)}>
                  Annuler
                </Button>
              </div>
              {message && <p className="text-sm text-indigo-800">{message}</p>}
            </fieldset>
          </form>
        )}
        <section
          className="space-y-3 rounded-xl border bg-white p-4"
          aria-label="Filtres et totaux"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Recherche rapide">
              <Input
                value={filters.query}
                onChange={(e) => setFilter("query", e.target.value)}
                placeholder="Client, commande, service…"
              />
            </Field>
            <Field label="Filtrer par client">
              <TechSearchSelect
                label="Filtrer par client"
                value={filters.client}
                options={[
                  { value: "", label: "Tous les clients" },
                  ...clients.map((c) => ({ value: c.key, label: c.client, detail: c.facebookUrl })),
                ]}
                onChange={(key) => setFilter("client", key)}
                placeholder="Nom ou lien Facebook…"
              />
            </Field>
            <Field label="Commande / ID">
              <Input
                value={filters.orderId}
                onChange={(e) => setFilter("orderId", e.target.value)}
                placeholder="TECH-… ou ID complet"
              />
            </Field>
            <Field label="Filtrer par état">
              <select
                className="h-9 rounded border bg-white px-2"
                value={filters.state}
                onChange={(e) => setFilter("state", e.target.value as TechFilters["state"])}
              >
                <option value="">Tous les états</option>
                <option value="active">Vert — Actif</option>
                <option value="ending">Jaune — Expire sous 3 jours</option>
                <option value="inactive">Rouge — Inactif</option>
              </select>
            </Field>
          </div>
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-indigo-700">
              Filtres par service et dates
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Service">
                <TechSearchSelect
                  label="Filtrer par service"
                  value={filters.serviceId}
                  options={[
                    { value: "", label: "Tous les services" },
                    ...services.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                  onChange={(id) => setFilter("serviceId", id)}
                />
              </Field>
              <Field label="Date à contrôler">
                <select
                  className="h-9 rounded border bg-white px-2"
                  value={filters.dateBasis}
                  onChange={(e) =>
                    setFilter("dateBasis", e.target.value as TechFilters["dateBasis"])
                  }
                >
                  <option value="end">Fin d’abonnement</option>
                  <option value="start">Début d’abonnement</option>
                  <option value="created">Création de la vente</option>
                </select>
              </Field>
              <Field label="Du (inclus)">
                <Input
                  type="date"
                  value={filters.from}
                  onChange={(e) => setFilter("from", e.target.value)}
                />
              </Field>
              <Field label="Au (inclus)">
                <Input
                  type="date"
                  value={filters.to}
                  onChange={(e) => setFilter("to", e.target.value)}
                />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>Échéances :</span>
              {techDatePresets(today).map((range) => (
                <Button
                  key={range.label}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      dateBasis: "end",
                      from: range.from,
                      to: range.to,
                    }))
                  }
                >
                  {range.label}
                </Button>
              ))}
            </div>
          </details>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Trier les ventes">
              <select
                className="h-9 rounded-lg border bg-white px-3"
                value={filters.sort}
                onChange={(e) => setFilter("sort", e.target.value as TechFilters["sort"])}
              >
                <option value="recent">Plus récentes</option>
                <option value="ending">Prochaine échéance</option>
                <option value="client">Client A–Z</option>
                <option value="sale-desc">Montant décroissant</option>
              </select>
            </Field>
          </div>
          <Button size="sm" variant="outline" onClick={() => setFilters({ ...emptyTechFilters })}>
            Réinitialiser les filtres
          </Button>
          {invalidDates && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              La date de début du filtre doit précéder sa date de fin. Corrigez la période ;
              l’export est suspendu.
            </p>
          )}
          <div className="flex flex-wrap gap-6 text-sm">
            <span>
              {filtered.length} vente(s) sur {orders.length} · {techClients(filtered).length}{" "}
              client(s)
            </span>
            <span>
              Ventes <strong>{money(totals.sale)}</strong>
            </span>
            <span>
              Coûts <strong>{money(totals.cost)}</strong>
            </span>
            <span>
              Marge brute{" "}
              <strong className={totals.margin < 0 ? "text-red-700" : "text-emerald-700"}>
                {money(totals.margin)}
              </strong>
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Totaux des ventes retenues, tous leurs services inclus. Ensemble du registre : ventes{" "}
            {money(allTotals.sale)} · coûts {money(allTotals.cost)} · marge{" "}
            {money(allTotals.margin)}.
          </p>
          <p className="text-xs text-slate-500">
            État de chaque vente : jaune si un service actif expire d’ici 3 jours ; sinon vert si au
            moins un service est actif ; sinon rouge. Un service à venir n’est pas encore actif.
          </p>
        </section>
        <div className="space-y-3 md:hidden">
          {visible.map((item) => (
            <TechMobileOrderCard
              key={item.id}
              order={item}
              today={today}
              renderLogo={(serviceId) => (
                <Logo
                  service={services.find((s) => s.id === serviceId)}
                  override={logos[serviceId]}
                />
              )}
              menu={mobileMenu(item)}
            />
          ))}
          {!filtered.length && (
            <p className="rounded-xl border bg-white p-6 text-center text-sm text-slate-500">
              {busy ? "Chargement…" : "Aucune vente pour ces filtres."}
            </p>
          )}
        </div>
        <div className="hidden overflow-x-auto rounded-xl border bg-white md:block">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                {[
                  "ID",
                  "Client",
                  "État",
                  "Services / dates / état",
                  "Coût DA",
                  "Total DA",
                  "Marge DA",
                  "Actions",
                ].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                const value = orderTotals(item);
                return (
                  <tr key={item.id} className="border-t align-top">
                    <td className="px-4 py-4 font-mono text-xs" title={item.id}>
                      TECH-{item.id.slice(0, 8).toUpperCase()}
                      {item.renewalOf && (
                        <small className="block text-indigo-600">Renouvellement</small>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <strong>{item.client}</strong>
                      {item.facebookUrl && (
                        <a
                          href={item.facebookUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block text-xs text-blue-700 underline"
                        >
                          Facebook
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <StateBadge state={techOrderState(item, today)} />
                    </td>
                    <td className="space-y-2 px-4 py-4">
                      {item.lines.map((line) => (
                        <div key={line.id} className="flex gap-2">
                          <Logo
                            service={services.find((s) => s.id === line.serviceId)}
                            override={logos[line.serviceId]}
                          />
                          <div>
                            {line.name}
                            <small className="block text-slate-500">
                              {line.start} → {line.end} ·{" "}
                              <span
                                className={
                                  techLineStatus(line, today) === "Expiré"
                                    ? "text-red-700"
                                    : techLineStatus(line, today) === "Expire sous 3 jours"
                                      ? "text-amber-700"
                                      : ""
                                }
                              >
                                {techLineStatus(line, today)}
                              </span>
                            </small>
                            {line.invoiceUrl && (
                              <a
                                className="text-xs text-blue-700 underline"
                                href={line.invoiceUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Facture fournisseur
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right">{money(value.cost)}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-right font-bold">
                      {money(value.sale)}
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-4 text-right font-bold ${value.margin < 0 ? "text-red-700" : "text-emerald-700"}`}
                    >
                      {money(value.margin)}
                    </td>
                    <td className="px-4 py-4">{actionsFor(item)}</td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-500">
                    {busy
                      ? "Chargement du cloud…"
                      : loaded
                        ? "Aucune vente. Ajoutez vos services puis votre première vente."
                        : "Les données cloud ne sont pas chargées. Cliquez sur Actualiser."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4 text-sm">
            <span>
              {Math.min(visibleCount, filtered.length)} sur {filtered.length} ventes affichées. Les
              totaux et l’export incluent tous les résultats filtrés.
            </span>
            {visibleCount < filtered.length && (
              <Button variant="outline" onClick={() => setVisibleCount((count) => count + 25)}>
                Afficher 25 ventes de plus
              </Button>
            )}
          </div>
        )}
      </div>
    </FullPageWorkspace>
  );
}
