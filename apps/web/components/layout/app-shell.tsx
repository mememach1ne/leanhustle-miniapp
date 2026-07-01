'use client';

import { usePathname } from 'next/navigation';

import { getAppTabs } from '../../lib/navigation';
import { useAuthStore } from '../../store/auth-store';
import { AuthStateBanner } from './auth-state-banner';
import { BottomNavigation } from './bottom-navigation';
import { DesktopSidebar } from './desktop-sidebar';
import { Header } from './header';
import { LoginScreen } from './login-screen';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const status = useAuthStore((state) => state.status);
  const staffRole = useAuthStore((state) => state.user?.staffRole);
  const tabs = getAppTabs(staffRole);
  const activeTab = tabs.find((tab) => pathname?.startsWith(tab.href)) ?? tabs[0];

  // Browser visitor without a session — show the Telegram login gate instead
  // of the app chrome.
  if (status === 'needs-login') {
    return <LoginScreen />;
  }

  return (
    <div className="lg:flex">
      {/* Desktop-only left navigation rail. */}
      <DesktopSidebar />

      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-[calc(8.5rem+env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] lg:max-w-none lg:flex-1 lg:px-10 lg:pb-14 lg:pt-9">
        {/* Mobile header card. */}
        <div className="lg:hidden">
          <Header activeTitle={activeTab.label} subtitle={activeTab.subtitle} />
        </div>

        {/* Desktop page heading. */}
        <div className="mb-6 hidden lg:mx-auto lg:block lg:w-full lg:max-w-6xl">
          <h1 className="text-2xl font-bold text-white">{activeTab.label}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{activeTab.subtitle}</p>
        </div>

        <div className="lg:mx-auto lg:w-full lg:max-w-6xl">
          <AuthStateBanner />
        </div>

        <main className="flex-1 pt-1 lg:mx-auto lg:w-full lg:max-w-6xl">{children}</main>
      </div>

      {/* Mobile bottom tab bar (hidden on desktop). */}
      <BottomNavigation />
    </div>
  );
}
