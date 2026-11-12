import { Body, Controller, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsInt, IsObject, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

import { InternalBotTokenGuard } from '../auth/guards/internal-bot-token.guard';
import { BotMenuService } from '../bot-menu/bot-menu.service';
import { TonPayService } from '../crypto-payments/services/ton-pay.service';
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

export class MenuDto {
  @Matches(/^\d{1,20}$/)
  telegramId!: string;

  @Matches(/^-?\d{1,20}$/)
  chatId!: string;

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

  /** Raw WidgetQueryType (wallet card / sent transaction). */
  @IsOptional()
  @IsObject()
  type?: Record<string, unknown>;
}

/** Bot only: links sent by a client (multi-link calculation) and queries from widget cards. */
@Controller()
@UseGuards(InternalBotTokenGuard)
export class ChatCalcInternalController {
  constructor(
    @Inject(ChatCalcService) private readonly calc: ChatCalcService,
    @Inject(OrderWidgetService) private readonly orderCards: OrderWidgetService,
    @Inject(TonPayService) private readonly tonPay: TonPayService,
    @Inject(BotMenuService) private readonly menu: BotMenuService,
    @Inject(ConfigService) private readonly config: ConfigService,
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
    // Paying from the Telegram wallet in the order card.
    if (dto.data === 'tp' || dto.data.startsWith('tp:') || dto.type?.type === 'sent_transaction') {
      const answer = await this.tonPay.handle(dto as never);
      await this.answer(dto.id, answer);
      return { ok: true };
    }
    if (await this.menu.handleQuery(dto)) return { ok: true };
    if (!(await this.calc.handleQuery(dto))) await this.orderCards.handleQuery(dto);
    return { ok: true };
  }

  /** /start: the menu widget (false → the bot sends the old text menu). */
  @Post('menu-internal/send')
  @HttpCode(200)
  sendMenu(@Body() dto: MenuDto): Promise<{ sent: boolean; messageId?: number }> {
    return this.menu.send(dto);
  }

  private async answer(queryId: string, data: string): Promise<void> {
    const token = this.config.get<string>('telegram.botToken');
    await fetch(`https://api.telegram.org/bot${token}/answerWidgetQuery`, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widget_query_id: queryId, data }),
    }).catch(() => undefined);
  }
}
