import type {
  BusinessSettingsDto,
  SettingsAuditLogItemDto,
  UpdateBusinessSettingsRequest,
} from '@lean-poizon/shared';
import { Body, Controller, Get, Inject, Patch, UseGuards } from '@nestjs/common';
import type { StaffAccount } from '@prisma/client';

import { CurrentStaff } from '../staff/decorators/current-staff.decorator';
import { StaffBotAuthGuard } from '../staff/guards/staff-bot-auth.guard';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@Controller('staff/settings')
@UseGuards(StaffBotAuthGuard)
export class SettingsController {
  private readonly settingsService: SettingsService;

  constructor(@Inject(SettingsService) settingsService: SettingsService) {
    this.settingsService = settingsService;
  }

  @Get()
  async getCurrentSettings(): Promise<BusinessSettingsDto> {
    return this.settingsService.getCurrentSettingsDto();
  }

  @Patch()
  async update(
    @Body() dto: UpdateSettingsDto,
    @CurrentStaff() staff?: StaffAccount,
  ): Promise<BusinessSettingsDto> {
    return this.settingsService.updateByStaff(dto as UpdateBusinessSettingsRequest, staff);
  }

  @Get('audit')
  async getAuditLog(): Promise<SettingsAuditLogItemDto[]> {
    return this.settingsService.getAuditLogs();
  }
}
