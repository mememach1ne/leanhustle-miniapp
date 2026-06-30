'use client';

import { TelegramLoginButton } from '../ui/telegram-login-button';

/**
 * Full-screen browser login gate, styled like the brand's main site hero:
 * a glowing centred logo, a spaced uppercase tagline, a large gradient
 * wordmark, then the Telegram login button. Uses the project's dark +
 * teal-accent palette rather than the site's purple.
 *
 * Inside Telegram this never renders (the Mini App auto-authenticates).
 */
export function LoginScreen() {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-5 py-12">
      {/* Ambient background glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[28%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
        style={{
          background:
            'radial-gradient(circle, rgba(41,195,197,0.30) 0%, rgba(124,58,237,0.18) 45%, transparent 70%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/2 h-[260px] w-[520px] -translate-x-1/2 translate-y-1/3 rounded-full blur-[120px]"
        style={{
          background:
            'radial-gradient(circle, rgba(124,58,237,0.20) 0%, transparent 70%)',
        }}
      />

      <div className="relative flex w-full max-w-sm flex-col items-center text-center">
        {/* Hero logo with a soft glow ring */}
        <div className="relative mb-7">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 rounded-full blur-2xl"
            style={{ background: 'radial-gradient(circle, rgba(41,195,197,0.45), transparent 70%)' }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand-avatar.png"
            alt="LEAN HUSTLE POIZON"
            width={132}
            height={132}
            className="h-[132px] w-[132px] object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
          />
        </div>

        {/* Tagline with dash decorations */}
        <div className="mb-3 flex items-center gap-3">
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-[var(--accent)]/60" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--accent)]">
            Poizon в Россию
          </span>
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-[var(--accent)]/60" />
        </div>

        {/* Gradient wordmark */}
        <h1 className="bg-gradient-to-b from-white via-white to-[var(--accent)] bg-clip-text text-4xl font-extrabold leading-[1.05] tracking-tight text-transparent sm:text-5xl">
          LEAN HUSTLE
          <br />
          POIZON
        </h1>

        <p className="mt-4 max-w-xs text-sm leading-6 text-white/60">
          Заказывай товары с Poizon в Россию: рассчитывай стоимость, собирай
          корзину и отслеживай заказы.
        </p>

        {/* Login */}
        <div className="mt-8 w-full">
          <TelegramLoginButton />
        </div>

        <p className="mt-6 text-[11px] leading-5 text-white/30">
          Вход только через Telegram. Можно открыть и прямо в Telegram — там
          авторизация произойдёт автоматически.
        </p>
      </div>
    </div>
  );
}
