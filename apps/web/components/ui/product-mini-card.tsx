import type { DeliveryCategory, ProductImage } from '@lean-poizon/shared';

import { getDeliveryCategoryLabel } from '../../lib/delivery-categories';
import { ImageGallery } from './image-gallery';
import { SectionCard } from './section-card';

export function ProductMiniCard({
  image,
  mainImage,
  gallery,
  title,
  subtitle,
  meta,
  deliveryCategory,
  weightKg,
  action,
}: {
  image?: string | null;
  mainImage?: string | null;
  gallery?: ProductImage[];
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  deliveryCategory?: DeliveryCategory;
  weightKg?: number;
  action?: React.ReactNode;
}) {
  const showGallery = gallery && gallery.length > 0;
  const thumbImage = image ?? mainImage;

  return (
    <SectionCard>
      <div className="min-w-0">
        <div className="flex min-w-0 gap-3">
          {!showGallery && thumbImage ? (
            <img
              src={thumbImage}
              alt={title}
              loading="lazy"
              decoding="async"
              className="h-20 w-20 shrink-0 rounded-[26px] bg-white/5 object-cover sm:h-24 sm:w-24"
            />
          ) : !showGallery ? (
            <div className="h-20 w-20 shrink-0 rounded-[26px] bg-white/5 sm:h-24 sm:w-24" />
          ) : null}

          <div className="min-w-0 flex-1">
            <h3 className="break-words text-base font-semibold leading-snug text-white">{title}</h3>
            {subtitle ? <p className="mt-2 text-sm text-[var(--muted)]">{subtitle}</p> : null}
            {meta ? <p className="mt-2 text-xs text-[var(--muted)]">{meta}</p> : null}
            {deliveryCategory ? (
              <p className="mt-3 text-xs text-[var(--muted)]">
                Доставка: {getDeliveryCategoryLabel(deliveryCategory)}
                {typeof weightKg === 'number' ? ` • ${weightKg.toFixed(2)} кг` : ''}
              </p>
            ) : null}
          </div>
        </div>

        {showGallery ? (
          <div className="mt-4">
            <ImageGallery images={gallery} />
          </div>
        ) : null}

        {action ? <div className="mt-4 min-w-0">{action}</div> : null}
      </div>
    </SectionCard>
  );
}
