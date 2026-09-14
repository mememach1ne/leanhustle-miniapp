import { Logger, ServiceUnavailableException } from '@nestjs/common';

const logger = new Logger('DewuEngineConfig');

/**
 * Shared credentials for calling the self-hosted price engine
 * (`lh-dewu-engine`, `DEWU_ENGINE_URL`/`DEWU_ENGINE_TOKEN`). Used by both the
 * product-detail resolver (`DewuApiClientService`) and the catalog sync
 * (`CatalogEngineClientService`) — same VPS-local service, two endpoints.
 *
 * Fails closed (no hardcoded fallback token) so a missing env var can't
 * silently degrade into an unauthenticated/wrong-token request.
 */
export interface DewuEngineCredentials {
  engineUrl: string;
  engineToken: string;
}

export function getDewuEngineCredentials(): DewuEngineCredentials {
  const engineUrl = process.env.DEWU_ENGINE_URL ?? 'http://127.0.0.1:3777';
  const engineToken = process.env.DEWU_ENGINE_TOKEN;

  if (!engineToken) {
    logger.error('DEWU_ENGINE_TOKEN is not configured');
    throw new ServiceUnavailableException(
      'Сервис товаров временно недоступен. Введите данные товара вручную или попробуйте позже.',
    );
  }

  return { engineUrl, engineToken };
}
