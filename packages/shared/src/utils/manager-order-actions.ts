export const MANAGER_ORDER_ACTIONS = {
  PAYMENT_PENDING: 'pay',
  PAID_AWAITING_PURCHASE: 'paid',
  PURCHASED: 'buy',
  TRACK_CODE: 'trk',
  // Phase 2: actual delivery / duty cycles.
  ACTUAL_DELIVERY: 'adlv',
  MARK_DELIVERY_PAID: 'dpd',
  ACTUAL_DUTY: 'adty',
  MARK_DUTY_PAID: 'dtyp',
  MARK_DELIVERED: 'dlvd',
  CANCEL: 'cncl',
  DELETE: 'del',
} as const;

export type ManagerOrderAction =
  (typeof MANAGER_ORDER_ACTIONS)[keyof typeof MANAGER_ORDER_ACTIONS];

const CALLBACK_PREFIX = 'ord:';

export const encodeManagerOrderCallback = (
  action: ManagerOrderAction,
  orderId: string,
): string => {
  const payload = Buffer.from(`${action}:${orderId}`, 'utf8').toString('base64url');
  return `${CALLBACK_PREFIX}${payload}`;
};

export const decodeManagerOrderCallback = (
  callbackData: string,
): { action: ManagerOrderAction; orderId: string } | null => {
  if (!callbackData.startsWith(CALLBACK_PREFIX)) {
    return null;
  }

  try {
    const encoded = callbackData.slice(CALLBACK_PREFIX.length);
    const decoded = Buffer.from(encoded, 'base64url').toString('utf8');
    const separatorIndex = decoded.indexOf(':');

    if (separatorIndex === -1) {
      return null;
    }

    const action = decoded.slice(0, separatorIndex) as ManagerOrderAction;
    const orderId = decoded.slice(separatorIndex + 1);

    if (!orderId) {
      return null;
    }

    if (!Object.values(MANAGER_ORDER_ACTIONS).includes(action)) {
      return null;
    }

    return { action, orderId };
  } catch {
    return null;
  }
};
