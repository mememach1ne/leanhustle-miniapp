import type { CatalogTypeOption } from '@lean-poizon/shared';
import { CATALOG_BRAND_OPTIONS, CATALOG_TYPE_OPTIONS } from '@lean-poizon/shared';

import { hapticSelection } from '../../lib/telegram-web-app';

/** Type names are stored/sent in English (what the engine expects) but shown in Russian. */
const TYPE_LABELS_RU: Record<CatalogTypeOption, string> = {
  Sneakers: 'Кроссовки',
  Jacket: 'Куртки',
  Hoodie: 'Худи',
  'T-Shirt': 'Футболки',
  Pants: 'Брюки',
  Shorts: 'Шорты',
  Bag: 'Сумки',
  Backpack: 'Рюкзаки',
  Cap: 'Кепки',
  Slides: 'Шлёпанцы',
  Accessories: 'Аксессуары',
};

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

export function CatalogFilters({
  searchText,
  onSearchTextChange,
  selectedType,
  onSelectType,
  selectedBrand,
  onSelectBrand,
}: {
  searchText: string;
  onSearchTextChange: (value: string) => void;
  selectedType: CatalogTypeOption | null;
  onSelectType: (type: CatalogTypeOption | null) => void;
  selectedBrand: string | null;
  onSelectBrand: (brand: string | null) => void;
}) {
  return (
    <div className="space-y-3">
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
              label={TYPE_LABELS_RU[type]}
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
  );
}
