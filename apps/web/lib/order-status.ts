import { OrderStatus } from '@lean-poizon/shared';

export const getOrderStatusLabel = (
  status: OrderStatus,
  _trackCode?: string | null,
): string => {
  void _trackCode;

  switch (status) {
    case OrderStatus.CREATED:
      return 'Создан';
    case OrderStatus.PAYMENT_PENDING:
      return 'Ожидание оплаты';
    case OrderStatus.PAID_AWAITING_PURCHASE:
      return 'Оплачен, ожидается выкуп';
    case OrderStatus.PURCHASED:
      return 'Выкуплен';
    case OrderStatus.DELIVERY_PAYMENT_PENDING:
      return 'Ожидает оплаты доставки';
    case OrderStatus.DELIVERY_PAID:
      return 'Доставка оплачена';
    case OrderStatus.DUTY_PAYMENT_PENDING:
      return 'Ожидает оплаты пошлины';
    case OrderStatus.DUTY_PAID:
      return 'Пошлина оплачена';
    case OrderStatus.TRACK_CODE_RECEIVED:
      return 'В пути';
    case OrderStatus.DELIVERED:
      return 'Доставлен';
    case OrderStatus.CANCELLED:
      return 'Отменён';
    default:
      return status;
  }
};

export const getOrderStatusTone = (
  status: OrderStatus,
): 'neutral' | 'warning' | 'success' | 'accent' => {
  switch (status) {
    case OrderStatus.CREATED:
      return 'neutral';
    case OrderStatus.PAYMENT_PENDING:
    case OrderStatus.DELIVERY_PAYMENT_PENDING:
    case OrderStatus.DUTY_PAYMENT_PENDING:
      return 'warning';
    case OrderStatus.PAID_AWAITING_PURCHASE:
    case OrderStatus.DELIVERY_PAID:
    case OrderStatus.DUTY_PAID:
    case OrderStatus.TRACK_CODE_RECEIVED:
      return 'accent';
    case OrderStatus.PURCHASED:
    case OrderStatus.DELIVERED:
      return 'success';
    default:
      return 'neutral';
  }
};
