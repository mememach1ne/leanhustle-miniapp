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
 *   1. navigator.clipboard.readText (desktop / Telegram desktop)
 *   2. Telegram WebApp.readTextFromClipboard (Telegram mobile)
 *   3. document.execCommand('paste') against a focused input (legacy
 *      fallback that sometimes still works in restricted WebViews)
 * Returns null only if all three fail or the clipboard is empty.
 *
 * `targetInput`: optional input element to receive the pasted text if
 * we fall back to execCommand. Pass the actual input ref to enable
 * that fallback; otherwise execCommand is skipped.
 */
export const readClipboardText = async (
  targetInput?: HTMLInputElement | null,
): Promise<string | null> => {
  // 1. Modern browser API
  try {
    const text = await navigator.clipboard.readText();
    if (text && text.trim().length > 0) {
      return text;
    }
  } catch {
    // fall through
  }

  // 2. Telegram-native API (iOS / Android Telegram). 5s timeout to
  // protect against the user dismissing the permission dialog.
  const webApp = getTelegramWebApp();
  if (typeof webApp?.readTextFromClipboard === 'function') {
    const fromTg = await new Promise<string | null>((resolve) => {
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

    if (fromTg) return fromTg;
  }

  // 3. Legacy execCommand('paste') against the target input. Some
  // WebKit-based WebViews still honor this when both the new APIs
  // are blocked. Requires the input to be focused.
  if (targetInput && typeof document.execCommand === 'function') {
    try {
      const before = targetInput.value;
      targetInput.focus();
      // Move caret to end so the paste appends rather than overwriting.
      targetInput.setSelectionRange(targetInput.value.length, targetInput.value.length);
      const ok = document.execCommand('paste');
      if (ok && targetInput.value !== before) {
        return targetInput.value;
      }
    } catch {
      // ignore
    }
  }

  return null;
};
