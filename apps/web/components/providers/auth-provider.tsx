'use client';

import axios from 'axios';
import { useEffect } from 'react';

import { authApi } from '../../lib/api-client';
import {
  initializeTelegramWebApp,
  waitForTelegramWebApp,
} from '../../lib/telegram-web-app';
import { tokenStorage } from '../../lib/token-storage';
import { useAuthStore } from '../../store/auth-store';

const extractAxiosErrorDetails = (error: unknown) => {
  if (!axios.isAxiosError(error)) {
    return { statusCode: undefined as number | undefined, message: null as string | null };
  }
  const responseData = error.response?.data as { message?: string | string[] } | undefined;
  let message: string | null = null;
  if (typeof responseData?.message === 'string') {
    message = responseData.message;
  } else if (Array.isArray(responseData?.message) && responseData.message[0]) {
    message = responseData.message[0];
  } else if (error.message) {
    message = error.message;
  }
  return { statusCode: error.response?.status, message };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setTelegramContext = useAuthStore((state) => state.setTelegramContext);
  const startAuth = useAuthStore((state) => state.startAuth);
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated);
  const setError = useAuthStore((state) => state.setError);
  const setNeedsLogin = useAuthStore((state) => state.setNeedsLogin);

  useEffect(() => {
    let isMounted = true;

    const bootstrapAuth = async () => {
      // 1) Resume an existing session if a JWT is already stored. This makes
      //    the browser version "remember" the user between visits and skips
      //    the login widget while the token is valid.
      const savedToken = tokenStorage.get();
      if (savedToken) {
        startAuth();
        try {
          const profile = await authApi.getCurrentUser();
          if (!isMounted) return;
          setAuthenticated({ accessToken: savedToken, user: profile });
          return;
        } catch {
          tokenStorage.clear();
          // Token expired/invalid — fall through to a fresh auth attempt.
        }
      }

      // 2) Inside Telegram (Mini App): authenticate with initData.
      const resolvedWebApp = await waitForTelegramWebApp();
      const webApp = resolvedWebApp ? initializeTelegramWebApp(resolvedWebApp) : null;

      if (webApp?.initData) {
        setTelegramContext({
          initData: webApp.initData,
          initDataUnsafe: webApp.initDataUnsafe,
        });
        startAuth();
        try {
          const authPayload = await authApi.authenticateTelegram(webApp.initData);
          tokenStorage.set(authPayload.accessToken);
          const profile = await authApi.getCurrentUser();
          if (!isMounted) return;
          setAuthenticated({ accessToken: authPayload.accessToken, user: profile });
        } catch (error) {
          tokenStorage.clear();
          if (!isMounted) return;
          const { message } = extractAxiosErrorDetails(error);
          setError(message ?? 'Не удалось авторизоваться через Telegram.');
        }
        return;
      }

      // 3) Plain browser, no session → show the Telegram Login Widget.
      if (!isMounted) return;
      setNeedsLogin();
    };

    void bootstrapAuth();

    return () => {
      isMounted = false;
    };
  }, [setAuthenticated, setError, setNeedsLogin, setTelegramContext, startAuth]);

  return children;
}
