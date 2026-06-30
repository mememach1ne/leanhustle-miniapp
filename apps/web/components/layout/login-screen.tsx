'use client';

import { SectionCard } from '../ui/section-card';
import { TelegramLoginButton } from '../ui/telegram-login-button';

/**
 * Full-screen gate shown in the browser version when there's no active
 * session. Inside Telegram this never renders (the Mini App authenticates
 * automatically via initData).
 */
export function LoginScreen() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <SectionCard>
        <div className="flex flex-col items-center gap-5 py-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand-avatar.png"
            alt="LEAN HUSTLE POIZON"
            width={80}
            height={80}
            className="h-20 w-20 rounded-2xl object-cover shadow-lg shadow-black/30"
          />
          <div>
            <h1 className="text-lg font-semibold text-white">LEAN HUSTLE POIZON</h1>
            <p className="mt-1 text-sm text-white/60">
              Заказ товаров с Poizon в Россию
            </p>
          </div>
          <p className="text-sm text-white/70">
            Войдите через Telegram, чтобы пользоваться калькулятором, корзиной и
            отслеживать заказы.
          </p>
          <TelegramLoginButton />
          <p className="text-[11px] leading-5 text-white/30">
            Мы используем только ваш Telegram-профиль для входа. Открыть можно и
            прямо в Telegram — там вход произойдёт автоматически.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
