'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { getAppTabs } from '../../lib/navigation';
import { tokenStorage } from '../../lib/token-storage';
import { useAuthStore } from '../../store/auth-store';

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
