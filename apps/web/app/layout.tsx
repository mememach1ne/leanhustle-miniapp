import './globals.css';

import type { Metadata } from 'next';
import { JetBrains_Mono, Unbounded } from 'next/font/google';
import Script from 'next/script';

import { AppShell } from '../components/layout/app-shell';
import { AuthProvider } from '../components/providers/auth-provider';

// Brand fonts (same families as the main site leanhustle.net): Unbounded
// for the display wordmark, JetBrains Mono for the kicker/tagline.
const unbounded = Unbounded({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '600', '700'],
  variable: '--font-mono-brand',
  display: 'swap',
});

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
      className={`${unbounded.variable} ${jetbrainsMono.variable}`}
    >
      <body suppressHydrationWarning>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
