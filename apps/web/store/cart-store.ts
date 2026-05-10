import type { CartResponse } from '@lean-poizon/shared';
import { create } from 'zustand';

interface CartStoreState {
  cart?: CartResponse;
  isLoading: boolean;
  error?: string;
  setLoading: (isLoading: boolean) => void;
  setCart: (cart: CartResponse) => void;
  setError: (error: string | null) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartStoreState>((set) => ({
  cart: undefined,
  isLoading: false,
  error: undefined,
  setLoading: (isLoading) =>
    set({
      isLoading,
      error: undefined,
    }),
  setCart: (cart) =>
    set({
      cart,
      isLoading: false,
      error: undefined,
    }),
  setError: (error) =>
    set({
      error: error ?? undefined,
      isLoading: false,
    }),
  clearCart: () =>
    set({
      cart: undefined,
      isLoading: false,
      error: undefined,
    }),
}));
