import { OrderStatus } from '../enums/order-status.enum';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.CREATED]: 'Создан',
  [OrderStatus.PAYMENT_PENDING]: 'Ожидание оплаты товара',
  [OrderStatus.PAID_AWAITING_PURCHASE]: 'Оплачен, ожидается выкуп',
  [OrderStatus.PURCHASED]: 'Выкуплен',
  [OrderStatus.TRACK_CODE_RECEIVED]: 'Трек-код получен',
  [OrderStatus.DELIVERY_PAYMENT_PENDING]: 'Ожидание оплаты доставки',
  [OrderStatus.DELIVERY_PAID]: 'Доставка оплачена',
  [OrderStatus.DUTY_PAYMENT_PENDING]: 'Ожидание оплаты пошлины',
  [OrderStatus.DUTY_PAID]: 'Пошлина оплачена',
  [OrderStatus.DELIVERED]: 'Доставлено',
  [OrderStatus.CANCELLED]: 'Отменено',
};
