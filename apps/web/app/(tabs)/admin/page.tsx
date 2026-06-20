'use client';

import type {
  AdminOrdersResponse,
  AdminUsersResponse,
  BusinessSettingsDto,
  SettingsAuditLogItemDto,
  StaffOrderListItemDto,
} from '@lean-poizon/shared';
import { ORDER_STATUS_LABELS, OrderStatus } from '@lean-poizon/shared';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { AnalyticsPanel } from '../../../components/ui/analytics-panel';
import { EmptyState } from '../../../components/ui/empty-state';
import { FeedbackMessage } from '../../../components/ui/feedback-message';
import { LoadingBlock } from '../../../components/ui/loading-block';
import { ManualOrderForm } from '../../../components/ui/manual-order-form';
import { PageSection } from '../../../components/ui/page-section';
import { ProfitReportPanel } from '../../../components/ui/profit-report-panel';
import { SectionCard } from '../../../components/ui/section-card';
import { adminApi } from '../../../lib/api-client';
import { extractAxiosMessage } from '../../../lib/error-utils';
import { useAuthStore } from '../../../store/auth-store';

type AdminTab = 'analytics' | 'orders' | 'settings' | 'users' | 'profit';

const STATUS_COLORS: Record<string, string> = {
  CREATED: 'bg-blue-400/15 text-blue-300 border-blue-300/30',
  PAYMENT_PENDING: 'bg-amber-400/15 text-amber-300 border-amber-300/30',
  PAID_AWAITING_PURCHASE: 'bg-orange-400/15 text-orange-300 border-orange-300/30',
  PURCHASED: 'bg-purple-400/15 text-purple-300 border-purple-300/30',
  TRACK_CODE_RECEIVED: 'bg-emerald-400/15 text-emerald-300 border-emerald-300/30',
  DELIVERED: 'bg-emerald-400/15 text-emerald-300 border-emerald-300/30',
  CANCELLED: 'bg-rose-400/15 text-rose-300 border-rose-300/30',
};


export default function AdminPage() {
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState<AdminTab>('analytics');

  if (!user?.staffRole) {
    return (
      <PageSection>
        <EmptyState
          title="Доступ запрещён"
          description="Эта страница доступна только для сотрудников."
        />
      </PageSection>
    );
  }

  // The profit/earnings split is sensitive — admins only.
  const tabs: AdminTab[] =
    user.staffRole === 'ADMIN'
      ? ['analytics', 'orders', 'settings', 'users', 'profit']
      : ['analytics', 'orders', 'settings', 'users'];

  const tabLabel = (tab: AdminTab): string => {
    switch (tab) {
      case 'analytics':
        return '📊 Онлайн';
      case 'orders':
        return 'Заказы';
      case 'settings':
        return 'Настройки';
      case 'users':
        return 'Клиенты';
      case 'profit':
        return '💰 Прибыль';
    }
  };

  return (
    <PageSection>
      {/* Sub-navigation */}
      <div className="flex gap-2 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={[
              'shrink-0 rounded-[18px] px-3 py-2.5 text-sm font-semibold transition',
              activeTab === tab
                ? 'bg-[var(--accent)] text-slate-950'
                : 'border border-white/10 bg-white/5 text-white hover:bg-white/10',
            ].join(' ')}
          >
            {tabLabel(tab)}
          </button>
        ))}
      </div>

      {activeTab === 'analytics' ? <AnalyticsPanel /> : null}
      {activeTab === 'orders' ? <OrdersPanel /> : null}
      {activeTab === 'settings' ? <SettingsPanel /> : null}
      {activeTab === 'users' ? <UsersPanel /> : null}
      {activeTab === 'profit' ? (
        <ProfitReportPanel onClose={() => setActiveTab('analytics')} />
      ) : null}
    </PageSection>
  );
}

// ─── Orders Panel ───────────────────────────────────────────

