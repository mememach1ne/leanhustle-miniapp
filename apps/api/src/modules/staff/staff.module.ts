import { Module } from '@nestjs/common';

import { JwtStaffAuthGuard } from './guards/jwt-staff-auth.guard';
import { StaffBotAuthGuard } from './guards/staff-bot-auth.guard';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

@Module({
  controllers: [StaffController],
  providers: [StaffService, StaffBotAuthGuard, JwtStaffAuthGuard],
  exports: [StaffService, StaffBotAuthGuard, JwtStaffAuthGuard],
})
export class StaffModule {}
