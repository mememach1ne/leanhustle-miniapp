'use client';

import { usePathname } from 'next/navigation';

import { getAppTabs } from '../../lib/navigation';
import { useAuthStore } from '../../store/auth-store';
import { FloatingCartBar } from '../ui/floating-cart-bar';
import { AuthStateBanner } from './auth-state-banner';
import { BottomNavigation } from './bottom-navigation';
import { Header } from './header';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const staffRole = useAuthStore((state) => state.user?.staffRole);
  const tabs = getAppTabs(staffRole);
  const activeTab = tabs.find((tab) => pathname?.startsWith(tab.href)) ?? tabs[0];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-[calc(8.5rem+env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <Header activeTitle={activeTab.label} subtitle={activeTab.subtitle} />
      <AuthStateBanner />
      <main className="flex-1 pt-1">{children}</main>
      <FloatingCartBar />
      <BottomNavigation />
    </div>
  );
}
