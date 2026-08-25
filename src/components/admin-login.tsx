import { useState, type FormEvent } from "react";
import {
  ExternalLink,
  FileText,
  LoaderCircle,
  LockKeyhole,
  RefreshCcw,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearAdminSession, loginAdmin, type SessionUser } from "@/lib/auth-client";

const ONLINE_APP_URL = "https://abdou677778.github.io/zgr-cv/";

function initialUsername() {
  if (typeof window === "undefined") return "admin";
  return new URLSearchParams(window.location.search).get("login")?.trim() || "admin";
}

export function AdminLogin({ onAuthenticated }: { onAuthenticated: (user: SessionUser) => void }) {
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [networkFailure, setNetworkFailure] = useState(false);
  const fileMode = typeof window !== "undefined" && window.location.protocol === "file:";

  const openOnlineVersion = () => {
    const target = new URL(ONLINE_APP_URL);
    if (username.trim()) target.searchParams.set("login", username.trim());
    target.searchParams.set("refresh", Date.now().toString());
    window.location.assign(target.toString());
  };

  const repairSession = () => {
    clearAdminSession();
    const target = fileMode ? new URL(ONLINE_APP_URL) : new URL(window.location.href);
    if (username.trim()) target.searchParams.set("login", username.trim());
    target.searchParams.set("refresh", Date.now().toString());
    window.location.replace(target.toString());
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNetworkFailure(false);
    try {
      onAuthenticated(await loginAdmin(username, password));
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "Connexion impossible.";
      const isNetworkFailure =
        failure instanceof TypeError ||
        failure instanceof DOMException ||
        /failed to fetch|networkerror|load failed|abort|timeout|délai/i.test(message);
      setNetworkFailure(isNetworkFailure);
      setError(
        isNetworkFailure
          ? fileMode
            ? "Ce navigateur bloque la connexion Cloudflare depuis le fichier local. Ouvrez la version en ligne ci-dessous."
            : "Le navigateur n’a pas joint le service. Une ancienne session, le cache ou une extension peut bloquer la connexion."
          : message,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      className="zgr-app-shell flex min-h-screen items-center justify-center px-4 py-10"
      lang="fr"
    >
      <section className="w-full max-w-md overflow-hidden rounded-3xl border border-white/70 bg-white/95 shadow-2xl shadow-indigo-950/15 backdrop-blur">
        <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 px-7 py-7 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">ZGR CV Studio</h1>
              <p className="mt-1 text-xs text-indigo-100">Espace utilisateurs sécurisé</p>
            </div>
          </div>
        </div>
        <form className="space-y-5 p-7" onSubmit={submit}>
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-900">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p>Accès privé. Seul l’administrateur peut créer, modifier ou désactiver un profil.</p>
          </div>
          {fileMode && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
              <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p>
                Mode fichier local détecté. Pour une connexion fiable sur plusieurs navigateurs, PC
                ou téléphones, utilisez la version HTTPS en ligne.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="admin-username">Utilisateur</Label>
            <Input
              id="admin-username"
              value={username}
              autoComplete="username"
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-password">Mot de passe</Label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              required
              autoFocus
            />
          </div>
          {error && (
            <div className="space-y-2">
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
              {networkFailure && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full rounded-xl border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100"
                  onClick={repairSession}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" /> Réparer la session et actualiser
                </Button>
              )}
            </div>
          )}
          <Button
            type="submit"
            className="h-11 w-full rounded-xl"
            disabled={busy || !username || !password}
          >
            {busy ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LockKeyhole className="mr-2 h-4 w-4" />
            )}
            Se connecter
          </Button>
          {fileMode && (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl border-indigo-200 bg-indigo-50 text-indigo-950 hover:bg-indigo-100"
              onClick={openOnlineVersion}
            >
              <ExternalLink className="mr-2 h-4 w-4" /> Ouvrir la version en ligne
            </Button>
          )}
        </form>
      </section>
    </main>
  );
}
