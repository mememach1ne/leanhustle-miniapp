'use client';

import { LiquidBackground } from '../ui/liquid-background';
import { TelegramLoginButton } from '../ui/telegram-login-button';

/**
 * Full-screen browser login gate, modelled on the main site (leanhustle.net)
 * hero: a WebGL liquid background, a spaced mono kicker with hairlines, and a
 * large animated "chrome" wordmark — recoloured to the Poizon teal palette
 * (the site uses purple). Inside Telegram this never renders.
 */
export function LoginScreen() {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-5 py-12 text-center">
      {/* Animated liquid background (opaque, covers the screen) */}
      <LiquidBackground />

      {/* Darkening + vignette overlay so the text stays legible, mirroring
          the main site's #shade layer. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            'linear-gradient(180deg, rgba(5,10,20,0.82), rgba(5,10,20,0.42) 16%, rgba(5,10,20,0.42) 74%, rgba(5,10,20,0.92)), radial-gradient(125% 80% at 50% 38%, transparent 40%, rgba(5,10,20,0.7))',
        }}
      />

      <div className="relative flex w-full max-w-2xl flex-col items-center gap-6">
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

        <p className="max-w-md text-sm leading-6 text-white/70">
          Заказывай товары с Poizon в Россию: рассчитывай стоимость, собирай
          корзину и отслеживай заказы.
        </p>

        <div className="mt-2 w-full max-w-xs">
          <TelegramLoginButton />
        </div>

        <p className="mt-2 text-[11px] leading-5 text-white/35">
          Вход только через Telegram. Можно открыть и прямо в Telegram — там
          авторизация произойдёт автоматически.
        </p>
      </div>
    </div>
  );
}
