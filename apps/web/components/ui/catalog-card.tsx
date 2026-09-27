import type { CatalogProductDto } from '@lean-poizon/shared';

const formatUsd = (value: number) => `$${value.toFixed(2)}`;

/**
 * The engine's raw soldText ("64w+", 'w' = 万 = 10 000) means nothing to a
 * Russian-speaking customer. Format the parsed soldRank into a plain
 * Russian label instead — "640 тыс.+", "1.4 млн+".
 */
const formatSoldLabel = (soldRank: number): string | null => {
  if (!soldRank || soldRank <= 0) return null;
  if (soldRank >= 1_000_000) {
    return `${(soldRank / 1_000_000).toFixed(1).replace(/\.0$/, '')} млн+`;
  }
  if (soldRank >= 1_000) {
    return `${Math.round(soldRank / 1_000)} тыс.+`;
  }
  return `${soldRank}+`;
};

export function CatalogCard({
  product,
  onClick,
}: {
  product: CatalogProductDto;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="lg-surface flex min-w-0 flex-col overflow-hidden rounded-[22px] text-left transition active:scale-[0.97]"
    >
      <div className="aspect-square w-full shrink-0 bg-white">
        <img
          src={product.imageUrl}
          alt={product.title}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain"
        />
      </div>

      <div className="flex flex-1 flex-col px-3 pb-3 pt-2.5">
        <h3 className="font-body line-clamp-2 min-h-[2.6em] text-[13px] font-semibold leading-[1.3] text-[#e9eaec]">
          {product.title}
        </h3>

        <div className="mt-auto pt-2">
          <p className="font-display whitespace-nowrap text-[14px] font-bold text-white">
            <span className="font-body mr-1 text-xs font-semibold text-[var(--muted)]">от</span>
            {formatUsd(product.priceUsd)}
          </p>
          {formatSoldLabel(product.soldRank) ? (
            <p className="mt-0.5 truncate text-[11px] font-semibold text-[var(--muted)]">
              Продано {formatSoldLabel(product.soldRank)}
            </p>
          ) : null}
        </div>
      </div>
    </button>
  );
}
