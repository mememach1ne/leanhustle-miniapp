import './globals.css';

import type { Metadata } from 'next';
import { Archivo, JetBrains_Mono, Onest, Unbounded } from 'next/font/google';
import Script from 'next/script';

import { AppShell } from '../components/layout/app-shell';
import { AuthProvider } from '../components/providers/auth-provider';
import { TelegramLinkHandler } from '../components/providers/telegram-link-handler';

// Brand fonts from the main site leanhustle.net: Unbounded for headings and
// key numbers, Archivo for body text, JetBrains Mono for kickers. Archivo has
// no Cyrillic, so Onest (a close grotesque with Cyrillic) covers Russian text.
const unbounded = Unbounded({
  subsets: ['latin', 'cyrillic'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-archivo',
  display: 'swap',
});
const onest = Onest({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-onest',
  display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '600', '700'],
  variable: '--font-mono-brand',
  display: 'swap',
});

// Render every page on request so HTML is served with no-store and browsers /
// the Telegram WebView always pick up a fresh deploy instead of a stale copy.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'LEAN HUSTLE POIZON',
  description: 'Telegram Mini App для заказа товаров с Poizon в Россию',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${unbounded.variable} ${archivo.variable} ${onest.variable} ${jetbrainsMono.variable}`}
    >
      <body suppressHydrationWarning>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <TelegramLinkHandler />
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
