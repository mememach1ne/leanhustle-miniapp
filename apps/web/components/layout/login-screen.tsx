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
    <div
      className="relative isolate flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-5 py-12 text-center"
      style={{ background: '#060c16' }}
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

        <div className="mt-2 w-full max-w-xs">
          <TelegramLoginButton />
        </div>

        <p
          className="mt-2 text-xs leading-5 text-white/70"
          style={{ textShadow: '0 1px 12px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.7)' }}
        >
          Вход только через Telegram. Можно открыть и прямо в Telegram — там
          авторизация произойдёт автоматически.
        </p>
      </div>
    </div>
  );
}
