import type { OrderDetailsDto, OrderListItemDto } from '@lean-poizon/shared';
import { create } from 'zustand';

interface OrdersStoreState {
  orders: OrderListItemDto[];
  currentOrder?: OrderDetailsDto;
  isLoadingList: boolean;
  isLoadingDetails: boolean;
  error?: string;
  setListLoading: (isLoading: boolean) => void;
  setDetailsLoading: (isLoading: boolean) => void;
  setOrders: (orders: OrderListItemDto[]) => void;
  setCurrentOrder: (order: OrderDetailsDto) => void;
  prependOrder: (order: OrderListItemDto) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useOrdersStore = create<OrdersStoreState>((set) => ({
  orders: [],
  currentOrder: undefined,
  isLoadingList: false,
  isLoadingDetails: false,
  error: undefined,
  setListLoading: (isLoadingList) =>
    set({
      isLoadingList,
      error: undefined,
    }),
  setDetailsLoading: (isLoadingDetails) =>
    set({
      isLoadingDetails,
      error: undefined,
    }),
  setOrders: (orders) =>
    set({
      orders,
      isLoadingList: false,
      error: undefined,
    }),
  setCurrentOrder: (currentOrder) =>
    set({
      currentOrder,
      isLoadingDetails: false,
      error: undefined,
    }),
  prependOrder: (order) =>
    set((state) => ({
      orders: [order, ...state.orders.filter((item) => item.id !== order.id)],
      error: undefined,
    })),
  setError: (error) =>
    set({
      error: error ?? undefined,
      isLoadingList: false,
      isLoadingDetails: false,
    }),
  clearError: () =>
    set({
      error: undefined,
    }),
}));
