'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useCartStore } from '../../store/cart-store';

/**
 * Compact floating cart pill (Portals-style) anchored to the right edge,
 * sitting just above the bottom navigation. Liquid-glass look: translucent
 * white surface with a subtle blur and white text inside.
 *
 * Only shown on /calculator. Hidden when the cart is empty or unloaded.
 */
export function FloatingCartBar() {
  const pathname = usePathname();
  const cart = useCartStore((state) => state.cart);

  if (!pathname?.startsWith('/calculator')) return null;
  if (!cart) return null;

  const count = cart.summary.itemsCount;
  if (count <= 0) return null;

  const totalUsdLabel = `$${cart.summary.cartTotalUsd.toFixed(2)}`;
  const itemsLabel = `${count} ${pluralize(count, ['товар', 'товара', 'товаров'])}`;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-30"
      style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom))' }}
    >
      {/* Same horizontal frame as the rest of the shell so the pill
          aligns with the content and sticks to the right edge of the
          card column on wide screens. */}
      <div className="mx-auto flex w-full max-w-md justify-end px-4">
        <Link
          href="/cart"
          aria-label={`Открыть корзину — ${itemsLabel}, ${totalUsdLabel}`}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-black/30 backdrop-blur-xl transition active:scale-[0.97]"
        >
          <CartIcon />
          <span className="leading-none">{totalUsdLabel}</span>
          <span className="leading-none text-white/60">·</span>
          <span className="leading-none text-white/80">{itemsLabel}</span>
        </Link>
      </div>
    </div>
  );
}

function CartIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
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
