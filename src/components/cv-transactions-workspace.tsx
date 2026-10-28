import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, ExternalLink, Plus, Receipt, RefreshCw } from "lucide-react";
import { authenticatedFetch, getCurrentUser } from "@/lib/auth-client";
import { todayAlgiers, techMatchesSearch } from "@/lib/tech-orders";
import { FullPageWorkspace } from "./full-page-workspace";
import { TechSearchSelect } from "./tech-search-select";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  CV_CURRENCIES,
  CV_PAYMENT_METHODS,
  CV_TRANSACTION_SERVICES,
  cvReceiptType,
  cvAmountInput,
  cvTransactionLabel,
  cvTransactionTotals,
  formatCvAmount,
  parseCvAmount,
  validateCvTransaction,
  type CvCurrency,
  type CvReceipt,
  type CvTransaction,
  type CvTransactionOrder,
} from "../../shared/cv-transactions";

const API = "/api/admin/client-orders/transactions";
async function api<T>(path = "", init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(`${API}${path}`, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(body.error || `Erreur de transaction (${response.status}).`);
  return body as T;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1 text-xs font-medium text-slate-600">
      <span>{label}</span>
      {children}
    </label>
  );
}
function emptyTransaction(): CvTransaction {
  return {
    id: crypto.randomUUID(),
    revision: 0,
    orderId: "",
    client: "",
    date: todayAlgiers(),
    admin: getCurrentUser()?.displayName || "",
    writer: "",
    services: [],
    amountMinor: 0,
    currency: "DZD",
    paymentMethod: "BaridiMob",
    receiver: "",
    notes: "",
    voided: false,
    voidReason: "",
  };
}
export function CvTransactionsWorkspace({ onClose }: { onClose: () => void }) {
  const [records, setRecords] = useState<CvTransaction[]>([]);
  const [orders, setOrders] = useState<CvTransactionOrder[]>([]);
  const [draft, setDraft] = useState<CvTransaction>();
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File>();
  const [customService, setCustomService] = useState("");
  const [query, setQuery] = useState("");
  const [currency, setCurrency] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [method, setMethod] = useState("");
  const [status, setStatus] = useState("active");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [driveMessage, setDriveMessage] = useState(
    "Justificatifs privés : PNG, JPG ou WebP, 5 Mo maximum.",
  );
  const writing = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [visibleCount, setVisibleCount] = useState(25);
  const load = useCallback(async () => {
    if (writing.current) return;
    setBusy(true);
    try {
      const data = await api<{ records: CvTransaction[]; orders: CvTransactionOrder[] }>();
      setRecords(data.records);
      setOrders(data.orders);
      setLoaded(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chargement impossible.");
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const preventLoss = (event: BeforeUnloadEvent) => {
      if (draft || writing.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [draft]);
  const close = () => {
    if (!busy && (!draft || window.confirm("Abandonner la saisie non enregistrée ?"))) onClose();
  };
  const edit = (record: CvTransaction) => {
    if (busy || (draft && !window.confirm("Abandonner la saisie actuelle ?"))) return;
    setDraft(structuredClone(record));
    setAmount(record.amountMinor ? cvAmountInput(record.amountMinor, record.currency) : "");
    setFile(undefined);
    setCustomService("");
    setMessage("");
    document
      .getElementById("cv-transaction-form")
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  const draftId = draft?.id;
  useEffect(() => {
    if (draftId)
      document
        .getElementById("cv-transaction-form")
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [draftId]);
  const patch = (value: Partial<CvTransaction>) =>
    setDraft((current) => (current ? { ...current, ...value } : current));
  const choices = useMemo(
    () => [
      ...new Set([
        ...CV_TRANSACTION_SERVICES,
        ...records.flatMap((r) => r.services),
        ...(draft?.services || []),
      ]),
    ],
    [records, draft?.services],
  );
  const receivers = [...new Set(records.map((r) => r.receiver))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  );
  const people = [...new Set(records.flatMap((r) => [r.admin, r.writer]).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "fr"),
  );
  const filtered = useMemo(
    () =>
      records.filter(
        (record) =>
          (!currency || record.currency === currency) &&
          (!method || record.paymentMethod === method) &&
          (status === "all" || (status === "voided" ? record.voided : !record.voided)) &&
          (!from || record.date >= from) &&
          (!to || record.date <= to) &&
          techMatchesSearch(
            `${record.client} ${record.orderId} ${cvTransactionLabel(record.id)} ${record.admin} ${record.writer} ${record.receiver} ${record.services.join(" ")} ${record.notes}`,
            query,
          ),
      ),
    [records, query, currency, from, to, method, status],
  );
  const totals = cvTransactionTotals(filtered);
  useEffect(() => setVisibleCount(25), [query, currency, from, to, method, status]);
  const save = async () => {
    if (!draft || writing.current) return;
    const minor = parseCvAmount(amount, draft.currency);
    if (minor === null) {
      setMessage(
        `Montant positif requis, avec ${CV_CURRENCIES[draft.currency]} décimales maximum.`,
      );
      return;
    }
    const input = { ...draft, amountMinor: minor };
    try {
      validateCvTransaction(input, input.id);
    } catch (error) {
      setMessage((error as Error).message);
      return;
    }
    if (file && file.size > 5 * 1024 * 1024) {
      setMessage("Photo PNG, JPG ou WebP, 5 Mo maximum.");
      return;
    }
    writing.current = true;
    setBusy(true);
    setMessage("Enregistrement…");
    let saved: CvTransaction | undefined;
    try {
      const receiptMime = file
        ? cvReceiptType(new Uint8Array(await file.slice(0, 12).arrayBuffer()))
        : null;
      if (file && !receiptMime) throw Error("Photo PNG, JPG ou WebP valide requise.");
      const result = await api<{ record: CvTransaction }>(`/${input.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      saved = { ...result.record, receipt: draft.receipt };
      setDraft(saved);
      setRecords((current) =>
        [saved!, ...current.filter((r) => r.id !== saved!.id)].sort((a, b) =>
          b.date.localeCompare(a.date),
        ),
      );
      if (file) {
        setMessage(
          "Transaction enregistrée. Envoi direct du justificatif privé vers Google Drive…",
        );
        const result = await api<{ receipt: CvReceipt }>(`/${saved.id}/receipt`, {
          method: "POST",
          headers: { "Content-Type": receiptMime! },
          body: file,
        });
        saved = { ...saved, receipt: result.receipt };
        setRecords((current) => current.map((r) => (r.id === saved!.id ? saved! : r)));
      }
      setDraft(undefined);
      setFile(undefined);
      setMessage(
        "Transaction enregistrée. Aucun paiement bancaire n’a été exécuté ni vérifié automatiquement.",
      );
    } catch (error) {
      setMessage(
        `${saved ? "Transaction enregistrée ; justificatif non confirmé. La saisie est conservée pour réessayer, sans créer une autre transaction. " : ""}${error instanceof Error ? error.message : "Enregistrement impossible."}`,
      );
    } finally {
      writing.current = false;
      setBusy(false);
    }
  };
  const checkDrive = async () => {
    if (writing.current) return;
    setBusy(true);
    try {
      const result = await api<{ drive: { name: string } }>("/drive");
      setDriveMessage(`Drive vérifié : « ${result.drive.name} », privé et accessible en écriture.`);
    } catch (error) {
      setDriveMessage(error instanceof Error ? error.message : "Drive indisponible.");
    } finally {
      setBusy(false);
    }
  };
  const exportCsv = () => {
    const safe = (value: string) =>
      `"${(/^\s*[=+@-]|^[\t\r\n]/.test(value) ? "'" : "") + value.replace(/"/g, '""')}"`;
    const rows = [
      [
        "Référence",
        "Commande",
        "Client",
        "Date",
        "Admin",
        "Rédactrice",
        "Services",
        "Montant",
        "Devise",
        "Paiement",
        "Reçu par",
        "Statut",
        "Note",
        "Justificatif",
      ],
      ...filtered.map((r) => [
        cvTransactionLabel(r.id),
        r.orderId,
        r.client,
        r.date,
        r.admin,
        r.writer,
        r.services.join(" / "),
        cvAmountInput(r.amountMinor, r.currency),
        r.currency,
        r.paymentMethod,
        r.receiver,
        r.voided ? "Annulée" : "Enregistrée",
        r.notes,
        r.receipt?.url || "",
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + rows.map((row) => row.map(safe).join(";")).join("\r\n")], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `transactions-cv-${todayAlgiers()}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const moneyCell = (record: CvTransaction) => (
    <strong className={record.voided ? "text-slate-400 line-through" : "text-emerald-700"}>
      {formatCvAmount(record.amountMinor, record.currency)}
    </strong>
  );
  const receiptLink = (record: CvTransaction) =>
    record.receipt ? (
      <a
        className="inline-flex items-center gap-1 text-xs text-blue-700 underline"
        href={record.receipt.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        <ExternalLink className="h-3 w-3" />
        Justificatif privé
      </a>
    ) : (
      <span className="text-xs text-slate-400">Sans justificatif</span>
    );
  return (
    <FullPageWorkspace
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title="Transactions CV"
      description="Paiements saisis manuellement, liés aux commandes CV. Espace séparé de ZGR Tech Orders."
      icon={<Receipt />}
      iconClassName="bg-emerald-100 text-emerald-700"
      bodyClassName="overflow-y-auto"
      wrapHeaderActions
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy || !!draft} onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </Button>
          <Button variant="outline" disabled={busy || !loaded} onClick={exportCsv}>
            <Download className="h-4 w-4" />
            Export CSV / Excel
          </Button>
          <Button disabled={busy || !loaded} onClick={() => edit(emptyTransaction())}>
            <Plus className="h-4 w-4" />
            Nouvelle transaction
          </Button>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-[1800px] space-y-4 p-4 sm:p-6">
        {message && (
          <p role="status" className="rounded-xl border bg-white p-3 text-sm">
            {message}
          </p>
        )}
        {draft && (
          <section
            id="cv-transaction-form"
            className="space-y-4 rounded-xl border border-emerald-200 bg-white p-4"
          >
            <h2 className="font-bold">
              {draft.revision ? "Modifier la transaction" : "Nouvelle transaction"}{" "}
              <small className="font-normal text-slate-500">{cvTransactionLabel(draft.id)}</small>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="min-w-0 sm:col-span-2">
                <span className="mb-1 block text-xs text-slate-600">Client / commande CV *</span>
                <TechSearchSelect
                  label="Commande CV"
                  value={draft.orderId}
                  options={orders.map((o) => ({
                    value: o.id,
                    label: o.clientName || "Client sans nom",
                    detail: o.id,
                  }))}
                  disabled={busy}
                  placeholder="Rechercher par nom ou ID de commande…"
                  onChange={(id) => {
                    const chosen = orders.find((o) => o.id === id);
                    patch({
                      orderId: id,
                      client: chosen?.clientName || "",
                      admin: chosen?.adminUsername || draft.admin,
                      writer: chosen?.writerUsername || "",
                    });
                  }}
                />
              </div>
              <Field label="Date *">
                <Input
                  type="date"
                  value={draft.date}
                  disabled={busy}
                  onChange={(e) => patch({ date: e.target.value })}
                />
              </Field>
              <Field label="Devise *">
                <select
                  className="h-10 rounded-lg border bg-white px-2"
                  value={draft.currency}
                  disabled={busy}
                  onChange={(e) => {
                    patch({ currency: e.target.value as CvCurrency });
                    setAmount("");
                  }}
                >
                  {Object.keys(CV_CURRENCIES).map((code) => (
                    <option key={code}>{code}</option>
                  ))}
                </select>
              </Field>
              <Field label="Admin *">
                <Input
                  list="cv-transaction-people"
                  value={draft.admin}
                  disabled={busy}
                  onChange={(e) => patch({ admin: e.target.value })}
                />
              </Field>
              <Field label="Rédactrice / rédacteur">
                <Input
                  list="cv-transaction-people"
                  value={draft.writer}
                  disabled={busy}
                  onChange={(e) => patch({ writer: e.target.value })}
                />
              </Field>
              <Field label="Moyen de paiement *">
                <select
                  className="h-10 rounded-lg border bg-white px-2"
                  value={draft.paymentMethod}
                  disabled={busy}
                  onChange={(e) => patch({ paymentMethod: e.target.value })}
                >
                  {CV_PAYMENT_METHODS.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </Field>
              <Field label="Reçu par — bénéficiaire *">
                <Input
                  list="cv-transaction-receivers"
                  value={draft.receiver}
                  disabled={busy}
                  placeholder="Nom de la personne"
                  onChange={(e) => patch({ receiver: e.target.value })}
                />
              </Field>
            </div>
            <datalist id="cv-transaction-receivers">
              {receivers.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <datalist id="cv-transaction-people">
              {people.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <fieldset disabled={busy} className="space-y-2">
              <legend className="mb-2 text-xs font-medium">
                Services * — plusieurs choix, un seul montant global
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {choices.map((name) => (
                  <label
                    key={name}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs ${draft.services.includes(name) ? "border-emerald-400 bg-emerald-50 text-emerald-900" : "border-slate-200"}`}
                  >
                    <input
                      type="checkbox"
                      checked={draft.services.includes(name)}
                      onChange={(e) =>
                        patch({
                          services: e.target.checked
                            ? [...draft.services, name]
                            : draft.services.filter((s) => s !== name),
                        })
                      }
                    />
                    {name}
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  aria-label="Autre service personnalisé"
                  placeholder="Autre service…"
                  value={customService}
                  maxLength={150}
                  onChange={(e) => setCustomService(e.target.value)}
                />
                <Button
                  variant="outline"
                  disabled={!customService.trim() || busy}
                  onClick={() => {
                    const name = customService.trim();
                    if (
                      !draft.services.some(
                        (s) => s.toLocaleLowerCase("fr") === name.toLocaleLowerCase("fr"),
                      )
                    )
                      patch({ services: [...draft.services, name] });
                    setCustomService("");
                  }}
                >
                  Ajouter
                </Button>
              </div>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={`Montant global reçu (${draft.currency}) *`}>
                <Input
                  inputMode="decimal"
                  className="border-emerald-300 bg-emerald-50 text-lg font-bold text-emerald-900"
                  value={amount}
                  disabled={busy}
                  placeholder={draft.currency === "TND" ? "0,000" : "0,00"}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
              <Field label="Note facultative">
                <Input
                  value={draft.notes}
                  disabled={busy}
                  maxLength={4000}
                  onChange={(e) => patch({ notes: e.target.value })}
                />
              </Field>
            </div>
            <div className="space-y-2 rounded-lg border bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-xs">
                  Photo du justificatif — Google Drive privé uniquement
                </strong>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void checkDrive()}
                >
                  Vérifier Drive
                </Button>
              </div>
              <p role="status" className="text-xs text-slate-600">
                {driveMessage}
              </p>
              {receiptLink(draft)}
              <input
                ref={fileInput}
                aria-label="Photo du justificatif"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={busy || draft.voided}
                className="block w-full text-xs"
                onChange={(e) => setFile(e.target.files?.[0])}
              />
              {file && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 truncate">À envoyer : {file.name}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setFile(undefined);
                      if (fileInput.current) fileInput.current.value = "";
                    }}
                  >
                    Retirer
                  </Button>
                </div>
              )}
              <p className="text-[11px] text-slate-500">
                L’enregistrement envoie la photo dans le dossier Drive choisi. Aucun lien public
                n’est créé. Remplacer un justificatif conserve l’ancien fichier dans Drive.
              </p>
            </div>
            {draft.revision > 0 && (
              <div className="space-y-2 rounded-lg border border-amber-200 p-3">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={draft.voided}
                    disabled={busy}
                    onChange={(e) => patch({ voided: e.target.checked })}
                  />
                  Annuler cette écriture erronée — exclue des totaux, historique conservé
                </label>
                {draft.voided && (
                  <Input
                    aria-label="Motif de l’annulation"
                    placeholder="Motif obligatoire"
                    value={draft.voidReason}
                    maxLength={500}
                    disabled={busy}
                    onChange={(e) => patch({ voidReason: e.target.value })}
                  />
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => void save()}>
                {busy ? "Enregistrement…" : "Enregistrer la transaction"}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Abandonner cette saisie ?")) {
                    setDraft(undefined);
                    setFile(undefined);
                  }
                }}
              >
                Annuler la saisie
              </Button>
            </div>
          </section>
        )}
        <section className="space-y-3 rounded-xl border bg-white p-3">
          <Input
            aria-label="Rechercher les transactions CV"
            placeholder="Client, commande, admin, rédactrice, service, bénéficiaire…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <details>
            <summary className="cursor-pointer text-xs font-semibold text-indigo-700">
              Filtres
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-6">
              <Field label="Devise">
                <select
                  className="h-9 rounded-lg border px-2"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="">Toutes</option>
                  {Object.keys(CV_CURRENCIES).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Paiement">
                <select
                  className="h-9 rounded-lg border px-2"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <option value="">Tous</option>
                  {CV_PAYMENT_METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </Field>
              <Field label="Du">
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label="Au">
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </Field>
              <Field label="Écritures">
                <select
                  className="h-9 rounded-lg border px-2"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="active">Enregistrées</option>
                  <option value="voided">Annulées</option>
                  <option value="all">Toutes</option>
                </select>
              </Field>
              <Button
                variant="outline"
                onClick={() => {
                  setCurrency("");
                  setMethod("");
                  setFrom("");
                  setTo("");
                  setStatus("active");
                  setQuery("");
                }}
              >
                Réinitialiser
              </Button>
            </div>
          </details>
          {from && to && from > to && (
            <p className="text-xs text-red-700">La date de début doit précéder la date de fin.</p>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(CV_CURRENCIES) as CvCurrency[]).map((c) => (
              <div key={c} className="rounded-lg bg-emerald-50 p-2">
                <span className="text-[10px] text-slate-500">Total {c}</span>
                <strong className="block text-sm text-emerald-800">
                  {formatCvAmount(totals[c], c)}
                </strong>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">
            {filtered.length} transaction(s) retenue(s). Devises non additionnées entre elles ;
            écritures annulées exclues des totaux.
          </p>
        </section>
        <div className="space-y-2 md:hidden">
          {filtered.slice(0, visibleCount).map((record) => (
            <article key={record.id} className="space-y-2 rounded-xl border bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <strong className="text-indigo-700">{record.client}</strong>
                  <small className="block text-slate-500">
                    {record.date} · {record.orderId}
                  </small>
                </div>
                {moneyCell(record)}
              </div>
              <p className="text-xs">{record.services.join(" · ")}</p>
              <p className="text-xs text-slate-600">
                {record.paymentMethod} · Reçu par {record.receiver}
              </p>
              <div className="flex items-center justify-between gap-2">
                {receiptLink(record)}
                <Button size="sm" variant="outline" disabled={busy} onClick={() => edit(record)}>
                  Détails / modifier
                </Button>
              </div>
              {record.voided && (
                <p className="text-xs text-red-700">Annulée : {record.voidReason}</p>
              )}
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto rounded-xl border bg-white md:block">
          <table className="w-full min-w-[1100px] text-left text-xs">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                {[
                  "Date / commande",
                  "Client",
                  "Admin",
                  "Rédactrice",
                  "Services",
                  "Montant global",
                  "Paiement",
                  "Reçu par",
                  "Photo",
                  "Actions",
                ].map((h) => (
                  <th className="px-3 py-3" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, visibleCount).map((record) => (
                <tr key={record.id} className="border-t align-top">
                  <td className="px-3 py-3">
                    {record.date}
                    <small className="block text-slate-500">{record.orderId}</small>
                  </td>
                  <td className="px-3 py-3 font-semibold text-indigo-700">
                    {record.client}
                    {record.voided && <small className="block text-red-700">Annulée</small>}
                  </td>
                  <td className="px-3 py-3">{record.admin}</td>
                  <td className="px-3 py-3">{record.writer || "—"}</td>
                  <td className="max-w-64 px-3 py-3">{record.services.join(" · ")}</td>
                  <td className="whitespace-nowrap px-3 py-3">{moneyCell(record)}</td>
                  <td className="px-3 py-3">{record.paymentMethod}</td>
                  <td className="px-3 py-3">{record.receiver}</td>
                  <td className="px-3 py-3">{receiptLink(record)}</td>
                  <td className="px-3 py-3">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => edit(record)}
                    >
                      Détails / modifier
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <p className="rounded-xl border bg-white p-6 text-center text-sm text-slate-500">
            {busy
              ? "Chargement…"
              : loaded
                ? "Aucune transaction pour ces filtres."
                : "Registre indisponible. Actualisez après vérification de la connexion."}
          </p>
        )}
        {filtered.length > visibleCount && (
          <Button variant="outline" onClick={() => setVisibleCount((n) => n + 25)}>
            Afficher 25 transactions de plus
          </Button>
        )}
      </div>
    </FullPageWorkspace>
  );
}
