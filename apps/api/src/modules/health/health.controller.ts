import { Controller, Get, Inject } from '@nestjs/common';

import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  private readonly healthService: HealthService;

  constructor(@Inject(HealthService) healthService: HealthService) {
    this.healthService = healthService;
  }

  @Get()
  async getStatus() {
    return this.healthService.getStatus();
  }
}
