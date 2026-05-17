import './globals.css';

import type { Metadata } from 'next';
import Script from 'next/script';

import { AppShell } from '../components/layout/app-shell';
import { AuthProvider } from '../components/providers/auth-provider';

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
    <html lang="ru" suppressHydrationWarning>
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
