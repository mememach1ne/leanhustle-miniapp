'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { authApi } from '../../lib/api-client';
import { getAppTabs } from '../../lib/navigation';
import { tokenStorage } from '../../lib/token-storage';
import { useAuthStore } from '../../store/auth-store';

const CHANNEL_SUBSCRIBE_URL = 'https://t.me/lh_crypto1/8439';

/**
 * Left navigation rail shown only on desktop (lg+). On mobile / inside the
 * Telegram Mini App the bottom tab bar is used instead.
 */
export function DesktopSidebar() {
  const pathname = usePathname();
  const staffRole = useAuthStore((state) => state.user?.staffRole);
  const user = useAuthStore((state) => state.user);
  const isTelegramEnvironment = useAuthStore((state) => state.isTelegramEnvironment);
  const logout = useAuthStore((state) => state.logout);
  const tabs = getAppTabs(staffRole);

  const handleLogout = () => {
    tokenStorage.clear();
    logout();
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/10 bg-[var(--surface)] px-4 py-6 backdrop-blur-xl lg:flex">
      <Link href="/calculator" className="mb-8 flex items-center gap-3 px-2">
        <Image src="/logo.png" alt="Poizon" width={34} height={34} className="rounded-[10px]" priority />
        <span className="text-[13px] font-bold uppercase leading-tight tracking-[0.14em] text-[var(--accent)]">
          LEAN HUSTLE
          <br />
          POIZON
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {tabs.map((tab) => {
          const active = pathname?.startsWith(tab.href) ?? false;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={[
                'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition',
                active
                  ? 'bg-[var(--accent)] text-slate-950 shadow-[0_8px_20px_-6px_rgba(41,195,197,0.55)]'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white',
              ].join(' ')}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      <SidebarSubscription />

      <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
        {user ? (
          <div className="px-2">
            <p className="truncate text-sm font-semibold text-white">
              {user.firstName} {user.lastName ?? ''}
            </p>
            {user.username ? (
              <p className="truncate text-xs text-white/40">@{user.username}</p>
            ) : null}
          </div>
        ) : null}
        {!isTelegramEnvironment ? (
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-2xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-400/20"
          >
            Выйти
          </button>
        ) : null}
      </div>
    </aside>
  );
}

/** Compact private-channel subscription status shown in the desktop sidebar. */
function SidebarSubscription() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [refreshing, setRefreshing] = useState(false);

  if (!user) return null;

  const subscribed = user.isChannelSubscriber;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await authApi.refreshChannelSubscription();
      setUser(response.user);
    } catch {
      // Non-critical — the status simply stays as it was.
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--accent)]/20 bg-white/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-white">Приватный канал</span>
        <span
          className={[
            'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
            subscribed
              ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-200'
              : 'border-[var(--accent)]/30 bg-[var(--accent)]/15 text-[var(--accent)]',
          ].join(' ')}
        >
          {subscribed ? 'Активна' : 'Нет'}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-4 text-white/50">
        {subscribed
          ? 'Скидка на комиссию применяется при заказе.'
          : 'Подпишитесь — скидка на комиссию при каждом заказе.'}
      </p>
      {!subscribed ? (
        <a
          href={CHANNEL_SUBSCRIBE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block w-full rounded-xl bg-[var(--accent)] px-3 py-2 text-center text-xs font-semibold text-slate-950"
        >
          Подписаться
        </a>
      ) : null}
      <button
        type="button"
        onClick={handleRefresh}
        disabled={refreshing}
        className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
      >
        {refreshing ? 'Проверяем…' : 'Обновить статус'}
      </button>
    </div>
  );
}
