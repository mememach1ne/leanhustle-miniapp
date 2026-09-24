import type { ProductResolveErrorCode } from '@lean-poizon/shared';
import {
  BadRequestException,
  HttpException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';

const DEFAULT_MESSAGES: Record<ProductResolveErrorCode, string> = {
  LINK_UNRECOGNIZED: 'Ссылка не распознана. Скопируйте ссылку на товар из приложения Poizon.',
  PRODUCT_NOT_AVAILABLE:
    'Poizon не отдаёт данные по этому товару для автоматического расчёта. Введите данные вручную или напишите менеджеру.',
  PRODUCT_UNPARSEABLE:
    'Не получилось автоматически получить размеры и цены этого товара. Введите данные вручную или напишите менеджеру.',
  ENGINE_UNAVAILABLE:
    'Сервис товаров временно недоступен. Введите данные товара вручную или попробуйте позже.',
};

/**
 * Builds the HttpException for a failed product resolve. The response body
 * carries `code` next to `message` (HttpExceptionFilter passes it through),
 * so the frontend can pick a specific explanation instead of treating every
 * failure as "API temporarily unavailable".
 */
export const productResolveError = (
  code: ProductResolveErrorCode,
  message: string = DEFAULT_MESSAGES[code],
): HttpException => {
  const body = { message, code };

  switch (code) {
    case 'LINK_UNRECOGNIZED':
      return new BadRequestException(body);
    case 'PRODUCT_NOT_AVAILABLE':
    case 'PRODUCT_UNPARSEABLE':
      return new UnprocessableEntityException(body);
    case 'ENGINE_UNAVAILABLE':
      return new ServiceUnavailableException(body);
  }
};
