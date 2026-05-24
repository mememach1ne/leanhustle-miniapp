import axios from 'axios';

import type {
  BusinessSettingsDto,
  DeliveryCategoryWeightDto,
  SetActualDeliveryRequest,
  SetActualDutyRequest,
  SetCategoryWeightRequest,
  SettingsAuditLogItemDto,
  StaffOrderDetailsDto,
  StaffOrderListItemDto,
  UpdateBusinessSettingsRequest,
  UpdateOrderStatusRequest,
  UpdateOrderTrackCodeRequest,
} from '@lean-poizon/shared';

import { botEnv } from '../utils/env';

export interface BotActorIdentity {
  telegramId: string;
  username?: string;
}

export interface StaffIdentityResponse {
  id: string;
  role: 'ADMIN' | 'MANAGER';
  telegramId?: string | null;
  username?: string | null;
  isActive: boolean;
}

export class ApiService {
  private readonly http = axios.create({
    baseURL: botEnv.apiUrl,
    timeout: 10_000,
  });

  async getHealth() {
    const response = await this.http.get('/health');
    return response.data;
  }

  async getCurrentStaff(actor: BotActorIdentity): Promise<StaffIdentityResponse> {
    const response = await this.http.get<StaffIdentityResponse>('/staff/me', {
      headers: this.buildHeaders(actor),
    });

    return response.data;
  }

  async getStaffSettings(actor: BotActorIdentity): Promise<BusinessSettingsDto> {
    const response = await this.http.get<BusinessSettingsDto>('/staff/settings', {
      headers: this.buildHeaders(actor),
    });

    return response.data;
  }

  async updateStaffSettings(
    payload: UpdateBusinessSettingsRequest,
    actor: BotActorIdentity,
  ): Promise<BusinessSettingsDto> {
    const response = await this.http.patch<BusinessSettingsDto>('/staff/settings', payload, {
      headers: this.buildHeaders(actor),
    });

    return response.data;
  }

  async getStaffSettingsAudit(actor: BotActorIdentity): Promise<SettingsAuditLogItemDto[]> {
    const response = await this.http.get<SettingsAuditLogItemDto[]>('/staff/settings/audit', {
      headers: this.buildHeaders(actor),
    });

    return response.data;
  }

  async getStaffOrder(
    orderId: string,
    actor: BotActorIdentity,
  ): Promise<StaffOrderDetailsDto> {
    const response = await this.http.get<StaffOrderDetailsDto>(`/staff/orders/${orderId}`, {
      headers: this.buildHeaders(actor),
    });

    return response.data;
  }

  async getNewOrders(actor: BotActorIdentity): Promise<StaffOrderListItemDto[]> {
    const response = await this.http.get<StaffOrderListItemDto[]>('/staff/orders/new', {
      headers: this.buildHeaders(actor),
    });

    return response.data;
  }

  async getActiveOrders(actor: BotActorIdentity): Promise<StaffOrderListItemDto[]> {
    const response = await this.http.get<StaffOrderListItemDto[]>('/staff/orders/active', {
      headers: this.buildHeaders(actor),
    });

    return response.data;
  }

  async findOrderByNumber(
    orderNumber: string,
    actor: BotActorIdentity,
  ): Promise<StaffOrderDetailsDto> {
    const response = await this.http.get<StaffOrderDetailsDto>('/staff/orders/search', {
      headers: this.buildHeaders(actor),
      params: {
        orderNumber,
      },
    });

    return response.data;
  }

  async updateOrderStatus(
    orderId: string,
    payload: UpdateOrderStatusRequest,
    actor: BotActorIdentity,
  ): Promise<StaffOrderDetailsDto> {
    const response = await this.http.post<StaffOrderDetailsDto>(
      `/staff/orders/${orderId}/status`,
      payload,
      {
        headers: this.buildHeaders(actor),
      },
    );

    return response.data;
  }

  async updateOrderTrackCode(
    orderId: string,
    payload: UpdateOrderTrackCodeRequest,
    actor: BotActorIdentity,
  ): Promise<StaffOrderDetailsDto> {
    const response = await this.http.post<StaffOrderDetailsDto>(
      `/staff/orders/${orderId}/track-code`,
      payload,
      {
        headers: this.buildHeaders(actor),
      },
    );

    return response.data;
  }

