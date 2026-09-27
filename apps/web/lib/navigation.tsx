import { TAB_ROUTES } from '@lean-poizon/shared';

import { CalculatorIcon, CartIcon, ProfileIcon, ShieldIcon, StorefrontIcon } from '../components/ui/icons';

interface TabItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const BASE_TABS: TabItem[] = [
  { href: TAB_ROUTES.CATALOG, label: 'Магазин', icon: <StorefrontIcon className="h-5 w-5" /> },
  { href: TAB_ROUTES.CALCULATOR, label: 'Калькулятор', icon: <CalculatorIcon className="h-5 w-5" /> },
  { href: TAB_ROUTES.CART, label: 'Корзина', icon: <CartIcon className="h-5 w-5" /> },
  { href: TAB_ROUTES.PROFILE, label: 'Профиль', icon: <ProfileIcon className="h-5 w-5" /> },
];

const ADMIN_TAB: TabItem = {
  href: TAB_ROUTES.ADMIN,
  label: 'Панель',
  icon: <ShieldIcon className="h-5 w-5" />,
};

export function getAppTabs(staffRole?: string | null): TabItem[] {
  if (staffRole) {
    return [...BASE_TABS, ADMIN_TAB];
  }
  return BASE_TABS;
}

/** @deprecated Use getAppTabs(staffRole) */
export const APP_TABS = BASE_TABS;
