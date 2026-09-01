import { LockKeyhole } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { ClientIntakeForm } from '@/components/client-intake-form';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parameters = await searchParams;
  const invitationToken =
    typeof parameters.invite === 'string' ? parameters.invite.trim() : '';
  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-6 flex items-center justify-between sm:mb-8">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-primary text-sm font-black tracking-tight text-primary-foreground shadow-sm">
              CV
            </div>
            <div>
              <p className="text-lg font-black tracking-tight text-primary">
                CV PRO TEAM
              </p>
              <p className="text-xs text-muted-foreground">
                Espace de dépôt sécurisé
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="hidden border-emerald-200 bg-emerald-50 text-emerald-700 sm:inline-flex"
          >
            <LockKeyhole /> Privé et confidentiel
          </Badge>
        </header>

        <section className="mb-5 rounded-3xl border border-primary/10 bg-primary px-6 py-7 text-primary-foreground shadow-[0_22px_70px_-42px_rgba(13,38,63,.65)] sm:px-9 sm:py-9">
          <Badge className="mb-4 bg-white/10 text-white">Dossier client</Badge>
          <h1 className="max-w-2xl text-2xl font-black tracking-tight sm:text-4xl">
            Envoyez-nous les éléments nécessaires à votre candidature.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
            Choisissez vos documents, précisez votre besoin et suivez un seul
            dossier du dépôt jusqu’à la livraison.
          </p>
        </section>

        <ClientIntakeForm invitationToken={invitationToken} />

        <footer className="py-7 text-center text-xs leading-5 text-muted-foreground">
          Vos documents restent privés et sont utilisés uniquement pour préparer
          votre commande.
        </footer>
      </div>
    </main>
  );
}
