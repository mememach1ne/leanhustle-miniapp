/* eslint-disable @next/next/no-img-element -- tiny static icons, no optimisation needed */
export type Marketplace = 'poizon' | 'taobao' | '1688' | '95' | 'goofish' | 'pinduoduo';

/**
 * Official app icons of the Chinese marketplaces (128px, from the App Store
 * listings), stored in public/marketplaces and rounded like app icons.
 */
export function MarketplaceLogo({
  marketplace,
  className = 'h-5 w-5',
}: {
  marketplace: Marketplace;
  className?: string;
}) {
  return (
    <img
      src={`/marketplaces/${marketplace}.png`}
      alt=""
      aria-hidden
      loading="lazy"
      decoding="async"
      className={`${className} rounded-[22%] object-cover`}
    />
  );
}
