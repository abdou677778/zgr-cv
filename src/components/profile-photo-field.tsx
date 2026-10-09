import { useEffect, useRef, useState } from "react";
import { Cloud, ImagePlus, Images, LoaderCircle, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProfilePhoto } from "@/lib/cv-types";
import {
  PROFILE_PHOTO_AI_MODEL,
  PROFILE_PHOTO_BACKGROUND,
  processProfilePhoto,
} from "@/lib/profile-photo";
import { professionalizeProfilePhoto } from "@/lib/profile-photo-ai";
import {
  getProfilePhotoAssetBlob,
  listProfilePhotoAssets,
  saveProfilePhotoAsset,
  type ProfilePhotoAsset,
} from "@/lib/profile-photo-cloud";

type LocalAsset = ProfilePhotoAsset & { blob: Blob; previewUrl: string };

function blobDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Lecture de la photo impossible."));
    reader.readAsDataURL(blob);
  });
}

function localAsset(
  blob: Blob,
  photo: ProfilePhoto,
  kind: ProfilePhotoAsset["kind"],
  id = crypto.randomUUID(),
  sourceId?: string,
): LocalAsset {
  return {
    id,
    kind,
    label: kind === "professional" ? "Photo CV · fond #E7E7E7" : "Original importé",
    name: photo.name,
    contentType: blob.type as LocalAsset["contentType"],
    width: photo.width,
    height: photo.height,
    sizeBytes: blob.size,
    createdAt: new Date().toISOString(),
    ...(kind === "professional"
      ? { backgroundColor: PROFILE_PHOTO_BACKGROUND, model: PROFILE_PHOTO_AI_MODEL }
      : {}),
    ...(sourceId ? { sourceId } : {}),
    blob,
    previewUrl: photo.dataUrl || "",
  };
}

