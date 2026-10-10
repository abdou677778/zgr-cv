import type { Metadata } from 'next';
import { Geist, Geist_Mono, Noto_Kufi_Arabic } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const notoKufiArabic = Noto_Kufi_Arabic({
  variable: '--font-arabic',
  subsets: ['arabic'],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || 'https://zgr-cv.pages.dev',
  ),
  title: 'CV PRO TEAM — Espace client',
  description:
    'Déposez vos documents et vos consignes pour la préparation de votre CV et de vos lettres.',
  openGraph: {
    title: 'CV PRO TEAM — Espace client',
    description: 'Déposez votre dossier en français ou en arabe, dans un espace privé et sécurisé.',
    images: [
      {
        url: '/client-invite-cover-v2.png',
        width: 1732,
        height: 908,
        alt: 'CV PRO TEAM — espace client sécurisé',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CV PRO TEAM — Espace client',
    description: 'Votre dossier privé, disponible en français et en arabe.',
    images: ['/client-invite-cover-v2.png'],
  },
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoKufiArabic.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
