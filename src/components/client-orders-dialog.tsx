import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CircleCheck,
  Cloud,
  Copy,
  Download,
  ExternalLink,
  FileJson,
  FileText,
  FolderOpen,
  LoaderCircle,
  Link2,
  PackageOpen,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  createClientInvitation,
  downloadClientOrderFile,
  downloadClientOrderJson,
  downloadClientOrderPack,
  getClientOrder,
  importClientOrderJson,
  listClientOrders,
  readClientOrderJson,
  syncClientOrderDrive,
  type ClientOrderDetail,
  type ClientOrderFile,
  type ClientOrderJsonVersion,
  type ClientOrderSummary,
} from "@/lib/client-orders";

const SERVICE_LABELS: Record<string, string> = {
  CV_EUROPASS: "Europass",
  CV_CANADIEN: "CV Canadien",
  CV_ATS: "CV ATS",
  CV_ARABE: "CV Arabe",
  LETTRE_FR: "Lettre FR",
  LETTRE_ENG: "Lettre ENG",
  CONSEILS: "Conseils",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  RECEIVED: "Reçue",
  JSON_IMPORTED: "JSON importé",
  IN_PRODUCTION: "En production",
  TO_VALIDATE: "À valider",
  DELIVERED: "Livrée",
  ARCHIVED: "Archivée",
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  RECEIVED: "bg-blue-100 text-blue-800",
  JSON_IMPORTED: "bg-violet-100 text-violet-800",
  IN_PRODUCTION: "bg-amber-100 text-amber-800",
  TO_VALIDATE: "bg-orange-100 text-orange-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
  ARCHIVED: "bg-zinc-100 text-zinc-700",
};

const EVENT_LABELS: Record<string, string> = {
  ORDER_CREATED: "Commande créée",
  FILE_UPLOADED: "Document ajouté",
  ORDER_COMPLETED: "Dossier envoyé",
  AI_PACK_DOWNLOADED: "Pack IA téléchargé",
  JSON_IMPORTED: "JSON ZGR importé",
  DRIVE_SYNCED: "Google Drive synchronisé",
  DRIVE_SYNC_FAILED: "Échec de la synchronisation Drive",
};

