'use client';

import { useLiteMode } from '../../lib/use-lite-mode';
import { LiquidBackground } from '../ui/liquid-background';
import { BotLoginButton } from './bot-login-button';
import {
  LiteSwitch,
  MarketplacesSection,
  PURCHASES_URL,
  REVIEWS_URL,
  SectionHead,
  SiteFooter,
  ToTopButton,
} from './site-footer';
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
    title: 'Войдите через Telegram',
    text: 'Нажмите «Войти через Telegram», подпишитесь на канал в боте — и вход на сайт произойдёт сам, без паролей.',
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
 * Browser landing for visitors outside Telegram. Instead of the Telegram
 * OAuth popup (which reads as phishing to most people) login goes through
 * the bot — see BotLoginButton. Styled after the
 * main site leanhustle.net: continuous liquid background, liquid-glass
 * cards, Lite switch, scroll-to-top button and the same footer.
 */
export function LoginScreen() {
  const { lite, ready, toggle } = useLiteMode();

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
        <LiteSwitch lite={lite} onToggle={toggle} />
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
            Заказывайте оригинальные товары с Poizon в Россию: рассчитывайте стоимость, собирайте
            корзину и отслеживайте заказы прямо в Telegram.
          </p>

          <BotLoginButton className="mt-2 max-w-xs" />

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
            href="#top"
            className="lg-accent-button w-full rounded-full px-6 py-3 text-center text-sm font-bold transition hover:opacity-90 sm:w-auto"
          >
            Войти через Telegram
          </a>
        </div>
      </section>

      <MarketplacesSection />

      <SiteFooter />

      <ToTopButton />
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
