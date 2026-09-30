export type Marketplace = 'poizon' | 'taobao' | '1688' | '95' | 'goofish' | 'pinduoduo';

const CJK_FONT = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';

/**
 * Simplified app-icon style avatars for Chinese marketplaces, drawn inline
 * like NetworkLogo (brand colour + mark), so no external images are needed.
 */
function Mark({ marketplace }: { marketplace: Marketplace }) {
  switch (marketplace) {
    case 'poizon':
      return (
        <>
          <rect width="32" height="32" rx="9" fill="#01C2C3" />
          <text x="16" y="21.5" textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff" fontFamily={CJK_FONT}>
            得
          </text>
        </>
      );
    case 'taobao':
      return (
        <>
          <rect width="32" height="32" rx="9" fill="#FF5000" />
          <text x="16" y="21.5" textAnchor="middle" fontSize="16" fontWeight="800" fill="#fff" fontFamily={CJK_FONT}>
            淘
          </text>
        </>
      );
    case '1688':
      return (
        <>
          <rect width="32" height="32" rx="9" fill="#FF6A00" />
          <text x="16" y="20" textAnchor="middle" fontSize="10" fontWeight="800" fill="#fff" fontFamily="Arial,sans-serif">
            1688
          </text>
        </>
      );
    case '95':
      return (
        <>
          <rect width="32" height="32" rx="9" fill="#111" />
          <text x="16" y="21.5" textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff" fontFamily="Arial,sans-serif">
            95
          </text>
        </>
      );
    case 'goofish':
      return (
        <>
          <rect width="32" height="32" rx="9" fill="#FFE60F" />
          <text x="16" y="21.5" textAnchor="middle" fontSize="16" fontWeight="800" fill="#1a1a1a" fontFamily={CJK_FONT}>
            鱼
          </text>
        </>
      );
    case 'pinduoduo':
      return (
        <>
          <rect width="32" height="32" rx="9" fill="#E02E24" />
          <path
            d="M16 24.5s-7.5-4.6-7.5-10a4.2 4.2 0 0 1 7.5-2.6 4.2 4.2 0 0 1 7.5 2.6c0 5.4-7.5 10-7.5 10z"
            fill="#fff"
          />
        </>
      );
  }
}

export function MarketplaceLogo({
  marketplace,
  className = 'h-5 w-5',
}: {
  marketplace: Marketplace;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <Mark marketplace={marketplace} />
    </svg>
  );
}
