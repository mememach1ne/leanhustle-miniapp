import { Prisma } from '@prisma/client';
import type { DeliveryCarrier, DeliveryKind } from '@lean-poizon/shared';
import { deliveryMethodTitle } from '@lean-poizon/shared';

/** «СДЭК · пункт выдачи · Экспресс» for an order (old orders: CDEK pickup point, Стандарт). */
export function deliveryMethodLabel(order: {
  deliveryCarrier?: string | null;
  deliveryKind?: string | null;
  deliveryTariff?: string | null;
}): string {
  return deliveryMethodTitle(
    (order.deliveryCarrier ?? 'cdek') as DeliveryCarrier,
    (order.deliveryKind ?? 'pvz') as DeliveryKind,
    order.deliveryTariff ?? 'STND',
  );
}

/** Default tariff of a carrier: the partner's own points have only «Эконом». */
export const defaultTariff = (carrier?: string | null) => (carrier === 'raketa' ? 'ECON' : 'STND');

/**
 * Order delivery-method columns for a point picked by staff (manual order,
 * pickup-point fix): carrier/kind from the point, default speed. A courier
 * picked by staff goes by CDEK.
 */
export function pointDeliveryColumns(
  point: { kind?: string | null; carrier?: string | null; courier?: unknown } | null | undefined,
  keepTariff?: string | null,
) {
  const courier = point?.kind === 'courier' && point.courier ? point.courier : null;
  const carrier = courier ? 'cdek' : (point?.carrier ?? 'cdek');
  const tariff =
    keepTariff && keepTariff !== 'ECON' && carrier !== 'raketa' ? keepTariff : defaultTariff(carrier);
  return {
    deliveryCarrier: carrier,
    deliveryKind: courier ? 'courier' : 'pvz',
    deliveryTariff: tariff,
    deliveryCourier: courier ? (courier as Prisma.InputJsonValue) : Prisma.DbNull,
  };
}
