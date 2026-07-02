'use client';

import { LiquidBackground } from '../ui/liquid-background';
import { SectionCard } from '../ui/section-card';
import { TelegramLoginButton } from '../ui/telegram-login-button';

const GUIDE_VIDEO_EMBED_URL = 'https://www.youtube.com/embed/dwVmtQGWVa8';
const GUIDE_ARTICLE_URL =
  'https://telegra.ph/KAK-ZAKAZYVAT-s-POIZON-v-ROSSII-05-24';

const GUIDE_STEPS = [
  {
    n: '1',
    title: 'Войдите через Telegram',
    text: 'Никаких паролей и регистраций — аккаунт создаётся автоматически по вашему Telegram.',
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

/**
 * Full-screen browser login gate + landing. The hero (liquid background,
 * chrome wordmark, Telegram login) fills the first viewport; scrolling down
 * reveals a "Как это работает" guide section with the YouTube walkthrough
 * and the Telegraph article. Inside Telegram this never renders (the Mini
 * App authenticates automatically).
 */
export function LoginScreen() {
  return (
    <div style={{ background: '#060c16' }}>
      {/* ── Hero / login ─────────────────────────────────────── */}
      <section
        id="login"
        className="relative isolate flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-5 py-12 text-center"
      >
        {/* Animated liquid background (opaque, covers the screen) */}
        <LiquidBackground />

        {/* Darkening + vignette overlay so the text stays legible, mirroring
            the main site's #shade layer. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              'linear-gradient(180deg, rgba(6,12,22,0.78), rgba(6,12,22,0.34) 16%, rgba(6,12,22,0.34) 76%, rgba(6,12,22,0.90)), radial-gradient(125% 80% at 50% 38%, transparent 42%, rgba(6,12,22,0.66))',
          }}
        />

        <div className="relative z-10 flex w-full max-w-2xl flex-col items-center gap-6">
          {/* Kicker / tagline with hairlines */}
          <span
            className="inline-flex items-center gap-3 text-[0.72rem] font-semibold uppercase text-[var(--accent)]"
            style={{
              fontFamily: 'var(--font-mono-brand), ui-monospace, monospace',
              letterSpacing: '0.22em',
            }}
          >
            <span className="h-px w-7 bg-[var(--accent)] sm:w-10" />
            Poizon в Россию
            <span className="h-px w-7 bg-[var(--accent)] sm:w-10" />
          </span>

          {/* Animated chrome wordmark */}
          <h1
            className="lh-wordmark uppercase"
            style={{
              fontFamily: 'var(--font-display), sans-serif',
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

          <p
            className="max-w-md text-sm font-medium leading-6 text-white"
            style={{ textShadow: '0 1px 14px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.7)' }}
          >
            Заказывай товары с Poizon в Россию: рассчитывай стоимость, собирай
            корзину и отслеживай заказы.
          </p>

          {/* Login */}
          <div className="mt-2 w-full max-w-xs">
            <TelegramLoginButton />
          </div>

          <p
            className="mt-2 text-xs leading-5 text-white/70"
            style={{ textShadow: '0 1px 12px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.7)' }}
          >
            Вход только через Telegram. Можно открыть и{' '}
            <a
              href="https://t.me/lh_poizonbot"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline"
            >
              прямо в Telegram
            </a>{' '}
            — там авторизация произойдёт автоматически.
          </p>
        </div>

        {/* Scroll hint to the guide section */}
        <a
          href="#guide"
          className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2"
        >
          <span
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase text-white/70 backdrop-blur-xl transition hover:border-[var(--accent)]/40 hover:text-[var(--accent)]"
            style={{
              fontFamily: 'var(--font-mono-brand), ui-monospace, monospace',
              letterSpacing: '0.18em',
            }}
          >
            Инструкция
            <span className="animate-bounce">↓</span>
          </span>
        </a>
      </section>

      {/* ── Guide / how it works ─────────────────────────────── */}
      <section id="guide" className="mx-auto w-full max-w-4xl px-5 py-16 lg:py-20">
        <div className="mb-10 text-center">
          <span
            className="inline-flex items-center gap-3 text-[0.72rem] font-semibold uppercase text-[var(--accent)]"
            style={{
              fontFamily: 'var(--font-mono-brand), ui-monospace, monospace',
              letterSpacing: '0.22em',
            }}
          >
            <span className="h-px w-7 bg-[var(--accent)]" />
            Инструкция
            <span className="h-px w-7 bg-[var(--accent)]" />
          </span>
          <h2
            className="mt-4 text-3xl font-bold uppercase text-white sm:text-4xl"
            style={{
              fontFamily: 'var(--font-display), sans-serif',
              letterSpacing: '-0.01em',
            }}
          >
            Как это работает
          </h2>
        </div>

        {/* Steps */}
        <div className="grid gap-4 sm:grid-cols-3">
          {GUIDE_STEPS.map((step) => (
            <SectionCard key={step.n}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)]/15 text-sm font-semibold text-[var(--accent)]">
                {step.n}
              </div>
              <h3 className="mt-3 text-sm font-semibold text-white">{step.title}</h3>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{step.text}</p>
            </SectionCard>
          ))}
        </div>

        {/* Video walkthrough */}
        <div className="mt-8 overflow-hidden rounded-[28px] border border-white/10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]">
          <iframe
            className="aspect-video w-full"
            src={GUIDE_VIDEO_EMBED_URL}
            title="Видео-инструкция: как заказывать с Poizon в Россию"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>

        {/* CTA row */}
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={GUIDE_ARTICLE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-[18px] border border-white/15 bg-white/5 px-6 py-3 text-center text-sm font-semibold text-white backdrop-blur-xl transition hover:bg-white/10 sm:w-auto"
          >
            Текстовая инструкция
          </a>
          <a
            href="#login"
            className="w-full rounded-[18px] bg-[var(--accent)] px-6 py-3 text-center text-sm font-semibold text-slate-950 transition hover:opacity-90 sm:w-auto"
          >
            Войти через Telegram
          </a>
        </div>
      </section>
    </div>
  );
}
