'use client';

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  FileCheck2,
  FileText,
  LoaderCircle,
  LockKeyhole,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  fileCategoryIds,
  fileCategoryLabels,
  type FileCategoryId,
  serviceIds,
  serviceLabels,
  type ServiceId,
} from '@/lib/order-constants';

interface PendingFile {
  id: string;
  file: File;
  category: FileCategoryId;
  uploaded: boolean;
}

interface OrderSession {
  id: string;
  uploadToken: string;
}

const acceptedExtensions = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif';

function formatBytes(value: number) {
  if (value < 1024) return `${value} o`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} Ko`;
  return `${(value / 1024 / 1024).toFixed(1)} Mo`;
}

async function apiError(response: Response) {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return payload?.error || `Erreur ${response.status}`;
}

function uploadFile(
  session: OrderSession,
  item: PendingFile,
  onProgress: (ratio: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/orders/${encodeURIComponent(session.id)}/files`);
    xhr.setRequestHeader('x-upload-token', session.uploadToken);
    xhr.setRequestHeader('x-file-name', encodeURIComponent(item.file.name));
    xhr.setRequestHeader('x-file-category', item.category);
    xhr.setRequestHeader(
      'Content-Type',
      item.file.type || 'application/octet-stream',
    );
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve();
        return;
      }
      try {
        const payload = JSON.parse(xhr.responseText) as { error?: string };
        reject(new Error(payload.error || `Erreur ${xhr.status}`));
      } catch {
        reject(new Error(`Erreur ${xhr.status} pendant l’envoi.`));
      }
    });
    xhr.addEventListener('error', () =>
      reject(new Error('Connexion interrompue pendant l’envoi.')),
    );
    xhr.send(item.file);
  });
}

