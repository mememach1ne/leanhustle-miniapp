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

  useEffect(() => {
    if (!isFullscreen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === 'ArrowRight') handleNext();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [isFullscreen, handlePrev, handleNext]);

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
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setIsFullscreen(false)}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsFullscreen(false);
            }}
            className="absolute right-4 top-[calc(env(safe-area-inset-top)+12px)] z-10 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xl text-white backdrop-blur-md transition active:scale-95"
            aria-label="Закрыть"
          >
            ✕
          </button>

          <div className="absolute left-1/2 top-[calc(env(safe-area-inset-top)+18px)] -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white backdrop-blur-md">
            {selectedIndex + 1} / {images.length}
          </div>

          <div
            className="flex flex-1 items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selected?.url}
              alt={selected?.alt ?? `Фото ${selectedIndex + 1}`}
              className="max-h-full max-w-full object-contain"
            />
          </div>

          {images.length > 1 ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrev();
                }}
                className="absolute left-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl text-white backdrop-blur-md transition active:scale-95"
                aria-label="Предыдущее фото"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                className="absolute right-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl text-white backdrop-blur-md transition active:scale-95"
                aria-label="Следующее фото"
              >
                ›
              </button>

              <div
                className="flex gap-2 overflow-x-auto px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]"
                style={{ scrollbarWidth: 'none' }}
                onClick={(e) => e.stopPropagation()}
              >
                {images.map((image, index) => (
                  <button
                    key={image.url}
                    type="button"
                    onClick={() => setSelectedIndex(index)}
                    className={[
                      'h-14 w-14 shrink-0 rounded-[14px] transition',
                      index === selectedIndex ? 'ring-2 ring-[var(--accent)]' : 'opacity-50',
                    ].join(' ')}
                  >
                    <img
                      src={image.url}
                      alt={image.alt ?? `Фото ${index + 1}`}
                      className="h-full w-full rounded-[14px] bg-white object-contain"
                    />
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
