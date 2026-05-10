import axios from 'axios';

import type {
  BusinessSettingsDto,
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

  private buildHeaders(actor: BotActorIdentity) {
    return {
      'x-internal-bot-token': botEnv.internalApiToken,
      'x-telegram-id': actor.telegramId,
      ...(actor.username ? { 'x-telegram-username': actor.username } : {}),
    };
  }
}