function OrdersPanel() {
  const staffRole = useAuthStore((state) => state.user?.staffRole);
  const [filter, setFilter] = useState<'active' | 'completed' | 'cancelled'>('active');
  const [data, setData] = useState<AdminOrdersResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StaffOrderListItemDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);

  const loadOrders = useCallback(async (status: 'active' | 'completed' | 'cancelled', page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminApi.getOrders({ status, page, pageSize: 20 });
      setData(result);
    } catch (err) {
      setError(extractAxiosMessage(err) ?? 'Не удалось загрузить заказы');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders(filter);
  }, [filter, loadOrders]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setLoading(true);
    try {
      const results = await adminApi.searchOrders(searchQuery.trim());
      setSearchResults(results);
    } catch (err) {
      setError(extractAxiosMessage(err) ?? 'Ошибка поиска');
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
  };

  const orders = searchResults ?? data?.data ?? [];

  return (
    <>
      {/* Manual order creation (admin & manager) */}
      {staffRole === 'ADMIN' || staffRole === 'MANAGER' ? (
        showManualForm ? (
          <ManualOrderForm onClose={() => setShowManualForm(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setShowManualForm(true)}
            className="w-full rounded-[18px] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 transition"
          >
            ➕ Создать заказ вручную
          </button>
        )
      ) : null}

      {/* Search */}
      <SectionCard className="!p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Номер заказа, username или ID..."
            className="min-w-0 flex-1 rounded-xl bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
          {searchResults ? (
            <button
              type="button"
              onClick={clearSearch}
              className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white"
            >
              Сброс
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSearch}
              className="shrink-0 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950"
            >
              Поиск
            </button>
          )}
        </div>
      </SectionCard>

      {/* Filter tabs */}
      {!searchResults ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFilter('active')}
            className={[
              'flex-1 rounded-[16px] px-3 py-2 text-sm font-medium transition',
              filter === 'active'
                ? 'bg-white/10 text-white'
                : 'text-white/50 hover:text-white/80',
            ].join(' ')}
          >
            Активные {data && filter === 'active' ? `(${data.total})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setFilter('completed')}
            className={[
              'flex-1 rounded-[16px] px-3 py-2 text-sm font-medium transition',
              filter === 'completed'
                ? 'bg-white/10 text-white'
                : 'text-white/50 hover:text-white/80',
            ].join(' ')}
          >
            Завершённые {data && filter === 'completed' ? `(${data.total})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setFilter('cancelled')}
            className={[
              'flex-1 rounded-[16px] px-3 py-2 text-sm font-medium transition',
              filter === 'cancelled'
                ? 'bg-rose-400/15 text-rose-200'
                : 'text-white/50 hover:text-white/80',
            ].join(' ')}
          >
            Отменённые {data && filter === 'cancelled' ? `(${data.total})` : ''}
          </button>
        </div>
      ) : null}

      {error ? <FeedbackMessage tone="error">{error}</FeedbackMessage> : null}

      {loading ? (
        <LoadingBlock title="Загрузка" description="Загружаем заказы..." />
      ) : orders.length === 0 ? (
        <EmptyState title="Нет заказов" description="Заказы не найдены" />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <AdminOrderCard key={order.id} order={order} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && !searchResults && data.total > data.pageSize ? (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={data.page <= 1}
            onClick={() => loadOrders(filter, data.page - 1)}
            className="rounded-xl bg-white/10 px-4 py-2 text-sm text-white disabled:opacity-30"
          >
            Назад
          </button>
          <span className="text-sm text-white/50">
            {data.page} / {Math.ceil(data.total / data.pageSize)}
          </span>
          <button
            type="button"
            disabled={data.page >= Math.ceil(data.total / data.pageSize)}
            onClick={() => loadOrders(filter, data.page + 1)}
            className="rounded-xl bg-white/10 px-4 py-2 text-sm text-white disabled:opacity-30"
          >
            Далее
          </button>
        </div>
      ) : null}
    </>
  );
}

