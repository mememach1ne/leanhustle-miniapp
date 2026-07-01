'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { getAppTabs } from '../../lib/navigation';
import { useAuthStore } from '../../store/auth-store';

export function BottomNavigation() {
  const pathname = usePathname();
  const staffRole = useAuthStore((state) => state.user?.staffRole);
  const tabs = getAppTabs(staffRole);

  return (
    <nav className="lg-surface-strong fixed bottom-4 left-1/2 z-20 w-[calc(100%-24px)] max-w-md -translate-x-1/2 rounded-[28px] p-2 lg:hidden">
      {/* grid-cols auto-adapts to the tab count so we never get empty
          dead space when /cart is hidden. */}
      <ul
        className={`grid gap-2 ${
          tabs.length === 4
            ? 'grid-cols-4'
            : tabs.length === 3
            ? 'grid-cols-3'
            : 'grid-cols-2'
        }`}
      >
        {tabs.map((tab) => {
          const isActive = pathname?.startsWith(tab.href) ?? false;

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={[
                  'flex flex-col items-center justify-center rounded-2xl px-2 py-3 text-xs font-medium transition-all',
                  isActive
                    ? 'bg-[var(--accent)] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_8px_20px_-6px_rgba(41,195,197,0.55)]'
                    : 'text-slate-300 hover:bg-white/5',
                ].join(' ')}
              >
                {tab.icon}
                <span className="mt-1">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
