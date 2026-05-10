type FeedbackTone = 'error' | 'success' | 'info';

const TONE_STYLES: Record<FeedbackTone, string> = {
  error: 'border-rose-300/20 bg-rose-400/10 text-rose-100',
  success: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100',
  info: 'border-white/10 bg-white/5 text-slate-200',
};

export function FeedbackMessage({
  children,
  tone = 'info',
  onRetry,
}: {
  children: React.ReactNode;
  tone?: FeedbackTone;
  onRetry?: () => void;
}) {
  return (
    <div className={['rounded-2xl border px-4 py-3 text-sm', TONE_STYLES[tone]].join(' ')}>
      <div>{children}</div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-[14px] border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition active:scale-[0.97]"
        >
          Попробовать снова
        </button>
      ) : null}
    </div>
  );
}
