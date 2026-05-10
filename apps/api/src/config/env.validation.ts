type EnvShape = Record<string, unknown>;

const asString = (value: unknown): string => {
  return typeof value === 'string' ? value : '';
};

export function validateEnv(config: EnvShape) {
  const errors: string[] = [];
  const nodeEnv = asString(config.NODE_ENV) || 'development';
  const databaseUrl = asString(config.DATABASE_URL);
  const telegramBotToken = asString(config.TELEGRAM_BOT_TOKEN);
  const privateChannelId = asString(config.PRIVATE_CHANNEL_ID);
  const jwtSecret = asString(config.JWT_SECRET);
  const rapidApiDewuKey = asString(config.RAPIDAPI_DEWU_KEY);
  const managerTelegramIds = asString(config.MANAGER_TELEGRAM_IDS);
  const botInternalApiToken = asString(config.BOT_INTERNAL_API_TOKEN);
  const rapidApiDewuProductEndpoint =
    asString(config.RAPIDAPI_DEWU_PRODUCT_ENDPOINT) || '/poizon/product/queryDetail';
  const port = Number(asString(config.PORT) || '3001');
  const authMaxAge = Number(asString(config.TELEGRAM_AUTH_MAX_AGE_SECONDS) || '300');

  if (!databaseUrl) {
    errors.push('DATABASE_URL is required');
  }

  if (!telegramBotToken) {
    errors.push('TELEGRAM_BOT_TOKEN is required');
  }

  if (!privateChannelId) {
    errors.push('PRIVATE_CHANNEL_ID is required');
  }

  if (!jwtSecret) {
    errors.push('JWT_SECRET is required');
  }

  if (!rapidApiDewuKey) {
    errors.push('RAPIDAPI_DEWU_KEY is required');
  }

  if (!managerTelegramIds) {
    errors.push('MANAGER_TELEGRAM_IDS is required');
  }

  if (!botInternalApiToken) {
    errors.push('BOT_INTERNAL_API_TOKEN is required');
  }

  if (Number.isNaN(port) || port <= 0) {
    errors.push('PORT must be a positive number');
  }

  if (Number.isNaN(authMaxAge) || authMaxAge <= 0) {
    errors.push('TELEGRAM_AUTH_MAX_AGE_SECONDS must be a positive number');
  }

  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    errors.push('NODE_ENV must be one of development, test, production');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration: ${errors.join('; ')}`);
  }

  return {
    ...config,
    NODE_ENV: nodeEnv,
    API_HOST: asString(config.API_HOST) || '0.0.0.0',
    PORT: String(port),
    CORS_ORIGIN: asString(config.CORS_ORIGIN) || 'http://localhost:3000',
    TELEGRAM_BOT_TOKEN: telegramBotToken,
    PRIVATE_CHANNEL_ID: privateChannelId,
    TELEGRAM_AUTH_MAX_AGE_SECONDS: String(authMaxAge),
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: asString(config.JWT_EXPIRES_IN) || '1d',
    RAPIDAPI_DEWU_HOST:
      asString(config.RAPIDAPI_DEWU_HOST) || 'open-poizon-api.p.rapidapi.com',
    RAPIDAPI_DEWU_KEY: rapidApiDewuKey,
    RAPIDAPI_DEWU_PRODUCT_ENDPOINT: rapidApiDewuProductEndpoint,
    MANAGER_TELEGRAM_IDS: asString(config.MANAGER_TELEGRAM_IDS),
    BOT_INTERNAL_API_TOKEN: botInternalApiToken,
    SEED_ADMIN_TELEGRAM_IDS: asString(config.SEED_ADMIN_TELEGRAM_IDS),
    SEED_ADMIN_USERNAMES: asString(config.SEED_ADMIN_USERNAMES),
    SEED_MANAGER_TELEGRAM_IDS: asString(config.SEED_MANAGER_TELEGRAM_IDS),
    SEED_MANAGER_USERNAMES: asString(config.SEED_MANAGER_USERNAMES),
  };
}
