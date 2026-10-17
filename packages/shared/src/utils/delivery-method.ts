import type { DeliveryCarrier, DeliveryKind } from '../interfaces/delivery-address.interface';
import { DELIVERY_CARRIER_LABELS } from '../interfaces/delivery-address.interface';

/** RAKETA tariff codes → client-facing speed names. */
export const DELIVERY_TARIFF_LABELS: Record<string, string> = {
  STND: 'Стандарт',
  EXPR: 'Экспресс',
  ECON: 'Эконом',
};

/** «СДЭК · пункт выдачи · Экспресс», «Почта России · курьер · Стандарт», «Пункт выдачи партнёра · Эконом». */
export function deliveryMethodTitle(carrier: DeliveryCarrier, kind: DeliveryKind, tariff: string): string {
  const speed = DELIVERY_TARIFF_LABELS[tariff] ?? tariff;
  if (carrier === 'raketa') return `${DELIVERY_CARRIER_LABELS.raketa} · ${speed}`;
  const how = kind === 'courier' ? 'курьер' : carrier === 'pochta' ? 'отделение' : 'пункт выдачи';
  return `${DELIVERY_CARRIER_LABELS[carrier]} · ${how} · ${speed}`;
}

/** Where the client tracks the RF leg (null for the partner's own points — no carrier track). */
export function carrierTracking(
  carrier: DeliveryCarrier | null | undefined,
  track: string,
): { name: string; url: string } | null {
  const code = encodeURIComponent(track);
  switch (carrier ?? 'cdek') {
    case 'cdek':
      return { name: 'СДЭК', url: `https://www.cdek.ru/ru/tracking?order_id=${code}` };
    case 'pochta':
      return { name: 'Почта России', url: `https://www.pochta.ru/tracking?barcode=${code}` };
    default:
      return null;
  }
}
