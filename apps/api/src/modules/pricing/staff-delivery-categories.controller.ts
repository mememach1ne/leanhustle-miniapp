import type { DeliveryCategoryWeightDto } from '@lean-poizon/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import type { StaffAccount } from '@prisma/client';
import { IsNumber, Max, Min } from 'class-validator';

import { CurrentStaff } from '../staff/decorators/current-staff.decorator';
import { StaffBotAuthGuard } from '../staff/guards/staff-bot-auth.guard';
import {
  CategoryWeightRecord,
  DeliveryCategoryWeightService,
} from './services/delivery-category-weight.service';

class SetWeightDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  weightKg!: number;
}

const toDto = (record: CategoryWeightRecord): DeliveryCategoryWeightDto => ({
  id: record.id,
  categoryKey: record.categoryKey,
  categoryL1: record.categoryL1,
  categoryL2: record.categoryL2,
  categoryL3: record.categoryL3,
  title: record.title,
  weightKg: record.weightKg,
  encounterCount: record.encounterCount,
  firstSeenAt: record.firstSeenAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});

@Controller('staff/delivery-categories')
@UseGuards(StaffBotAuthGuard)
export class StaffDeliveryCategoriesController {
  private readonly weightService: DeliveryCategoryWeightService;

  constructor(
    @Inject(DeliveryCategoryWeightService) weightService: DeliveryCategoryWeightService,
  ) {
    this.weightService = weightService;
  }

  @Get('pending')
  async listPending(): Promise<DeliveryCategoryWeightDto[]> {
    const rows = await this.weightService.listPending();
    return rows.map(toDto);
  }

  @Get()
  async listAll(): Promise<DeliveryCategoryWeightDto[]> {
    const rows = await this.weightService.listAll();
    return rows.map(toDto);
  }

  @Get(':id')
  async getOne(@Param('id', ParseUUIDPipe) id: string): Promise<DeliveryCategoryWeightDto> {
    return toDto(await this.weightService.getById(id));
  }

  @Patch(':id')
  async setWeight(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetWeightDto,
    @CurrentStaff() staff?: StaffAccount,
  ): Promise<DeliveryCategoryWeightDto> {
    return toDto(await this.weightService.setWeight(id, dto.weightKg, staff?.id));
  }

  @Delete(':id')
  async deleteOne(@Param('id', ParseUUIDPipe) id: string): Promise<{ ok: true }> {
    await this.weightService.deleteCategory(id);
    return { ok: true };
  }
}
