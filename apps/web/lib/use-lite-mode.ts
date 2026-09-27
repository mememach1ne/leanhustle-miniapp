'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'lh_lite';

/**
 * "Lite" mode from leanhustle.net: drops the WebGL liquid background,
 * blur and animations for weak PCs / phones. Auto-enabled on the first
 * visit for small, touch, low-core/low-memory or save-data devices; the
 * user's explicit choice is remembered. Toggles `html.lite` for CSS.
 */
export function useLiteMode() {
  const [lite, setLite] = useState<boolean | null>(null);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage blocked — fall back to auto-detection.
    }

    if (stored === '1' || stored === '0') {
      setLite(stored === '1');
      return;
    }

    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean };
    };
    const weak = Boolean(nav.hardwareConcurrency && nav.hardwareConcurrency <= 4);
    const lowMem = Boolean(nav.deviceMemory && nav.deviceMemory <= 4);
    const small = window.matchMedia('(max-width: 680px)').matches;
    const touch = window.matchMedia('(pointer: coarse)').matches;
    const saveData = Boolean(nav.connection?.saveData);
    setLite(small || weak || lowMem || touch || saveData);
  }, []);

  useEffect(() => {
    if (lite === null) return;
    document.documentElement.classList.toggle('lite', lite);
    return () => document.documentElement.classList.remove('lite');
  }, [lite]);

  const toggle = useCallback(() => {
    setLite((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        // Ignore — the choice just won't persist.
      }
      return next;
    });
  }, []);

  return { lite: lite ?? false, ready: lite !== null, toggle };
}
