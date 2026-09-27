'use client';

import { useEffect, useState } from 'react';

import { LiquidBackground } from '../ui/liquid-background';

/**
 * Dim, ambient version of the login liquid background, painted behind the
 * whole app to give the desktop site some life. Mounted only on desktop
 * (lg+) so the WebGL loop never runs inside the narrow Telegram Mini App or
 * on phones, where it would just drain the battery.
 *
 * Sits at -z-10 inside the app shell's isolated stacking context, so it
 * covers the flat page background but stays behind all content.
 */
export function AmbientBackground() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  if (!isDesktop) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={{ background: '#060c16' }}
    >
      <LiquidBackground opacity={0.32} />
      {/* Extra darkening + vignette so the liquid stays a whisper behind
          the content instead of competing with it. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(6,12,22,0.55), rgba(6,12,22,0.66) 40%, rgba(6,12,22,0.78)), radial-gradient(120% 90% at 50% 30%, transparent 45%, rgba(6,12,22,0.6))',
        }}
      />
    </div>
  );
}
