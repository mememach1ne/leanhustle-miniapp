import type {
  AddToCartRequest,
  AdminAnalyticsResponse,
  AdminOrdersResponse,
  AdminUserDetailDto,
  AdminUsersResponse,
  AuthPayload,
  BusinessSettingsDto,
  CartResponse,
  ChannelSubscriptionRefreshResponse,
  CheckoutOrderResponse,
  CreateDeliveryAddressRequest,
  CreateManualOrderRequest,
  DeliveryAddressDto,
  DewuResolvedProduct,
  ManagerHelpRequest,
  ManualPricingRequest,
  ManualPricingResult,
  OrderDetailsDto,
  OrderListItemDto,
  PricingCalculationRequest,
  PricingCalculationResult,
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
  async refreshChannelSubscription(): Promise<ChannelSubscriptionRefreshResponse> {
    const response = await apiClient.post<ChannelSubscriptionRefreshResponse>(
      '/users/me/channel-subscription/refresh',
    );
    return response.data;
  },
};

export const productsApi = {
  async resolveProduct(payload: ResolveProductRequest): Promise<DewuResolvedProduct> {
    const response = await apiClient.post<DewuResolvedProduct>('/products/resolve', payload);
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
  async getOrderById(id: string): Promise<StaffOrderDetailsDto> {
    const response = await apiClient.get<StaffOrderDetailsDto>(`/admin/orders/${id}`);
    return response.data;
  },
  async updateOrderStatus(id: string, status: string): Promise<StaffOrderDetailsDto> {
    const response = await apiClient.post<StaffOrderDetailsDto>(`/admin/orders/${id}/status`, { status });
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
  async exportUserExcel(id: string): Promise<Blob> {
    const response = await apiClient.get(`/admin/users/${id}/export-excel`, { responseType: 'blob' });
    return response.data as Blob;
  },
};

export { apiClient };
