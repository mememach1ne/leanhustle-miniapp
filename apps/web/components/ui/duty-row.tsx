'use client';

import type { DutyBreakdown } from '@lean-poizon/shared';
import { useState } from 'react';

import { hapticSelection } from '../../lib/telegram-web-app';

export function DutyRow({
  dutyRub,
  breakdown,
}: {
  dutyRub: number;
  breakdown?: DutyBreakdown;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (dutyRub <= 0) {
    return null;
  }

  const canExpand = Boolean(breakdown);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (!canExpand) return;
          setIsOpen((v) => !v);
          hapticSelection();
        }}
        disabled={!canExpand}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-1 text-sm text-[var(--muted)]">
          Примерная пошлина
          {canExpand ? (
            <span
              className={[
                'text-xs text-[var(--accent)] transition-transform',
                isOpen ? 'rotate-180' : '',
              ].join(' ')}
            >
              ▼
            </span>
          ) : null}
        </span>
        <span className="text-sm font-medium text-white">{dutyRub} ₽</span>
      </button>

      {isOpen && breakdown ? (
        <div className="mt-3 space-y-2 rounded-[16px] border border-white/10 bg-white/5 px-4 py-3 text-xs leading-5 text-[var(--muted)]">
          <p className="font-medium text-white">Как рассчитана пошлина:</p>
          <div className="flex justify-between">
            <span>Цена товара в евро</span>
            <span className="text-white">€{breakdown.priceEur.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Беспошлинный лимит</span>
            <span className="text-white">€{breakdown.thresholdEur.toFixed(0)}</span>
          </div>
          <div className="flex justify-between">
            <span>Сумма превышения</span>
            <span className="text-white">€{breakdown.excessEur.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Ставка пошлины</span>
            <span className="text-white">{breakdown.dutyPercent}%</span>
          </div>
          <div className="border-t border-white/10" />
          <div className="flex justify-between">
            <span>Пошлина</span>
            <span className="text-white">{breakdown.dutyAmountRub} ₽</span>
          </div>
          <div className="flex justify-between">
            <span>Сбор за оформление</span>
            <span className="text-white">{breakdown.processingFeeRub} ₽</span>
          </div>
          <div className="border-t border-white/10" />
          <div className="flex justify-between font-medium">
            <span className="text-white">Итого пошлина</span>
            <span className="text-[var(--accent)]">{breakdown.totalRub} ₽</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
