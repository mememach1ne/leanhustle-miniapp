import Image from 'next/image';

export function Header() {
  return (
    <header className="lg-surface-strong mb-5 rounded-[28px] px-4 py-4">
      <div className="flex items-center gap-3">
        <Image
          src="/lh-logo.webp"
          alt="Lean Hustle Poizon"
          width={36}
          height={36}
          className="h-9 w-9 shrink-0 rounded-[10px] object-cover"
          priority
        />
        <span className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
          LEAN HUSTLE POIZON
        </span>
      </div>
    </header>
  );
}
