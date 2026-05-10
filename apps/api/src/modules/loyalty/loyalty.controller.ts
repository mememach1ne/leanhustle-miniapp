import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LoyaltyService } from './loyalty.service';

@Controller('loyalty')
@UseGuards(JwtAuthGuard)
export class LoyaltyController {
  private readonly loyaltyService: LoyaltyService;

  constructor(@Inject(LoyaltyService) loyaltyService: LoyaltyService) {
    this.loyaltyService = loyaltyService;
  }

  @Get()
  getStatus(@CurrentUser() user: User) {
    return this.loyaltyService.getStatus({ userId: user.id });
  }
}
