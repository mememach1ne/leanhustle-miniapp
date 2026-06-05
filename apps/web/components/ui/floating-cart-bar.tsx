'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useCartStore } from '../../store/cart-store';

/**
 * Floating pill above the bottom navigation that links to /cart.
 * Currently shown only on the Calculator screen (matches the Portals-style
 * pattern where the cart CTA sits above the catalog/main flow).
 *
 * Hides itself when:
 *   - we're already on the cart page,
 *   - the cart hasn't loaded yet,
 *   - the cart is empty.
 */
export function FloatingCartBar() {
  const pathname = usePathname();
  const cart = useCartStore((state) => state.cart);

  // Only on the calculator screen for now.
  if (!pathname?.startsWith('/calculator')) return null;
  if (!cart) return null;

  const count = cart.summary.itemsCount;
  if (count <= 0) return null;

  // USD as requested. Round to 2 decimals; trim trailing zero if integer.
  const totalUsdLabel = `$${cart.summary.cartTotalUsd.toFixed(2)}`;

  // Russian noun agreement: 1 товар / 2 товара / 5 товаров
  const noun = pluralize(count, ['товар', 'товара', 'товаров']);

  return (
    // Fixed position aligns the bar above the bottom-nav (~5.5rem high).
    // The inner div is centered + max-width-md to match the rest of the
    // miniapp shell, so on wide screens the pill doesn't span the page.
    <div
      className="pointer-events-none fixed inset-x-0 z-30"
      style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto w-full max-w-md px-4">
        <Link
          href="/cart"
          className="pointer-events-auto flex items-center justify-between rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-black/30 transition active:scale-[0.99]"
        >
          <span className="flex items-center gap-2">
            <CartIcon />
            <span>{totalUsdLabel}</span>
          </span>
          <span className="text-xs font-medium text-slate-950/80">
            {count} {noun}
          </span>
        </Link>
      </div>
    </div>
  );
}

function CartIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function pluralize(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}
