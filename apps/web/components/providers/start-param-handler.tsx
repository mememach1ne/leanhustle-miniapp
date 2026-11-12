'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { waitForTelegramWebApp } from '../../lib/telegram-web-app';

const ORDER_PARAM = /^o_([0-9a-f-]{36})$/i;
const HANDLED_KEY = 'lh:start-param-handled';

/**
 * Deep links into the Mini App: `t.me/lh_poizonbot?startapp=o_<orderId>`
 * (the «Открыть заказ» button of the order card in the chat) opens that
 * order. Handled once per launch so «Back» doesn't bounce to it again.
 */
export function StartParamHandler() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void waitForTelegramWebApp().then((webApp) => {
      const param = webApp?.initDataUnsafe?.start_param;
      const match = param ? ORDER_PARAM.exec(param) : null;
      if (cancelled || !match) return;
      try {
        if (sessionStorage.getItem(HANDLED_KEY) === param) return;
        sessionStorage.setItem(HANDLED_KEY, param as string);
      } catch {
        // No storage — still open the order.
      }
      router.replace(`/profile/orders/${match[1]}`);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
