import { PaymentNetwork } from '@lean-poizon/shared';

const diamond = (cx: number, cy: number, r: number) =>
  `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;

function Mark({ network }: { network: PaymentNetwork }) {
  switch (network) {
    case PaymentNetwork.TRC20:
      return (
        <>
          <circle cx="16" cy="16" r="16" fill="#EF0027" />
          <g fill="none" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round">
            <polygon points="8.5,8.5 24,12 14.8,25" />
            <polyline points="8.5,8.5 18,16 24,12" />
            <line x1="18" y1="16" x2="14.8" y2="25" />
          </g>
        </>
      );
    case PaymentNetwork.BEP20:
      return (
        <>
          <circle cx="16" cy="16" r="16" fill="#F3BA2F" />
          <g fill="#fff">
            <polygon points={diamond(16, 16, 2.6)} />
            <polygon points={diamond(16, 9.4, 2.6)} />
            <polygon points={diamond(16, 22.6, 2.6)} />
            <polygon points={diamond(9.4, 16, 2.6)} />
            <polygon points={diamond(22.6, 16, 2.6)} />
          </g>
        </>
      );
    case PaymentNetwork.ERC20:
      return (
        <>
          <circle cx="16" cy="16" r="16" fill="#627EEA" />
          <polygon points="16,5 23,16.3 16,20.4 9,16.3" fill="#fff" />
          <polygon points="16,21.8 23,17.7 16,27 9,17.7" fill="#fff" fillOpacity="0.75" />
        </>
      );
    case PaymentNetwork.TON:
      return (
        <>
          <circle cx="16" cy="16" r="16" fill="#0098EA" />
          <path
            d="M10.4 10h11.2c1 0 1.6 1.1 1.1 1.9l-5.9 10.3c-.4.7-1.4.7-1.8 0l-5.7-10.3c-.5-.8.1-1.9 1.1-1.9zM16 10v12.8"
            fill="none"
            stroke="#fff"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </>
      );
    case PaymentNetwork.SOL:
      return (
        <>
          <defs>
            <linearGradient id="sol-g" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#9945FF" />
              <stop offset="1" stopColor="#14F195" />
            </linearGradient>
          </defs>
          <circle cx="16" cy="16" r="16" fill="#101014" />
          <g fill="url(#sol-g)">
            <polygon points="11,9 25,9 21.5,12 7.5,12" />
            <polygon points="7.5,14.5 21.5,14.5 25,17.5 11,17.5" />
            <polygon points="11,20 25,20 21.5,23 7.5,23" />
          </g>
        </>
      );
    case PaymentNetwork.POLYGON:
      return (
        <>
          <circle cx="16" cy="16" r="16" fill="#8247E5" />
          <g fill="none" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round">
            <polygon points="12.5,11 16.83,13.5 16.83,18.5 12.5,21 8.17,18.5 8.17,13.5" />
            <polygon points="19.5,11 23.83,13.5 23.83,18.5 19.5,21 15.17,18.5 15.17,13.5" />
          </g>
        </>
      );
    case PaymentNetwork.ARBITRUM:
      return (
        <>
          <circle cx="16" cy="16" r="16" fill="#213147" />
          <path
            d="M16 6.5l8.2 4.75v9.5L16 25.5l-8.2-4.75v-9.5z"
            fill="none"
            stroke="#fff"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M14.6 11.5l-4 10.5M17.8 11.5l4.8 10.5" stroke="#28A0F0" strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case PaymentNetwork.AVALANCHE:
      return (
        <>
          <circle cx="16" cy="16" r="16" fill="#E84142" />
          <path
            d="M13.9 23.5H9c-.8 0-1.3-.9-.9-1.6l7.1-12.3c.4-.7 1.4-.7 1.8 0l1.5 2.6c.3.5.3 1.1 0 1.6l-4.6 9.7zM19.6 23.5h3.4c.8 0 1.3-.9.9-1.6l-1.7-3c-.4-.7-1.4-.7-1.8 0l-1.7 3c-.4.7.1 1.6.9 1.6z"
            fill="#fff"
          />
        </>
      );
    case PaymentNetwork.OPTIMISM:
      return (
        <>
          <circle cx="16" cy="16" r="16" fill="#FF0420" />
          <text
            x="16"
            y="20"
            textAnchor="middle"
            fill="#fff"
            fontSize="11"
            fontWeight="800"
            fontStyle="italic"
            fontFamily="Arial, Helvetica, sans-serif"
          >
            OP
          </text>
        </>
      );
    case PaymentNetwork.APTOS:
      return (
        <>
          <circle cx="16" cy="16" r="16" fill="#0B0B0F" />
          <g stroke="#fff" strokeWidth="1.8" strokeLinecap="round">
            <path d="M9.5 11.5h7.5M19.5 11.5h3" />
            <path d="M8 15h5M15.5 15h8.5" />
            <path d="M8 18.5h10M20.5 18.5h3.5" />
            <path d="M9.5 22h3M15 22h7.5" />
          </g>
        </>
      );
    default:
      return <circle cx="16" cy="16" r="16" fill="#26A17B" />;
  }
}

export function NetworkLogo({
  network,
  className,
}: {
  network: PaymentNetwork;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <Mark network={network} />
    </svg>
  );
}
