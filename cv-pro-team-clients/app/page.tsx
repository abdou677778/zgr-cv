import {
  ClientPortalShell,
  type ClientPortalLocale,
} from '@/components/client-portal-shell';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parameters = await searchParams;
  const invitationToken =
    typeof parameters.invite === 'string' ? parameters.invite.trim() : '';
  const locale: ClientPortalLocale = parameters.lang === 'ar' ? 'ar' : 'fr';
  return <ClientPortalShell invitationToken={invitationToken} initialLocale={locale} />;
}
