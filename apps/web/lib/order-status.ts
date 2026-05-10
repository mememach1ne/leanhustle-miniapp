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
    case OrderStatus.TRACK_CODE_RECEIVED:
      return 'Трек-код получен';
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
      return 'warning';
    case OrderStatus.PAID_AWAITING_PURCHASE:
      return 'accent';
    case OrderStatus.PURCHASED:
    case OrderStatus.TRACK_CODE_RECEIVED:
      return 'success';
    default:
      return 'neutral';
  }
};
