"use client";

import { Languages, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";

import { ClientIntakeForm } from "@/components/client-intake-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type ClientPortalLocale = "fr" | "ar";

const copy = {
  fr: {
    secure: "Espace de dépôt sécurisé",
    private: "Privé et confidentiel",
    badge: "Dossier client",
    title: "Envoyez-nous les éléments nécessaires à votre candidature.",
    description:
      "Choisissez vos documents, précisez votre besoin et suivez un seul dossier du dépôt jusqu’à la livraison.",
    footer:
      "Vos documents restent privés et sont utilisés uniquement pour préparer votre commande.",
    languageAction: "العربية",
    languageLabel: "Afficher en arabe",
  },
  ar: {
    secure: "فضاء آمن لإيداع الملفات",
    private: "خاص وسري",
    badge: "ملف العميل",
    title: "أرسل لنا المعلومات والوثائق اللازمة لإعداد ملف ترشحك.",
    description:
      "اختر الوثائق المطلوبة، وضّح احتياجاتك، وتابع ملفًا واحدًا من مرحلة الإرسال إلى غاية التسليم.",
    footer: "تبقى وثائقك خاصة ولا تُستخدم إلا لإعداد طلبك.",
    languageAction: "Français",
    languageLabel: "Afficher en français",
  },
} as const;

export function ClientPortalShell({
  invitationToken,
  initialLocale,
}: {
  invitationToken: string;
  initialLocale: ClientPortalLocale;
}) {
  const [locale, setLocale] = useState<ClientPortalLocale>(initialLocale);
  const ar = locale === "ar";
  const t = copy[locale];

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = ar ? "rtl" : "ltr";
    const url = new URL(window.location.href);
    url.searchParams.set("lang", locale);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [ar, locale]);

  return (
    <main
      lang={locale}
      dir={ar ? "rtl" : "ltr"}
      className={`min-h-screen bg-background px-4 py-5 text-foreground sm:px-6 sm:py-8 ${
        ar ? "font-arabic" : ""
      }`}
    >
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-6 flex items-center justify-between gap-3 sm:mb-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-sm font-black tracking-tight text-primary-foreground shadow-sm">
              CV
            </div>
            <div className="min-w-0">
              <p className="text-lg font-black tracking-tight text-primary">CV PRO TEAM</p>
              <p className="text-xs text-muted-foreground">{t.secure}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge
              variant="outline"
              className="hidden border-emerald-200 bg-emerald-50 text-emerald-700 sm:inline-flex"
            >
              <LockKeyhole /> {t.private}
            </Badge>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl border-primary/15 bg-white px-3 text-primary"
              aria-label={t.languageLabel}
              title={t.languageLabel}
              onClick={() => setLocale(ar ? "fr" : "ar")}
            >
              <Languages className="size-4" />
              <span className="font-bold">{t.languageAction}</span>
            </Button>
          </div>
        </header>

        <section className="mb-5 rounded-3xl border border-primary/10 bg-primary px-6 py-7 text-primary-foreground shadow-[0_22px_70px_-42px_rgba(13,38,63,.65)] sm:px-9 sm:py-9">
          <Badge className="mb-4 bg-white/10 text-white">{t.badge}</Badge>
          <h1 className="max-w-2xl text-2xl font-black tracking-tight sm:text-4xl">{t.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/80 sm:text-base">
            {t.description}
          </p>
        </section>

        <ClientIntakeForm invitationToken={invitationToken} locale={locale} />

        <footer className="py-7 text-center text-xs leading-6 text-muted-foreground">
          {t.footer}
        </footer>
      </div>
    </main>
  );
}
