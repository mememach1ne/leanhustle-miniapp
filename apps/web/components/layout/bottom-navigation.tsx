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
    <nav className="fixed bottom-4 left-1/2 z-20 w-[calc(100%-24px)] max-w-md -translate-x-1/2 rounded-[28px] border border-[var(--surface-border)] bg-[var(--surface)] p-2 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <ul className={`grid gap-2 ${tabs.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {tabs.map((tab) => {
          const isActive = pathname?.startsWith(tab.href) ?? false;

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={[
                  'flex flex-col items-center justify-center rounded-2xl px-2 py-3 text-xs font-medium transition-colors',
                  isActive ? 'bg-[var(--accent)] text-slate-950' : 'text-slate-300 hover:bg-white/5',
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
