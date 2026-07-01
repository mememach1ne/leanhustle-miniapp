'use client';

import type { TelegramLoginWidgetPayload } from '@lean-poizon/shared';
import { useEffect, useRef, useState } from 'react';

import { authApi } from '../../lib/api-client';
import { extractAxiosMessage } from '../../lib/error-utils';
import { tokenStorage } from '../../lib/token-storage';
import { useAuthStore } from '../../store/auth-store';
import { FeedbackMessage } from './feedback-message';

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

// The Telegram widget calls a global function by name (data-onauth). We use a
// stable name and route it through a ref so React state stays in control.
declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramLoginWidgetPayload) => void;
  }
}

export function TelegramLoginButton() {
  const containerRef = useRef<HTMLDivElement>(null);
  const startAuth = useAuthStore((state) => state.startAuth);
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    window.onTelegramAuth = async (user: TelegramLoginWidgetPayload) => {
      setError(null);
      setSubmitting(true);
      startAuth();
      try {
        const payload = await authApi.authenticateTelegramWidget(user);
        tokenStorage.set(payload.accessToken);
        // Pull the canonical profile (with staffRole) like the Mini App flow.
        const profile = await authApi.getCurrentUser();
        setAuthenticated({ accessToken: payload.accessToken, user: profile });
      } catch (err) {
        tokenStorage.clear();
        setError(extractAxiosMessage(err) ?? 'Не удалось войти. Попробуйте снова.');
        // Reset to needs-login so the widget stays usable.
        useAuthStore.getState().setNeedsLogin();
      } finally {
        setSubmitting(false);
      }
    };

    const container = containerRef.current;
    if (!BOT_USERNAME || !container) return;
    if (container.querySelector('script')) return; // avoid double-inject

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    container.appendChild(script);

    return () => {
      window.onTelegramAuth = undefined;
    };
  }, [setAuthenticated, startAuth]);

  if (!BOT_USERNAME) {
    return (
      <FeedbackMessage tone="error">
        Вход через Telegram не настроен (нет NEXT_PUBLIC_TELEGRAM_BOT_USERNAME).
      </FeedbackMessage>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={containerRef} className="tg-login min-h-[48px]" />
      {submitting ? (
        <p className="text-xs text-white/50">Входим…</p>
      ) : null}
      {error ? <FeedbackMessage tone="error">{error}</FeedbackMessage> : null}
    </div>
  );
}
