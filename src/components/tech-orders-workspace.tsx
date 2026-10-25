import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Plus, RefreshCw, Settings2, ShoppingCart } from "lucide-react";
import { FullPageWorkspace } from "./full-page-workspace";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { authenticatedFetch } from "@/lib/auth-client";
import { SOFTWARE_ICON_CATALOG } from "@/data/software-icon-catalog";
import { loadSharedSoftwareLogos } from "@/lib/shared-software-logos";
import { techLogoSource, type TechLogo } from "@/lib/tech-order-logos";
import {
  addTechMonths,
  lineTotals,
  newTechLine,
  orderTotals,
  renewTechOrder,
  techLineStatus,
  todayAlgiers,
  type TechLine,
  type TechOrder,
  type TechService,
} from "@/lib/tech-orders";

const money = (n: number) =>
  Number.isFinite(n)
    ? new Intl.NumberFormat("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
        n,
      ) + " DA"
    : "À saisir";
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
  return src ? (
    <img src={src} alt="" className="h-8 w-8 shrink-0 rounded border bg-white p-1 object-contain" />
  ) : (
    <span className="grid h-8 w-8 place-items-center rounded border bg-slate-100 text-xs">—</span>
  );
}
async function normalizedLogo(file: File) {
  if (
    !["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type) ||
    file.size > 4 * 1024 * 1024
  )
    throw Error("Logo PNG, JPG, WebP ou SVG : 4 Mo maximum.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Conversion du logo impossible.");
    const scale = 224 / Math.max(image.naturalWidth, image.naturalHeight);
    const w = image.naturalWidth * scale,
      h = image.naturalHeight * scale;
    ctx.drawImage(image, (256 - w) / 2, (256 - h) / 2, w, h);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-slate-600">
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
        required
        value={numberValue(value)}
        onChange={(e) => onChange(parseNumber(e.target.value))}
      />
    </Field>
  );
}
async function cloudJson(path: string, init?: RequestInit) {
  const response = await authenticatedFetch(path, init);
  const body = await response.json();
  if (!response.ok) throw Error(body.error || "Cloud indisponible.");
  return body;
}

