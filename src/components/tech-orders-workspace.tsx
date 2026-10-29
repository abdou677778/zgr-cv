import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Plus,
  RefreshCw,
  Settings2,
  MoreVertical,
  Pencil,
  MessageSquare,
  ExternalLink,
  Receipt,
  BarChart3,
  Trash2,
  ImageDown,
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
import { TechClientHistory } from "./tech-client-history";
import { filterTechClientGroups, groupTechClients } from "@/lib/tech-client-groups";
import { TechFinancePanel } from "./tech-finance-panel";
import { TechServiceCatalogPanel } from "./tech-service-catalog-panel";
import { TechServiceDetails } from "./tech-service-details";
import { sortTechServicesByName } from "@/lib/tech-service-sort";
import {
  officialTechDetails,
  officialTechFeatures,
  TECH_SERVICE_DETAILS_CHECKED,
} from "@/data/tech-official-service-details";
import { TechStatusTiles } from "./tech-status-tiles";
import { TechOrderFilters } from "./tech-order-filters";
import { TechSaleLineFields } from "./tech-sale-line-fields";
import { TechBrandLogo } from "./tech-brand-logo";
import { TechContactBadge } from "./tech-contact-badge";
import { emptyTechFinance, type TechFinance } from "@/lib/tech-finance";
import { formatTechMoney as money } from "@/lib/tech-order-display";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "./ui/dropdown-menu";
import {
  addTechMonths,
  lineTotals,
  newTechLine,
  orderTotals,
  techOrdersTotals,
  techMatchesSearch,
  renewTechOrder,
  techLineStatus,
  techContactAt,
  todayAlgiers,
  techOrderState,
  techClientKey,
  techOrderLabel,
  techClients,
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
  highlight = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  highlight?: boolean;
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        className={
          highlight
            ? "border-emerald-300 bg-emerald-50 font-bold text-emerald-900 focus-visible:ring-emerald-400"
            : undefined
        }
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
  const sortedServices = useMemo(() => sortTechServicesByName(services), [services]);
  const [logos, setLogos] = useState<Record<string, TechLogo>>({});
  const [finance, setFinance] = useState<TechFinance>(emptyTechFinance);
  const [financeView, setFinanceView] = useState<"expenses" | "stats">();
  const [financeDirty, setFinanceDirty] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TechOrder>();
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  useEffect(() => {
    if (financeView)
      document
        .getElementById("tech-finance-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [financeView]);
  const [, refreshLogos] = useState(0);
  const logoInput = useRef<HTMLInputElement>(null);
  const writing = useRef(false);
  const [conflict, setConflict] = useState<"logos" | "services" | "orders">();
  const [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [catalog, setCatalog] = useState(false),
    [service, setService] = useState<TechService>();
  const [clientCatalog, setClientCatalog] = useState(false);
  const [order, setOrder] = useState<TechOrder>(),
    [selected, setSelected] = useState(""),
    [renewMonths, setRenewMonths] = useState(1);
  const [filters, setFilters] = useState<TechFilters>({ ...emptyTechFilters });
  const [today, setToday] = useState(todayAlgiers);
  const [renewSource, setRenewSource] = useState<TechOrder>();
  const [renewLineIds, setRenewLineIds] = useState<string[]>([]);
  const [renewStart, setRenewStart] = useState("");
  const [renewContinuity, setRenewContinuity] = useState(false);
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
  const hasDraft = !!(order || service || financeDirty || renewSource);
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
      setFinance(data.finance || emptyTechFinance());
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
  const groups = useMemo(
    () => filterTechClientGroups(orders, filters, today),
    [orders, filters, today],
  );
  const filtered = useMemo(() => groups.flatMap((group) => group.orders), [groups]);
  const invalidDates = !!(filters.from && filters.to && filters.from > filters.to);
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
    setRenewMonths(1);
    setRenewContinuity(false);
    setRenewStart(
      source.lines.reduce((start, line) => (line.end > start ? line.end : start), today),
    );
    setMessage(
      "Choisissez la date réelle de reprise et la période. Préparer ne change aucun état : seul l’enregistrement crée la nouvelle vente.",
    );
  };
  const requestDelete = (item: TechOrder) => {
    if (writing.current || hasDraft) return;
    setDeleteConfirmation("");
    setDeleteTarget(item);
  };
  const deleteSale = async (item: TechOrder) => {
    if (writing.current || hasDraft) return;
    const label = techOrderLabel(item);
    if (deleteConfirmation.trim() !== label) return;
    writing.current = true;
    setBusy(true);
    try {
      await cloudJson(
        `/api/tech-orders/orders/${item.id}?revision=${item.revision}&confirm=${encodeURIComponent(label)}`,
        { method: "DELETE" },
      );
      setOrders((current) => current.filter((entry) => entry.id !== item.id));
      setDeleteTarget(undefined);
      setMessage(
        `Vente ${label} supprimée du registre et des totaux. Une trace privée est conservée.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      writing.current = false;
      setBusy(false);
    }
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
  const orderMenu = (item: TechOrder, surface: "mobile" | "desktop", history: TechOrder[] = []) => {
    const disabled = busy || !!order || !!service || !!renewSource || financeDirty;
    const triggerId = `tech-actions-${surface}-${item.id}`;
    return (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            id={triggerId}
            size={surface === "mobile" ? "icon" : "sm"}
            variant={surface === "mobile" ? "ghost" : "outline"}
            disabled={busy}
            className={surface === "mobile" ? "h-10 w-10 text-indigo-700" : "gap-1 text-indigo-700"}
            aria-label={`Actions pour ${item.client}`}
          >
            <MoreVertical className="h-5 w-5" />
            {surface === "desktop" && <span>Actions</span>}
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
          {history.length > 1 && (
            <>
              <div className="px-2 py-1 text-xs font-semibold text-slate-500">
                Dernière période —{" "}
                {item.lines
                  .map((l) => l.start)
                  .sort()
                  .at(-1)}
              </div>
              {history
                .filter((record) => record.id !== item.id)
                .sort((a, b) => (a.lines[0]?.start || "").localeCompare(b.lines[0]?.start || ""))
                .map((record) => (
                  <DropdownMenuSub key={record.id}>
                    <DropdownMenuSubTrigger>
                      {record.lines[0]?.start} · {techOrderLabel(record)}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="z-[170] max-w-[90vw]">
                      <DropdownMenuItem
                        disabled={disabled}
                        onSelect={() => {
                          setOrder(structuredClone(record));
                          setMessage("");
                          setSelected("");
                          setPendingLine(undefined);
                        }}
                      >
                        Modifier cette période
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={disabled}
                        onSelect={() =>
                          openRenewalMessage(record, document.getElementById(triggerId))
                        }
                      >
                        Message / contact
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={disabled}
                        className="text-red-700"
                        onSelect={() => requestDelete(record)}
                      >
                        Supprimer cette vente erronée
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ))}
              <DropdownMenuSeparator />
            </>
          )}
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
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={disabled}
            className="min-h-11 rounded-lg text-red-700 focus:text-red-800"
            onSelect={() => requestDelete(item)}
          >
            <Trash2 />
            Supprimer la vente
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };
  const totals = techOrdersTotals(filtered);
  const visible = groups.slice(0, visibleCount);
  const stateCounts = useMemo(
    () =>
      groupTechClients(orders, today).reduce(
        (counts, group) => {
          counts[group.state]++;
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
  const confirmRenewalContact = async (ids: string[], contacted: boolean) => {
    if (!messageOrder || writing.current)
      throw new Error("Enregistrement en cours. Réessayez ensuite.");
    if (order || financeDirty)
      throw new Error(
        "Fermez ou enregistrez le formulaire en cours avant de confirmer le contact.",
      );
    writing.current = true;
    setBusy(true);
    const at = new Date().toISOString();
    try {
      const data = await cloudJson(`/api/tech-orders/orders/${messageOrder.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...messageOrder,
          lines: messageOrder.lines.map((line) =>
            ids.includes(line.id) &&
            techLineStatus(line, today) === "Expiré" &&
            !(contacted && techContactAt(line))
              ? {
                  ...line,
                  renewalContact: contacted ? { start: line.start, end: line.end, at } : undefined,
                }
              : line,
          ),
        }),
      });
      setOrders((current) =>
        current.map((item) => (item.id === data.record.id ? data.record : item)),
      );
    } catch (error) {
      if (error instanceof TechCloudError && error.status === 409)
        throw new Error(
          "Cette vente a changé dans le cloud. Fermez le message, actualisez le registre puis réessayez. Aucune confirmation enregistrée.",
        );
      throw error;
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
      if (data.record.renewalOf && !next)
        setFilters({
          ...emptyTechFilters,
          client: techClientKey(data.record),
          state: techOrderState(data.record, today),
        });
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
  const openFinance = (next: "expenses" | "stats") => {
    if (financeDirty && !window.confirm("Abandonner le formulaire de frais non enregistré ?"))
      return;
    setFinanceDirty(false);
    setCatalog(false);
    setFinanceView((current) => (current === next ? undefined : next));
  };
  const saveFinance = async (next: TechFinance) => {
    if (writing.current) throw Error("Une opération cloud est déjà en cours.");
    writing.current = true;
    setBusy(true);
    try {
      const data = await cloudJson("/api/tech-orders/finance/main", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      setFinance(data.record);
    } finally {
      writing.current = false;
      setBusy(false);
    }
  };
  const reloadFinance = async () => {
    setBusy(true);
    try {
      const data = await cloudJson("/api/tech-orders");
      setFinance(data.finance || emptyTechFinance());
      setOrders(data.orders);
      setServices(data.services);
      setLogos(data.logos || {});
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
        if (hasDraft && !window.confirm("Quitter sans enregistrer le formulaire en cours ?"))
          return;
        onOpenChange(value);
      }}
      title="ZGR Tech Orders"
      description="Ventes et abonnements. Espace privé indépendant des dossiers CV."
      icon={<TechBrandLogo />}
      iconClassName="rounded-none bg-transparent p-0"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy || !!order || !!service || !!renewSource || financeDirty}
            onClick={() => void load()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualiser
          </Button>
          <Button
            variant="outline"
            disabled={!loaded || busy}
            onClick={() => {
              if (
                financeDirty &&
                !window.confirm("Abandonner le formulaire de frais non enregistré ?")
              )
                return;
              setFinanceView(undefined);
              setFinanceDirty(false);
              setCatalog((value) => !value);
            }}
          >
            <Settings2 className="mr-2 h-4 w-4" />
            Services et marges
          </Button>
          <Button
            variant="outline"
            disabled={!loaded || busy || !!order || !!service || !!renewSource || financeDirty}
            aria-pressed={clientCatalog}
            onClick={() => setClientCatalog((value) => !value)}
          >
            <ImageDown className="mr-2 h-4 w-4" />
            Catalogue client
          </Button>
          <Button
            variant="outline"
            disabled={!loaded || busy || !!order || !!service || !!renewSource}
            aria-pressed={financeView === "expenses"}
            onClick={() => openFinance("expenses")}
          >
            <Receipt className="mr-2 h-4 w-4" />
            Frais
          </Button>
          <Button
            variant="outline"
            disabled={!loaded || busy || !!order || !!service || !!renewSource}
            aria-pressed={financeView === "stats"}
            onClick={() => openFinance("stats")}
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Statistiques
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
            Excel ventes
          </Button>
          <Button
            disabled={!loaded || busy || !!order || !!renewSource || financeDirty}
            onClick={() => {
              setOrder(blankOrder());
              setSelected("");
              setPendingLine(undefined);
              setCatalog(false);
              setFinanceView(undefined);
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
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open && !busy) setDeleteTarget(undefined);
          }}
        >
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-[180] bg-slate-950/50" />
            <DialogPrimitive.Content
              className="fixed left-1/2 top-1/2 z-[190] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-xl bg-white p-5 shadow-xl"
              onEscapeKeyDown={(event) => event.stopPropagation()}
            >
              <DialogPrimitive.Title className="font-bold">
                Supprimer la vente erronée
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-slate-600">
                {deleteTarget?.client} — {deleteTarget && techOrderLabel(deleteTarget)}. Cette vente
                sera retirée des listes et des totaux. Une trace privée est conservée ; ce n’est pas
                un remboursement.
              </DialogPrimitive.Description>
              {deleteTarget?.lines.map((line) => (
                <p key={line.id} className="text-sm">
                  {line.name} · {line.start} → {line.end} · {money(line.saleDzd)}
                </p>
              ))}
              <label className="block space-y-1 text-sm">
                <span>Recopiez {deleteTarget && techOrderLabel(deleteTarget)} pour confirmer</span>
                <Input
                  aria-label="Confirmation de suppression"
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                  disabled={busy}
                />
              </label>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setDeleteTarget(undefined)}
                >
                  Annuler la suppression
                </Button>
                <Button
                  className="bg-red-700 hover:bg-red-800"
                  disabled={
                    busy ||
                    !deleteTarget ||
                    deleteConfirmation.trim() !== techOrderLabel(deleteTarget)
                  }
                  onClick={() => deleteTarget && void deleteSale(deleteTarget)}
                >
                  Confirmer la suppression
                </Button>
              </div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
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
                    onConfirmContact={confirmRenewalContact}
                    busy={busy}
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
        <TechStatusTiles
          counts={stateCounts}
          total={clients.length}
          unit="clients"
          selected={filters.state}
          onSelect={(state) => setFilters((current) => ({ ...current, state }))}
        />
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
        {financeView && (
          <TechFinancePanel
            key={financeView}
            view={financeView}
            finance={finance}
            orders={orders}
            today={today}
            busy={busy}
            onSave={saveFinance}
            onReload={reloadFinance}
            onClose={() => setFinanceView(undefined)}
            onDirtyChange={setFinanceDirty}
          />
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
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Début réel du nouveau renouvellement">
                <Input
                  type="date"
                  required
                  min="2000-01-01"
                  max="2199-12-31"
                  value={renewStart}
                  disabled={renewContinuity || busy}
                  onChange={(event) => setRenewStart(event.target.value)}
                />
              </Field>
              <Field label="Période à renouveler">
                <select
                  className="h-9 rounded border px-2"
                  value={renewMonths}
                  onChange={(e) => setRenewMonths(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((m) => (
                    <option key={m} value={m}>
                      {m} mois
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={renewContinuity}
                onChange={(event) => setRenewContinuity(event.target.checked)}
              />
              Continuité automatique par service (fin précédente si à venir, sinon aujourd’hui)
            </label>
            {!renewContinuity && (
              <p className="text-xs text-indigo-800">
                Reprise : {renewStart || "à renseigner"} → fin :{" "}
                {addTechMonths(renewStart, renewMonths) || "à renseigner"}. L’état suit ces dates
                réelles, pas la date de saisie.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={
                  busy ||
                  !renewLineIds.length ||
                  (!renewContinuity && !addTechMonths(renewStart, renewMonths))
                }
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
                      renewContinuity ? undefined : renewStart,
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
        {clientCatalog && (
          <TechServiceCatalogPanel
            services={services}
            logos={logos}
            onClose={() => setClientCatalog(false)}
            onEdit={() => {
              setCatalog(true);
              setClientCatalog(false);
            }}
          />
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
            <div className="flex flex-wrap items-start gap-2">
              {sortedServices
                .filter((s) => techMatchesSearch(s.name, catalogQuery))
                .map((s) => (
                  <div key={s.id} className="min-w-0 max-w-xs rounded-lg border bg-white p-2">
                    <button
                      type="button"
                      disabled={busy}
                      className="flex w-full items-center gap-2 rounded-lg text-left text-sm"
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
                    <TechServiceDetails service={s} />
                  </div>
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
                  {officialTechDetails(service.name) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const details = officialTechDetails(service.name);
                        if (details)
                          setService({
                            ...service,
                            websiteUrl: details.websiteUrl,
                            features: officialTechFeatures(details),
                          });
                      }}
                    >
                      Préremplir la fiche officielle · {TECH_SERVICE_DETAILS_CHECKED}
                    </Button>
                  )}
                  <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-2">
                    <Field label="Lien du site (facultatif)">
                      <Input
                        type="url"
                        maxLength={2000}
                        placeholder="https://…"
                        value={service.websiteUrl || ""}
                        onChange={(e) => setService({ ...service, websiteUrl: e.target.value })}
                      />
                    </Field>
                    <Field label="Caractéristiques de l’abonnement (facultatif)">
                      <textarea
                        rows={3}
                        maxLength={4000}
                        dir="auto"
                        className="w-full min-w-0 resize-y rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm focus-visible:outline-indigo-500"
                        placeholder="Fonctionnalités incluses, limites, conditions… Une information par ligne."
                        value={service.features || ""}
                        onChange={(e) => setService({ ...service, features: e.target.value })}
                      />
                      <span className="text-xs text-slate-500">
                        {(service.features || "").length}/4000 · Visible dans les caractéristiques
                        du service.
                      </span>
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
            className="space-y-3 rounded-xl border border-indigo-200 bg-white p-3 sm:p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void saveOrder();
            }}
          >
            <fieldset disabled={busy} className="min-w-0 space-y-3">
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
                    options={sortedServices.map((s) => ({
                      value: s.id,
                      label: s.name,
                      detail: `${money(s.saleDzd)} · ${s.months} mois`,
                      leading: <Logo service={s} override={logos[s.id]} />,
                    }))}
                    onChange={(id) => {
                      setSelected(id);
                      const service = services.find((s) => s.id === id);
                      setPendingLine(service ? newTechLine(service, today, 1) : undefined);
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
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-2"
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
                    label="Prix de vente (DA)"
                    highlight
                    value={pendingLine.saleDzd}
                    onChange={(value) => setPendingLine({ ...pendingLine, saleDzd: value })}
                  />
                  <p className="text-sm">
                    Coût : {money(lineTotals(pendingLine).cost)} · Marge :{" "}
                    <strong>{money(lineTotals(pendingLine).margin)}</strong>
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
                  <TechSaleLineFields
                    line={line}
                    disabled={busy}
                    onChange={(patch) => mutateLine(line.id, patch)}
                  />
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
          className="space-y-2 rounded-xl border bg-white p-3"
          aria-label="Filtres et totaux"
        >
          <TechOrderFilters
            filters={filters}
            clients={clients}
            services={services}
            today={today}
            onChange={setFilters}
          />
          {invalidDates && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              La date de début du filtre doit précéder sa date de fin. Corrigez la période ;
              l’export est suspendu.
            </p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-2 text-xs">
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
        </section>
        <div className="space-y-3 md:hidden">
          {visible.map((group) => (
            <TechClientHistory
              key={group.key}
              group={group}
              today={today}
              mobile
              logo={(id) => (
                <Logo service={services.find((s) => s.id === id)} override={logos[id]} />
              )}
              onContact={(record) =>
                openRenewalMessage(record, document.activeElement as HTMLElement | null)
              }
              menu={orderMenu(group.latest, "mobile", group.orders)}
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
                  "Historique",
                  "Client",
                  "État",
                  "Services / dates / état",
                  "Coût DA",
                  "Total DA",
                  "Marge brute DA",
                  "Note",
                  "Actions",
                ].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((group) => (
                <TechClientHistory
                  key={group.key}
                  group={group}
                  today={today}
                  logo={(id) => (
                    <Logo service={services.find((s) => s.id === id)} override={logos[id]} />
                  )}
                  onContact={(record) =>
                    openRenewalMessage(record, document.activeElement as HTMLElement | null)
                  }
                  menu={orderMenu(group.latest, "desktop", group.orders)}
                />
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-500">
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
              {Math.min(visibleCount, groups.length)} sur {groups.length} clients affichés. Les
              totaux et l’export incluent tous les résultats filtrés.
            </span>
            {visibleCount < groups.length && (
              <Button variant="outline" onClick={() => setVisibleCount((count) => count + 25)}>
                Afficher 25 clients de plus
              </Button>
            )}
          </div>
        )}
      </div>
    </FullPageWorkspace>
  );
}
