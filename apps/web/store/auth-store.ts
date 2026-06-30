import type { TelegramWebAppInitDataUnsafe, UserProfile } from '@lean-poizon/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type AuthStatus =
  | 'idle'
  | 'loading'
  | 'authenticated'
  | 'fallback'
  | 'error'
  // Browser (not inside Telegram) and no valid session — show the
  // "Log in with Telegram" widget instead of an error.
  | 'needs-login';

interface AuthDebugState {
  hasTelegramObject: boolean;
  hasWebAppObject: boolean;
  hasInitData: boolean;
  initDataLength: number;
  hasInitDataUnsafeUser: boolean;
  authRequestStarted: boolean;
  authRequestStatusCode?: number;
  authRequestMessage?: string;
}

interface AuthState {
  status: AuthStatus;
  accessToken?: string;
  user?: UserProfile;
  error?: string;
  isTelegramEnvironment: boolean;
  initData?: string;
  initDataUnsafe?: TelegramWebAppInitDataUnsafe;
  authDebug: AuthDebugState;
  setTelegramContext: (payload: {
    initData: string;
    initDataUnsafe: TelegramWebAppInitDataUnsafe;
  }) => void;
  setAuthDebug: (payload: Partial<AuthDebugState>) => void;
  startAuth: () => void;
  setAuthenticated: (payload: { accessToken: string; user: UserProfile }) => void;
  setUser: (user: UserProfile) => void;
  setFallback: (message: string) => void;
  setError: (message: string) => void;
  setNeedsLogin: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      status: 'idle',
      accessToken: undefined,
      user: undefined,
      error: undefined,
      isTelegramEnvironment: false,
      initData: undefined,
      initDataUnsafe: undefined,
      authDebug: {
        hasTelegramObject: false,
        hasWebAppObject: false,
        hasInitData: false,
        initDataLength: 0,
        hasInitDataUnsafeUser: false,
        authRequestStarted: false,
        authRequestStatusCode: undefined,
        authRequestMessage: undefined,
      },
      setTelegramContext: ({ initData, initDataUnsafe }) =>
        set({
          isTelegramEnvironment: true,
          initData,
          initDataUnsafe,
          error: undefined,
        }),
      setAuthDebug: (payload) =>
        set((state) => ({
          authDebug: {
            ...state.authDebug,
            ...payload,
          },
        })),
      startAuth: () =>
        set({
          status: 'loading',
          error: undefined,
        }),
      setAuthenticated: ({ accessToken, user }) =>
        set({
          status: 'authenticated',
          accessToken,
          user,
          error: undefined,
        }),
      setUser: (user) =>
        set((state) => ({
          ...state,
          user,
          status: 'authenticated',
        })),
      setFallback: (message) =>
        set({
          status: 'fallback',
          isTelegramEnvironment: false,
          error: message,
          accessToken: undefined,
          user: undefined,
        }),
      setError: (message) =>
        set({
          status: 'error',
          error: message,
          accessToken: undefined,
        }),
      setNeedsLogin: () =>
        set({
          status: 'needs-login',
          error: undefined,
          accessToken: undefined,
          user: undefined,
        }),
      logout: () =>
        set({
          status: 'needs-login',
          error: undefined,
          accessToken: undefined,
          user: undefined,
        }),
    }),
    {
      name: 'lean-poizon-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
      }),
    },
  ),
);
