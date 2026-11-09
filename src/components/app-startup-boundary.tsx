import { Component, type ReactNode } from "react";

/** Keep a failed lazy chunk or render from turning the authenticated app white. */
export class AppStartupBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="mx-auto max-w-md space-y-4 p-6 pt-16 font-sans text-slate-800">
        <h1 className="text-xl font-bold text-indigo-700">ZGR — démarrage interrompu</h1>
        <p>
          L’application n’a pas pu s’afficher. Réessayez avec Internet actif. Sur Android, vérifiez
          les mises à jour de WebView et Chrome dans le Play Store.
        </p>
        <button
          type="button"
          className="rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white"
          onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.set("_zgr_retry", String(Date.now()));
            window.location.replace(url.href);
          }}
        >
          Réessayer
        </button>
        <p className="text-sm text-slate-500">
          Aucune commande n’a été effacée par cette récupération.
        </p>
      </main>
    );
  }
}
