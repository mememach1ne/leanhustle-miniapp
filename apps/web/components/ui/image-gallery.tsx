'use client';

import type { ProductImage } from '@lean-poizon/shared';
import { useState } from 'react';

export function ImageGallery({ images }: { images: ProductImage[] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (images.length === 0) return null;

  const selected = images[selectedIndex];

  return (
    <div>
      <img
        src={selected?.url}
        alt={selected?.alt ?? `Фото ${selectedIndex + 1}`}
        loading="lazy"
        decoding="async"
        className="aspect-square w-full rounded-[22px] bg-white/5 object-cover"
      />

      {images.length > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={[
                'h-14 w-14 shrink-0 rounded-[14px] object-cover transition',
                index === selectedIndex
                  ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface)]'
                  : 'opacity-50',
              ].join(' ')}
            >
              <img
                src={image.url}
                alt={image.alt ?? `Фото ${index + 1}`}
                loading="lazy"
                decoding="async"
                className="h-full w-full rounded-[14px] bg-white/5 object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
