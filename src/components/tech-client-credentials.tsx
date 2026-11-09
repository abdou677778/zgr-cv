import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Eye, EyeOff, LockKeyhole, X } from "lucide-react";
import { authenticatedFetch } from "@/lib/auth-client";
import type { TechOrder } from "@/lib/tech-orders";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Metadata = { email: string; hasPassword: boolean; revision: number };
async function vault(path: string, init?: RequestInit) {
  const response = await authenticatedFetch(path, { ...init, cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw Error(body.error || "Coffre indisponible.");
  return body;
}
export function TechClientCredentials({
  order,
  onClose,
  request = vault,
}: {
  order: TechOrder;
  onClose: () => void;
  request?: typeof vault;
}) {
  const path = `/api/tech-orders/orders/${order.id}/credentials`;
  const [meta, setMeta] = useState<Metadata>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState<string>();
  const [revealed, setRevealed] = useState<string>();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const working = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    const controller = new AbortController();
    void request(path, { signal: controller.signal })
      .then((data: Metadata) => {
        if (active) {
          setMeta(data);
          setEmail(data.email);
        }
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      });
    const hide = () => {
      if (document.hidden) {
        setVisible(false);
        setRevealed(undefined);
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      active = false;
      mounted.current = false;
      controller.abort();
      document.removeEventListener("visibilitychange", hide);
    };
  }, [path, request]);
  const run = async (action: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      if (mounted.current)
        setMessage(error instanceof Error ? error.message : "Coffre indisponible.");
    } finally {
      working.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const reveal = () => {
    if (visible) {
      setVisible(false);
      setRevealed(undefined);
      return;
    }
    if (password !== undefined || !meta?.hasPassword) {
      setVisible(true);
      return;
    }
    void run(async () => {
      const data = await request(`${path}/reveal`, { method: "POST" });
      if (!mounted.current || document.hidden) return;
      if (data.revision !== meta.revision)
        throw Error("Les identifiants ont changé. Fermez puis rouvrez ce panneau.");
      setRevealed(data.password);
      setVisible(true);
    });
  };
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !working.current) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[180] bg-slate-950/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[181] max-h-[90dvh] overflow-y-auto w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-2xl border bg-white p-5 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="flex items-center gap-2 font-bold text-indigo-900">
                <LockKeyhole className="h-5 w-5" />
                E-mail et mot de passe
              </Dialog.Title>
              <Dialog.Description className="mt-1 break-words text-sm text-slate-600">
                {order.client} · Mémo privé commun aux ventes de ce client.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button
                size="icon"
                variant="ghost"
                disabled={busy}
                aria-label="Fermer les identifiants"
              >
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>
          <form
            autoComplete="off"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!meta) return;
              void run(async () => {
                const data: Metadata = await request(path, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    revision: meta.revision,
                    email,
                    ...(password !== undefined ? { password } : {}),
                  }),
                });
                if (mounted.current) {
                  setMeta(data);
                  setPassword(undefined);
                  setRevealed(undefined);
                  setVisible(false);
                  setMessage("Identifiants enregistrés dans le coffre chiffré.");
                }
              });
            }}
          >
            <label className="block space-y-1 text-sm font-medium">
              E-mail du client
              <Input
                type="email"
                maxLength={254}
                autoComplete="off"
                value={email}
                disabled={!meta || busy}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="client@exemple.com"
              />
            </label>
            <div className="space-y-1">
              <label htmlFor="tech-client-password" className="text-sm font-medium">
                Mot de passe
              </label>
              <div className="flex gap-2">
                <Input
                  id="tech-client-password"
                  type={visible ? "text" : "password"}
                  autoComplete="new-password"
                  maxLength={2048}
                  value={password ?? revealed ?? ""}
                  disabled={!meta || busy}
                  placeholder={
                    meta?.hasPassword
                      ? "Déjà enregistré — inchangé si vide"
                      : "Saisir le mot de passe"
                  }
                  onChange={(event) => setPassword(event.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!meta || busy}
                  aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  onClick={reveal}
                >
                  {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {meta?.hasPassword && (
                <button
                  type="button"
                  disabled={busy}
                  className="py-1 text-xs text-red-700 hover:underline"
                  onClick={() => {
                    setPassword("");
                    setRevealed(undefined);
                    setVisible(false);
                  }}
                >
                  {password === ""
                    ? "Suppression à enregistrer"
                    : "Effacer le mot de passe enregistré"}
                </button>
              )}
            </div>
            {message && (
              <p role="status" className="text-sm text-indigo-800">
                {message}
              </p>
            )}
            <p className="text-xs text-slate-500">
              Chiffré dans le cloud · Accès administrateur · Exclu des exports et des messages.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
                Fermer
              </Button>
              <Button type="submit" disabled={!meta || busy}>
                {busy ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
