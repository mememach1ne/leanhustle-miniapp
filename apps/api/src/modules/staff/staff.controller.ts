import { Controller, Get, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { StaffAccount } from '@prisma/client';

import { CurrentStaff } from './decorators/current-staff.decorator';
import { StaffBotAuthGuard } from './guards/staff-bot-auth.guard';

@Controller('staff')
@UseGuards(StaffBotAuthGuard)
@SkipThrottle()
export class StaffController {
  @Get('me')
  async getCurrentStaff(@CurrentStaff() staff?: StaffAccount) {
    return {
      id: staff?.id,
      role: staff?.role,
      telegramId: staff?.telegramId,
      username: staff?.username,
      isActive: staff?.isActive,
    };
  }
}
