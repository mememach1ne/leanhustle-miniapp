const parseCsv = (value?: string): string[] => {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export default () => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    host: process.env.API_HOST ?? '0.0.0.0',
    port: Number(process.env.API_PORT ?? process.env.PORT ?? 3001),
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  },
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    privateChannelId: process.env.PRIVATE_CHANNEL_ID ?? '',
    authMaxAgeSeconds: Number(process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS ?? 300),
    miniAppUrl: process.env.TELEGRAM_MINI_APP_URL ?? '',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET ?? '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  },
  integrations: {
    // Dewu / Poizon product API (via dajisaas.com). The previous RapidAPI
    // provider stopped working and we migrated to a Chinese OpenAPI gateway.
    // Auth is appKey + appSecret in query params (no headers).
    dewuApiHost: process.env.DEWU_API_HOST ?? 'openapi.dajisaas.com',
    dewuApiAppKey: process.env.DEWU_API_APP_KEY ?? '',
    dewuApiAppSecret: process.env.DEWU_API_APP_SECRET ?? '',
    dewuApiProductEndpoint:
      process.env.DEWU_API_PRODUCT_ENDPOINT ?? '/poizon/product/queryDetail',
    dw4ResolverUrl: process.env.DW4_RESOLVER_URL ?? '',
  },
  notifications: {
    managerTelegramIds: parseCsv(process.env.MANAGER_TELEGRAM_IDS),
  },
  bot: {
    internalApiToken: process.env.BOT_INTERNAL_API_TOKEN ?? '',
  },
  seed: {
    adminTelegramIds: parseCsv(process.env.SEED_ADMIN_TELEGRAM_IDS),
    adminUsernames: parseCsv(process.env.SEED_ADMIN_USERNAMES),
    managerTelegramIds: parseCsv(process.env.SEED_MANAGER_TELEGRAM_IDS),
    managerUsernames: parseCsv(process.env.SEED_MANAGER_USERNAMES),
  },
});
