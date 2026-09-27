'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

import { useLiteMode } from '../../lib/use-lite-mode';
import { LiquidBackground } from '../ui/liquid-background';
import { TelegramLoginButton } from '../ui/telegram-login-button';

const BOT_URL = 'https://t.me/lh_poizonbot';
const MANAGER_URL = 'https://t.me/lh_poizonmanager';
const PURCHASES_URL = 'https://t.me/lh_poizonpurchases';
const REVIEWS_URL = 'https://t.me/lh_poizonreviews';
const GUIDE_VIDEO_EMBED_URL = 'https://www.youtube.com/embed/dwVmtQGWVa8';
const GUIDE_ARTICLE_URL = 'https://telegra.ph/KAK-ZAKAZYVAT-s-POIZON-v-ROSSII-05-24';

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono-brand), ui-monospace, monospace',
};
const DISPLAY: React.CSSProperties = {
  fontFamily: 'var(--font-display), sans-serif',
};
const READABLE: React.CSSProperties = {
  textShadow: '0 1px 14px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.7)',
};

const GUIDE_STEPS = [
  {
    n: '1',
    title: 'Откройте бота в Telegram',
    text: 'Нажмите «Открыть бота» и «Запустить» — приложение откроется прямо в Telegram, без паролей и регистраций.',
  },
  {
    n: '2',
    title: 'Вставьте ссылку на товар',
    text: 'Скопируйте ссылку из приложения Poizon — покажем карточку, размеры и точную цену с доставкой.',
  },
  {
    n: '3',
    title: 'Оформите и оплатите',
    text: 'Добавьте в корзину и оплатите USDT — мы выкупим товар и привезём его в Россию.',
  },
] as const;

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

/**
 * Browser landing for visitors outside Telegram. Instead of a Telegram
 * OAuth login (which reads as phishing to most people) it sends them to
 * the bot, where the Mini App opens with automatic auth. Styled after the
 * main site leanhustle.net: continuous liquid background, liquid-glass
 * cards, Lite switch, scroll-to-top button and the same footer. A small
 * "Вход на сайте" link in the footer keeps the web login for staff.
 */
