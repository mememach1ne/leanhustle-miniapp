import type {
  AddToCartRequest,
  AdminAnalyticsResponse,
  AdminOrdersResponse,
  AdminUserDetailDto,
  AdminUsersResponse,
  AuthPayload,
  BusinessSettingsDto,
  CartResponse,
  CatalogListResponse,
  CatalogSortKey,
  CatalogSyncResultDto,
  CheckoutOrderResponse,
  CreateCryptoPaymentIntentRequest,
  CreateDeliveryAddressRequest,
  CreateManualOrderRequest,
  CryptoPaymentIntentDto,
  DeliveryAddressDto,
  DeliveryCityDto,
  DeliveryPickupPoint,
  DeliveryPointDto,
  DewuResolvedProduct,
  LoyaltyStatusDto,
  ManagerHelpRequest,
  ManualOrderClientLookupResponse,
  ManualPricingRequest,
  ManualPricingResult,
  OrderDetailsDto,
  OrderListItemDto,
  PaymentNetwork,
  PricingCalculationRequest,
  PricingCalculationResult,
  ProfitReportDto,
  ResolveProductRequest,
  SettingsAuditLogItemDto,
  StaffOrderDetailsDto,
  StaffOrderListItemDto,
  UpdateBusinessSettingsRequest,
  UpdateDeliveryAddressRequest,
  UserProfile,
} from '@lean-poizon/shared';
import axios from 'axios';

import { tokenStorage } from './token-storage';

const normalizeApiBaseUrl = (value?: string) => {
  if (!value) {
    return '/backend-api';
  }

  return value.endsWith('/') ? value.slice(0, -1) : value;
};

