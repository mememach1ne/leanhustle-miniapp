import { Body, Controller, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Length, Matches } from 'class-validator';

import { InternalBotTokenGuard } from '../../auth/guards/internal-bot-token.guard';
import { OrderWidgetService } from './order-widget.service';

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

/** Bot only: a query from an order card (widget) in a client's chat. */
@Controller('widgets-internal')
@UseGuards(InternalBotTokenGuard)
export class OrderWidgetInternalController {
  constructor(@Inject(OrderWidgetService) private readonly widgets: OrderWidgetService) {}

  @Post('query')
  @HttpCode(200)
  async query(@Body() dto: WidgetQueryDto): Promise<{ ok: true }> {
    await this.widgets.handleQuery(dto);
    return { ok: true };
  }
}
