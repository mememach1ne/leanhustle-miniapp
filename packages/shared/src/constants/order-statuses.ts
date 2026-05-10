import { OrderStatus } from '../enums/order-status.enum';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.CREATED]: 'Создан',
  [OrderStatus.PAYMENT_PENDING]: 'Ожидание оплаты',
  [OrderStatus.PAID_AWAITING_PURCHASE]: 'Оплачен, ожидается выкуп',
  [OrderStatus.PURCHASED]: 'Выкуплен',
  [OrderStatus.TRACK_CODE_RECEIVED]: 'Трек-код получен',
};