const apiClient = axios.create({
  baseURL: normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL),
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.get();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export const authApi = {
  async authenticateTelegram(initData: string): Promise<AuthPayload> {
    const response = await apiClient.post<AuthPayload>('/auth/telegram', { initData });
    return response.data;
  },
  async getCurrentUser(): Promise<UserProfile> {
    const response = await apiClient.get<UserProfile>('/auth/me');
    return response.data;
  },
  /** Website login through the bot: one-time code + t.me deep link. */
  async startBotLogin(): Promise<{ token: string; botUrl: string; expiresAt: string }> {
    const response = await apiClient.post<{ token: string; botUrl: string; expiresAt: string }>(
      '/auth/bot-login/start',
      { origin: window.location.origin },
    );
    return response.data;
  },
  /** `accessToken` is present once the bot has confirmed the code. */
  async getBotLoginStatus(
    token: string,
  ): Promise<{ status: 'pending' | 'confirmed'; accessToken?: string }> {
    const response = await apiClient.get<{ status: 'pending' | 'confirmed'; accessToken?: string }>(
      `/auth/bot-login/status/${encodeURIComponent(token)}`,
    );
    return response.data;
  },
};

export const productsApi = {
  // Uncached resolves go through the price engine, which averages ~12s and
  // regularly exceeds 15s — same headroom as catalog search.
  async resolveProduct(payload: ResolveProductRequest): Promise<DewuResolvedProduct> {
    const response = await apiClient.post<DewuResolvedProduct>('/products/resolve', payload, {
      timeout: 30000,
    });
    return response.data;
  },
  async resolveBySpuId(spuId: string): Promise<DewuResolvedProduct> {
    const response = await apiClient.get<DewuResolvedProduct>(
      `/products/by-spu-id/${encodeURIComponent(spuId)}`,
      { timeout: 30000 },
    );
    return response.data;
  },
};

export const catalogApi = {
  async list(
    params: { page?: number; limit?: number; sort?: CatalogSortKey } = {},
  ): Promise<CatalogListResponse> {
    const response = await apiClient.get<CatalogListResponse>('/catalog', { params });
    return response.data;
  },
  async search(
    params: {
      brand?: string;
      type?: string;
      q?: string;
      sort?: CatalogSortKey;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<CatalogListResponse> {
    // A brand/type/q combo outside the curated nightly snapshot triggers a
    // live engine call server-side (~10-20s cold) — give it more room than
    // the default 15s timeout so a legitimate slow-but-successful search
    // doesn't get cut off client-side.
    const response = await apiClient.get<CatalogListResponse>('/catalog/search', {
      params,
      timeout: 30000,
    });
    return response.data;
  },
};

export const pricingApi = {
  async calculate(payload: PricingCalculationRequest): Promise<PricingCalculationResult> {
    const response = await apiClient.post<PricingCalculationResult>('/pricing/calculate', payload);
    return response.data;
  },
  async calculateManual(payload: ManualPricingRequest): Promise<ManualPricingResult> {
    const response = await apiClient.post<ManualPricingResult>('/pricing/calculate-manual', payload);
    return response.data;
  },
  async requestManagerHelp(payload: ManagerHelpRequest): Promise<{ success: boolean }> {
    const response = await apiClient.post<{ success: boolean }>('/pricing/manager-help', payload);
    return response.data;
  },
};

export const cartApi = {
  async getCart(): Promise<CartResponse> {
    const response = await apiClient.get<CartResponse>('/cart');
    return response.data;
  },
  async addToCart(payload: AddToCartRequest): Promise<CartResponse> {
    const response = await apiClient.post<CartResponse>('/cart/items', payload);
    return response.data;
  },
  async updateCartItemQuantity(id: string, quantity: number): Promise<CartResponse> {
    const response = await apiClient.patch<CartResponse>(`/cart/items/${id}/quantity`, {
      quantity,
    });
    return response.data;
  },
  async removeCartItem(id: string): Promise<CartResponse> {
    const response = await apiClient.delete<CartResponse>(`/cart/items/${id}`);
    return response.data;
  },
};

export const deliveryAddressesApi = {
  async getAll(): Promise<DeliveryAddressDto[]> {
    const response = await apiClient.get<DeliveryAddressDto[]>('/delivery-addresses');
    return response.data;
  },
  async create(payload: CreateDeliveryAddressRequest): Promise<DeliveryAddressDto> {
    const response = await apiClient.post<DeliveryAddressDto>('/delivery-addresses', payload);
    return response.data;
  },
  async update(id: string, payload: UpdateDeliveryAddressRequest): Promise<DeliveryAddressDto> {
    const response = await apiClient.patch<DeliveryAddressDto>(`/delivery-addresses/${id}`, payload);
    return response.data;
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/delivery-addresses/${id}`);
  },
};

export interface RaketaQuickOrderResult {
  orders: Array<{ id: string; raketaTrackNumber: string | null; title: string; existed: boolean }>;
  consolidationId: string | null;
  deliveryAssigned: boolean;
  deliveryError: string | null;
}

/** City / CDEK pickup point directory for the delivery address form. */
export const deliveryPointsApi = {
  async searchCities(q: string): Promise<DeliveryCityDto[]> {
    const response = await apiClient.get<DeliveryCityDto[]>('/delivery-points/cities', { params: { q } });
    return response.data;
  },
  async getCdekPoints(cityId: string): Promise<DeliveryPointDto[]> {
    const response = await apiClient.get<DeliveryPointDto[]>('/delivery-points/cdek', {
      params: { cityId },
      timeout: 30000,
    });
    return response.data;
  },
};

export const ordersApi = {
  async checkoutOrder(deliveryAddressId: string): Promise<CheckoutOrderResponse> {
    const response = await apiClient.post<CheckoutOrderResponse>('/orders/checkout', { deliveryAddressId });
    return response.data;
  },
  async getOrders(): Promise<OrderListItemDto[]> {
    const response = await apiClient.get<OrderListItemDto[]>('/orders');
    return response.data;
  },
  async getOrderById(id: string): Promise<OrderDetailsDto> {
    const response = await apiClient.get<OrderDetailsDto>(`/orders/${id}`);
    return response.data;
  },
  async cancelOrder(id: string, reason?: string): Promise<OrderDetailsDto> {
    const response = await apiClient.post<OrderDetailsDto>(`/orders/${id}/cancel`, { reason });
    return response.data;
  },
};

export const loyaltyApi = {
  async getStatus(): Promise<LoyaltyStatusDto> {
    const response = await apiClient.get<LoyaltyStatusDto>('/loyalty/me');
    return response.data;
  },
};

export const cryptoPaymentsApi = {
  async getNetworks(): Promise<{ networks: PaymentNetwork[] }> {
    const response = await apiClient.get<{ networks: PaymentNetwork[] }>(
      '/crypto-payments/networks',
    );
    return response.data;
  },
  async createIntent(
    orderId: string,
    payload: CreateCryptoPaymentIntentRequest,
  ): Promise<CryptoPaymentIntentDto> {
    const response = await apiClient.post<CryptoPaymentIntentDto>(
      `/crypto-payments/orders/${orderId}/intent`,
      payload,
    );
    return response.data;
  },
  async getStatus(orderId: string): Promise<CryptoPaymentIntentDto | null> {
    try {
      const response = await apiClient.get<CryptoPaymentIntentDto>(
        `/crypto-payments/orders/${orderId}/status`,
      );
      return response.data;
    } catch (error) {
      // 404 = no intent yet for this order; not an error from the UI's
      // perspective — it just means we should show the network picker.
      if (isAxios404(error)) return null;
      throw error;
    }
  },
};

function isAxios404(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    (error as { response?: { status?: number } }).response?.status === 404
  );
}

export const adminApi = {
  // Analytics
  async getAnalytics(): Promise<AdminAnalyticsResponse> {
    const response = await apiClient.get<AdminAnalyticsResponse>('/admin/analytics');
    return response.data;
  },
  // Orders
  async getOrders(params: { status?: string; page?: number; pageSize?: number } = {}): Promise<AdminOrdersResponse> {
    const response = await apiClient.get<AdminOrdersResponse>('/admin/orders', { params });
    return response.data;
  },
  async searchOrders(q: string): Promise<StaffOrderListItemDto[]> {
    const response = await apiClient.get<StaffOrderListItemDto[]>('/admin/orders/search', { params: { q } });
    return response.data;
  },
  async createManualOrder(dto: CreateManualOrderRequest): Promise<StaffOrderDetailsDto> {
    const response = await apiClient.post<StaffOrderDetailsDto>('/admin/orders/manual', dto);
    return response.data;
  },
  async lookupManualOrderClient(username: string): Promise<ManualOrderClientLookupResponse> {
    const response = await apiClient.get<ManualOrderClientLookupResponse>(
      '/admin/orders/manual/lookup-client',
      { params: { username } },
    );
    return response.data;
  },
  async resolveManualOrderProduct(link: string): Promise<DewuResolvedProduct> {
    const response = await apiClient.post<DewuResolvedProduct>(
      '/admin/orders/manual/resolve-product',
      { link },
      // Price engine resolves average ~12s and can exceed 15s.
      { timeout: 30000 },
    );
    return response.data;
  },
  /** Admin-only: create an order straight in the RAKETA cabinet. */
  async createRaketaQuickOrder(payload: {
    label?: string;
    title?: string;
    insurance?: boolean;
    items: Array<{
      link: string;
      dwSpuId: string;
      productTitle: string;
      titleCn?: string;
      categoryL1?: string;
      categoryL2?: string;
      categoryL3?: string;
      size: string;
      priceYuan: number;
      quantity: number;
      chinaTrackNumber: string;
    }>;
    delivery?: {
      fullName: string;
      phone: string;
      pointAddress: string;
      pickupPoint: DeliveryPickupPoint;
    };
  }): Promise<RaketaQuickOrderResult> {
    // One engine + RAKETA round-trip per item.
    const response = await apiClient.post<RaketaQuickOrderResult>('/admin/raketa/quick-order', payload, {
      timeout: 60000 + payload.items.length * 30000,
    });
    return response.data;
  },
  async getOrderById(id: string): Promise<StaffOrderDetailsDto> {
    const response = await apiClient.get<StaffOrderDetailsDto>(`/admin/orders/${id}`);
    return response.data;
  },
  async updateOrderStatus(id: string, status: string): Promise<StaffOrderDetailsDto> {
    const response = await apiClient.post<StaffOrderDetailsDto>(`/admin/orders/${id}/status`, { status });
    return response.data;
  },
  // RAKETA forwarder automation
  async setChinaTrack(id: string, itemId: string, chinaTrackNumber: string): Promise<StaffOrderDetailsDto> {
    const response = await apiClient.post<StaffOrderDetailsDto>(
      `/admin/orders/${id}/china-track`,
      { itemId, chinaTrackNumber },
      { timeout: 60000 },
    );
    return response.data;
  },
  async setFulfillmentMode(id: string, manual: boolean): Promise<StaffOrderDetailsDto> {
    const response = await apiClient.post<StaffOrderDetailsDto>(`/admin/orders/${id}/fulfillment-mode`, { manual });
    return response.data;
  },
  async assignRaketaDelivery(id: string): Promise<StaffOrderDetailsDto> {
    const response = await apiClient.post<StaffOrderDetailsDto>(
      `/admin/orders/${id}/raketa-delivery`,
      {},
      { timeout: 60000 },
    );
    return response.data;
  },
  async setTrackCode(id: string, trackCode: string): Promise<StaffOrderDetailsDto> {
    const response = await apiClient.post<StaffOrderDetailsDto>(`/admin/orders/${id}/track-code`, { trackCode });
    return response.data;
  },
  async cancelOrder(id: string, reason?: string): Promise<StaffOrderDetailsDto> {
    const response = await apiClient.post<StaffOrderDetailsDto>(`/admin/orders/${id}/cancel`, { reason });
    return response.data;
  },
  async restoreOrder(id: string): Promise<StaffOrderDetailsDto> {
    const response = await apiClient.post<StaffOrderDetailsDto>(`/admin/orders/${id}/restore`, {});
    return response.data;
  },
  async deleteOrder(id: string): Promise<{ ok: true; orderNumber: string }> {
    const response = await apiClient.delete<{ ok: true; orderNumber: string }>(
      `/admin/orders/${id}`,
    );
    return response.data;
  },
  async setActualDelivery(id: string, actualDeliveryRub: number): Promise<StaffOrderDetailsDto> {
    const response = await apiClient.post<StaffOrderDetailsDto>(
      `/admin/orders/${id}/actual-delivery`,
      { actualDeliveryRub },
    );
    return response.data;
  },
  async markDeliveryPaid(id: string): Promise<StaffOrderDetailsDto> {
    const response = await apiClient.post<StaffOrderDetailsDto>(
      `/admin/orders/${id}/mark-delivery-paid`,
    );
    return response.data;
  },
  async setActualDuty(id: string, actualDutyRub: number): Promise<StaffOrderDetailsDto> {
    const response = await apiClient.post<StaffOrderDetailsDto>(
      `/admin/orders/${id}/actual-duty`,
      { actualDutyRub },
    );
    return response.data;
  },
  async markDutyPaid(id: string): Promise<StaffOrderDetailsDto> {
    const response = await apiClient.post<StaffOrderDetailsDto>(
      `/admin/orders/${id}/mark-duty-paid`,
    );
    return response.data;
  },
  async markDelivered(id: string): Promise<StaffOrderDetailsDto> {
    const response = await apiClient.post<StaffOrderDetailsDto>(
      `/admin/orders/${id}/mark-delivered`,
    );
    return response.data;
  },

  // Settings
  async getSettings(): Promise<BusinessSettingsDto> {
    const response = await apiClient.get<BusinessSettingsDto>('/admin/settings');
    return response.data;
  },
  async updateSettings(dto: UpdateBusinessSettingsRequest): Promise<BusinessSettingsDto> {
    const response = await apiClient.patch<BusinessSettingsDto>('/admin/settings', dto);
    return response.data;
  },
  async getSettingsAudit(): Promise<SettingsAuditLogItemDto[]> {
    const response = await apiClient.get<SettingsAuditLogItemDto[]>('/admin/settings/audit');
    return response.data;
  },

  // Users
  async getUsers(params: { page?: number; pageSize?: number; filter?: string; search?: string; sortBy?: string } = {}): Promise<AdminUsersResponse> {
    const response = await apiClient.get<AdminUsersResponse>('/admin/users', { params });
    return response.data;
  },
  async getUserById(id: string): Promise<AdminUserDetailDto> {
    const response = await apiClient.get<AdminUserDetailDto>(`/admin/users/${id}`);
    return response.data;
  },
  async exportUsersExcel(): Promise<Blob> {
    const response = await apiClient.get('/admin/users/export-excel', { responseType: 'blob' });
    return response.data as Blob;
  },

  // Profit report (admin only)
  async getProfitReport(from: string, to: string): Promise<ProfitReportDto> {
    const response = await apiClient.get<ProfitReportDto>('/admin/profit-report', {
      params: { from, to },
    });
    return response.data;
  },
  async exportProfitReportExcel(from: string, to: string): Promise<Blob> {
    const response = await apiClient.get('/admin/profit-report/export-excel', {
      params: { from, to },
      responseType: 'blob',
    });
    return response.data as Blob;
  },
  async exportUserExcel(id: string): Promise<Blob> {
    const response = await apiClient.get(`/admin/users/${id}/export-excel`, { responseType: 'blob' });
    return response.data as Blob;
  },

  // Catalog (storefront) sync
  async syncCatalog(): Promise<CatalogSyncResultDto> {
    const response = await apiClient.post<CatalogSyncResultDto>('/admin/catalog/sync');
    return response.data;
  },
};

export { apiClient };
