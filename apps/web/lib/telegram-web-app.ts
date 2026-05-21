import type { TelegramWebAppInitDataUnsafe } from '@lean-poizon/shared';

export interface TelegramHapticFeedback {
  impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
  notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  selectionChanged: () => void;
}

export interface TelegramBackButton {
  isVisible: boolean;
  show: () => void;
  hide: () => void;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
}

export interface TelegramMainButton {
  text: string;
  color: string;
  textColor: string;
  isVisible: boolean;
  isActive: boolean;
  isProgressVisible: boolean;
  setText: (text: string) => void;
  show: () => void;
  hide: () => void;
  enable: () => void;
  disable: () => void;
  showProgress: (leaveActive?: boolean) => void;
  hideProgress: () => void;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
  setParams: (params: { text?: string; color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean }) => void;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: TelegramWebAppInitDataUnsafe;
  version?: string;
  ready: () => void;
  expand: () => void;
  HapticFeedback?: TelegramHapticFeedback;
  BackButton?: TelegramBackButton;
  MainButton?: TelegramMainButton;
  // Bot API 6.4+: reads the user's clipboard inside the Telegram app
  // itself (works on iOS where navigator.clipboard.readText is blocked).
  readTextFromClipboard?: (callback?: (text: string | null) => void) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

interface WaitForTelegramWebAppOptions {
  timeoutMs?: number;
  intervalMs?: number;
}

export const hasTelegramObject = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return Boolean(window.Telegram);
};

export const getTelegramWebApp = (): TelegramWebApp | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.Telegram?.WebApp ?? null;
};

export const initializeTelegramWebApp = (webApp: TelegramWebApp | null) => {
  if (!webApp) {
    return null;
  }

  webApp.ready();
  webApp.expand();

  return webApp;
};

export const waitForTelegramWebApp = async (
  options: WaitForTelegramWebAppOptions = {},
): Promise<TelegramWebApp | null> => {
  const timeoutMs = options.timeoutMs ?? 2500;
  const intervalMs = options.intervalMs ?? 100;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const webApp = getTelegramWebApp();

    if (webApp) {
      return webApp;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return getTelegramWebApp();
};

export const hapticImpact = (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') => {
  getTelegramWebApp()?.HapticFeedback?.impactOccurred(style);
};

export const hapticNotification = (type: 'error' | 'success' | 'warning') => {
  getTelegramWebApp()?.HapticFeedback?.notificationOccurred(type);
};

export const hapticSelection = () => {
  getTelegramWebApp()?.HapticFeedback?.selectionChanged();
};

/**
 * Read clipboard text. Prefers Telegram's own readTextFromClipboard
 * (works on iOS/Android in the Telegram app) and falls back to the
 * browser clipboard API on desktop / outside Telegram.
 * Resolves to null on failure or empty clipboard.
 */
export const readClipboardText = async (): Promise<string | null> => {
  const webApp = getTelegramWebApp();
  if (typeof webApp?.readTextFromClipboard === 'function') {
    return new Promise<string | null>((resolve) => {
      try {
        webApp.readTextFromClipboard!((text) => {
          resolve(text && text.length > 0 ? text : null);
        });
      } catch {
        resolve(null);
      }
    });
  }

  try {
    const text = await navigator.clipboard.readText();
    return text && text.length > 0 ? text : null;
  } catch {
    return null;
  }
};
