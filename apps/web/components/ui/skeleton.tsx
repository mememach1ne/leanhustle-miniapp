export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={[
        'animate-pulse rounded-2xl bg-white/[0.06]',
        className,
      ].join(' ')}
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="rounded-[28px] border border-[var(--surface-border)] bg-[var(--surface)] p-5">
      <div className="flex gap-3">
        <Skeleton className="h-20 w-20 shrink-0 rounded-[26px] sm:h-24 sm:w-24" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-3/4 rounded-lg" />
          <Skeleton className="h-3 w-1/2 rounded-lg" />
          <Skeleton className="h-3 w-1/3 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function OrderCardSkeleton() {
  return (
    <div className="rounded-[28px] border border-[var(--surface-border)] bg-[var(--surface)] p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24 rounded-lg" />
          <Skeleton className="h-4 w-32 rounded-lg" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-14 w-14 shrink-0 rounded-[20px]" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-3/4 rounded-lg" />
          <Skeleton className="h-3 w-1/2 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function CartItemSkeleton() {
  return (
    <div className="rounded-[28px] border border-[var(--surface-border)] bg-[var(--surface)] p-5">
      <div className="flex gap-3">
        <Skeleton className="h-20 w-20 shrink-0 rounded-[26px]" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-3/4 rounded-lg" />
          <Skeleton className="h-3 w-1/2 rounded-lg" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-full rounded-lg" />
        <Skeleton className="h-3 w-2/3 rounded-lg" />
        <Skeleton className="h-11 w-full rounded-[18px]" />
      </div>
    </div>
  );
}
