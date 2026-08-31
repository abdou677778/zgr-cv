import { useRef, useState } from "react";
import { Cloud, ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProfilePhoto } from "@/lib/cv-types";
import { processProfilePhoto } from "@/lib/profile-photo";

export function ProfilePhotoField({
  photo,
  onChange,
}: {
  photo?: ProfilePhoto;
  onChange: (photo?: ProfilePhoto) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const selectPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const processed = await processProfilePhoto(file);
      onChange(processed);
      setMessage(
        `Photo convertie en WebP haute qualité : ${(processed.sizeBytes / 1024).toFixed(1)} Ko.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Traitement de la photo impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={selectPhoto}
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-inner">
          {photo?.dataUrl ? (
            <img
              src={photo.dataUrl}
              alt="Aperçu de la photo du profil"
              className="h-full w-full object-cover"
            />
          ) : (
            <ImagePlus className="h-8 w-8 text-slate-300" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {photo ? "Photo professionnelle prête" : "Ajouter une photo professionnelle"}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              JPG, PNG ou WebP · conversion automatique en WebP · qualité élevée · 150 Ko maximum.
            </p>
          </div>
          {photo && (
            <div className="flex flex-wrap gap-2 text-[11px] font-medium">
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
                WebP {(photo.sizeBytes / 1024).toFixed(1)} Ko
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                {photo.width} × {photo.height} px
              </span>
              {photo.r2Key && (
                <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-1 text-sky-700">
                  <Cloud className="mr-1 h-3 w-3" /> R2 synchronisé
                </span>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="mr-2 h-4 w-4" />
              )}
              {photo ? "Remplacer la photo" : "Choisir une photo"}
            </Button>
            {photo && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  onChange(undefined);
                  setMessage(
                    "Photo retirée du profil. La prochaine sauvegarde supprimera sa copie R2.",
                  );
                }}
              >
                <Trash2 className="mr-2 h-4 w-4 text-destructive" /> Retirer
              </Button>
            )}
          </div>
        </div>
      </div>
      {message && (
        <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-600" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
