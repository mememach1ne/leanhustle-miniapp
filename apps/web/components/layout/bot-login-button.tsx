'use client';

import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';

import { authApi } from '../../lib/api-client';
import { tokenStorage } from '../../lib/token-storage';
import { useAuthStore } from '../../store/auth-store';

const POLL_MS = 2000;

/**
 * "Войти через Telegram" without the Telegram OAuth popup: gets a one-time
 * code, opens the bot with it (the bot runs its channel-subscription gate
 * and confirms), and polls until the confirmation lands — then logs in.
 */
export function BotLoginButton({ className = '' }: { className?: string }) {
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated);
  const [login, setLogin] = useState<{ token: string; botUrl: string } | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finishingRef = useRef(false);

  const requestCode = useCallback(async () => {
    try {
      const result = await authApi.startBotLogin();
      setLogin({ token: result.token, botUrl: result.botUrl });
      setError(null);
    } catch {
      setError('Не удалось подготовить вход. Обновите страницу и попробуйте ещё раз.');
    }
  }, []);

  // Pre-fetch the code so the button is a plain link (no popup blocking).
  useEffect(() => {
    void requestCode();
  }, [requestCode]);

  useEffect(() => {
    if (!waiting || !login) return;

    const interval = setInterval(async () => {
      if (finishingRef.current) return;
      try {
        const status = await authApi.getBotLoginStatus(login.token);
        if (status.status !== 'confirmed' || !status.accessToken) return;

        finishingRef.current = true;
        tokenStorage.set(status.accessToken);
        const profile = await authApi.getCurrentUser();
        setAuthenticated({ accessToken: status.accessToken, user: profile });
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          // Code expired — get a fresh one and let the user click again.
          setWaiting(false);
          void requestCode();
        }
      }
    }, POLL_MS);

    return () => clearInterval(interval);
  }, [waiting, login, requestCode, setAuthenticated]);

  return (
    <div className={['flex w-full flex-col items-center gap-2', className].join(' ')}>
      <a
        href={login?.botUrl ?? '#'}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={!login}
        onClick={(event) => {
          if (!login) {
            event.preventDefault();
            return;
          }
          setWaiting(true);
        }}
        className={[
          'lg-accent-button inline-flex h-14 w-full items-center justify-center gap-2 rounded-full text-base font-bold transition active:scale-[0.98]',
          login ? '' : 'pointer-events-none opacity-60',
        ].join(' ')}
        style={{ fontFamily: 'var(--font-display), sans-serif' }}
      >
        {waiting ? 'Открыть бота ещё раз' : 'Войти через Telegram'}
        <span aria-hidden>↗</span>
      </a>

      {waiting ? (
        <p className="flex items-center gap-2 text-xs text-white/75">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-[var(--accent)]" />
          Ждём подтверждения в боте — после него вход произойдёт сам
        </p>
      ) : null}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
