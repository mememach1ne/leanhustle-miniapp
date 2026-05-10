import type { DeliveryAddressDto } from '@lean-poizon/shared';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateDeliveryAddressDto } from './dto/create-delivery-address.dto';
import { UpdateDeliveryAddressDto } from './dto/update-delivery-address.dto';

@Injectable()
export class DeliveryAddressesService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async getByUserId(userId: string): Promise<DeliveryAddressDto[]> {
    const addresses = await this.prisma.deliveryAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return addresses.map((a) => this.toDto(a));
  }

  async create(userId: string, dto: CreateDeliveryAddressDto): Promise<DeliveryAddressDto> {
    const address = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.deliveryAddress.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.deliveryAddress.create({
        data: {
          userId,
          fullName: dto.fullName,
          cdekAddress: dto.cdekAddress,
          phone: dto.phone,
          isDefault: dto.isDefault ?? false,
        },
      });
    });

    return this.toDto(address);
  }

  async update(userId: string, id: string, dto: UpdateDeliveryAddressDto): Promise<DeliveryAddressDto> {
    await this.getOwned(userId, id);

    const address = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.deliveryAddress.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.deliveryAddress.update({
        where: { id },
        data: {
          ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
          ...(dto.cdekAddress !== undefined ? { cdekAddress: dto.cdekAddress } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        },
      });
    });

    return this.toDto(address);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.getOwned(userId, id);
    await this.prisma.deliveryAddress.delete({ where: { id } });
  }

  private async getOwned(userId: string, id: string) {
    const address = await this.prisma.deliveryAddress.findFirst({
      where: { id, userId },
    });

    if (!address) {
      throw new NotFoundException('Адрес не найден.');
    }

    return address;
  }

  private toDto(address: {
    id: string;
    fullName: string;
    cdekAddress: string;
    phone: string;
    isDefault: boolean;
    createdAt: Date;
  }): DeliveryAddressDto {
    return {
      id: address.id,
      fullName: address.fullName,
      cdekAddress: address.cdekAddress,
      phone: address.phone,
      isDefault: address.isDefault,
      createdAt: address.createdAt.toISOString(),
    };
  }
}
