'use client';

import { OrderStatus } from '@lean-poizon/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { AuthDebugBlock } from '../../../components/debug/auth-debug-block';
import { LoyaltyCard } from '../../../components/profile/loyalty-card';
import { EmptyState } from '../../../components/ui/empty-state';
import { ChatIcon, HelpIcon, LockIcon, MapPinIcon, ReceiptIcon } from '../../../components/ui/icons';
import { LoadingBlock } from '../../../components/ui/loading-block';
import { PageSection } from '../../../components/ui/page-section';
import { SectionCard } from '../../../components/ui/section-card';
import { ordersApi } from '../../../lib/api-client';
import { tokenStorage } from '../../../lib/token-storage';
import { useAuthStore } from '../../../store/auth-store';

const SUPPORT_TELEGRAM_URL = 'https://t.me/lh_poizonmanager';

const OTHER_MARKETPLACES = ['Taobao', '1688', '95', 'Рыбка', 'Pinduoduo'] as const;

export default function ProfilePage() {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const error = useAuthStore((state) => state.error);

  const [orderStats, setOrderStats] = useState<{ count: number; sumUsd: number } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    ordersApi
      .getOrders()
      .then((orders) => {
        if (cancelled) return;
        const active = orders.filter((o) => o.status !== OrderStatus.CANCELLED);
        const sumUsd = active.reduce((sum, o) => sum + o.totalUsd, 0);
        setOrderStats({ count: active.length, sumUsd });
      })
      .catch(() => {
        // Non-critical — the stat cards just show a dash.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'loading' || status === 'idle') {
    return (
      <PageSection>
        <AuthDebugBlock />
        <LoadingBlock
          title="Профиль загружается"
          description="Скоро покажем аккаунт и переход к заказам."
        />
      </PageSection>
    );
  }

  if (!user) {
    return (
      <PageSection>
        <AuthDebugBlock />
        <EmptyState
          icon={<LockIcon />}
          title="Нужен вход через Telegram"
          description={
            error ??
            'Войдите через Telegram, чтобы получить доступ к профилю и заказам.'
          }
        />
      </PageSection>
    );
  }

  const roleLabel = user.staffRole
    ? user.staffRole === 'ADMIN'
      ? 'Администратор'
      : 'Менеджер'
    : 'Клиент';

  return (
    <PageSection>
      <AuthDebugBlock />

      {/* Account card with stats. */}
      <SectionCard>
        <div className="flex items-center gap-3">
          {user.photoUrl ? (
            <img
              src={user.photoUrl}
              alt={user.firstName}
              loading="lazy"
              decoding="async"
              className="h-14 w-14 shrink-0 rounded-[18px] bg-white/5 object-cover"
            />
          ) : (
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-[linear-gradient(135deg,#5b4bd6,#29C3C5)] text-xl font-extrabold text-white">
              {user.firstName.slice(0, 1).toUpperCase()}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-extrabold text-white">
              {[user.firstName, user.lastName].filter(Boolean).join(' ')}
            </h3>
            <p className="mt-0.5 truncate text-[13px] font-semibold text-[var(--muted)]">
              {user.username ? `@${user.username}` : 'Без username'}
              {user.staffRole ? ` · ${roleLabel}` : ''}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat label="Заказов" value={orderStats === null ? '—' : String(orderStats.count)} />
          <Stat
            label="Сумма заказов"
            value={orderStats === null ? '—' : `$${orderStats.sumUsd.toFixed(2)}`}
          />
        </div>
      </SectionCard>

      {/* Quick actions — round icon buttons. */}
      <div className="lg-surface grid grid-cols-4 gap-1 rounded-[22px] px-1.5 py-3">
        <ActionButton href="/profile/orders" label="Заказы" icon={<ReceiptIcon className="h-[21px] w-[21px]" />} />
        <ActionButton href="/profile/delivery" label="Адреса" icon={<MapPinIcon className="h-[21px] w-[21px]" />} />
        <ActionButton href={SUPPORT_TELEGRAM_URL} external label="Поддержка" icon={<ChatIcon className="h-[21px] w-[21px]" />} />
        <ActionButton href="/profile/faq" label="FAQ" icon={<HelpIcon className="h-[21px] w-[21px]" />} />
      </div>

      <div>
        {/* Loyalty program — live tier / discount / progress. */}
        <LoyaltyCard />
      </div>

      {/* Other Chinese marketplaces — ordered through the manager. */}
      <div className="lg-surface rounded-[26px] p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-[16px] font-bold text-white">Не только Poizon</h3>
          <span className="text-[11px] font-semibold text-[var(--muted)]">через менеджера</span>
        </div>
        <p className="mt-1 text-[12.5px] leading-5 text-[var(--muted)]">
          Доставим товары с любого китайского маркетплейса — менеджер найдёт самое выгодное
          предложение.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {OTHER_MARKETPLACES.map((name) => (
            <span
              key={name}
              className="rounded-full bg-white/[0.06] px-3 py-1 text-[12px] font-semibold text-white"
            >
              {name}
            </span>
          ))}
        </div>
        <a
          href={SUPPORT_TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="lg-accent-button mt-3.5 flex h-11 w-full items-center justify-center rounded-full text-sm font-bold transition active:scale-[0.98]"
        >
          Написать менеджеру
        </a>
      </div>

      {/* Logout — mobile browser only (desktop uses the sidebar). */}
      <div className="lg:hidden">
        <LogoutButton />
      </div>
    </PageSection>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] px-3 py-2.5">
      <p className="font-display text-[16px] font-bold text-white">{value}</p>
      <p className="mt-0.5 text-[11.5px] font-semibold text-[var(--muted)]">{label}</p>
    </div>
  );
}

function ActionButton({
  href,
  label,
  icon,
  external = false,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  external?: boolean;
}) {
  const content = (
    <>
      <span className="mx-auto mb-1.5 grid h-11 w-11 place-items-center rounded-full bg-[var(--surface-2)] text-white">
        {icon}
      </span>
      <span className="block text-center text-[11.5px] font-bold text-white">{label}</span>
    </>
  );
  const className = 'block transition active:scale-95';

  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {content}
    </a>
  ) : (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}

/**
 * Browser-only "Выйти" button. Hidden inside Telegram, where the session is
 * managed by the Mini App and there's nothing to log out of.
 */
function LogoutButton() {
  const isTelegramEnvironment = useAuthStore((state) => state.isTelegramEnvironment);
  const logout = useAuthStore((state) => state.logout);

  if (isTelegramEnvironment) return null;

  const handleLogout = () => {
    tokenStorage.clear();
    logout();
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="mt-4 w-full rounded-[18px] border border-rose-400/30 bg-rose-400/10 px-4 py-2.5 text-sm font-semibold text-rose-200 transition hover:bg-rose-400/20"
    >
      Выйти
    </button>
  );
}
