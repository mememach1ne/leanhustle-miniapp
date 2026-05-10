import type { DeliveryAddressDto } from '@lean-poizon/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DeliveryAddressesService } from './delivery-addresses.service';
import { CreateDeliveryAddressDto } from './dto/create-delivery-address.dto';
import { UpdateDeliveryAddressDto } from './dto/update-delivery-address.dto';

@Controller('delivery-addresses')
@UseGuards(JwtAuthGuard)
export class DeliveryAddressesController {
  private readonly service: DeliveryAddressesService;

  constructor(@Inject(DeliveryAddressesService) service: DeliveryAddressesService) {
    this.service = service;
  }

  @Get()
  async getAll(@CurrentUser() user: User): Promise<DeliveryAddressDto[]> {
    return this.service.getByUserId(user.id);
  }

  @Post()
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateDeliveryAddressDto,
  ): Promise<DeliveryAddressDto> {
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeliveryAddressDto,
  ): Promise<DeliveryAddressDto> {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.service.remove(user.id, id);
  }
}
