import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async getStatus() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        app: 'ok',
        db: 'ok',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        'Database health check failed',
        error instanceof Error ? error.stack : String(error),
      );

      throw new ServiceUnavailableException({
        app: 'ok',
        db: 'error',
        message: 'Database health check failed',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
