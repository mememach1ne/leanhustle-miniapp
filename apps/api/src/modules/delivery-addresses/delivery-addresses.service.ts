import type { DeliveryAddressDto, DeliveryCarrier, DeliveryCourierAddress, DeliveryKind } from '@lean-poizon/shared';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { RegionalDeliveryService } from '../pricing/services/regional-delivery.service';
import { CreateDeliveryAddressDto } from './dto/create-delivery-address.dto';
import { PickupPointDto } from './dto/pickup-point.dto';
import { UpdateDeliveryAddressDto } from './dto/update-delivery-address.dto';

/** Address columns for a directory point / courier door (or none for a free-text address). */
export const pickupPointColumns = (point?: PickupPointDto) => {
  const courier = point?.kind === 'courier';
  if (courier && !point?.courier) throw new BadRequestException('Укажите улицу и дом для курьера.');
  return {
    cityId: point?.cityId ?? null,
    city: point?.city ?? null,
    region: point?.region ?? null,
    carrier: courier ? 'cdek' : (point?.carrier ?? 'cdek'),
    kind: courier ? 'courier' : 'pvz',
    pvzCode: courier ? null : (point?.pvzCode ?? null),
    pvzIndex: courier ? (point?.courier?.index ?? null) : (point?.pvzIndex ?? null),
    courier: courier && point?.courier ? (point.courier as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
  };
};

@Injectable()
export class DeliveryAddressesService {
  private readonly prisma: PrismaService;
  private readonly regionalDelivery: RegionalDeliveryService;

  constructor(
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(RegionalDeliveryService) regionalDelivery: RegionalDeliveryService,
  ) {
    this.prisma = prisma;
    this.regionalDelivery = regionalDelivery;
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
          ...pickupPointColumns(dto.pickupPoint),
        },
      });
    });

    // Fetch the city's delivery rates now so checkout doesn't wait for them.
    this.regionalDelivery.warm(address.region, address.city, address.cityId);
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
          // Editing the address text without re-picking a point drops the
          // stale point, so automation never ships to a mismatched PVZ.
          ...(dto.pickupPoint
            ? pickupPointColumns(dto.pickupPoint)
            : dto.cdekAddress !== undefined
              ? pickupPointColumns(undefined)
              : {}),
        },
      });
    });

    this.regionalDelivery.warm(address.region, address.city, address.cityId);
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
    cityId: string | null;
    city: string | null;
    region: string | null;
    pvzCode: string | null;
    pvzIndex: string | null;
    carrier: string;
    kind: string;
    courier: Prisma.JsonValue;
  }): DeliveryAddressDto {
    const courier = address.kind === 'courier' ? (address.courier as unknown as DeliveryCourierAddress | null) : null;
    return {
      id: address.id,
      fullName: address.fullName,
      cdekAddress: address.cdekAddress,
      phone: address.phone,
      isDefault: address.isDefault,
      createdAt: address.createdAt.toISOString(),
      pickupPoint:
        address.cityId && address.city && (address.pvzCode || courier)
          ? {
              cityId: address.cityId,
              city: address.city,
              region: address.region,
              kind: address.kind as DeliveryKind,
              carrier: address.carrier as DeliveryCarrier,
              pvzCode: address.pvzCode ?? '',
              pvzIndex: address.pvzIndex,
              courier,
            }
          : null,
    };
  }
}
