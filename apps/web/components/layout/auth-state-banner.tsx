'use client';

import { useAuthStore } from '../../store/auth-store';

export function AuthStateBanner() {
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);

  if (status === 'idle' || status === 'authenticated') {
    return null;
  }

  const isWarning = status === 'loading' || status === 'fallback';

  let title: string;
  if (status === 'loading') {
    title = 'Ожидание авторизации...';
  } else if (status === 'fallback') {
    title = 'Dev fallback режим';
  } else {
    title = 'Ошибка авторизации';
  }

  return (
    <div
      className={[
        'mb-4 rounded-3xl border p-4 text-sm backdrop-blur-xl',
        isWarning
          ? 'border-amber-300/20 bg-amber-400/10 text-amber-100'
          : 'border-rose-300/20 bg-rose-400/10 text-rose-100',
      ].join(' ')}
    >
      <p className="font-medium">{title}</p>
      {error ? <p className="mt-2 leading-6 text-white/80">{error}</p> : null}
    </div>
  );
}
