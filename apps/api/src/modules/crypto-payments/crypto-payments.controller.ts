import type { CryptoPaymentIntentDto, PaymentNetwork } from '@lean-poizon/shared';
import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCryptoPaymentIntentDto } from './dto/create-intent.dto';
import { CryptoPaymentService } from './services/crypto-payment.service';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class CryptoPaymentsController {
  constructor(
    @Inject(CryptoPaymentService)
    private readonly service: CryptoPaymentService,
  ) {}

  /**
   * Returns the list of USDT networks we accept right now. The mini-app
   * builds its picker from this so we can hide a chain via env without a
   * frontend redeploy.
   */
  @Get('payment-networks')
  getNetworks(): { networks: PaymentNetwork[] } {
    return { networks: this.service.getEnabledNetworks() };
  }

  @Post(':id/payment-intent')
  async createIntent(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateCryptoPaymentIntentDto,
  ): Promise<CryptoPaymentIntentDto> {
    return this.service.createIntentForCurrentUser(user.id, orderId, dto.network);
  }

  /**
   * Used by the mini-app to poll the matcher status. Returns the most
   * recent intent for this order (any status). 404 if none has ever been
   * created — callers should fall back to picking a network.
   */
  @Get(':id/payment-status')
  async getStatus(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) orderId: string,
  ): Promise<CryptoPaymentIntentDto> {
    const intent = await this.service.getLatestIntentForCurrentUser(user.id, orderId);
    if (!intent) throw new NotFoundException();
    return intent;
  }
}
