'use client';

import axios from 'axios';
import { useEffect } from 'react';

import { authApi } from '../../lib/api-client';
import {
  getTelegramWebApp,
  hasTelegramObject,
  initializeTelegramWebApp,
  waitForTelegramWebApp,
} from '../../lib/telegram-web-app';
import { tokenStorage } from '../../lib/token-storage';
import { useAuthStore } from '../../store/auth-store';

const shouldLogAuthDebug = process.env.NODE_ENV !== 'production';

const logAuthDebug = (message: string, payload?: Record<string, unknown>) => {
  if (!shouldLogAuthDebug) {
    return;
  }

  if (payload) {
    console.log(`[AuthProvider] ${message}`, payload);
    return;
  }

  console.log(`[AuthProvider] ${message}`);
};

const extractAxiosErrorDetails = (error: unknown) => {
  if (!axios.isAxiosError(error)) {
    return {
      statusCode: undefined as number | undefined,
      message: error instanceof Error ? error.message : null,
    };
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

  return {
    statusCode: error.response?.status,
    message,
  };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setTelegramContext = useAuthStore((state) => state.setTelegramContext);
  const setAuthDebug = useAuthStore((state) => state.setAuthDebug);
  const startAuth = useAuthStore((state) => state.startAuth);
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated);
  const setFallback = useAuthStore((state) => state.setFallback);
  const setError = useAuthStore((state) => state.setError);

  useEffect(() => {
    let isMounted = true;

    const bootstrapAuth = async () => {
      const initialHasTelegramObject = hasTelegramObject();
      const initialWebApp = getTelegramWebApp();
      const initialHasWebAppObject = Boolean(initialWebApp);

      logAuthDebug('telegram object detected', {
        detected: initialHasTelegramObject,
      });
      logAuthDebug('webapp detected', {
        detected: initialHasWebAppObject,
      });

      setAuthDebug({
        hasTelegramObject: initialHasTelegramObject,
        hasWebAppObject: initialHasWebAppObject,
        hasInitData: false,
        initDataLength: 0,
        hasInitDataUnsafeUser: false,
        authRequestStarted: false,
        authRequestStatusCode: undefined,
        authRequestMessage: 'Waiting for Telegram WebApp script',
      });

      const resolvedWebApp = await waitForTelegramWebApp();
      const resolvedHasTelegramObject = hasTelegramObject();
      const hasWebAppObject = Boolean(resolvedWebApp);

      logAuthDebug('telegram object after wait', {
        detected: resolvedHasTelegramObject,
      });
      logAuthDebug('webapp after wait', {
        detected: hasWebAppObject,
      });

      if (!resolvedWebApp) {
        setAuthDebug({
          hasTelegramObject: resolvedHasTelegramObject,
          hasWebAppObject,
          hasInitData: false,
          initDataLength: 0,
          hasInitDataUnsafeUser: false,
          authRequestStarted: false,
          authRequestStatusCode: undefined,
          authRequestMessage: 'Telegram WebApp object not found',
        });
        setFallback(
          'Откройте LEAN POIZON внутри Telegram Mini App. В обычном браузере доступен только dev fallback режим.',
        );
        return;
      }

      const webApp = initializeTelegramWebApp(resolvedWebApp);

      if (!webApp) {
        setFallback(
          'Откройте LEAN POIZON внутри Telegram Mini App. В обычном браузере доступен только dev fallback режим.',
        );
        return;
      }

      const initDataLength = webApp.initData?.length ?? 0;
      const hasInitData = initDataLength > 0;
      const hasInitDataUnsafeUser = Boolean(webApp.initDataUnsafe?.user);

      setAuthDebug({
        hasTelegramObject: resolvedHasTelegramObject,
        hasWebAppObject,
        hasInitData,
        initDataLength,
        hasInitDataUnsafeUser,
        authRequestStarted: false,
        authRequestStatusCode: undefined,
        authRequestMessage: undefined,
      });

      logAuthDebug('initData length', {
        length: initDataLength,
      });
      logAuthDebug('initDataUnsafe.user exists', {
        exists: hasInitDataUnsafeUser,
      });

      if (!webApp.initData) {
        setAuthDebug({
          authRequestStarted: false,
          authRequestMessage: 'Telegram initData is empty',
        });
        setError('Telegram initData не получен. Повторно откройте Mini App из Telegram.');
        return;
      }

      setTelegramContext({
        initData: webApp.initData,
        initDataUnsafe: webApp.initDataUnsafe,
      });
      startAuth();
      setAuthDebug({
        authRequestStarted: true,
        authRequestStatusCode: undefined,
        authRequestMessage: 'POST /auth/telegram started',
      });

      logAuthDebug('auth request started', {
        endpoint: '/auth/telegram',
      });

      try {
        const authPayload = await authApi.authenticateTelegram(webApp.initData);

        tokenStorage.set(authPayload.accessToken);

        const profile = await authApi.getCurrentUser();

        logAuthDebug('auth request success', {
          hasUser: Boolean(profile),
        });

        if (!isMounted) {
          return;
        }

        setAuthDebug({
          authRequestStarted: true,
          authRequestStatusCode: 200,
          authRequestMessage: 'POST /auth/telegram succeeded',
        });
        setAuthenticated({
          accessToken: authPayload.accessToken,
          user: profile,
        });
      } catch (error) {
        tokenStorage.clear();

        if (!isMounted) {
          return;
        }

        const { statusCode, message } = extractAxiosErrorDetails(error);

        logAuthDebug('auth request failed', {
          statusCode: statusCode ?? null,
          message: message ?? 'Неизвестная ошибка авторизации',
        });

        setAuthDebug({
          authRequestStarted: true,
          authRequestStatusCode: statusCode,
          authRequestMessage: message ?? 'Не удалось авторизоваться через Telegram',
        });

        if (message) {
          setError(message);
          return;
        }

        setError('Не удалось авторизоваться через Telegram.');
      }
    };

    void bootstrapAuth();

    return () => {
      isMounted = false;
    };
  }, [
    setAuthenticated,
    setAuthDebug,
    setError,
    setFallback,
    setTelegramContext,
    startAuth,
  ]);

  return children;
}
