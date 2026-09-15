'use client';

import type { CatalogTypeOption } from '@lean-poizon/shared';
import { CATALOG_BRAND_OPTIONS, CATALOG_TYPE_OPTIONS } from '@lean-poizon/shared';
import { useEffect } from 'react';

import { CATALOG_TYPE_LABELS_RU } from '../../lib/catalog-type-labels';
import { hapticImpact, hapticSelection } from '../../lib/telegram-web-app';

function Chip({
  label,
  isSelected,
  onClick,
}: {
  label: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95',
        isSelected
          ? 'border-[var(--accent)] bg-[var(--accent)] text-slate-950'
          : 'border-white/10 bg-white/5 text-white',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

/**
 * Liquid-glass bottom sheet for the storefront's brand/type/text filters —
 * opened from the "Популярные ⌄" pill on the /catalog page. Selections
 * apply live (the grid behind the sheet refetches as soon as state
 * changes), so "Готово" just dismisses the sheet rather than triggering
 * anything itself.
 */
export function CatalogFilterSheet({
  searchText,
  onSearchTextChange,
  selectedType,
  onSelectType,
  selectedBrand,
  onSelectBrand,
  onClose,
  onReset,
}: {
  searchText: string;
  onSearchTextChange: (value: string) => void;
  selectedType: CatalogTypeOption | null;
  onSelectType: (type: CatalogTypeOption | null) => void;
  selectedBrand: string | null;
  onSelectBrand: (brand: string | null) => void;
  onClose: () => void;
  onReset: () => void;
}) {
  useEffect(() => {
    hapticImpact('light');
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const hasAnyFilter = Boolean(selectedType || selectedBrand || searchText.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="lg-surface-strong max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-[28px] p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:max-w-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Фильтры</h3>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-sm text-white transition active:scale-90"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <input
            type="text"
            value={searchText}
            onChange={(event) => onSearchTextChange(event.target.value)}
            placeholder="Поиск: например, кроссовки"
            className="w-full rounded-[16px] border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[var(--accent)]"
          />

          <div>
            <p className="mb-2 text-xs text-[var(--muted)]">Тип</p>
            <div className="flex flex-wrap gap-2">
              {CATALOG_TYPE_OPTIONS.map((type) => (
                <Chip
                  key={type}
                  label={CATALOG_TYPE_LABELS_RU[type]}
                  isSelected={selectedType === type}
                  onClick={() => {
                    hapticSelection();
                    onSelectType(selectedType === type ? null : type);
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs text-[var(--muted)]">Бренд</p>
            <div className="flex flex-wrap gap-2">
              {CATALOG_BRAND_OPTIONS.map((brand) => (
                <Chip
                  key={brand}
                  label={brand}
                  isSelected={selectedBrand === brand}
                  onClick={() => {
                    hapticSelection();
                    onSelectBrand(selectedBrand === brand ? null : brand);
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          {hasAnyFilter ? (
            <button
              type="button"
              onClick={onReset}
              className="flex-1 rounded-[16px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.98]"
            >
              Сбросить
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-[16px] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 transition active:scale-[0.98]"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
