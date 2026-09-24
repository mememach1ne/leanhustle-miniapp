import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

interface HttpRequestLike {
  method?: string;
  url?: string;
}

interface HttpResponseLike {
  status(code: number): {
    json(payload: unknown): void;
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponseLike>();
    const request = ctx.getRequest<HttpRequestLike>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const isProduction = process.env.NODE_ENV === 'production';
    let message: string = 'Internal server error';
    // Optional machine-readable reason (e.g. ProductResolveErrorCode) so the
    // frontend can branch on it instead of parsing the Russian message.
    let code: string | undefined;

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse
      ) {
        const msg = (exceptionResponse as { message: unknown }).message;
        // In production, hide detailed validation errors for 400 responses
        if (isProduction && status === HttpStatus.BAD_REQUEST && Array.isArray(msg)) {
          message = 'Неверные данные запроса';
        } else {
          message = Array.isArray(msg) ? msg.join(', ') : String(msg);
        }

        const rawCode = (exceptionResponse as { code?: unknown }).code;
        if (typeof rawCode === 'string') {
          code = rawCode;
        }
      }
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method ?? 'UNKNOWN'} ${request.url ?? ''} — ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      ...(code ? { code } : {}),
      path: request.url ?? '',
      timestamp: new Date().toISOString(),
    });
  }
}
