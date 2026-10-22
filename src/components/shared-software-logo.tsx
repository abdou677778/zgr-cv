import { useEffect, useState } from "react";
import { getCurrentUser } from "@/lib/auth-client";
import { softwareIconUrl } from "@/lib/software-icons";
import { loadSharedSoftwareLogos, replaceSharedSoftwareLogo } from "@/lib/shared-software-logos";

export function SharedSoftwareLogo({ slug, custom, onSaved }: { slug: string; custom?: string; onSaved: () => void }) {
  const [, refresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const update = () => refresh((value) => value + 1);
    window.addEventListener("zgr-software-logos", update);
    void loadSharedSoftwareLogos();
    return () => window.removeEventListener("zgr-software-logos", update);
  }, []);
  const canEdit = getCurrentUser()?.role === "admin" && slug !== "generic";
  const source = custom || softwareIconUrl(slug);
  return <div className="shrink-0">
    <label className={canEdit ? "block cursor-pointer" : "block"}
      title={canEdit ? "Remplacer ce logo dans la bibliothèque cloud pour tous les profils" : "Logo de la bibliothèque partagée"}>
      {source ? <img src={source} alt="Logo du logiciel" className="h-10 w-10 rounded-md border bg-white p-1 object-contain" />
        : <span className="flex h-10 w-10 items-center justify-center rounded-md border">—</span>}
      {canEdit && <input type="file" className="sr-only" disabled={busy}
        aria-label={`Remplacer le logo cloud ${slug}`}
        accept="image/svg+xml,image/png,image/webp,image/jpeg" onChange={async (event) => {
          const file = event.target.files?.[0]; event.currentTarget.value = "";
          if (!file) return;
          setBusy(true); setMessage("");
          try { await replaceSharedSoftwareLogo(slug, file); onSaved(); setMessage("Cloud ✓"); }
          catch (error) { setMessage(error instanceof Error ? error.message : "Échec cloud"); }
          finally { setBusy(false); }
        }} />}
    </label>
    {busy && <span className="text-[10px]">Envoi…</span>}
    {message && <p role="status" className="max-w-36 text-[10px]">{message}</p>}
  </div>;
}
