import { InfoRow } from './info-row';
import { SectionCard } from './section-card';

export function PriceSummaryCard({
  title,
  totalUsd,
  deliveryRub,
  dutyRub,
  actualDeliveryRub,
  actualDutyRub,
  itemsCount,
  footer,
}: {
  title: string;
  totalUsd: number;
  deliveryRub: number;
  dutyRub: number;
  /** When set, replaces the estimated delivery and is highlighted. */
  actualDeliveryRub?: number | null;
  /** When set, replaces the estimated duty. */
  actualDutyRub?: number | null;
  itemsCount?: number;
  footer?: React.ReactNode;
}) {
  const hasActualDelivery =
    actualDeliveryRub !== null && actualDeliveryRub !== undefined;
  const hasActualDuty = actualDutyRub !== null && actualDutyRub !== undefined;

  return (
    <SectionCard>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <div className="mt-4 space-y-3">
        {typeof itemsCount === 'number' ? <InfoRow label="Товаров" value={itemsCount} /> : null}
        <p className="text-xs text-[var(--muted)]">Выкуп товара (USD)</p>
        <InfoRow label="Итог за товары" value={`$${totalUsd.toFixed(2)}`} accent />
        <div className="border-t border-white/5" />
        <p className="text-xs text-[var(--muted)]">Доставка и пошлина (RUB)</p>
        {hasActualDelivery ? (
          <InfoRow
            label="Доставка (факт)"
            value={`${actualDeliveryRub} ₽`}
            accent
          />
        ) : (
          <InfoRow label="Примерная доставка" value={`${deliveryRub} ₽`} />
        )}
        {hasActualDuty ? (
          <InfoRow label="Пошлина (факт)" value={`${actualDutyRub} ₽`} accent />
        ) : dutyRub > 0 ? (
          <InfoRow label="Примерная пошлина" value={`${dutyRub} ₽`} />
        ) : null}
      </div>
      {footer ? <div className="mt-5">{footer}</div> : null}
    </SectionCard>
  );
}
