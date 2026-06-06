import { TAB_ROUTES } from '@lean-poizon/shared';

import { CalculatorIcon, ProfileIcon, ShieldIcon } from '../components/ui/icons';

interface TabItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  subtitle: string;
}

// Cart is intentionally NOT a bottom-nav tab anymore — it's reached via
// the floating cart pill on the Calculator screen (Portals-style). The
// /cart route still exists; the floating pill links to it.
const BASE_TABS: TabItem[] = [
  { href: TAB_ROUTES.CALCULATOR, label: 'Калькулятор', icon: <CalculatorIcon className="h-5 w-5" />, subtitle: 'Расчёт стоимости товара по ссылке Poizon' },
  { href: TAB_ROUTES.PROFILE, label: 'Профиль', icon: <ProfileIcon className="h-5 w-5" />, subtitle: 'Аккаунт, подписка и история заказов' },
];

const ADMIN_TAB: TabItem = {
  href: TAB_ROUTES.ADMIN,
  label: 'Панель',
  icon: <ShieldIcon className="h-5 w-5" />,
  subtitle: 'Управление заказами и клиентами',
};

export function getAppTabs(staffRole?: string | null): TabItem[] {
  if (staffRole) {
    return [...BASE_TABS, ADMIN_TAB];
  }
  return BASE_TABS;
}

/** @deprecated Use getAppTabs(staffRole) */
export const APP_TABS = BASE_TABS;
