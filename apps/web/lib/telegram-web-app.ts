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
 * Read clipboard text. Tries every available API in order:
 *   1. navigator.clipboard.readText (works on desktop browsers and
 *      desktop Telegram, instant).
 *   2. Telegram WebApp.readTextFromClipboard (works inside Telegram
 *      mobile apps; limited by Telegram's 1-second-since-copy rule).
 * Resolves to null only if both fail / return empty.
 */
export const readClipboardText = async (): Promise<string | null> => {
  // 1. Try the browser API first — fast, no permission popup on most
  // desktop Telegram clients.
  try {
    const text = await navigator.clipboard.readText();
    if (text && text.trim().length > 0) {
      return text;
    }
  } catch {
    // permission denied or unsupported — fall through to Telegram API
  }

  // 2. Try the Telegram-native API (the only thing that works inside
  // iOS/Android Telegram). Add a 5s timeout to avoid hanging if the
  // user dismisses the permission prompt.
  const webApp = getTelegramWebApp();
  if (typeof webApp?.readTextFromClipboard === 'function') {
    return new Promise<string | null>((resolve) => {
      let settled = false;
      const finish = (value: string | null) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      try {
        webApp.readTextFromClipboard!((text) => {
          finish(text && text.trim().length > 0 ? text : null);
        });
      } catch {
        finish(null);
      }

      setTimeout(() => finish(null), 5000);
    });
  }

  return null;
};