export function ProfilePhotoField({
  photo,
  onChange,
  profileId,
  canUseAi = true,
}: {
  photo?: ProfilePhoto;
  onChange: (photo?: ProfilePhoto) => void;
  profileId?: string | null;
  canUseAi?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [gallery, setGallery] = useState<LocalAsset[]>([]);
  const [sourceAssetId, setSourceAssetId] = useState<string>();
  const previousProfileIdRef = useRef<string | null | undefined>(profileId);

  const refreshGallery = async () => {
    if (!profileId) return;
    setGalleryBusy(true);
    try {
      const { items } = await listProfilePhotoAssets(profileId);
      const hydrated = await Promise.all(
        items.map(async (item) => {
          const blob = await getProfilePhotoAssetBlob(profileId, item.id);
          return { ...item, blob, previewUrl: await blobDataUrl(blob) } satisfies LocalAsset;
        }),
      );
      setGallery(hydrated);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chargement de la galerie impossible.");
    } finally {
      setGalleryBusy(false);
    }
  };

  useEffect(() => {
    const previousProfileId = previousProfileIdRef.current;
    previousProfileIdRef.current = profileId;
    if (profileId && !previousProfileId && gallery.length) {
      void Promise.all(
        gallery.map((asset) =>
          saveProfilePhotoAsset(profileId, asset.blob, {
            id: asset.id,
            kind: asset.kind,
            label: asset.label,
            width: asset.width,
            height: asset.height,
            backgroundColor: asset.backgroundColor,
            model: asset.model,
            sourceId: asset.sourceId,
          }),
        ),
      )
        .then(() => setMessage("Galerie locale synchronisée dans R2 avec le nouveau profil."))
        .catch((error: unknown) =>
          setMessage(
            error instanceof Error ? error.message : "Synchronisation galerie impossible.",
          ),
        );
      return;
    }
    if (previousProfileId && previousProfileId !== profileId) {
      setGallery([]);
      setSourceAssetId(undefined);
    }
    // Migrate the in-memory gallery exactly once when a new client receives its persisted ID.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  useEffect(() => {
    if (galleryOpen && profileId) void refreshGallery();
    // Refresh only when the dialog opens or the profile changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galleryOpen, profileId]);

  const selectPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const processed = await processProfilePhoto(file);
      const local = localAsset(file, processed, "original");
      let id = local.id;
      if (profileId) {
        const stored = await saveProfilePhotoAsset(profileId, file, {
          id,
          kind: "original",
          label: `Original · ${file.name || "photo"}`,
          width: processed.width,
          height: processed.height,
        });
        id = stored.id;
      }
      setSourceAssetId(id);
      setGallery((current) => [{ ...local, id }, ...current.filter((item) => item.id !== id)]);
      onChange(processed);
      setMessage(
        profileId
          ? "Original conservé dans R2 et photo WebP prête pour le CV."
          : "Original conservé dans cette session. Enregistrez le client pour activer la galerie R2.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Traitement de la photo impossible.");
    } finally {
      setBusy(false);
    }
  };

  const generateProfessionalPhoto = async () => {
    if (!photo?.dataUrl) return;
    setBusy(true);
    setMessage("Chargement du moteur IA local, détourage et application du fond #E7E7E7…");
    try {
      let sourceId = sourceAssetId;
      if (!sourceId) {
        const sourceBlob = await (await fetch(photo.dataUrl)).blob();
        const source = localAsset(sourceBlob, photo, "original");
        sourceId = source.id;
        if (profileId) {
          await saveProfilePhotoAsset(profileId, sourceBlob, {
            id: source.id,
            kind: "original",
            label: "Original avant traitement IA",
            width: photo.width,
            height: photo.height,
          });
        }
        setGallery((current) => [source, ...current]);
        setSourceAssetId(sourceId);
      }
      const generated = await professionalizeProfilePhoto(photo);
      const generatedBlob = await (await fetch(generated.dataUrl || "")).blob();
      const generatedAsset = localAsset(
        generatedBlob,
        generated,
        "professional",
        crypto.randomUUID(),
        sourceId,
      );
      if (profileId) {
        await saveProfilePhotoAsset(profileId, generatedBlob, {
          id: generatedAsset.id,
          kind: "professional",
          label: generatedAsset.label,
          width: generated.width,
          height: generated.height,
          backgroundColor: PROFILE_PHOTO_BACKGROUND,
          model: PROFILE_PHOTO_AI_MODEL,
          sourceId,
        });
      }
      setGallery((current) => [generatedAsset, ...current]);
      onChange(generated);
      setMessage(
        `Photo CV créée localement avec ${PROFILE_PHOTO_AI_MODEL} · aucun envoi externe · fond exact ${PROFILE_PHOTO_BACKGROUND}.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Création de la photo CV impossible.");
    } finally {
      setBusy(false);
    }
  };

  const chooseGalleryAsset = async (asset: LocalAsset) => {
    setGalleryBusy(true);
    setMessage("");
    try {
      const selected = await processProfilePhoto(
        new File([asset.blob], asset.name || "photo", { type: asset.contentType }),
      );
      onChange(selected);
      setSourceAssetId(asset.kind === "professional" ? asset.sourceId : asset.id);
      setGalleryOpen(false);
      setMessage(`${asset.label} placée dans le formulaire.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cette photo ne peut pas être utilisée.");
    } finally {
      setGalleryBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={selectPhoto}
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-inner dark:border-slate-700 dark:bg-slate-800">
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
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {photo ? "Photo du profil prête" : "Ajouter une photo professionnelle"}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              L’original est conservé. L’IA locale détoure la personne sur cet appareil et applique
              le fond exact #E7E7E7, sans clé API, quota ni envoi externe.
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
              {photo ? "Ajouter un original" : "Choisir une photo"}
            </Button>
            {photo && canUseAi && (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={generateProfessionalPhoto}
                className="bg-violet-600 text-white hover:bg-violet-700"
              >
                {busy ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Photo CV IA locale
              </Button>
            )}
            <Button
              type="button"
              size="icon"
              variant="outline"
              disabled={busy}
              aria-label="Parcourir les photos de ce profil"
              title="Galerie du profil"
              onClick={() => setGalleryOpen(true)}
            >
              <Images className="h-4 w-4" />
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
                    "Photo retirée du CV. Les originaux restent disponibles dans la galerie.",
                  );
                }}
              >
                <Trash2 className="mr-2 h-4 w-4 text-destructive" /> Retirer du CV
              </Button>
            )}
          </div>
        </div>
      </div>
      {message && (
        <p
          className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
          role="status"
        >
          {message}
        </p>
      )}

      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Images className="h-5 w-5 text-violet-600" /> Photos du profil
            </DialogTitle>
            <DialogDescription>
              Sélectionnez un original ou une version professionnelle. Les originaux ne sont jamais
              écrasés.
            </DialogDescription>
          </DialogHeader>
          {!profileId && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Galerie locale temporaire : sauvegardez d’abord le client pour conserver les photos
              dans R2 et les retrouver sur un autre appareil.
            </p>
          )}
          {galleryBusy ? (
            <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500">
              <LoaderCircle className="h-5 w-5 animate-spin" /> Chargement des photos…
            </div>
          ) : gallery.length ? (
            <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4">
              {gallery.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  className="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-violet-400 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
                  onClick={() => void chooseGalleryAsset(asset)}
                >
                  <img
                    src={asset.previewUrl}
                    alt={asset.label}
                    className="aspect-[4/5] w-full bg-[#E7E7E7] object-cover"
                  />
                  <span className="block p-2">
                    <span className="block text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {asset.label}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-slate-500">
                      {asset.kind === "professional" ? "Version IA locale" : "Original"} ·{" "}
                      {new Date(asset.createdAt).toLocaleDateString("fr-DZ")}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 text-center">
              <Images className="mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">Aucune photo enregistrée</p>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Fermez cette fenêtre puis choisissez une photo originale.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