function AdminOrderCard({ order }: { order: StaffOrderListItemDto }) {
  const statusLabel =
    ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status;
  const statusColor = STATUS_COLORS[order.status] ?? 'bg-white/10 text-white border-white/20';

  return (
    <Link href={`/admin/orders/${order.id}`}>
      <SectionCard className="transition hover:border-white/20">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">{order.orderNumber}</span>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusColor}`}>
                {statusLabel}
              </span>
            </div>
            <p className="mt-1 text-xs text-white/50">
              {order.user.username ? `@${order.user.username}` : order.user.firstName}
              {' · '}
              {new Date(order.createdAt).toLocaleDateString('ru-RU')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-white">${order.totalUsd}</p>
            <p className="text-[10px] text-white/40">{order.itemsCount} товаров</p>
          </div>
        </div>
      </SectionCard>
    </Link>
  );
}

// ─── Settings Panel ─────────────────────────────────────────

function SettingsPanel() {
  const [settings, setSettings] = useState<BusinessSettingsDto | null>(null);
  const [audit, setAudit] = useState<SettingsAuditLogItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  useEffect(() => {
    void loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [s, a] = await Promise.all([
        adminApi.getSettings(),
        adminApi.getSettingsAudit(),
      ]);
      setSettings(s);
      setAudit(a);
      setEditValues({
        cnyToUsd: String(s.cnyToUsd),
        cnyToRub: String(s.cnyToRub),
        eurToRub: String(s.eurToRub),
        commissionPercent: String(s.commissionPercent),
        deliveryPricePerKgRub: String(s.deliveryPricePerKgRub),
      });
    } catch (err) {
      setError(extractAxiosMessage(err) ?? 'Не удалось загрузить настройки');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const dto: Record<string, number> = {};
      for (const [key, value] of Object.entries(editValues)) {
        const num = parseFloat(value);
        if (!isNaN(num) && settings && num !== (settings as unknown as Record<string, number>)[key]) {
          dto[key] = num;
        }
      }

      if (Object.keys(dto).length === 0) {
        setSuccess('Нет изменений');
        return;
      }

      const updated = await adminApi.updateSettings(dto);
      setSettings(updated);
      setSuccess('Настройки сохранены');
      const freshAudit = await adminApi.getSettingsAudit();
      setAudit(freshAudit);
    } catch (err) {
      setError(extractAxiosMessage(err) ?? 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingBlock title="Загрузка" description="Загружаем настройки..." />;
  }

  if (!settings) {
    return <EmptyState title="Ошибка" description={error ?? 'Настройки не найдены'} />;
  }

  const SETTING_LABELS: Record<string, string> = {
    cnyToUsd: 'CNY → USD',
    cnyToRub: 'CNY → RUB (ЦБ)',
    eurToRub: 'EUR → RUB (ЦБ)',
    commissionPercent: 'Комиссия (%)',
    deliveryPricePerKgRub: 'Доставка за кг (₽)',
  };

  return (
    <>
      {error ? <FeedbackMessage tone="error">{error}</FeedbackMessage> : null}
      {success ? <FeedbackMessage tone="success">{success}</FeedbackMessage> : null}

      <SectionCard>
        <h3 className="mb-4 text-sm font-semibold text-white">Курсы и комиссия</h3>
        <div className="space-y-3">
          {Object.entries(SETTING_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-3">
              <label className="w-36 shrink-0 text-xs text-white/60">{label}</label>
              <input
                type="number"
                step="any"
                value={editValues[key] ?? ''}
                onChange={(e) =>
                  setEditValues((prev) => ({ ...prev, [key]: e.target.value }))
                }
                className="min-w-0 flex-1 rounded-xl bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-4 w-full rounded-[18px] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 transition disabled:opacity-50"
        >
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>

        <p className="mt-2 text-center text-[10px] text-white/30">
          Обновлено: {new Date(settings.updatedAt).toLocaleString('ru-RU')}
        </p>
      </SectionCard>

      {/* Audit log */}
      {audit.length > 0 ? (
        <SectionCard>
          <h3 className="mb-3 text-sm font-semibold text-white">История изменений</h3>
          <div className="space-y-2">
            {audit.slice(0, 10).map((log) => (
              <div key={log.id} className="border-b border-white/5 pb-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-white/50">
                    {new Date(log.createdAt).toLocaleString('ru-RU')}
                  </span>
                  <span className="text-white/30">
                    {log.changedByStaff
                      ? `@${log.changedByStaff.username ?? log.changedByStaff.role}`
                      : 'Авто (ЦБ)'}
                  </span>
                </div>
                <div className="mt-1 text-white/60">
                  {log.changedFields.map((field) => {
                    const prev = log.previousValues?.[field];
                    const next = log.nextValues[field];
                    return (
                      <span key={field} className="mr-2">
                        {SETTING_LABELS[field] ?? field}: {prev} → {next}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}
    </>
  );
}

// ─── Users Panel ────────────────────────────────────────────

type UsersFilter = 'all' | 'subscribers' | 'with_orders' | 'without_orders';
type UsersSortBy = 'createdAt' | 'ordersCount' | 'averageCheckRub' | 'totalProfitRub';

const USERS_FILTERS: { value: UsersFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'subscribers', label: 'Подписчики' },
  { value: 'with_orders', label: 'С заказами' },
  { value: 'without_orders', label: 'Без заказов' },
];

const USERS_SORTS: { value: UsersSortBy; label: string }[] = [
  { value: 'createdAt', label: 'По дате регистрации' },
  { value: 'ordersCount', label: 'По заказам' },
  { value: 'averageCheckRub', label: 'По среднему чеку' },
  { value: 'totalProfitRub', label: 'По прибыли' },
];

function UsersPanel() {
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [filter, setFilter] = useState<UsersFilter>('all');
  const [sortBy, setSortBy] = useState<UsersSortBy>('createdAt');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState<string | undefined>(undefined);

  const loadUsers = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminApi.getUsers({
        page,
        pageSize: 20,
        filter,
        search: activeSearch,
        sortBy,
      });
      setData(result);
    } catch (err) {
      setError(extractAxiosMessage(err) ?? 'Не удалось загрузить');
    } finally {
      setLoading(false);
    }
  }, [filter, sortBy, activeSearch]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleSearch = () => {
    const trimmed = searchQuery.trim();
    setActiveSearch(trimmed || undefined);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setActiveSearch(undefined);
  };

  const handleFilterChange = (f: UsersFilter) => {
    setFilter(f);
  };

  const handleSortChange = (s: UsersSortBy) => {
    setSortBy(s);
  };

  const handleExportAll = async () => {
    setExporting(true);
    try {
      const blob = await adminApi.exportUsersExcel();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(extractAxiosMessage(err) ?? 'Ошибка экспорта');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      {/* Search */}
      <SectionCard className="!p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Поиск по username..."
            className="min-w-0 flex-1 rounded-xl bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
          {activeSearch ? (
            <button
              type="button"
              onClick={clearSearch}
              className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white"
            >
              Сброс
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSearch}
              className="shrink-0 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950"
            >
              Поиск
            </button>
          )}
        </div>
      </SectionCard>

      {/* Filter chips */}
      <div className="flex gap-1.5 overflow-x-auto">
        {USERS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => handleFilterChange(f.value)}
            className={[
              'shrink-0 rounded-[16px] px-3 py-2 text-sm font-medium transition',
              filter === f.value
                ? 'bg-white/10 text-white'
                : 'text-white/50 hover:text-white/80',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Sort + Export row */}
      <div className="flex items-center gap-2">
        <select
          value={sortBy}
          onChange={(e) => handleSortChange(e.target.value as UsersSortBy)}
          className="min-w-0 flex-1 rounded-xl bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[var(--accent)]"
        >
          {USERS_SORTS.map((s) => (
            <option key={s.value} value={s.value} className="bg-slate-800">
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleExportAll}
          disabled={exporting}
          className="shrink-0 rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-slate-950 transition disabled:opacity-50"
        >
          {exporting ? '...' : 'Excel'}
        </button>
      </div>

      {error ? <FeedbackMessage tone="error">{error}</FeedbackMessage> : null}

      {loading ? (
        <LoadingBlock title="Загрузка" description="Загружаем клиентов..." />
      ) : !data || data.data.length === 0 ? (
        <EmptyState title="Нет клиентов" description="Пользователи не найдены" />
      ) : (
        <>
          <div className="space-y-2">
            {data.data.map((u) => (
              <Link key={u.id} href={`/admin/users/${u.id}`}>
                <SectionCard className="!p-4 transition hover:border-white/20">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">
                        {u.username ? `@${u.username}` : 'Без username'}
                      </p>
                      <p className="mt-0.5 text-[11px] text-white/40">
                        Регистрация: {new Date(u.createdAt).toLocaleDateString('ru-RU')}
                        {u.isChannelSubscriber ? ' · Подписчик' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-white/5 px-2 py-1.5">
                      <p className="text-xs font-bold text-white">{u.ordersCount}</p>
                      <p className="text-[10px] text-white/40">Заказов</p>
                    </div>
                    <div className="rounded-xl bg-white/5 px-2 py-1.5">
                      <p className="text-xs font-bold text-white">
                        {u.averageCheckRub.toLocaleString('ru-RU')} ₽
                      </p>
                      <p className="text-[10px] text-white/40">Ср. чек</p>
                    </div>
                    <div className="rounded-xl bg-white/5 px-2 py-1.5">
                      <p className="text-xs font-bold text-emerald-300">
                        {u.totalProfitRub.toLocaleString('ru-RU')} ₽
                      </p>
                      <p className="text-[10px] text-white/40">Прибыль</p>
                    </div>
                  </div>
                </SectionCard>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {data.total > data.pageSize ? (
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={data.page <= 1}
                onClick={() => loadUsers(data.page - 1)}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm text-white disabled:opacity-30"
              >
                Назад
              </button>
              <span className="text-sm text-white/50">
                {data.page} / {Math.ceil(data.total / data.pageSize)}
              </span>
              <button
                type="button"
                disabled={data.page >= Math.ceil(data.total / data.pageSize)}
                onClick={() => loadUsers(data.page + 1)}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm text-white disabled:opacity-30"
              >
                Далее
              </button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
