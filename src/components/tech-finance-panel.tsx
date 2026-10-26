import { useEffect, useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { TechSearchSelect } from "./tech-search-select";
import {
  financeKinds,
  financeAllowsMultiple,
  financeLinkedOrders,
  sponsorDuration,
  financeMonthRange,
  techFinanceStats,
  type FinanceKind,
  type TechFinance,
  type TechFinanceEntry,
} from "@/lib/tech-finance";
import { formatTechMoney as money } from "@/lib/tech-order-display";
import { techMatchesSearch, techOrderLabel, type TechOrder } from "@/lib/tech-orders";

export function TechFinancePanel({
  view,
  finance,
  orders,
  today,
  busy,
  onSave,
  onReload,
  onClose,
  onDirtyChange,
}: {
  view: "expenses" | "stats";
  finance: TechFinance;
  orders: TechOrder[];
  today: string;
  busy: boolean;
  onSave: (value: TechFinance) => Promise<void>;
  onReload: () => Promise<void>;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<TechFinanceEntry>();
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<"month" | "all" | "custom">("month");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [limit, setLimit] = useState(25);
  const [linkQuery, setLinkQuery] = useState("");
  useEffect(() => onDirtyChange(!!draft), [draft, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  useEffect(() => setLimit(25), [query, kind, mode, month, from, to]);
  const range =
    mode === "month"
      ? financeMonthRange(month)
      : mode === "custom"
        ? { from, to }
        : { from: "", to: "" };
  const invalidMonth = mode === "month" && !range.from;
  const stats = techFinanceStats(
    orders,
    finance.entries,
    invalidMonth ? "9999" : "" + range.from,
    invalidMonth ? "0000" : "" + range.to,
  );
  const orderMap = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);
  const linkMatches = orders.filter((order) =>
    techMatchesSearch(
      `${order.client} ${techOrderLabel(order)} ${order.lines.map((line) => line.name).join(" ")}`,
      linkQuery,
    ),
  );
  const entries = finance.entries
    .map((entry, index) => ({ entry, index }))
    .filter(
      ({ entry }) =>
        !stats.invalid &&
        (!range.from || entry.date >= range.from) &&
        (!range.to || entry.date <= range.to) &&
        (!kind || entry.kind === kind) &&
        techMatchesSearch(
          `${entry.label} ${entry.publicationUrl || ""} ${financeKinds[entry.kind]} ${financeLinkedOrders(
            entry,
          )
            .map((id) => `${orderMap.get(id)?.client || ""} ${techOrderLabel({ id })}`)
            .join(" ")}`,
          query,
        ),
    )
    .sort((a, b) => b.entry.date.localeCompare(a.entry.date) || b.index - a.index)
    .map(({ entry }) => entry);
  const close = () => {
    if (draft && !window.confirm("Abandonner le formulaire de frais non enregistré ?")) return;
    onClose();
  };
  const save = async () => {
    if (!draft || busy) return;
    if (
      !Number.isFinite(draft.amountDzd) ||
      draft.amountDzd <= 0 ||
      Math.abs(Math.round(draft.amountDzd * 100) / 100 - draft.amountDzd) > 0.0000001
    ) {
      setNotice("Saisissez un montant positif, avec 2 décimales maximum.");
      return;
    }
    if (draft.kind === "sponsor" && (!draft.sponsorEnd || draft.sponsorEnd < draft.date)) {
      setNotice("Renseignez la fin du sponsor, égale ou postérieure à son début.");
      return;
    }
    if (["refund", "cancellation"].includes(draft.kind) && !draft.orderId) {
      setNotice("Choisissez la vente concernée par ce remboursement ou cette annulation.");
      return;
    }
    const next = {
      ...finance,
      entries: finance.entries.some((entry) => entry.id === draft.id)
        ? finance.entries.map((entry) => (entry.id === draft.id ? draft : entry))
        : [...finance.entries, draft],
    };
    try {
      await onSave(next);
      setDraft(undefined);
      setNotice(
        "Ligne enregistrée dans le cloud. Les statistiques suivent la période sélectionnée.",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };
  const toggle = async (entry: TechFinanceEntry) => {
    if (
      busy ||
      !window.confirm(
        `${entry.voided ? "Rétablir" : "Neutraliser"} cette ligne dans les statistiques ? Elle reste conservée dans le registre et son historique.`,
      )
    )
      return;
    try {
      await onSave({
        ...finance,
        entries: finance.entries.map((item) =>
          item.id === entry.id ? { ...item, voided: !item.voided } : item,
        ),
      });
      setNotice(entry.voided ? "Ligne rétablie." : "Ligne neutralisée, sans suppression.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };
  const metrics = [
    ["Ventes brutes", stats.sale],
    ["Coûts fournisseurs", stats.cost],
    ["Marge brute", stats.margin],
    ["Total frais", stats.fees],
    ["Total déductions (frais + remboursements + annulations)", stats.deductions],
    ["Remboursements clients", stats.refund],
    ["Ventes annulées", stats.cancellation],
    ["Avoirs fournisseurs", stats.supplier_credit],
    ["Ventes nettes", stats.netSales],
  ] as const;
  return (
    <section
      id="tech-finance-panel"
      className="space-y-4 rounded-2xl border border-indigo-200 bg-white p-4 sm:p-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">
          {view === "expenses" ? "Frais et ajustements" : "Statistiques"}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              if (
                draft &&
                !window.confirm("Abandonner le formulaire et recharger le registre cloud ?")
              )
                return;
              try {
                await onReload();
                setDraft(undefined);
                setNotice("Registre cloud actualisé.");
              } catch (error) {
                setNotice(error instanceof Error ? error.message : String(error));
              }
            }}
          >
            Actualiser
          </Button>
          <Button variant="outline" disabled={busy} onClick={close}>
            Fermer
          </Button>
        </div>
      </header>
      <p className="text-xs leading-5 text-slate-500">
        Période indépendante des filtres clients. Ventes classées par date de création ; frais et
        ajustements par date saisie (début pour le sponsor). Le montant du sponsor est déduit une
        seule fois à son début, sans prorata ni multiplication par client lié. Aucun paiement
        bancaire n’est vérifié automatiquement.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs font-semibold">
          Période
          <select
            className="h-10 rounded-xl border bg-white px-3"
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
          >
            <option value="month">Un mois</option>
            <option value="all">Tout le registre</option>
            <option value="custom">Dates personnalisées</option>
          </select>
        </label>
        {mode === "month" && (
          <label className="grid gap-1 text-xs font-semibold">
            Mois
            <Input
              type="month"
              value={month}
              min="2000-01"
              max="2199-12"
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
        )}
        {mode === "custom" && (
          <>
            <label className="grid gap-1 text-xs font-semibold">
              Du
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="grid gap-1 text-xs font-semibold">
              Au
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </>
        )}
      </div>
      {stats.invalid && (
        <p role="alert" className="text-sm text-red-700">
          Corrigez la période : le mois doit être renseigné et la date de début doit précéder la
          fin.
        </p>
      )}
      {stats.undatedOrders > 0 && (
        <p className="text-xs text-amber-800">
          {stats.undatedOrders} vente(s) sans date de création exploitable exclue(s) de cette
          période. « Tout le registre » les inclut.
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl border bg-indigo-50 p-3 text-sm text-indigo-900">
          {notice}
        </p>
      )}
      {view === "stats" ? (
        <>
          <div
            className={`rounded-2xl border p-5 ${stats.netMargin < 0 ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}
          >
            <p className="text-sm font-semibold">Marge nette calculée</p>
            <p
              className={`mt-1 break-words text-3xl font-extrabold tabular-nums ${stats.netMargin < 0 ? "text-red-800" : "text-emerald-800"}`}
            >
              {money(stats.netMargin)}
            </p>
            <p className="mt-2 text-xs">
              {stats.orders} vente(s) · {stats.movements} frais/ajustement(s) actifs dans la période
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {metrics.map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-xl border bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="mt-1 break-words text-sm font-bold tabular-nums">{money(value)}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs leading-5 text-slate-600">
            Frais : sponsor {money(stats.sponsor)} + autres {money(stats.other)} + frais
            d’annulation {money(stats.cancellation_fee)}. Marge nette = ventes − coûts fournisseurs
            − frais − remboursements clients − ventes annulées + avoirs fournisseurs. Les coûts
            fournisseurs restent comptés en cas d’annulation ; saisissez un avoir seulement s’il est
            réel.
          </p>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">Total frais de la période : {money(stats.fees)}</p>
            <Button
              disabled={busy || !!draft || finance.entries.length >= 1000}
              onClick={() => {
                setDraft({
                  id: crypto.randomUUID(),
                  date: today,
                  kind: "sponsor",
                  amountDzd: NaN,
                  label: "",
                  orderId: "",
                  orderIds: [],
                  publicationUrl: "",
                  sponsorEnd: today,
                  voided: false,
                });
                setNotice("");
                setLinkQuery("");
              }}
            >
              Ajouter un frais / ajustement
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Un remboursement client et une vente annulée diminuent les ventes : ne saisissez pas les
            deux pour le même montant. Une annulation ici est comptable et ne change pas les dates
            d’abonnement.
          </p>
          {draft && (
            <form
              className="rounded-xl border bg-slate-50 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <fieldset disabled={busy} className="grid min-w-0 gap-3 sm:grid-cols-2">
                <legend className="mb-2 text-sm font-bold">
                  {finance.entries.some((entry) => entry.id === draft.id)
                    ? "Modifier la ligne"
                    : "Nouvelle ligne"}
                  {draft.voided ? " — neutralisée" : ""}
                </legend>
                <label className="grid min-w-0 gap-1 text-xs font-semibold">
                  Catégorie
                  <select
                    className="h-10 min-w-0 rounded-xl border bg-white px-2"
                    value={draft.kind}
                    onChange={(e) => {
                      const nextKind = e.target.value as FinanceKind;
                      const linked = financeLinkedOrders(draft);
                      setDraft({
                        ...draft,
                        kind: nextKind,
                        orderId: financeAllowsMultiple(nextKind)
                          ? ""
                          : linked.length === 1
                            ? linked[0]
                            : "",
                        orderIds: financeAllowsMultiple(nextKind) ? linked : [],
                        sponsorEnd: nextKind === "sponsor" ? draft.sponsorEnd || "" : undefined,
                      });
                      setNotice(
                        !financeAllowsMultiple(nextKind) && linked.length > 1
                          ? "Pour un remboursement, une annulation ou un avoir, choisissez une seule vente afin d’attribuer le montant correctement."
                          : "",
                      );
                    }}
                  >
                    {Object.entries(financeKinds).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid min-w-0 gap-1 text-xs font-semibold">
                  {draft.kind === "sponsor" ? "Début du sponsor" : "Date"}
                  <Input
                    type="date"
                    required
                    min="2000-01-01"
                    max="2199-12-31"
                    value={draft.date}
                    onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                  />
                </label>
                <label className="grid min-w-0 gap-1 text-xs font-semibold">
                  Libellé / motif — facultatif
                  <Input
                    maxLength={180}
                    value={draft.label}
                    onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  />
                </label>
                <label className="grid min-w-0 gap-1 text-xs font-semibold">
                  Montant DA
                  <Input
                    required
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    max="100000000"
                    step="0.01"
                    value={Number.isFinite(draft.amountDzd) ? draft.amountDzd : ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        amountDzd: e.target.value === "" ? NaN : Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="grid min-w-0 gap-1 text-xs font-semibold sm:col-span-2">
                  Lien de la publication — facultatif
                  <Input
                    type="url"
                    inputMode="url"
                    maxLength={2000}
                    placeholder="https://www.facebook.com/photo?..."
                    value={draft.publicationUrl || ""}
                    onChange={(e) => setDraft({ ...draft, publicationUrl: e.target.value.trim() })}
                  />
                  <span className="font-normal text-slate-500">Lien HTTPS uniquement.</span>
                </label>
                {draft.kind === "sponsor" && (
                  <label className="grid min-w-0 gap-1 text-xs font-semibold">
                    Fin du sponsor — incluse
                    <Input
                      type="date"
                      required
                      min={draft.date || "2000-01-01"}
                      max="2199-12-31"
                      value={draft.sponsorEnd || ""}
                      onChange={(e) => setDraft({ ...draft, sponsorEnd: e.target.value })}
                    />
                    <span className="font-normal text-slate-500">
                      {sponsorDuration(draft.date, draft.sponsorEnd || "") || "—"} jour(s) · montant
                      total pour toute la durée
                    </span>
                  </label>
                )}
                {financeAllowsMultiple(draft.kind) ? (
                  <div className="grid min-w-0 gap-2 text-xs sm:col-span-2">
                    <p className="font-semibold">
                      Ventes / clients liés — sélection multiple facultative (
                      {financeLinkedOrders(draft).length}/100)
                    </p>
                    <Input
                      aria-label="Rechercher les ventes à lier"
                      placeholder="Nom du client, service ou commande…"
                      value={linkQuery}
                      onChange={(e) => setLinkQuery(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-1">
                      {!!financeLinkedOrders(draft).length && (
                        <button
                          type="button"
                          className="rounded-lg border px-2 py-1"
                          onClick={() => setDraft({ ...draft, orderId: "", orderIds: [] })}
                        >
                          Tout décocher
                        </button>
                      )}
                      {financeLinkedOrders(draft).map((id) => (
                        <button
                          type="button"
                          key={id}
                          className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-indigo-800"
                          aria-label={`Retirer ${orderMap.get(id)?.client || id} — ${techOrderLabel({ id })}`}
                          onClick={() =>
                            setDraft({
                              ...draft,
                              orderId: "",
                              orderIds: financeLinkedOrders(draft).filter((value) => value !== id),
                            })
                          }
                        >
                          {orderMap.get(id)?.client || "Vente"} · {techOrderLabel({ id })} ×
                        </button>
                      ))}
                    </div>
                    <div className="max-h-48 overflow-y-auto rounded-xl border bg-white p-2">
                      {linkMatches.slice(0, 50).map((order) => {
                        const selected = financeLinkedOrders(draft);
                        return (
                          <label
                            key={order.id}
                            className="flex cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-indigo-50"
                          >
                            <input
                              type="checkbox"
                              checked={selected.includes(order.id)}
                              disabled={!selected.includes(order.id) && selected.length >= 100}
                              onChange={(e) =>
                                setDraft({
                                  ...draft,
                                  orderId: "",
                                  orderIds: e.target.checked
                                    ? [...selected, order.id]
                                    : selected.filter((id) => id !== order.id),
                                })
                              }
                            />
                            <span className="min-w-0 break-words">
                              <strong>{order.client}</strong> · {techOrderLabel(order)}
                              <span className="block text-slate-500">
                                {order.lines.map((line) => line.name).join(", ")}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                      {!linkMatches.length && (
                        <p className="p-2 text-slate-500">
                          Aucune vente ne correspond à la recherche.
                        </p>
                      )}
                    </div>
                    <p className="text-slate-500">
                      50 résultats maximum affichés : précisez la recherche. Le montant reste
                      unique, sans répartition ni duplication entre les clients.
                    </p>
                  </div>
                ) : (
                  <label className="grid min-w-0 gap-1 text-xs font-semibold sm:col-span-2">
                    Vente liée{" "}
                    {["refund", "cancellation"].includes(draft.kind)
                      ? "— obligatoire"
                      : "— facultative"}
                    <TechSearchSelect
                      label="Vente liée aux frais"
                      value={draft.orderId}
                      disabled={busy}
                      options={[
                        { value: "", label: "Aucune vente liée" },
                        ...orders.map((order) => ({
                          value: order.id,
                          label: order.client,
                          detail: `${order.lines.map((line) => line.name).join(", ")} · ${techOrderLabel(order)}`,
                        })),
                      ]}
                      onChange={(id) => setDraft({ ...draft, orderId: id })}
                      placeholder="Rechercher le client ou le service…"
                    />
                  </label>
                )}
                {notice && <p className="text-sm text-indigo-800 sm:col-span-2">{notice}</p>}
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <Button>Enregistrer</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (window.confirm("Abandonner cette saisie non enregistrée ?"))
                        setDraft(undefined);
                    }}
                  >
                    Annuler la saisie
                  </Button>
                </div>
              </fieldset>
            </form>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              aria-label="Rechercher dans les frais"
              placeholder="Libellé, client, catégorie…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              aria-label="Filtrer les frais par catégorie"
              className="h-10 min-w-0 rounded-xl border bg-white px-3"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="">Toutes les catégories</option>
              {Object.entries(financeKinds).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            {entries.slice(0, limit).map((entry) => (
              <article
                key={entry.id}
                className={`rounded-xl border p-3 ${entry.voided ? "bg-slate-50 text-slate-500" : "bg-white"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold">
                      {entry.label || financeKinds[entry.kind]}
                      {entry.voided ? " — neutralisée" : ""}
                    </p>
                    <p className="text-xs text-slate-500">
                      {entry.date} · {financeKinds[entry.kind]}
                    </p>
                    {entry.kind === "sponsor" && (
                      <p className="text-xs text-slate-500">
                        {entry.sponsorEnd
                          ? `Sponsor du ${entry.date} au ${entry.sponsorEnd} · ${sponsorDuration(entry.date, entry.sponsorEnd)} jour(s)`
                          : "Fin du sponsor non renseignée"}
                      </p>
                    )}
                    {entry.publicationUrl && (
                      <a
                        href={entry.publicationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs text-blue-700 underline"
                      >
                        Ouvrir la publication ↗
                      </a>
                    )}
                    {!!financeLinkedOrders(entry).length && (
                      <p className="text-xs text-indigo-700">
                        {financeLinkedOrders(entry)
                          .map(
                            (id) =>
                              `${orderMap.get(id)?.client || "Vente liée"} (${techOrderLabel({ id })})`,
                          )
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                  <strong className="text-sm tabular-nums">{money(entry.amountDzd)}</strong>
                </div>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || !!draft}
                    onClick={() => {
                      setDraft({ ...entry });
                      setLinkQuery("");
                      setNotice("");
                    }}
                  >
                    Modifier
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || !!draft}
                    onClick={() => void toggle(entry)}
                  >
                    {entry.voided ? "Rétablir" : "Neutraliser"}
                  </Button>
                </div>
              </article>
            ))}
            {!entries.length && (
              <p className="py-5 text-center text-sm text-slate-500">
                Aucune ligne dans cette période.
              </p>
            )}
          </div>
          {entries.length > limit && (
            <Button variant="outline" onClick={() => setLimit((value) => value + 25)}>
              Afficher 25 lignes de plus
            </Button>
          )}
        </>
      )}
      <p className="text-xs leading-5 text-slate-500">
        Les lignes neutralisées sont conservées mais exclues des calculs. Ce registre ne remplace
        pas une comptabilité ni un suivi d’encaissement ; les frais et ajustements ne figurent pas
        dans l’export « Excel ventes ».
      </p>
    </section>
  );
}
