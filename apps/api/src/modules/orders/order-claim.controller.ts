import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { InternalBotTokenGuard } from '../auth/guards/internal-bot-token.guard';
import { OrdersService } from './orders.service';

class ClaimOrderDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{16,64}$/)
  token!: string;

  @IsString()
  @Matches(/^\d{1,20}$/)
  telegramId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  languageCode?: string;
}

/** Bot only (internal token): attach a "pay by link" order to the Telegram user who opened the link. */
@Controller('orders-claim')
@UseGuards(InternalBotTokenGuard)
export class OrderClaimController {
  private readonly ordersService: OrdersService;

  constructor(@Inject(OrdersService) ordersService: OrdersService) {
    this.ordersService = ordersService;
  }

  @Post()
  async claim(@Body() dto: ClaimOrderDto) {
    return this.ordersService.claimOrderByLink(dto);
  }
}
