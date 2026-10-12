'use client';

import type { DeliveryPickupPoint, StaffOrderDetailsDto } from '@lean-poizon/shared';
import { OrderStatus } from '@lean-poizon/shared';
import { useState } from 'react';

import { type PickedPoint, PickupPointPicker } from './pickup-point-picker';
import { SectionCard } from './section-card';

const inputClass =
  'min-w-0 w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-[var(--accent)]';

const RAKETA_STATUSES: OrderStatus[] = [
  OrderStatus.PAYMENT_PENDING,
  OrderStatus.PAID_AWAITING_PURCHASE,
  OrderStatus.PURCHASED,
  OrderStatus.DELIVERY_PAYMENT_PENDING,
  OrderStatus.DELIVERY_PAID,
  OrderStatus.DUTY_PAYMENT_PENDING,
  OrderStatus.DUTY_PAID,
];

/**
 * RAKETA forwarder block on the admin order page (same flow as the bot):
 * China track per item → order in RAKETA, then recipient + CDEK point /
 * consolidation, plus the "handle manually" switch.
 */
export function RaketaOrderPanel({
  order,
  busy,
  onChinaTrack,
  onAssignDelivery,
  onToggleManual,
  onSetPickupPoint,
}: {
  order: StaffOrderDetailsDto;
  busy: boolean;
  onChinaTrack: (itemId: string, track: string) => Promise<void>;
  onAssignDelivery: () => Promise<void>;
  onToggleManual: (manual: boolean) => Promise<void>;
  /** Staff picks the CDEK point (saved to the order and the client's address). */
  onSetPickupPoint: (point: DeliveryPickupPoint, label: string) => Promise<void>;
}) {
  const [tracks, setTracks] = useState<Record<string, string>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState<PickedPoint | null>(null);
  const fulfillment = order.fulfillment;
  if (!fulfillment) return null;

  const active = RAKETA_STATUSES.includes(order.status);
  const registered = fulfillment.items.filter((item) => item.raketaOrderId).length;
  const allRegistered = registered === fulfillment.items.length;

  return (
    <SectionCard>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">RAKETA</h3>
        {active ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onToggleManual(!fulfillment.manual)}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            {fulfillment.manual ? 'Включить автоматику' : 'Оформить вручную'}
          </button>
        ) : null}
      </div>

      {fulfillment.manual ? (
        <p className="text-xs text-white/50">Заказ ведётся вручную — автоматика RAKETA его не трогает.</p>
      ) : (
        <div className="space-y-3 text-xs">
          <p className="text-white/60">
            Зарегистрировано {registered} из {fulfillment.items.length} ·{' '}
            Пункт СДЭК:{' '}
            <span className={fulfillment.pickupPoint ? 'text-white' : 'text-amber-200'}>
              {fulfillment.pickupPoint ?? 'не выбран из справочника'}
            </span>
            {!fulfillment.deliveryAssigned && fulfillment.pickupPoint && !pickerOpen ? (
              <button type="button" onClick={() => setPickerOpen(true)} className="ml-2 text-[var(--accent)]">
                изменить
              </button>
            ) : null}
          </p>

          {!fulfillment.deliveryAssigned && (!fulfillment.pickupPoint || pickerOpen) ? (
            <div className="space-y-3 rounded-xl border border-amber-300/30 bg-amber-400/5 p-3">
              {order.delivery?.cdekAddress ? (
                <p className="text-white/70">
                  Адрес клиента (текстом): <span className="text-white">{order.delivery.cdekAddress}</span>
                </p>
              ) : null}
              <p className="text-white/50">
                Выберите пункт СДЭК — он сохранится в заказе и в адресе клиента для следующих заказов.
              </p>
              <PickupPointPicker value={picked} onChange={setPicked} />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || !picked}
                  onClick={async () => {
                    if (!picked) return;
                    await onSetPickupPoint(picked.pickupPoint, picked.label);
                    setPickerOpen(false);
                    setPicked(null);
                  }}
                  className="flex-1 rounded-xl bg-[var(--accent)] px-3 py-2.5 text-xs font-semibold text-slate-950 disabled:opacity-50"
                >
                  Сохранить пункт
                </button>
                {fulfillment.pickupPoint ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPickerOpen(false);
                      setPicked(null);
                    }}
                    className="rounded-xl bg-white/10 px-3 py-2.5 text-xs text-white"
                  >
                    Отмена
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            {fulfillment.items.map((item, index) => (
              <div key={item.itemId} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-white">
                  {fulfillment.items.length > 1 ? `${index + 1}. ` : ''}
                  {item.title} <span className="text-white/40">({item.size})</span>
                </p>
                {item.raketaOrderId ? (
                  <p className="mt-1 text-emerald-300">
                    {item.raketaTrackNumber ?? 'Создан в RAKETA'}
                    {item.chinaTrackNumber ? (
                      <span className="text-white/40"> · Китай {item.chinaTrackNumber}</span>
                    ) : null}
                  </p>
                ) : active ? (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={tracks[item.itemId] ?? ''}
                      onChange={(e) => setTracks({ ...tracks, [item.itemId]: e.target.value })}
                      placeholder="Китайский трек или RA…"
                      className={inputClass}
                    />
                    <button
                      type="button"
                      disabled={busy || !(tracks[item.itemId] ?? '').trim()}
                      onClick={async () => {
                        await onChinaTrack(item.itemId, (tracks[item.itemId] ?? '').trim());
                        setTracks({ ...tracks, [item.itemId]: '' });
                      }}
                      className="shrink-0 rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50"
                    >
                      В RAKETA
                    </button>
                  </div>
                ) : (
                  <p className="mt-1 text-white/40">Для этого статуса заказа трек ввести нельзя.</p>
                )}
              </div>
            ))}
          </div>

          {fulfillment.deliveryAssigned ? (
            <p className="text-emerald-300">
              {fulfillment.items.length > 1
                ? 'Объединение, получатель и пункт СДЭК оформлены в RAKETA.'
                : 'Получатель и пункт СДЭК указаны в RAKETA.'}
            </p>
          ) : active && allRegistered ? (
            <button
              type="button"
              disabled={busy}
              onClick={onAssignDelivery}
              className="w-full rounded-xl bg-[var(--accent)] px-3 py-2.5 text-xs font-semibold text-slate-950 disabled:opacity-50"
            >
              {fulfillment.items.length > 1
                ? 'Создать объединение в RAKETA'
                : 'Указать получателя и адрес в RAKETA'}
            </button>
          ) : null}

          {fulfillment.deliveryAssigned ? (
            <p className="text-[var(--muted)]">
              Оплата доставки:{' '}
              <span className="text-white">
                {fulfillment.raketaPaid
                  ? 'оплачено в RAKETA'
                  : fulfillment.clientPaid
                    ? 'клиент оплатил, списываем с баланса RAKETA'
                    : fulfillment.topupRub
                      ? `ссылка на ${fulfillment.topupRub} ₽ отправлена клиенту`
                      : fulfillment.priceRub
                        ? `цена RAKETA ${fulfillment.priceRub} ₽`
                        : fulfillment.assembled
                          ? 'объединение собирается, ждём цену'
                          : 'ждём вещи на складе'}
              </span>
            </p>
          ) : null}

          {fulfillment.lastError ? (
            <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-2 text-rose-200">
              Ошибка RAKETA: {fulfillment.lastError}
            </p>
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}
