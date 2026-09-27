'use client';

import { TAB_ROUTES } from '@lean-poizon/shared';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { getAppTabs } from '../../lib/navigation';
import { useAuthStore } from '../../store/auth-store';

export function BottomNavigation() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const tabs = getAppTabs(user?.staffRole).filter((tab) => tab.href !== TAB_ROUTES.PROFILE);
  const isProfileActive = pathname?.startsWith(TAB_ROUTES.PROFILE) ?? false;
  const initial = (user?.firstName ?? user?.username ?? '?').slice(0, 1).toUpperCase();

  return (
    <nav className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-20 flex w-[calc(100%-24px)] max-w-md -translate-x-1/2 items-center gap-2 lg:hidden">
      <ul className="lg-island flex h-16 flex-1 items-center justify-around rounded-full px-1.5">
        {tabs.map((tab) => {
          const isActive = pathname?.startsWith(tab.href) ?? false;

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={[
                  'mx-auto flex h-14 max-w-[76px] flex-col items-center justify-center gap-0.5 rounded-full text-[10.5px] font-bold transition-colors',
                  isActive
                    ? 'bg-[radial-gradient(circle_at_50%_45%,rgba(41,195,197,0.28),rgba(41,195,197,0)_70%)] text-[var(--accent)]'
                    : 'text-[#8a8d93]',
                ].join(' ')}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Link
        href={TAB_ROUTES.PROFILE}
        aria-label="Профиль"
        className={[
          'lg-island grid h-16 w-16 shrink-0 place-items-center rounded-full',
          isProfileActive ? 'ring-2 ring-[var(--accent)]' : '',
        ].join(' ')}
      >
        {user?.photoUrl ? (
          <img
            src={user.photoUrl}
            alt=""
            className="h-12 w-12 rounded-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="grid h-12 w-12 place-items-center rounded-full bg-[linear-gradient(135deg,#5b4bd6,#29C3C5)] text-lg font-extrabold text-white">
            {initial}
          </span>
        )}
      </Link>
    </nav>
  );
}
