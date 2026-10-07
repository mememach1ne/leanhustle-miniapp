import type { PartnerDashboardDto, ReferralSummaryDto } from '@lean-poizon/shared';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { StaffAccount, User } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InternalBotTokenGuard } from '../auth/guards/internal-bot-token.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentStaff } from '../staff/decorators/current-staff.decorator';
import { JwtStaffAuthGuard } from '../staff/guards/jwt-staff-auth.guard';
import { PAYOUT_CHAINS, ProfitService } from './profit.service';
import { ReferralService } from './referral.service';

class AttachReferralDto {
  @IsString()
  @Matches(/^[a-z0-9]{6,16}$/i)
  code!: string;

  @IsString()
  @Matches(/^\d{1,20}$/)
  telegramId!: string;

  @IsOptional() @IsString() @MaxLength(64) username?: string;
  @IsOptional() @IsString() @MaxLength(128) firstName?: string;
  @IsOptional() @IsString() @MaxLength(128) lastName?: string;
  @IsOptional() @IsString() @MaxLength(16) languageCode?: string;
}

class ShareDto {
  @IsUUID()
  staffId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  sharePercent!: number | null;
}

class SetSharesDto {
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ShareDto)
  shares!: ShareDto[];
}

class PayoutAddressDto {
  @IsIn(PAYOUT_CHAINS)
  chain!: string;

  @IsString()
  @MaxLength(128)
  address!: string;
}

/** Client: own referral link, stats and payout request (inside «Лояльность»). */
@Controller('referrals')
@UseGuards(JwtAuthGuard)
export class ReferralController {
  constructor(@Inject(ReferralService) private readonly referrals: ReferralService) {}

  @Get('me')
  getMine(@CurrentUser() user: User): Promise<ReferralSummaryDto> {
    return this.referrals.getSummary(user.id);
  }

  @Post('payout')
  requestPayout(@CurrentUser() user: User): Promise<ReferralSummaryDto> {
    return this.referrals.requestPayout(user.id);
  }
}

/** Bot only: a new user opened t.me/lh_poizonbot?start=ref_<code>. */
@Controller('referrals-internal')
@UseGuards(InternalBotTokenGuard)
export class ReferralInternalController {
  constructor(@Inject(ReferralService) private readonly referrals: ReferralService) {}

  @Post('attach')
  attach(@Body() dto: AttachReferralDto): Promise<{ attached: boolean }> {
    return this.referrals.attach(dto);
  }
}

/** Admin panel «Прибыль»: partners' balances, shares, withdrawals, referral payouts. */
@Controller('admin/partners')
@UseGuards(JwtStaffAuthGuard)
export class PartnersAdminController {
  constructor(
    @Inject(ProfitService) private readonly profit: ProfitService,
    @Inject(ReferralService) private readonly referrals: ReferralService,
  ) {}

  @Get('dashboard')
  dashboard(@CurrentStaff() staff: StaffAccount): Promise<PartnerDashboardDto> {
    return this.profit.dashboard(staff);
  }

  @Put('shares')
  setShares(@CurrentStaff() staff: StaffAccount, @Body() dto: SetSharesDto): Promise<PartnerDashboardDto> {
    return this.profit.setShares(staff, dto.shares);
  }

  @Put('payout-address')
  setAddress(@CurrentStaff() staff: StaffAccount, @Body() dto: PayoutAddressDto): Promise<PartnerDashboardDto> {
    return this.profit.setPayoutAddress(staff, dto.chain, dto.address);
  }

  @Post('withdraw')
  withdraw(@CurrentStaff() staff: StaffAccount): Promise<PartnerDashboardDto> {
    return this.profit.withdrawNow(staff);
  }

  @Post('referral-payouts/:id/:result')
  async processPayout(
    @CurrentStaff() staff: StaffAccount,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('result') result: string,
  ): Promise<PartnerDashboardDto> {
    if (result !== 'paid' && result !== 'rejected') throw new BadRequestException('result: paid | rejected');
    await this.referrals.processPayout(id, result === 'paid' ? 'PAID' : 'REJECTED', staff);
    return this.profit.dashboard(staff);
  }
}
