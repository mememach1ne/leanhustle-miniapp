/**
 * USDT networks supported on Bybit. The string values are the `chainType`
 * that Bybit's V5 API expects in `coin=USDT&chainType=...` queries.
 *
 * Keep this list aligned with what Bybit's deposit-address endpoint returns
 * for USDT — if Bybit drops support for a chain, remove it here too.
 */
export enum PaymentNetwork {
  TRC20 = 'TRX',
  BEP20 = 'BSC',
  ERC20 = 'ETH',
  TON = 'TON',
  SOL = 'SOL',
  POLYGON = 'MATIC',
  ARBITRUM = 'ARBI',
  AVALANCHE = 'CAVAX',
  OPTIMISM = 'OP',
  APTOS = 'APTOS',
}

/** Human-readable label shown in pickers (RU UI). */
export const PAYMENT_NETWORK_LABELS: Record<PaymentNetwork, string> = {
  [PaymentNetwork.TRC20]: 'USDT · TRC20 (Tron) — рекомендуем',
  [PaymentNetwork.BEP20]: 'USDT · BEP20 (BSC)',
  [PaymentNetwork.ERC20]: 'USDT · ERC20 (Ethereum)',
  [PaymentNetwork.TON]: 'USDT · TON',
  [PaymentNetwork.SOL]: 'USDT · Solana',
  [PaymentNetwork.POLYGON]: 'USDT · Polygon',
  [PaymentNetwork.ARBITRUM]: 'USDT · Arbitrum One',
  [PaymentNetwork.AVALANCHE]: 'USDT · Avalanche C-Chain',
  [PaymentNetwork.OPTIMISM]: 'USDT · Optimism',
  [PaymentNetwork.APTOS]: 'USDT · Aptos',
};

/** Short tag for badges / chips. */
export const PAYMENT_NETWORK_SHORT: Record<PaymentNetwork, string> = {
  [PaymentNetwork.TRC20]: 'TRC20',
  [PaymentNetwork.BEP20]: 'BEP20',
  [PaymentNetwork.ERC20]: 'ERC20',
  [PaymentNetwork.TON]: 'TON',
  [PaymentNetwork.SOL]: 'SOL',
  [PaymentNetwork.POLYGON]: 'Polygon',
  [PaymentNetwork.ARBITRUM]: 'Arbitrum',
  [PaymentNetwork.AVALANCHE]: 'Avalanche',
  [PaymentNetwork.OPTIMISM]: 'Optimism',
  [PaymentNetwork.APTOS]: 'Aptos',
};

/** Default short-list that we surface to the user first. */
export const PAYMENT_NETWORK_DEFAULTS: PaymentNetwork[] = [
  PaymentNetwork.TRC20,
  PaymentNetwork.BEP20,
  PaymentNetwork.TON,
  PaymentNetwork.SOL,
  PaymentNetwork.POLYGON,
  PaymentNetwork.ERC20,
];
