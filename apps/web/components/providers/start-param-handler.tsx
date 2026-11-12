'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { waitForTelegramWebApp } from '../../lib/telegram-web-app';

const ORDER_PARAM = /^o_([0-9a-f-]{36})$/i;
const PRODUCT_PARAM = /^p_(\d{1,20})$/;

/** Mini App path for a start parameter (null = not ours). */
function pathFor(param: string): string | null {
  const order = ORDER_PARAM.exec(param);
  if (order) return `/profile/orders/${order[1]}`;
  const product = PRODUCT_PARAM.exec(param);
  if (product) return `/calculator?spuId=${product[1]}`;
  if (param === 'cart') return '/cart';
  if (param === 'addr') return '/profile/delivery';
  return null;
}
const HANDLED_KEY = 'lh:start-param-handled';

/**
 * Deep links into the Mini App from the chat cards: `?startapp=o_<orderId>`
 * (order), `p_<spuId>` (product), `cart`, `addr` (delivery addresses).
 * Handled once per launch so «Back» doesn't bounce to it again.
 */
export function StartParamHandler() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void waitForTelegramWebApp().then((webApp) => {
      const param = webApp?.initDataUnsafe?.start_param;
      const path = param ? pathFor(param) : null;
      if (cancelled || !path) return;
      try {
        if (sessionStorage.getItem(HANDLED_KEY) === param) return;
        sessionStorage.setItem(HANDLED_KEY, param as string);
      } catch {
        // No storage — still open the order.
      }
      router.replace(path);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
