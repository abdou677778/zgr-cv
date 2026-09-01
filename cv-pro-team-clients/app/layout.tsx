import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  ),
  title: 'CV PRO TEAM — Espace client',
  description:
    'Déposez vos documents et vos consignes pour la préparation de votre CV et de vos lettres.',
  openGraph: {
    title: 'CV PRO TEAM — Espace client',
    description: 'Votre dossier. Vos documents. Notre expertise.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'CV PRO TEAM' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CV PRO TEAM — Espace client',
    description: 'Votre dossier. Vos documents. Notre expertise.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