export function TechOrdersWorkspace({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [services, setServices] = useState<TechService[]>([]),
    [orders, setOrders] = useState<TechOrder[]>([]);
  const [logos, setLogos] = useState<Record<string, TechLogo>>({});
  const [, refreshLogos] = useState(0);
  const logoInput = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [catalog, setCatalog] = useState(false),
    [service, setService] = useState<TechService>();
  const [order, setOrder] = useState<TechOrder>(),
    [selected, setSelected] = useState(""),
    [query, setQuery] = useState(""),
    [renewMonths, setRenewMonths] = useState(1);
  const [pendingLine, setPendingLine] = useState<TechLine>();
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
  const uploadLogo = async (file: File) => {
    if (!service) return;
    const target = { id: service.id, icon: service.icon };
    setBusy(true);
    setMessage("");
    try {
      const dataUrl = await normalizedLogo(file);
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
      setMessage(
        "Logo enregistré dans le cloud Tech Orders. Les prix et les logos des CV ne sont pas modifiés.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  const filtered = useMemo(
    () =>
      orders
        .filter((item) =>
          `${item.id} ${item.client} ${item.lines.map((l) => l.name).join(" ")}`
            .toLocaleLowerCase("fr")
            .includes(query.toLocaleLowerCase("fr")),
        )
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
    [orders, query],
  );
  const totals = filtered.reduce(
    (total, item) => {
      const value = orderTotals(item);
      return {
        cost: total.cost + value.cost,
        sale: total.sale + value.sale,
        margin: total.margin + value.margin,
      };
    },
    { cost: 0, sale: 0, margin: 0 },
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
    if (!service) return;
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
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const saveOrder = async () => {
    if (!order) return;
    setBusy(true);
    setMessage("");
    try {
      const data = await cloudJson(`/api/tech-orders/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order),
      });
      setOrders((current) => [...current.filter((o) => o.id !== order.id), data.record]);
      setOrder(undefined);
      setMessage(
        "Vente enregistrée. Les prix de cette transaction sont conservés indépendamment du catalogue.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <FullPageWorkspace
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
            disabled={busy || !!order || !!service}
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
            disabled={!loaded || busy}
            onClick={async () => {
              setBusy(true);
              try {
                const { buildTechOrdersXlsx } = await import("@/lib/tech-orders-excel");
                const bytes = buildTechOrdersXlsx(filtered);
                const url = URL.createObjectURL(
                  new Blob([new Uint8Array(bytes)], {
                    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = `zgr-tech-orders-${todayAlgiers()}.xlsx`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                setMessage(
                  "Export des ventes filtrées. Une ligne par service, sans double comptage.",
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
            disabled={!loaded || busy || !!order}
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
        <p className="text-xs text-slate-500">
          Coût DA = USD × taux saisi. Marge brute = vente − coût, hors frais et taxes. Les prix sont
          saisis par vous ; aucune facture fournisseur n’est générée par ZGR.
        </p>
        {message && (
          <p role="status" className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm">
            {message}
          </p>
        )}
        {catalog && (
          <section className="space-y-4 rounded-xl border bg-white p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <h2 className="font-bold">Catalogue privé des services</h2>
              <Button disabled={busy} variant="outline" onClick={() => setService(blankService())}>
                Ajouter un service
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Tarifs pour la durée standard indiquée. Le taux initial 260 DA/USD est une hypothèse
              modifiable. Modifier ici n’altère aucune vente passée. Un logo personnalisé reste
              propre à Tech Orders.
            </p>
            <div className="flex flex-wrap gap-2">
              {services.map((s) => (
                <button
                  key={s.id}
                  disabled={busy}
                  className="flex items-center gap-2 rounded-lg border p-2 text-sm"
                  onClick={() => setService({ ...s })}
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
                    <select
                      className="h-9 rounded border bg-white px-2"
                      value={service.icon}
                      onChange={(e) => setService({ ...service, icon: e.target.value, logo: "" })}
                    >
                      <option value="generic">Sans logo</option>
                      {SOFTWARE_ICON_CATALOG.map((s) => (
                        <option key={s.slug} value={s.slug}>
                          {s.title}
                        </option>
                      ))}
                    </select>
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
                  <Button type="button" variant="outline" onClick={() => setService(undefined)}>
                    Annuler
                  </Button>
                </div>
              </form>
            )}
          </section>
        )}
        {order && (
          <form
            className="space-y-4 rounded-xl border border-indigo-200 bg-white p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void saveOrder();
            }}
          >
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
              <select
                aria-label="Service à ajouter à la vente"
                className="h-9 min-w-48 rounded border bg-white px-2"
                value={selected}
                onChange={(e) => {
                  setSelected(e.target.value);
                  const service = services.find((s) => s.id === e.target.value);
                  setPendingLine(service ? newTechLine(service) : undefined);
                }}
              >
                <option value="">Choisir un service…</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {money(s.saleDzd)}
                  </option>
                ))}
              </select>
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
                  if (pendingLine)
                    setOrder({
                      ...order,
                      lines: [...order.lines, { ...pendingLine, id: crypto.randomUUID() }],
                    });
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
              </div>
            )}
            {order.lines.map((line) => (
              <fieldset key={line.id} className="space-y-3 rounded-lg border bg-slate-50 p-3">
                <legend className="px-2 text-sm font-bold">
                  <span className="inline-flex items-center gap-2">
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
                      className="h-9 rounded border bg-white px-2"
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
                  Changer les dates ne change pas les montants : saisissez les prix réels pour toute
                  la période. La date de fin est le jour du renouvellement.
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
                      className={lineTotals(line).margin < 0 ? "text-red-700" : "text-emerald-700"}
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
            <div className="flex gap-2">
              <Button disabled={busy || !order.lines.length}>Enregistrer la vente</Button>
              <Button type="button" variant="outline" onClick={() => setOrder(undefined)}>
                Annuler
              </Button>
            </div>
          </form>
        )}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-6 text-sm">
            <span>{filtered.length} vente(s)</span>
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
          <div className="flex flex-wrap gap-3">
            <Field label="Période du prochain renouvellement">
              <select
                className="h-9 rounded border bg-white px-2"
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
            <Field label="Rechercher client, ID ou service">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher…"
              />
            </Field>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                {[
                  "ID",
                  "Client",
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
              {filtered.map((item) => {
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
                                  techLineStatus(line) === "Expiré"
                                    ? "text-red-700"
                                    : techLineStatus(line) === "Expire sous 7 jours"
                                      ? "text-amber-700"
                                      : ""
                                }
                              >
                                {techLineStatus(line)}
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
                    <td className="space-y-2 px-4 py-4">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || !!order}
                        onClick={() => {
                          setOrder(structuredClone(item));
                          setMessage("");
                        }}
                      >
                        Modifier
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || !!order}
                        onClick={() => {
                          setOrder(renewTechOrder(item, services, renewMonths));
                          setMessage(
                            "Renouvellement à vérifier : prix du catalogue proportionnels à la période, modifiables. Nouvelle facture requise. L’ancienne vente reste inchangée.",
                          );
                        }}
                      >
                        Renouveler
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-500">
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
      </div>
    </FullPageWorkspace>
  );
}
