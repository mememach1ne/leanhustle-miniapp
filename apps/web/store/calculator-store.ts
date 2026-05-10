import type {
  DewuProductSku,
  DewuResolvedProduct,
  ManualPricingResult,
  PricingCalculationResult,
} from '@lean-poizon/shared';
import { create } from 'zustand';

interface CalculatorState {
  link: string;
  product?: DewuResolvedProduct;
  selectedSku?: DewuProductSku;
  pricing?: PricingCalculationResult;
  isLoadingProduct: boolean;
  isLoadingPricing: boolean;
  error?: string;
  pricingError?: string;

  /** Manual fallback mode — activated when API resolve fails */
  manualMode: boolean;
  manualPricing?: ManualPricingResult;

  setLink: (link: string) => void;
  setProductLoading: (isLoading: boolean) => void;
  setPricingLoading: (isLoading: boolean) => void;
  setResolvedProduct: (product: DewuResolvedProduct) => void;
  selectSku: (sku: DewuProductSku) => void;
  setPricing: (pricing: PricingCalculationResult) => void;
  setError: (error: string) => void;
  setPricingError: (error: string) => void;
  activateManualMode: () => void;
  setManualPricing: (pricing: ManualPricingResult) => void;
  clearManualPricing: () => void;
  reset: () => void;
}

export const useCalculatorStore = create<CalculatorState>((set) => ({
  link: '',
  product: undefined,
  selectedSku: undefined,
  pricing: undefined,
  isLoadingProduct: false,
  isLoadingPricing: false,
  error: undefined,
  pricingError: undefined,
  manualMode: false,
  manualPricing: undefined,
  setLink: (link) => set({ link }),
  setProductLoading: (isLoadingProduct) =>
    set({
      isLoadingProduct,
      error: undefined,
      pricing: undefined,
      pricingError: undefined,
      manualMode: false,
      manualPricing: undefined,
    }),
  setPricingLoading: (isLoadingPricing) =>
    set({
      isLoadingPricing,
      pricingError: undefined,
    }),
  setResolvedProduct: (product) =>
    set({
      product,
      selectedSku: product.availableSkus[0],
      pricing: undefined,
      isLoadingProduct: false,
      error: undefined,
      pricingError: undefined,
      manualMode: false,
      manualPricing: undefined,
    }),
  selectSku: (selectedSku) =>
    set({
      selectedSku,
      pricing: undefined,
      pricingError: undefined,
    }),
  setPricing: (pricing) =>
    set({
      pricing,
      isLoadingPricing: false,
      pricingError: undefined,
    }),
  setError: (error) =>
    set({
      error,
      isLoadingProduct: false,
      product: undefined,
      selectedSku: undefined,
      pricing: undefined,
    }),
  setPricingError: (pricingError) =>
    set({
      pricingError,
      isLoadingPricing: false,
      pricing: undefined,
    }),
  activateManualMode: () =>
    set({
      manualMode: true,
      isLoadingProduct: false,
      error: undefined,
      product: undefined,
      selectedSku: undefined,
      pricing: undefined,
      pricingError: undefined,
      manualPricing: undefined,
    }),
  setManualPricing: (manualPricing) =>
    set({
      manualPricing,
      isLoadingPricing: false,
      pricingError: undefined,
    }),
  clearManualPricing: () =>
    set({
      manualPricing: undefined,
      pricingError: undefined,
    }),
  reset: () =>
    set({
      link: '',
      product: undefined,
      selectedSku: undefined,
      pricing: undefined,
      isLoadingProduct: false,
      isLoadingPricing: false,
      error: undefined,
      pricingError: undefined,
      manualMode: false,
      manualPricing: undefined,
    }),
}));
