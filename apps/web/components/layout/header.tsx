import Image from 'next/image';

export function Header({ activeTitle, subtitle }: { activeTitle: string; subtitle: string }) {
  return (
    <header className="mb-5 rounded-[28px] border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-4 shadow-[0_24px_48px_rgba(0,0,0,0.24)] backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <Image src="/logo.png" alt="Poizon" width={36} height={36} className="rounded-[10px]" priority />
        <span className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
          LEAN HUSTLE POIZON
        </span>
      </div>
      <div className="mt-3 border-t border-white/5 pt-3">
        <h1 className="text-lg font-semibold leading-tight text-white">{activeTitle}</h1>
        <p className="mt-1 text-[13px] leading-snug text-[var(--muted)]">{subtitle}</p>
      </div>
    </header>
  );
}