export function LoginScreen() {
  const { lite, ready, toggle } = useLiteMode();
  const [showToTop, setShowToTop] = useState(false);
  const [showWebLogin, setShowWebLogin] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowToTop(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <div className="relative isolate min-h-screen text-white">
      {/* One continuous background for the whole page. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10" style={{ background: '#060c16' }}>
        {ready && !lite ? (
          <LiquidBackground />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(90% 60% at 20% 10%, rgba(41,195,197,0.28), transparent 60%), radial-gradient(80% 60% at 85% 70%, rgba(31,168,170,0.22), transparent 60%), linear-gradient(180deg, #0a1a24, #060c16)',
            }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(6,12,22,0.55), rgba(6,12,22,0.45) 40%, rgba(6,12,22,0.6)), radial-gradient(125% 80% at 50% 38%, transparent 42%, rgba(6,12,22,0.55))',
          }}
        />
      </div>

      {/* Lite switch — top right corner, like on leanhustle.net. */}
      <div className="fixed right-4 top-4 z-[130]">
        <button
          type="button"
          role="switch"
          aria-checked={lite}
          onClick={toggle}
          title="Lite Version — статичный фон и меньше эффектов для слабых устройств"
          className={['lite-switch', lite ? 'on' : ''].join(' ')}
        >
          <span className="lite-sw-track">
            <span className="lite-sw-knob" />
          </span>
          <span>Lite</span>
        </button>
      </div>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section
        id="top"
        className="relative flex min-h-screen w-full flex-col items-center justify-center px-5 py-16 text-center"
      >
        <div className="flex w-full max-w-2xl flex-col items-center gap-6">
          <span
            className="inline-flex items-center gap-3 text-[0.72rem] font-semibold uppercase text-[var(--accent)]"
            style={{ ...MONO, letterSpacing: '0.22em' }}
          >
            <span className="h-px w-7 bg-[var(--accent)] sm:w-10" />
            Poizon в Россию
            <span className="h-px w-7 bg-[var(--accent)] sm:w-10" />
          </span>

          <h1
            className="lh-wordmark uppercase"
            style={{
              ...DISPLAY,
              fontWeight: 800,
              lineHeight: 0.9,
              letterSpacing: '-0.01em',
              fontSize: 'clamp(2.6rem, 11vw, 6.5rem)',
            }}
          >
            Lean Hustle
            <br />
            Poizon
          </h1>

          <p className="max-w-md text-sm font-medium leading-6 text-white" style={READABLE}>
            Заказывай оригинальные товары с Poizon в Россию: рассчитывай стоимость, собирай корзину
            и отслеживай заказы прямо в Telegram.
          </p>

          <a
            href={BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="lg-accent-button mt-2 inline-flex h-14 w-full max-w-xs items-center justify-center gap-2 rounded-full text-base font-bold transition active:scale-[0.98]"
            style={DISPLAY}
          >
            Открыть бота
            <span aria-hidden>↗</span>
          </a>

          <div className="flex w-full max-w-xs gap-2">
            <GlassLink href={PURCHASES_URL}>Выкупы</GlassLink>
            <GlassLink href={REVIEWS_URL}>Отзывы</GlassLink>
          </div>
        </div>

        <a href="#guide" className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <span
            className="lg-glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-semibold uppercase text-white/70 transition hover:text-[var(--accent)]"
            style={{ ...MONO, letterSpacing: '0.18em' }}
          >
            Инструкция
            <span className="animate-bounce">↓</span>
          </span>
        </a>
      </section>

      {/* ── Guide ────────────────────────────────────────────── */}
      <section id="guide" className="mx-auto w-full max-w-4xl px-5 py-16 lg:py-20">
        <SectionHead kicker="Инструкция" title="Как это работает" />

        <div className="grid gap-4 sm:grid-cols-3">
          {GUIDE_STEPS.map((step) => (
            <div key={step.n} className="lg-glass rounded-[24px] p-5">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-[var(--accent)]/15 text-sm font-semibold text-[var(--accent)]">
                {step.n}
              </div>
              <h3 className="mt-3 text-sm font-semibold text-white">{step.title}</h3>
              <p className="mt-1 text-xs leading-5 text-white/65">{step.text}</p>
            </div>
          ))}
        </div>

        <div className="lg-glass mt-8 overflow-hidden rounded-[28px] p-1.5">
          <iframe
            className="aspect-video w-full rounded-[22px]"
            src={GUIDE_VIDEO_EMBED_URL}
            title="Видео-инструкция: как заказывать с Poizon в Россию"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <GlassLink href={GUIDE_ARTICLE_URL} wide>
            Текстовая инструкция
          </GlassLink>
          <a
            href={BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="lg-accent-button w-full rounded-full px-6 py-3 text-center text-sm font-bold transition hover:opacity-90 sm:w-auto"
          >
            Открыть бота ↗
          </a>
        </div>
      </section>

      {/* ── Other marketplaces ───────────────────────────────── */}
      <section id="marketplaces" className="mx-auto w-full max-w-4xl px-5 pb-16 lg:pb-20">
        <SectionHead kicker="LH — China" title="Не только Poizon" />
        <p className="mx-auto -mt-4 mb-8 max-w-xl text-center text-sm leading-6 text-white/70">
          Проект растёт в LH — CHINA: скоро выкуп и доставка в Россию с других крупных площадок
          Китая.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {MARKETPLACES.map((market) => (
            <div key={market.name} className="lg-glass flex items-center justify-between gap-4 rounded-[22px] px-5 py-4">
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

      {/* ── Footer (same as leanhustle.net) ──────────────────── */}
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
              <Image src="/lh-logo.webp" alt="" width={18} height={18} className="h-[18px] w-[18px] rounded-[5px]" />
              © 2026 Lean Hustle
            </div>
            <button
              type="button"
              onClick={() => setShowWebLogin((v) => !v)}
              className="text-[0.7rem] text-white/30 transition hover:text-white/60"
              style={{ ...MONO, letterSpacing: '0.06em' }}
            >
              Вход на сайте
            </button>
          </div>

          {showWebLogin ? (
            <div className="flex justify-end pb-10">
              <TelegramLoginButton />
            </div>
          ) : null}
        </div>
      </footer>

      <button
        type="button"
        aria-label="Наверх"
        title="Наверх"
        onClick={scrollToTop}
        className={['to-top', showToTop ? 'show' : ''].join(' ')}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 14l6-6 6 6" />
        </svg>
      </button>
    </div>
  );
}

function SectionHead({ kicker, title }: { kicker: string; title: string }) {
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

function GlassLink({
  href,
  children,
  wide = false,
}: {
  href: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        'lg-glass flex items-center justify-center gap-1.5 rounded-full px-5 py-3 text-sm font-semibold text-white transition hover:border-[var(--accent)]/40',
        wide ? 'w-full sm:w-auto' : 'flex-1',
      ].join(' ')}
    >
      {children}
      <span aria-hidden className="text-[var(--accent)]">
        ↗
      </span>
    </a>
  );
}
