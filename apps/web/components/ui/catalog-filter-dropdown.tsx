'use client';

import { hapticSelection } from '../../lib/telegram-web-app';
import { ChevronDownIcon } from './icons';

interface DropdownOption {
  value: string;
  label: string;
}

/**
 * Liquid-glass dropdown pill — "Категория ⌄" / "Бренд ⌄" — opening a
 * radio-list panel anchored right below it. `idleLabel` ("Все категории" /
 * "Все бренды") doubles as both the pill's text when nothing is picked and
 * the list's own "clear this filter" row, matching the reference screenshot
 * where the default option is just the first row, not a separate state.
 */
export function CatalogFilterDropdown({
  idleLabel,
  options,
  selectedValue,
  onSelect,
  isOpen,
  onToggle,
}: {
  idleLabel: string;
  options: DropdownOption[];
  selectedValue: string | null;
  onSelect: (value: string | null) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const currentLabel = selectedValue
    ? (options.find((option) => option.value === selectedValue)?.label ?? idleLabel)
    : idleLabel;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          hapticSelection();
          onToggle();
        }}
        className="lg-surface flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white transition active:scale-95"
      >
        {currentLabel}
        <ChevronDownIcon
          className={[
            'h-4 w-4 shrink-0 text-[var(--accent)] transition-transform',
            isOpen ? 'rotate-180' : '',
          ].join(' ')}
        />
      </button>

      {isOpen ? (
        <>
          {/* Transparent backdrop — closes the panel on an outside tap. */}
          <div className="fixed inset-0 z-40" onClick={onToggle} />

          <div className="lg-surface-strong absolute left-0 top-[calc(100%+8px)] z-50 max-h-80 w-56 overflow-y-auto rounded-[20px] p-2">
            <DropdownRow
              label={idleLabel}
              isSelected={selectedValue === null}
              onClick={() => onSelect(null)}
            />
            {options.map((option) => (
              <DropdownRow
                key={option.value}
                label={option.label}
                isSelected={selectedValue === option.value}
                onClick={() => onSelect(option.value)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function DropdownRow({
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
      onClick={() => {
        hapticSelection();
        onClick();
      }}
      className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left text-sm text-white transition active:scale-[0.98]"
    >
      <span
        className={[
          'h-4 w-4 shrink-0 rounded-full border-2 transition',
          isSelected ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-white/25',
        ].join(' ')}
      />
      {label}
    </button>
  );
}
