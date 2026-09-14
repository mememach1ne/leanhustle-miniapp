import type { CatalogProductDto } from '@lean-poizon/shared';

const formatRub = (value: number) => `${Math.round(value).toLocaleString('ru-RU')} ₽`;

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

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 min-h-[2.2em] text-xs font-medium leading-snug text-white">
          {product.title}
        </h3>

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="truncate text-sm font-semibold text-[var(--accent)]">
            от {formatRub(product.priceRub)}
          </span>
          {product.soldText ? (
            <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-[var(--muted)]">
              {product.soldText}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
