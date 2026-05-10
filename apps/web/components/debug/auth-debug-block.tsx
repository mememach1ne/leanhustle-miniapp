'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { useAuthStore } from '../../store/auth-store';

const isDevelopment = process.env.NODE_ENV === 'development';

const formatBoolean = (value: boolean) => (value ? 'true' : 'false');

const getDebugAdminTelegramIds = () =>
  (process.env.NEXT_PUBLIC_AUTH_DEBUG_ADMIN_TELEGRAM_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

function AuthDebugBlockContent() {
  const searchParams = useSearchParams();
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const error = useAuthStore((state) => state.error);
  const authDebug = useAuthStore((state) => state.authDebug);

  const debugAdminTelegramIds = getDebugAdminTelegramIds();
  const isDebugRequested = isDevelopment || searchParams.get('debug') === '1';
  const isAdminAllowed =
    Boolean(user?.telegramId) && debugAdminTelegramIds.includes(String(user?.telegramId));
  const isVisible = isDebugRequested && isAdminAllowed;

  if (!isVisible) {
    return null;
  }

  return (
    <div className="rounded-[24px] border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-50">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Debug Auth</p>
          <p className="mt-1 text-xs text-amber-100/80">
            Показывается только admin ID из env и только в development или при `?debug=1`
          </p>
        </div>
        <span className="rounded-full border border-amber-200/20 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-amber-100/70">
          Safe
        </span>
      </div>

      <div className="mt-4 space-y-2 text-xs text-amber-50/90">
        <DebugRow
          label="window.Telegram"
          value={formatBoolean(authDebug.hasTelegramObject)}
        />
        <DebugRow
          label="Telegram.WebApp"
          value={formatBoolean(authDebug.hasWebAppObject)}
        />
        <DebugRow
          label="WebApp.initData"
          value={formatBoolean(authDebug.hasInitData)}
        />
        <DebugRow label="initData length" value={String(authDebug.initDataLength)} />
        <DebugRow
          label="initDataUnsafe.user"
          value={formatBoolean(authDebug.hasInitDataUnsafeUser)}
        />
        <DebugRow
          label="API base URL"
          value={process.env.NEXT_PUBLIC_API_BASE_URL ?? '/backend-api'}
        />
        <DebugRow label="Auth status" value={status} />
        <DebugRow label="Auth error" value={error ?? '—'} />
        <DebugRow
          label="POST /auth/telegram"
          value={formatBoolean(authDebug.authRequestStarted)}
        />
        <DebugRow
          label="Auth status code"
          value={
            authDebug.authRequestStatusCode !== undefined
              ? String(authDebug.authRequestStatusCode)
              : '—'
          }
        />
        <DebugRow
          label="Auth response message"
          value={authDebug.authRequestMessage ?? '—'}
        />
      </div>
    </div>
  );
}

export function AuthDebugBlock() {
  return (
    <Suspense fallback={null}>
      <AuthDebugBlockContent />
    </Suspense>
  );
}

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[16px] border border-white/8 bg-black/10 px-3 py-2">
      <span className="text-amber-100/70">{label}</span>
      <span className="max-w-[58%] break-all text-right font-medium text-white">{value}</span>
    </div>
  );
}
