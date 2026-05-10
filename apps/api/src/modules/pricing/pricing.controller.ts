import type { ManualPricingResult, PricingCalculationResult } from '@lean-poizon/shared';
import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CalculatePricingDto } from './dto/calculate-pricing.dto';
import { ManagerHelpRequestDto } from './dto/manager-help-request.dto';
import { ManualPricingDto } from './dto/manual-pricing.dto';
import { PricingService } from './pricing.service';
import { ManagerHelpNotificationService } from './services/manager-help-notification.service';

@Controller('pricing')
export class PricingController {
  private readonly pricingService: PricingService;
  private readonly managerHelpNotificationService: ManagerHelpNotificationService;

  constructor(
    @Inject(PricingService) pricingService: PricingService,
    @Inject(ManagerHelpNotificationService) managerHelpNotificationService: ManagerHelpNotificationService,
  ) {
    this.pricingService = pricingService;
    this.managerHelpNotificationService = managerHelpNotificationService;
  }

  @UseGuards(JwtAuthGuard)
  @Post('calculate')
  async calculate(@Body() dto: CalculatePricingDto): Promise<PricingCalculationResult> {
    return this.pricingService.calculate(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('calculate-manual')
  async calculateManual(@Body() dto: ManualPricingDto): Promise<ManualPricingResult> {
    return this.pricingService.calculateManual(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('manager-help')
  async requestManagerHelp(
    @Body() dto: ManagerHelpRequestDto,
    @CurrentUser() user: User,
  ): Promise<{ success: boolean }> {
    await this.managerHelpNotificationService.sendHelpRequest({
      dewuLink: dto.dewuLink,
      size: dto.size,
      deliveryCategory: dto.deliveryCategory,
      comment: dto.comment,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      telegramId: user.telegramId,
    });

    return { success: true };
  }
}