function formatBytes(value: number) {
  if (value < 1024) return `${value} o`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} Ko`;
  return `${(value / 1024 / 1024).toFixed(1)} Mo`;
}

function dayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const key = date.toISOString().slice(0, 10);
  if (key === today.toISOString().slice(0, 10)) return "Aujourd’hui";
  if (key === yesterday.toISOString().slice(0, 10)) return "Hier";
  return date.toLocaleDateString("fr-DZ", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function ClientOrdersDialog({
  open,
  onOpenChange,
  onOpenJson,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenJson: (value: unknown, order: ClientOrderSummary) => void;
}) {
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [orders, setOrders] = useState<ClientOrderSummary[]>([]);
  const [detail, setDetail] = useState<ClientOrderDetail | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");

  const createInvitation = async () => {
    setBusy("invite");
    setMessage("");
    try {
      const invitation = await createClientInvitation(7);
      setInviteUrl(invitation.inviteUrl);
      await navigator.clipboard.writeText(invitation.inviteUrl);
      setMessage(
        `Lien client créé et copié · valable jusqu’au ${new Date(
          invitation.expiresAt,
        ).toLocaleString("fr-DZ")}.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Création du lien impossible.");
    } finally {
      setBusy("");
    }
  };

  const refresh = async (keepSelection = true) => {
    setBusy("refresh");
    setMessage("");
    try {
      const next = await listClientOrders();
      setOrders(next);
      const selectedId = keepSelection ? detail?.order.id : undefined;
      if (selectedId && next.some((order) => order.id === selectedId)) {
        setDetail(await getClientOrder(selectedId));
      } else if (next[0]) {
        setDetail(await getClientOrder(next[0].id));
      } else {
        setDetail(null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Commandes indisponibles.");
      setOrders([]);
      setDetail(null);
    } finally {
      setBusy("");
    }
  };

  useEffect(() => {
    if (open) void refresh(false);
  }, [open]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr");
    return orders.filter((order) => {
      if (status !== "ALL" && order.status !== status) return false;
      if (!query) return true;
      return [order.id, order.clientName, order.email, order.phone, ...order.services].some(
        (value) => value.toLocaleLowerCase("fr").includes(query),
      );
    });
  }, [orders, search, status]);

  const grouped = useMemo(() => {
    const result = new Map<string, ClientOrderSummary[]>();
    for (const order of filtered) {
      const label = dayLabel(order.createdAt);
      result.set(label, [...(result.get(label) ?? []), order]);
    }
    return [...result.entries()];
  }, [filtered]);

  const openOrder = async (orderId: string) => {
    setBusy(`open:${orderId}`);
    setMessage("");
    try {
      setDetail(await getClientOrder(orderId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ouverture impossible.");
    } finally {
      setBusy("");
    }
  };

  const downloadPack = async () => {
    if (!detail) return;
    setBusy("pack");
    setMessage("");
    try {
      await downloadClientOrderPack(detail.order.id);
      setMessage("Pack IA téléchargé avec le méga-prompt et les sources du client.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pack IA indisponible.");
    } finally {
      setBusy("");
    }
  };

  const downloadFile = async (file: ClientOrderFile) => {
    if (!detail) return;
    setBusy(`file:${file.id}`);
    try {
      await downloadClientOrderFile(detail.order.id, file);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Téléchargement impossible.");
    } finally {
      setBusy("");
    }
  };

  const importJson = async (file: File) => {
    if (!detail) return;
    setBusy("json-import");
    setMessage("");
    try {
      const result = await importClientOrderJson(detail.order.id, file);
      setMessage(
        `JSON v${String(result.versionNumber).padStart(3, "0")} importé et validé · ${
          result.validation.presentLanguages?.join(", ").toUpperCase() || "langues reconnues"
        }.`,
      );
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import JSON impossible.");
    } finally {
      setBusy("");
    }
  };

  const openJson = async (version: ClientOrderJsonVersion) => {
    if (!detail) return;
    setBusy(`json-open:${version.versionNumber}`);
    setMessage("");
    try {
      const value = await readClientOrderJson(detail.order.id, version.versionNumber);
      onOpenJson(value, detail.order);
      onOpenChange(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ouverture du JSON impossible.");
    } finally {
      setBusy("");
    }
  };

  const syncDrive = async () => {
    if (!detail) return;
    setBusy("drive");
    setMessage("");
    try {
      await syncClientOrderDrive(detail.order.id);
      setMessage("Dossier Google Drive synchronisé.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Synchronisation Drive impossible.");
    } finally {
      setBusy("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-7xl overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <PackageOpen className="h-5 w-5 text-cyan-700" /> Commandes CV PRO TEAM
              </DialogTitle>
              <DialogDescription className="mt-1">
                Dossiers reçus par date, Pack IA, documents sources et versions JSON ZGR.
              </DialogDescription>
            </div>
            <Button
              type="button"
              size="sm"
              className="bg-cyan-700 hover:bg-cyan-800"
              onClick={() => void createInvitation()}
              disabled={Boolean(busy)}
            >
              {busy === "invite" ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="mr-2 h-4 w-4" />
              )}
              Nouveau lien client
            </Button>
          </div>
        </DialogHeader>

        <input
          ref={jsonInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void importJson(file);
          }}
        />

        <div className="grid min-h-[620px] gap-4 lg:grid-cols-[23rem_minmax(0,1fr)]">
          <aside className="space-y-3 rounded-xl border bg-slate-50/80 p-3">
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Client, ID, service…"
                  className="bg-white pl-9"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Actualiser les commandes"
                onClick={() => void refresh()}
              >
                <RefreshCw className={busy === "refresh" ? "animate-spin" : ""} />
              </Button>
            </div>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-9 w-full rounded-md border bg-white px-3 text-sm"
            >
              <option value="ALL">Tous les statuts</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <div className="max-h-[525px] space-y-4 overflow-y-auto pr-1">
              {grouped.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-white p-8 text-center text-sm text-muted-foreground">
                  {busy === "refresh" ? "Chargement des commandes…" : "Aucune commande trouvée."}
                </div>
              ) : (
                grouped.map(([label, dayOrders]) => (
                  <section key={label}>
                    <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                      <CalendarDays className="h-3.5 w-3.5" /> {label}
                    </h3>
                    <div className="space-y-2">
                      {dayOrders.map((order) => (
                        <button
                          key={order.id}
                          type="button"
                          onClick={() => void openOrder(order.id)}
                          className={`w-full rounded-xl border p-3 text-left transition ${
                            detail?.order.id === order.id
                              ? "border-cyan-300 bg-cyan-50 shadow-sm"
                              : "border-slate-200 bg-white hover:border-cyan-200"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold">{order.clientName}</p>
                              <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                                {order.id}
                              </p>
                            </div>
                            {busy === `open:${order.id}` ? (
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : (
                              <span
                                className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${
                                  STATUS_STYLES[order.status] || "bg-slate-100"
                                }`}
                              >
                                {STATUS_LABELS[order.status] || order.status}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {order.services.slice(0, 3).map((service) => (
                              <span
                                key={service}
                                className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"
                              >
                                {SERVICE_LABELS[service] || service}
                              </span>
                            ))}
                            {order.services.length > 3 && (
                              <span className="text-[10px] text-slate-500">
                                +{order.services.length - 3}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          </aside>

          <section className="min-w-0 space-y-4">
            {!detail ? (
              <div className="grid min-h-[520px] place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">
                Sélectionnez une commande.
              </div>
            ) : (
              <>
                <div className="rounded-xl border bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold">{detail.order.clientName}</h2>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            STATUS_STYLES[detail.order.status] || "bg-slate-100"
                          }`}
                        >
                          {STATUS_LABELS[detail.order.status] || detail.order.status}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {detail.order.id}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {detail.order.email}
                        {detail.order.phone ? ` · ${detail.order.phone}` : ""} · Reçue{" "}
                        {new Date(detail.order.createdAt).toLocaleString("fr-DZ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => void downloadPack()}
                        disabled={Boolean(busy)}
                      >
                        {busy === "pack" ? (
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <PackageOpen className="mr-2 h-4 w-4" />
                        )}
                        Pack IA
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => jsonInputRef.current?.click()}
                        disabled={Boolean(busy)}
                      >
                        {busy === "json-import" ? (
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="mr-2 h-4 w-4" />
                        )}
                        Importer JSON
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void syncDrive()}
                        disabled={Boolean(busy)}
                      >
                        {busy === "drive" ? (
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Cloud className="mr-2 h-4 w-4" />
                        )}
                        Synchroniser Drive
                      </Button>
                      {detail.order.driveFolderId && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            window.open(
                              `https://drive.google.com/drive/folders/${detail.order.driveFolderId}`,
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }
                        >
                          <FolderOpen className="mr-2 h-4 w-4" /> Drive
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {detail.order.services.map((service) => (
                      <span
                        key={service}
                        className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-900"
                      >
                        {SERVICE_LABELS[service] || service}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Remarques du client
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                      {detail.order.notes || "Aucune remarque."}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <section className="rounded-xl border bg-white p-4">
                    <h3 className="flex items-center gap-2 font-bold">
                      <FileText className="h-4 w-4 text-blue-600" /> Documents sources ·{" "}
                      {detail.files.length}
                    </h3>
                    <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                      {detail.files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between gap-3 rounded-lg border p-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold">{file.originalName}</p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {file.category.replaceAll("_", " ")} · {formatBytes(file.sizeBytes)}
                            </p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Télécharger ${file.originalName}`}
                            onClick={() => void downloadFile(file)}
                            disabled={Boolean(busy)}
                          >
                            {busy === `file:${file.id}` ? (
                              <LoaderCircle className="animate-spin" />
                            ) : (
                              <Download />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-xl border bg-white p-4">
                    <h3 className="flex items-center gap-2 font-bold">
                      <FileJson className="h-4 w-4 text-violet-600" /> Versions JSON ·{" "}
                      {detail.jsonVersions.length}
                    </h3>
                    <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                      {detail.jsonVersions.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                          Téléchargez le Pack IA, traitez le dossier puis importez le JSON produit.
                        </div>
                      ) : (
                        detail.jsonVersions.map((version) => (
                          <div key={version.id} className="rounded-lg border p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-bold">
                                  Version {String(version.versionNumber).padStart(3, "0")}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  Prompt {version.promptVersion} ·{" "}
                                  {new Date(version.createdAt).toLocaleString("fr-DZ")}
                                </p>
                              </div>
                              <CircleCheck className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                onClick={() => void openJson(version)}
                                disabled={Boolean(busy)}
                              >
                                {busy === `json-open:${version.versionNumber}` ? (
                                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                )}
                                Ouvrir dans ZGR
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  void downloadClientOrderJson(
                                    detail.order.id,
                                    version.versionNumber,
                                  )
                                }
                              >
                                <Download className="mr-2 h-4 w-4" /> JSON
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </div>

                <section className="rounded-xl border bg-white p-4">
                  <h3 className="font-bold">Historique</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {detail.events.slice(0, 8).map((event) => (
                      <div
                        key={event.id}
                        className="flex items-start gap-2 rounded-lg bg-slate-50 p-2.5"
                      >
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-600" />
                        <div>
                          <p className="text-xs font-semibold">
                            {EVENT_LABELS[event.type] || event.type}
                          </p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {new Date(event.createdAt).toLocaleString("fr-DZ")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </section>
        </div>

        {(message || inviteUrl) && (
          <div className="space-y-2 rounded-lg border bg-background p-3 text-xs" role="status">
            {message && <p>{message}</p>}
            {inviteUrl && (
              <div className="flex items-center gap-2 rounded-md bg-slate-50 p-2">
                <code className="min-w-0 flex-1 truncate">{inviteUrl}</code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(inviteUrl)}
                >
                  <Copy className="mr-2 h-3.5 w-3.5" /> Copier
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
