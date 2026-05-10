import type { DeliveryAddressDto } from '@lean-poizon/shared';
import { create } from 'zustand';

interface DeliveryAddressesState {
  addresses: DeliveryAddressDto[];
  isLoading: boolean;
  error?: string;
  setLoading: (isLoading: boolean) => void;
  setAddresses: (addresses: DeliveryAddressDto[]) => void;
  setError: (error: string | null) => void;
  addAddress: (address: DeliveryAddressDto) => void;
  updateAddress: (address: DeliveryAddressDto) => void;
  removeAddress: (id: string) => void;
}

export const useDeliveryAddressesStore = create<DeliveryAddressesState>((set) => ({
  addresses: [],
  isLoading: false,
  error: undefined,
  setLoading: (isLoading) => set({ isLoading, error: undefined }),
  setAddresses: (addresses) => set({ addresses, isLoading: false, error: undefined }),
  setError: (error) => set({ error: error ?? undefined, isLoading: false }),
  addAddress: (address) =>
    set((state) => ({
      addresses: address.isDefault
        ? [address, ...state.addresses.map((a) => ({ ...a, isDefault: false }))]
        : [...state.addresses, address],
    })),
  updateAddress: (address) =>
    set((state) => ({
      addresses: state.addresses.map((a) => {
        if (a.id === address.id) return address;
        if (address.isDefault) return { ...a, isDefault: false };
        return a;
      }),
    })),
  removeAddress: (id) =>
    set((state) => ({
      addresses: state.addresses.filter((a) => a.id !== id),
    })),
}));
