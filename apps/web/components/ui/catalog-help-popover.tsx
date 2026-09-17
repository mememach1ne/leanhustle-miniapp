'use client';

import { hapticSelection } from '../../lib/telegram-web-app';
import { InfoIcon } from './icons';

/**
 * Small "?" pill next to the filter dropdowns — explains the non-obvious
 * rules of the search/filter panel (engine only understands English
 * keywords, category+text can be combined, first-time queries are slow).
 * Anchored panel, same mechanics as CatalogFilterDropdown, but right-0
 * since this button sits at the end of the pill row and a left-anchored
 * panel would risk overflowing the viewport on narrow phones.
 */
export function CatalogHelpPopover({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          hapticSelection();
          onToggle();
        }}
        aria-label="Как пользоваться поиском и фильтрами"
        className="lg-surface grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--accent)] transition active:scale-95"
      >
        <InfoIcon className="h-5 w-5" />
      </button>

      {isOpen ? (
        <>
          <div className="fixed inset-0 z-40" onClick={onToggle} />

          <div className="lg-surface-strong absolute right-0 top-[calc(100%+8px)] z-50 w-72 max-w-[calc(100vw-2.5rem)] rounded-[20px] p-4">
            <h4 className="text-sm font-semibold text-white">Как искать товары</h4>
            <ul className="mt-3 space-y-2.5 text-xs leading-5 text-[var(--muted)]">
              <li>
                <span className="text-white">Пишите на английском.</span> Каталог ищет по
                названиям с сайта Poizon — русские слова он не поймёт. Например:{' '}
                <span className="text-white">nike</span>, <span className="text-white">jacket</span>,{' '}
                <span className="text-white">jordan sneakers</span>.
              </li>
              <li>
                <span className="text-white">Категорию и поиск можно сочетать.</span> Выберите,
                например, «Куртки» и добавьте бренд в поиске — результат станет точнее.
              </li>
              <li>
                <span className="text-white">Новый запрос ищется дольше</span> (до 20 секунд) —
                зато повторно тот же запрос откроется мгновенно.
              </li>
              <li>
                <span className="text-white">Сортировка по цене</span> берётся прямо с сайта — иногда
                среди самых дешёвых попадаются не совсем подходящие товары, это особенность каталога.
              </li>
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}
