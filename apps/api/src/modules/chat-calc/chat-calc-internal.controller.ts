import { Body, Controller, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

import { InternalBotTokenGuard } from '../auth/guards/internal-bot-token.guard';
import { OrderWidgetService } from '../orders/widget/order-widget.service';
import { ChatCalcService } from './chat-calc.service';

export class ChatLinksDto {
  @Matches(/^\d{1,20}$/)
  telegramId!: string;

  @Matches(/^-?\d{1,20}$/)
  chatId!: string;

  @IsString()
  @MaxLength(8000)
  text!: string;

  @IsOptional() @IsString() @MaxLength(64) username?: string;
  @IsOptional() @IsString() @MaxLength(128) firstName?: string;
  @IsOptional() @IsString() @MaxLength(128) lastName?: string;
  @IsOptional() @IsString() @MaxLength(16) languageCode?: string;
}

export class WidgetQueryDto {
  @IsString()
  @Length(1, 128)
  id!: string;

  @Matches(/^\d{1,20}$/)
  fromId!: string;

  @IsString()
  @Length(1, 64)
  data!: string;

  @IsOptional()
  @Matches(/^-?\d{1,20}$/)
  chatId?: string;

  @IsOptional()
  @IsInt()
  messageId?: number;
}

/** Bot only: links sent by a client (multi-link calculation) and queries from widget cards. */
@Controller()
@UseGuards(InternalBotTokenGuard)
export class ChatCalcInternalController {
  constructor(
    @Inject(ChatCalcService) private readonly calc: ChatCalcService,
    @Inject(OrderWidgetService) private readonly orderCards: OrderWidgetService,
  ) {}

  @Post('chat-calc-internal/links')
  @HttpCode(200)
  links(@Body() dto: ChatLinksDto): Promise<{ handled: boolean }> {
    return this.calc.intake(dto);
  }

  /** A tap / background query from a card: calculation card or order card. */
  @Post('widgets-internal/query')
  @HttpCode(200)
  async query(@Body() dto: WidgetQueryDto): Promise<{ ok: true }> {
    if (!(await this.calc.handleQuery(dto))) await this.orderCards.handleQuery(dto);
    return { ok: true };
  }
}
