import { OrderStatus } from '@lean-poizon/shared';

import { getOrderStatusLabel, getOrderStatusTone } from '../../lib/order-status';

const TONE_STYLES = {
  neutral: 'border-white/10 bg-white/6 text-slate-100',
  warning: 'border-amber-300/20 bg-amber-400/10 text-amber-100',
  success: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100',
  accent: 'border-sky-300/20 bg-sky-400/10 text-sky-100',
} as const;

export function StatusBadge({
  status,
  trackCode,
}: {
  status: OrderStatus;
  trackCode?: string | null;
}) {
  const tone = getOrderStatusTone(status);

  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium',
        TONE_STYLES[tone],
      ].join(' ')}
    >
      {getOrderStatusLabel(status, trackCode)}
    </span>
  );
}