export function ClientIntakeForm({
  invitationToken,
}: {
  invitationToken: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [clientName, setClientName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState<'fr' | 'en' | 'ar'>('fr');
  const [notes, setNotes] = useState('');
  const [services, setServices] = useState<ServiceId[]>([]);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [consent, setConsent] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [session, setSession] = useState<OrderSession | null>(null);
  const [completedOrderId, setCompletedOrderId] = useState('');

  const totalBytes = useMemo(
    () => files.reduce((sum, item) => sum + item.file.size, 0),
    [files],
  );

  if (!invitationToken) {
    return (
      <Card className="border-0 text-center shadow-[0_22px_70px_-48px_rgba(13,38,63,.55)] ring-primary/10">
        <CardContent className="px-6 py-10 sm:px-10 sm:py-14">
          <div className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-amber-100 text-amber-800">
            <LockKeyhole className="size-8" />
          </div>
          <Badge className="mb-4 bg-amber-100 text-amber-900">
            Invitation nécessaire
          </Badge>
          <h2 className="text-2xl font-black text-primary">
            Ce portail est réservé aux clients.
          </h2>
          <p className="mx-auto mt-3 max-w-xl leading-7 text-muted-foreground">
            Ouvrez le lien personnel transmis par CV PRO TEAM. Chaque invitation
            protège un seul dossier et ne peut être utilisée qu’une fois.
          </p>
        </CardContent>
      </Card>
    );
  }

  const toggleService = (service: ServiceId) => {
    setServices((current) =>
      current.includes(service)
        ? current.filter((candidate) => candidate !== service)
        : [...current, service],
    );
  };

  const addFiles = (incoming: FileList | File[]) => {
    const nextFiles = [...incoming];
    setFiles((current) => {
      const signatures = new Set(
        current.map(
          (item) =>
            `${item.file.name}:${item.file.size}:${item.file.lastModified}`,
        ),
      );
      const accepted = nextFiles
        .filter(
          (file) =>
            !signatures.has(`${file.name}:${file.size}:${file.lastModified}`),
        )
        .slice(0, Math.max(0, 50 - current.length))
        .map((file) => ({
          id: crypto.randomUUID(),
          file,
          category: 'AUTRES' as FileCategoryId,
          uploaded: false,
        }));
      return [...current, ...accepted];
    });
    setMessage('');
  };

  const moveToFiles = () => {
    if (clientName.trim().length < 2)
      return setMessage('Renseignez votre nom et prénom.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim()))
      return setMessage('Renseignez un email valide.');
    if (!services.length)
      return setMessage('Sélectionnez au moins un service.');
    setMessage('');
    setStep(2);
  };

  const submit = async () => {
    if (!files.length) return setMessage('Ajoutez au moins un document.');
    if (!consent) return setMessage('Confirmez votre accord avant l’envoi.');
    setSubmitting(true);
    setMessage('');
    try {
      let activeSession = session;
      if (!activeSession) {
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invitationToken,
            clientName,
            email,
            phone,
            language,
            notes,
            services,
          }),
        });
        if (!response.ok) throw new Error(await apiError(response));
        activeSession = (await response.json()) as OrderSession;
        setSession(activeSession);
      }

      const pending = files.filter((item) => !item.uploaded);
      for (let index = 0; index < pending.length; index += 1) {
        const item = pending[index];
        await uploadFile(activeSession, item, (ratio) => {
          const doneBefore = files.filter(
            (candidate) => candidate.uploaded,
          ).length;
          setProgress(((doneBefore + index + ratio) / files.length) * 100);
        });
        setFiles((current) =>
          current.map((candidate) =>
            candidate.id === item.id
              ? { ...candidate, uploaded: true }
              : candidate,
          ),
        );
      }

      const response = await fetch(
        `/api/orders/${encodeURIComponent(activeSession.id)}/complete`,
        {
          method: 'POST',
          headers: { 'x-upload-token': activeSession.uploadToken },
        },
      );
      if (!response.ok) throw new Error(await apiError(response));
      setProgress(100);
      setCompletedOrderId(activeSession.id);
      setStep(3);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Envoi impossible.');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 3) {
    return (
      <Card className="border-0 text-center shadow-[0_22px_70px_-48px_rgba(13,38,63,.55)] ring-primary/10">
        <CardContent className="px-6 py-10 sm:px-10 sm:py-14">
          <div className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="size-9" />
          </div>
          <Badge className="mb-4 bg-emerald-100 text-emerald-800">
            Dossier reçu
          </Badge>
          <h2 className="text-2xl font-black text-primary sm:text-3xl">
            Merci, votre commande est enregistrée.
          </h2>
          <p className="mx-auto mt-3 max-w-xl leading-7 text-muted-foreground">
            Vos documents et vos consignes sont maintenant regroupés sous la
            référence suivante.
          </p>
          <div className="mx-auto mt-7 flex max-w-md items-center justify-between gap-3 rounded-2xl border border-primary/15 bg-muted px-4 py-4">
            <code className="overflow-hidden text-ellipsis text-sm font-black text-primary sm:text-base">
              {completedOrderId}
            </code>
            <Button
              variant="outline"
              size="icon"
              aria-label="Copier la référence"
              onClick={() => navigator.clipboard.writeText(completedOrderId)}
            >
              <Copy />
            </Button>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            Conservez cette référence pour toute modification future.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div
        className="mb-5 grid grid-cols-3 gap-2"
        aria-label="Progression du dépôt"
      >
        {['Vos besoins', 'Vos fichiers', 'Confirmation'].map((label, index) => {
          const number = index + 1;
          const active = number === step;
          const completed = number < step;
          return (
            <div
              key={label}
              className={`rounded-2xl border px-2 py-3 text-center text-[11px] font-bold sm:px-3 sm:text-sm ${
                active || completed
                  ? 'border-accent bg-accent/10 text-primary'
                  : 'border-border bg-card text-muted-foreground'
              }`}
            >
              <span className="mr-1 inline-grid size-5 place-items-center rounded-full bg-white/80 text-[11px] shadow-sm sm:mr-1.5">
                {completed ? '✓' : number}
              </span>
              {label}
            </div>
          );
        })}
      </div>

      <Card className="border-0 shadow-[0_22px_70px_-48px_rgba(13,38,63,.55)] ring-primary/10">
        <CardHeader className="border-b border-border px-5 pb-5 sm:px-7">
          <CardTitle className="text-xl font-black text-primary">
            {step === 1 ? 'Préparer votre dossier' : 'Ajouter vos documents'}
          </CardTitle>
          <CardDescription>
            {step === 1
              ? 'Les informations resteront associées à votre numéro de commande.'
              : 'Classez les fichiers avant de confirmer l’envoi.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-7 px-5 sm:px-7">
          {step === 1 ? (
            <>
              <section className="grid gap-4 sm:grid-cols-2">
                <label
                  htmlFor="client-name"
                  className="space-y-2 text-sm font-bold text-primary"
                >
                  Nom et prénom *
                  <Input
                    id="client-name"
                    className="h-11 bg-white"
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                    placeholder="Ex. Amine Bensalem"
                  />
                </label>
                <label
                  htmlFor="client-email"
                  className="space-y-2 text-sm font-bold text-primary"
                >
                  Email *
                  <Input
                    id="client-email"
                    className="h-11 bg-white"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="nom@exemple.com"
                  />
                </label>
                <label
                  htmlFor="client-phone"
                  className="space-y-2 text-sm font-bold text-primary"
                >
                  Téléphone / WhatsApp
                  <Input
                    id="client-phone"
                    className="h-11 bg-white"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+213 ..."
                  />
                </label>
                <label
                  htmlFor="client-language"
                  className="space-y-2 text-sm font-bold text-primary"
                >
                  Langue de communication
                  <select
                    id="client-language"
                    className="h-11 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
                    value={language}
                    onChange={(event) =>
                      setLanguage(event.target.value as 'fr' | 'en' | 'ar')
                    }
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                    <option value="ar">العربية</option>
                  </select>
                </label>
              </section>

              <section>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h2 className="font-black text-primary">
                      Documents souhaités *
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Vous pouvez sélectionner plusieurs services.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {services.length} sélectionné
                    {services.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {serviceIds.map((service) => {
                    const checked = services.includes(service);
                    return (
                      <label
                        key={service}
                        className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm font-bold transition ${
                          checked
                            ? 'border-accent bg-accent/10 text-primary'
                            : 'border-border bg-white text-primary hover:border-accent'
                        }`}
                      >
                        <input
                          className="size-4 accent-[var(--primary)]"
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleService(service)}
                        />
                        {serviceLabels[service]}
                      </label>
                    );
                  })}
                </div>
              </section>

              <label
                htmlFor="client-notes"
                className="block space-y-2 text-sm font-bold text-primary"
              >
                Remarques et consignes
                <Textarea
                  id="client-notes"
                  className="min-h-28 resize-y bg-white font-normal leading-6"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Ex. Basez-vous sur mon ancien CV, ajoutez mes nouveaux diplômes et retirez l’expérience..."
                />
              </label>
            </>
          ) : (
            <>
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                multiple
                accept={acceptedExtensions}
                onChange={(event) => {
                  if (event.target.files) addFiles(event.target.files);
                  event.target.value = '';
                }}
              />
              <section
                className={`rounded-2xl border-2 border-dashed px-5 py-8 text-center transition sm:py-10 ${
                  dragging
                    ? 'border-accent bg-accent/10'
                    : 'border-accent/45 bg-accent/5'
                }`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  addFiles(event.dataTransfer.files);
                }}
              >
                <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-white text-accent shadow-sm">
                  <UploadCloud className="size-7" />
                </div>
                <h2 className="font-black text-primary">
                  Déposez vos documents ici
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Ancien CV, diplômes, certificats, photos et documents PDF ou
                  Word.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 h-10 border-primary/20 bg-white px-5 text-primary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choisir les fichiers
                </Button>
                <p className="mt-3 text-xs text-muted-foreground">
                  100 Mo maximum par fichier · 500 Mo par commande
                </p>
              </section>

              {files.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-black text-primary">
                      {files.length} fichier{files.length > 1 ? 's' : ''}
                    </h2>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {formatBytes(totalBytes)}
                    </span>
                  </div>
                  {files.map((item) => (
                    <div
                      key={item.id}
                      className="grid gap-3 rounded-xl border border-border bg-white p-3 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-center"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-primary">
                          <FileText className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-primary">
                            {item.file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatBytes(item.file.size)}
                            {item.uploaded ? ' · envoyé' : ''}
                          </p>
                        </div>
                      </div>
                      <select
                        className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
                        value={item.category}
                        disabled={submitting || item.uploaded}
                        onChange={(event) =>
                          setFiles((current) =>
                            current.map((candidate) =>
                              candidate.id === item.id
                                ? {
                                    ...candidate,
                                    category: event.target
                                      .value as FileCategoryId,
                                  }
                                : candidate,
                            ),
                          )
                        }
                      >
                        {fileCategoryIds.map((category) => (
                          <option key={category} value={category}>
                            {fileCategoryLabels[category]}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={submitting || item.uploaded}
                        aria-label={`Retirer ${item.file.name}`}
                        onClick={() =>
                          setFiles((current) =>
                            current.filter(
                              (candidate) => candidate.id !== item.id,
                            ),
                          )
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </section>
              )}

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/55 p-4 text-sm leading-6 text-muted-foreground">
                <input
                  className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                J’autorise CV PRO TEAM à traiter ces documents uniquement pour
                préparer les services sélectionnés.
              </label>

              {submitting && (
                <Progress value={progress}>
                  <ProgressLabel>Envoi sécurisé en cours</ProgressLabel>
                  <ProgressValue>
                    {(_formattedValue, value) =>
                      `${Math.round(value ?? progress)} %`
                    }
                  </ProgressValue>
                </Progress>
              )}
            </>
          )}

          {message && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
            >
              {message}
            </p>
          )}

          <div className="flex flex-col gap-4 rounded-2xl bg-muted/65 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              {step === 1 ? (
                <FileCheck2 className="mt-0.5 size-5 shrink-0 text-accent" />
              ) : (
                <LockKeyhole className="mt-0.5 size-5 shrink-0 text-accent" />
              )}
              <p>
                {step === 1
                  ? 'Vous pourrez vérifier chaque document avant l’envoi.'
                  : 'Aucun autre client ne peut consulter votre dossier.'}
              </p>
            </div>
            <div className="flex gap-2">
              {step === 2 && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 px-4"
                  disabled={submitting}
                  onClick={() => {
                    setStep(1);
                    setMessage('');
                  }}
                >
                  <ArrowLeft /> Retour
                </Button>
              )}
              <Button
                type="button"
                className="h-11 min-w-44 gap-2 px-5"
                disabled={submitting}
                onClick={step === 1 ? moveToFiles : submit}
              >
                {submitting ? (
                  <>
                    <LoaderCircle className="animate-spin" /> Envoi…
                  </>
                ) : step === 1 ? (
                  <>
                    Continuer <ArrowRight />
                  </>
                ) : (
                  <>
                    Envoyer le dossier <UploadCloud />
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
