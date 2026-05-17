'use client';

import type { ProductImage } from '@lean-poizon/shared';
import { useCallback, useEffect, useState } from 'react';

import { hapticImpact, hapticSelection } from '../../lib/telegram-web-app';

export function ImageGallery({ images }: { images: ProductImage[] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handlePrev = useCallback(() => {
    setSelectedIndex((i) => (i - 1 + images.length) % images.length);
    hapticSelection();
  }, [images.length]);

  const handleNext = useCallback(() => {
    setSelectedIndex((i) => (i + 1) % images.length);
    hapticSelection();
  }, [images.length]);

  if (images.length === 0) return null;

  const selected = images[selectedIndex];

  return (
    <>
      <div>
        <button
          type="button"
          onClick={() => {
            setIsFullscreen(true);
            hapticImpact('light');
          }}
          className="block w-full"
          aria-label="Открыть фото в полный экран"
        >
          <img
            src={selected?.url}
            alt={selected?.alt ?? `Фото ${selectedIndex + 1}`}
            loading="lazy"
            decoding="async"
            className="aspect-square w-full rounded-[22px] bg-white object-contain"
          />
        </button>

        {images.length > 1 ? (
          <div className="mt-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {images.map((image, index) => (
              <button
                key={image.url}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className={[
                  'h-14 w-14 shrink-0 rounded-[14px] transition',
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
                  className="h-full w-full rounded-[14px] bg-white object-contain"
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {isFullscreen ? (
        <ImageGalleryModal
          images={images}
          initialIndex={selectedIndex}
          onClose={() => setIsFullscreen(false)}
          onIndexChange={setSelectedIndex}
        />
      ) : null}
    </>
  );
}

function ImageGalleryModal({
  images,
  initialIndex,
  onClose,
  onIndexChange,
}: {
  images: ProductImage[];
  initialIndex: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const [index, setIndex] = useState(initialIndex);

  const goPrev = useCallback(() => {
    setIndex((i) => {
      const next = (i - 1 + images.length) % images.length;
      onIndexChange(next);
      return next;
    });
    hapticSelection();
  }, [images.length, onIndexChange]);

  const goNext = useCallback(() => {
    setIndex((i) => {
      const next = (i + 1) % images.length;
      onIndexChange(next);
      return next;
    });
    hapticSelection();
  }, [images.length, onIndexChange]);

  useEffect(() => {
    hapticImpact('light');
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goPrev, goNext]);

  const selected = images[index];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-lg text-white transition active:scale-90"
        aria-label="Закрыть"
      >
        ✕
      </button>

      {images.length > 1 ? (
        <span className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
          {index + 1} / {images.length}
        </span>
      ) : null}

      <img
        src={selected?.url}
        alt={selected?.alt ?? `Фото ${index + 1}`}
        className="max-h-[85vh] max-w-[92vw] rounded-2xl bg-white object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      {images.length > 1 ? (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-3 top-1/2 z-10 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl text-white transition active:scale-90"
            aria-label="Предыдущее фото"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-3 top-1/2 z-10 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl text-white transition active:scale-90"
            aria-label="Следующее фото"
          >
            ›
          </button>
        </>
      ) : null}
    </div>
  );
}
