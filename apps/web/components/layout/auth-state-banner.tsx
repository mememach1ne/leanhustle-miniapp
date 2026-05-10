'use client';

import { useAuthStore } from '../../store/auth-store';

export function AuthStateBanner() {
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);

  if (status === 'idle' || status === 'authenticated') {
    return null;
  }

  const isFallback = status === 'fallback';

  return (
    <div
      className={[
        'mb-4 rounded-3xl border p-4 text-sm backdrop-blur-xl',
        isFallback
          ? 'border-amber-300/20 bg-amber-400/10 text-amber-100'
          : 'border-rose-300/20 bg-rose-400/10 text-rose-100',
      ].join(' ')}
    >
      <p className="font-medium">{isFallback ? 'Dev fallback режим' : 'Ошибка авторизации'}</p>
      <p className="mt-2 leading-6 text-white/80">{error}</p>
    </div>
  );
}
