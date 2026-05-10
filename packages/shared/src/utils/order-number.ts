import { ORDER_NUMBER_PREFIX } from '../constants/order-prefixes';

export type OrderPrefixKind = keyof typeof ORDER_NUMBER_PREFIX;

export const getOrderNumberPrefix = (kind: OrderPrefixKind): string => {
  return ORDER_NUMBER_PREFIX[kind];
};