  async setActualDelivery(
    orderId: string,
    payload: SetActualDeliveryRequest,
    actor: BotActorIdentity,
  ): Promise<StaffOrderDetailsDto> {
    const response = await this.http.post<StaffOrderDetailsDto>(
      `/staff/orders/${orderId}/actual-delivery`,
      payload,
      { headers: this.buildHeaders(actor) },
    );
    return response.data;
  }

  async markDeliveryPaid(
    orderId: string,
    actor: BotActorIdentity,
  ): Promise<StaffOrderDetailsDto> {
    const response = await this.http.post<StaffOrderDetailsDto>(
      `/staff/orders/${orderId}/mark-delivery-paid`,
      {},
      { headers: this.buildHeaders(actor) },
    );
    return response.data;
  }

  async setActualDuty(
    orderId: string,
    payload: SetActualDutyRequest,
    actor: BotActorIdentity,
  ): Promise<StaffOrderDetailsDto> {
    const response = await this.http.post<StaffOrderDetailsDto>(
      `/staff/orders/${orderId}/actual-duty`,
      payload,
      { headers: this.buildHeaders(actor) },
    );
    return response.data;
  }

  async markDutyPaid(
    orderId: string,
    actor: BotActorIdentity,
  ): Promise<StaffOrderDetailsDto> {
    const response = await this.http.post<StaffOrderDetailsDto>(
      `/staff/orders/${orderId}/mark-duty-paid`,
      {},
      { headers: this.buildHeaders(actor) },
    );
    return response.data;
  }

  async markDelivered(
    orderId: string,
    actor: BotActorIdentity,
  ): Promise<StaffOrderDetailsDto> {
    const response = await this.http.post<StaffOrderDetailsDto>(
      `/staff/orders/${orderId}/mark-delivered`,
      {},
      { headers: this.buildHeaders(actor) },
    );
    return response.data;
  }

  async cancelOrder(
    orderId: string,
    reason: string | undefined,
    actor: BotActorIdentity,
  ): Promise<StaffOrderDetailsDto> {
    const response = await this.http.post<StaffOrderDetailsDto>(
      `/staff/orders/${orderId}/cancel`,
      { reason },
      { headers: this.buildHeaders(actor) },
    );
    return response.data;
  }

  async listPendingDeliveryCategories(
    actor: BotActorIdentity,
  ): Promise<DeliveryCategoryWeightDto[]> {
    const response = await this.http.get<DeliveryCategoryWeightDto[]>(
      '/staff/delivery-categories/pending',
      { headers: this.buildHeaders(actor) },
    );
    return response.data;
  }

  async listAllDeliveryCategories(
    actor: BotActorIdentity,
  ): Promise<DeliveryCategoryWeightDto[]> {
    const response = await this.http.get<DeliveryCategoryWeightDto[]>(
      '/staff/delivery-categories',
      { headers: this.buildHeaders(actor) },
    );
    return response.data;
  }

  async getDeliveryCategory(
    id: string,
    actor: BotActorIdentity,
  ): Promise<DeliveryCategoryWeightDto> {
    const response = await this.http.get<DeliveryCategoryWeightDto>(
      `/staff/delivery-categories/${id}`,
      { headers: this.buildHeaders(actor) },
    );
    return response.data;
  }

  async setDeliveryCategoryWeight(
    id: string,
    payload: SetCategoryWeightRequest,
    actor: BotActorIdentity,
  ): Promise<DeliveryCategoryWeightDto> {
    const response = await this.http.patch<DeliveryCategoryWeightDto>(
      `/staff/delivery-categories/${id}`,
      payload,
      { headers: this.buildHeaders(actor) },
    );
    return response.data;
  }

  async deleteDeliveryCategory(id: string, actor: BotActorIdentity): Promise<void> {
    await this.http.delete(`/staff/delivery-categories/${id}`, {
      headers: this.buildHeaders(actor),
    });
  }

  private buildHeaders(actor: BotActorIdentity) {
    return {
      'x-internal-bot-token': botEnv.internalApiToken,
      'x-telegram-id': actor.telegramId,
      ...(actor.username ? { 'x-telegram-username': actor.username } : {}),
    };
  }
}
