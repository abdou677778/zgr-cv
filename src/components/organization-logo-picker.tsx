import { useEffect, useState } from "react";
import { Input } from "./ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "./ui/popover";
import { getCurrentUser } from "@/lib/auth-client";
import type { CompanyLogo } from "@/lib/cv-types";
import {
  organizationCatalog,
  createOrganization,
  loadOrganizationLogos,
  organizationLogo,
  organizationLogoUrl,
  saveOrganizationLogo,
} from "@/lib/organization-logos";
export function OrganizationLogoPicker({
  name,
  logo,
  onLogoSelect,
}: {
  name: string;
  logo?: CompanyLogo;
  onLogoSelect: (logo: CompanyLogo) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [, refresh] = useState(0);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [category, setCategory] = useState("company");
  const [file, setFile] = useState<File>();
  const [saving, setSaving] = useState(false);
  const admin = getCurrentUser()?.role === "admin";
  useEffect(() => {
    void loadOrganizationLogos();
    const update = () => refresh((v) => v + 1);
    window.addEventListener("zgr-organization-logos", update);
    return () => window.removeEventListener("zgr-organization-logos", update);
  }, []);
  const normalize = (v: string) =>
    v
      .normalize("NFD")
      .replace(/\p{Mark}/gu, "")
      .toLowerCase();
  const catalog = organizationCatalog();
  const matches = catalog
    .filter((item) => normalize(item.name).includes(normalize(query)))
    .slice(0, 15);
  const selected =
    logo?.catalogId || catalog.find((item) => normalize(item.name) === normalize(name))?.id;
  const source = selected ? organizationLogoUrl(selected) : logo?.dataUrl;
  return (
    <div className="space-y-2 rounded-lg border bg-white p-2">
      <p className="text-xs font-medium">Bibliothèque entreprises et établissements</p>
      <div className="flex items-center gap-2">
        <label
          title={
            selected && !creating
              ? "Remplacer ce logo dans le cloud partagé"
              : "Importer un logo depuis votre ordinateur"
          }
          className="cursor-pointer"
        >
          {source ? (
            <img src={source} alt="Logo organisation" className="h-9 w-9 object-contain" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded border">＋</span>
          )}
          {admin && (
            <input
              aria-label="Importer un logo depuis votre ordinateur"
              type="file"
              disabled={saving}
              className="sr-only"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={async (e) => {
                const chosen = e.target.files?.[0];
                e.currentTarget.value = "";
                if (!chosen) return;
                if (!selected || creating) {
                  setFile(chosen);
                  if (!creating) setNewName(query.trim() || name);
                  setCreating(true);
                  setOpen(false);
                  setMessage(
                    "Logo sélectionné : vérifiez le nom et la catégorie, puis enregistrez.",
                  );
                  return;
                }
                setSaving(true);
                setMessage("Enregistrement cloud…");
                try {
                  const result = await saveOrganizationLogo(selected, chosen);
                  if (result) onLogoSelect(result);
                  setMessage("Logo cloud enregistré. Le nom du document est conservé.");
                } catch (error) {
                  setMessage(String(error));
                } finally {
                  setSaving(false);
                }
              }}
            />
          )}
        </label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverAnchor asChild>
            <Input
              placeholder="Sonatrach, ADE, université…"
              value={query}
              onFocus={() => setOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
            />
          </PopoverAnchor>
          <PopoverContent
            align="start"
            className="z-[100] w-80 max-w-[calc(100vw-24px)] overflow-auto p-1"
            style={{ maxHeight: "min(300px,var(--radix-popover-content-available-height))" }}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            {matches.map((item) => (
              <button
                type="button"
                key={item.id}
                aria-label={`Utiliser le logo de ${item.name}`}
                className="flex w-full items-center gap-2 rounded p-2 text-left text-xs hover:bg-slate-100"
                onMouseDown={(e) => e.preventDefault()}
                onClick={async () => {
                  try {
                    const result = await organizationLogo(item.id);
                    if (result) onLogoSelect(result);
                    setQuery(item.name);
                    setOpen(false);
                    setMessage(
                      result
                        ? "Logo appliqué. Le nom du document est conservé."
                        : "Logo indisponible : le nom et le logo du document sont conservés.",
                    );
                  } catch {
                    setOpen(false);
                    setMessage("Logo indisponible : le nom et le logo du document sont conservés.");
                  }
                }}
              >
                {organizationLogoUrl(item.id) ? (
                  <img
                    src={organizationLogoUrl(item.id)}
                    alt=""
                    className="h-6 w-6 object-contain"
                  />
                ) : (
                  <span className="w-6 text-center">—</span>
                )}
                {item.name}
                {item.category === "example" ? " · exemple fictif" : ""}
              </button>
            ))}
            {!matches.length && <p className="p-2 text-xs">Aucun résultat.</p>}
            {admin && (
              <button
                type="button"
                className="w-full border-t p-2 text-left text-xs font-medium text-blue-700"
                onClick={() => {
                  setNewName(query.trim() || name);
                  setCreating(true);
                  setOpen(false);
                }}
              >
                ＋ Ajouter une entreprise ou un établissement au cloud
              </button>
            )}
          </PopoverContent>
        </Popover>
      </div>
      <p className="text-[10px] text-slate-500">
        Choisissez uniquement un logo : le nom de l’établissement ou de l’employeur reste inchangé,
        même s’il est vide. Modifiez ce nom dans son champ, dans la langue du document.
        Administrateur : cliquez sur le logo pour le remplacer dans le cloud partagé.
      </p>
      {admin && !creating && (
        <button
          type="button"
          className="text-xs font-medium text-blue-700"
          onClick={() => {
            setNewName(query.trim() || name);
            setCreating(true);
          }}
        >
          ＋ Ajouter un nom et son logo au cloud
        </button>
      )}
      {admin && creating && (
        <div className="space-y-2 rounded border bg-slate-50 p-3">
          <p className="text-xs font-medium">Nouvelle organisation — bibliothèque partagée</p>
          <Input
            aria-label="Nom de la nouvelle organisation"
            placeholder="Nom officiel"
            value={newName}
            maxLength={180}
            disabled={saving}
            onChange={(e) => setNewName(e.target.value)}
          />
          <select
            aria-label="Catégorie de l’organisation"
            className="h-9 w-full rounded border bg-white px-2 text-xs"
            value={category}
            disabled={saving}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="company">Entreprise</option>
            <option value="university">Université</option>
            <option value="school">École</option>
            <option value="training">Centre de formation</option>
            <option value="institute">Institut</option>
          </select>
          <label className="block text-xs">
            Logo (SVG, PNG, JPG ou WebP, 4 Mo maximum)
            <input
              aria-label="Logo de la nouvelle organisation"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              disabled={saving}
              className="mt-1 block w-full text-xs"
              onChange={(e) => setFile(e.target.files?.[0])}
            />
          </label>
          {file && (
            <p className="break-all text-xs text-slate-600">Fichier sélectionné : {file.name}</p>
          )}
          <p className="text-[10px] text-slate-500">
            Ajusté automatiquement en 256 × 256 px sans déformation. Disponible dans toutes les
            sections après enregistrement.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={saving || !newName.trim() || !file}
              className="rounded bg-blue-700 px-3 py-2 text-xs text-white disabled:opacity-50"
              onClick={async () => {
                if (!file) return;
                setSaving(true);
                setMessage("Enregistrement dans le cloud…");
                try {
                  const result = await createOrganization(newName, category, file);
                  onLogoSelect(result);
                  setQuery(newName.trim());
                  setCreating(false);
                  setFile(undefined);
                  setMessage(
                    "Organisation et logo ajoutés à la bibliothèque cloud partagée. Le nom du document est conservé.",
                  );
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : String(error));
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Enregistrement…" : "Enregistrer et utiliser"}
            </button>
            <button
              type="button"
              className="text-xs"
              disabled={saving}
              onClick={() => {
                setCreating(false);
                setFile(undefined);
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}
      {message && (
        <p role="status" className="text-xs">
          {message}
        </p>
      )}
    </div>
  );
}
