import type { StaffOrderListItemDto } from './order.interface';

export interface AdminOrdersResponse {
  data: StaffOrderListItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminUserListItemDto {
  id: string;
  username?: string | null;
  isChannelSubscriber: boolean;
  createdAt: string;
  lastActiveAt: string;
  ordersCount: number;
  averageCheckRub: number;
  totalProfitRub: number;
  lastOrderDate?: string | null;
}

export interface AdminUsersResponse {
  data: AdminUserListItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

export type AdminUsersFilter = 'all' | 'subscribers' | 'with_orders' | 'without_orders';
export type AdminUsersSortBy = 'createdAt' | 'ordersCount' | 'averageCheckRub' | 'totalProfitRub';

export interface AdminUserDetailDto {
  id: string;
  username?: string | null;
  firstName: string;
  lastName?: string | null;
  telegramId: string;
  isChannelSubscriber: boolean;
  createdAt: string;
  lastActiveAt: string;
  ordersCount: number;
  averageCheckRub: number;
  totalProfitRub: number;
  orders: StaffOrderListItemDto[];
}
