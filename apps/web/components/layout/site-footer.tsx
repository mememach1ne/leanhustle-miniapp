'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

export const BOT_URL = 'https://t.me/lh_poizonbot';
export const MANAGER_URL = 'https://t.me/lh_poizonmanager';
export const PURCHASES_URL = 'https://t.me/lh_poizonpurchases';
export const REVIEWS_URL = 'https://t.me/lh_poizonreviews';

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono-brand), ui-monospace, monospace',
};
const DISPLAY: React.CSSProperties = {
  fontFamily: 'var(--font-display), sans-serif',
};

const MARKETPLACES = [
  { name: 'Poizon', note: 'Оригинальная одежда, обувь и аксессуары', live: true },
  { name: 'Taobao и Tmall', note: 'Крупнейшие маркетплейсы Китая', live: false },
  { name: '1688', note: 'Оптовые цены напрямую от фабрик', live: false },
  { name: 'Pinduoduo', note: 'Товары на каждый день по низким ценам', live: false },
] as const;

const CONTACTS = [
  { label: 'Менеджер', href: MANAGER_URL },
  { label: 'Выкупы', href: PURCHASES_URL },
  { label: 'Отзывы', href: REVIEWS_URL },
  { label: 'Открыть бота', href: BOT_URL },
] as const;

export function SectionHead({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-10 text-center">
      <span
        className="inline-flex items-center gap-3 text-[0.72rem] font-semibold uppercase text-[var(--accent)]"
        style={{ ...MONO, letterSpacing: '0.22em' }}
      >
        <span className="h-px w-7 bg-[var(--accent)]" />
        {kicker}
        <span className="h-px w-7 bg-[var(--accent)]" />
      </span>
      <h2
        className="mt-4 text-3xl font-bold uppercase text-white sm:text-4xl"
        style={{ ...DISPLAY, letterSpacing: '-0.01em' }}
      >
        {title}
      </h2>
    </div>
  );
}

/** "Не только Poizon" — other Chinese marketplaces coming with LH — CHINA. */
export function MarketplacesSection() {
  return (
    <section id="marketplaces" className="mx-auto w-full max-w-4xl px-5 py-16">
      <SectionHead kicker="LH — China" title="Не только Poizon" />
      <p className="mx-auto -mt-4 mb-8 max-w-xl text-center text-sm leading-6 text-white/70">
        Проект растёт в LH — CHINA: скоро выкуп и доставка в Россию с других крупных площадок Китая.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {MARKETPLACES.map((market) => (
          <div
            key={market.name}
            className="lg-glass flex items-center justify-between gap-4 rounded-[22px] px-5 py-4"
          >
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white">{market.name}</h3>
              <p className="mt-0.5 text-xs leading-5 text-white/60">{market.note}</p>
            </div>
            <span
              className={[
                'shrink-0 rounded-full px-3 py-1 text-[10px] font-semibold uppercase',
                market.live
                  ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                  : 'border border-white/15 text-white/60',
              ].join(' ')}
              style={{ ...MONO, letterSpacing: '0.12em' }}
            >
              {market.live ? 'Доступно' : 'Скоро'}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Footer copied from leanhustle.net: big "Контакты", arrow buttons, logo © line. */
export function SiteFooter({ bottomExtra }: { bottomExtra?: React.ReactNode }) {
  return (
    <footer id="contacts" className="border-t border-white/10">
      <div className="mx-auto w-full max-w-5xl px-5">
        <div className="grid items-center gap-10 py-14 md:grid-cols-[1fr_auto]">
          <h3
            className="uppercase text-white"
            style={{
              ...DISPLAY,
              fontWeight: 800,
              letterSpacing: '-0.015em',
              lineHeight: 0.95,
              fontSize: 'clamp(2.3rem, 8.5vw, 5.4rem)',
            }}
          >
            Контакты
          </h3>
          <div className="flex min-w-0 flex-col gap-2.5 md:min-w-[320px]">
            {CONTACTS.map((contact) => (
              <a
                key={contact.label}
                href={contact.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-5 rounded-[18px] border border-white/15 bg-white/[0.02] px-5 py-4 text-[0.8rem] font-semibold uppercase text-white transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--accent)]/10"
                style={{ ...MONO, letterSpacing: '0.12em' }}
              >
                {contact.label}
                <span className="text-[var(--accent)] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
                  ↗
                </span>
              </a>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.06] pb-10 pt-6">
          <div
            className="flex items-center gap-2.5 text-[0.7rem] text-white/45"
            style={{ ...MONO, letterSpacing: '0.06em' }}
          >
            <Image
              src="/lh-logo.webp"
              alt=""
              width={18}
              height={18}
              className="h-[18px] w-[18px] rounded-[5px]"
            />
            © 2026 Lean Hustle
          </div>
          {bottomExtra}
        </div>
      </div>
    </footer>
  );
}

/** Translucent round button that appears after scrolling and jumps to the top. */
export function ToTopButton({ className = '' }: { className?: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label="Наверх"
      title="Наверх"
      onClick={() => {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      }}
      className={['to-top', show ? 'show' : '', className].join(' ')}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 14l6-6 6 6" />
      </svg>
    </button>
  );
}

/** "Lite" toggle styled like the one on leanhustle.net. */
export function LiteSwitch({
  lite,
  onToggle,
  className = '',
}: {
  lite: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={lite}
      onClick={onToggle}
      title="Lite Version — статичный фон и меньше эффектов для слабых устройств"
      className={['lite-switch', lite ? 'on' : '', className].join(' ')}
    >
      <span className="lite-sw-track">
        <span className="lite-sw-knob" />
      </span>
      <span>Lite</span>
    </button>
  );
}
