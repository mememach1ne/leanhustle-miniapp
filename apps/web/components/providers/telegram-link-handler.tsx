'use client';

import { useEffect } from 'react';

import { getTelegramWebApp } from '../../lib/telegram-web-app';

const TELEGRAM_HOSTS = new Set(['t.me', 'telegram.me']);

/**
 * Inside the Telegram Mini App, a plain `<a href="https://t.me/...">` makes
 * Telegram close the app to follow the link. Route external link clicks
 * through the WebApp API instead: t.me links via openTelegramLink, other
 * sites via openLink — both keep the Mini App alive.
 */
export function TelegramLinkHandler() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;

      const webApp = getTelegramWebApp();
      if (!webApp?.initData) return;

      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;

      let url: URL;
      try {
        url = new URL(anchor.href);
      } catch {
        return;
      }
      if (url.origin === window.location.origin) return;
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

      if (TELEGRAM_HOSTS.has(url.hostname) && webApp.openTelegramLink) {
        event.preventDefault();
        webApp.openTelegramLink(url.toString());
      } else if (webApp.openLink) {
        event.preventDefault();
        webApp.openLink(url.toString());
      }
    };

    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return null;
}
