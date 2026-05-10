import type {
  BusinessSettingsDto,
  SettingsAuditActorDto,
  SettingsAuditLogItemDto,
  UpdateBusinessSettingsRequest,
} from '@lean-poizon/shared';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type BusinessSettings,
  Prisma,
  type SettingsAuditLog,
  SettingsScope,
  type StaffAccount,
  StaffRole,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

const UPDATABLE_SETTING_KEYS = [
  'cnyToUsd',
  'cnyToRub',
  'eurToRub',
  'commissionPercent',
  'deliveryPricePerKgRub',
] as const;

type UpdatableSettingKey = (typeof UPDATABLE_SETTING_KEYS)[number];

type AuditLogWithActor = SettingsAuditLog & {
  changedByStaff: StaffAccount | null;
};

@Injectable()
export class SettingsService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async getCurrentSettings(): Promise<BusinessSettings> {
    return this.getCurrentSettingsEntity();
  }

  async getCurrentSettingsDto(): Promise<BusinessSettingsDto> {
    const settings = await this.getCurrentSettingsEntity();
    return this.mapSettings(settings);
  }

  async updateByStaff(
    dto: UpdateBusinessSettingsRequest,
    staff?: StaffAccount,
  ): Promise<BusinessSettingsDto> {
    this.assertStaff(staff);

    const patch = this.pickAllowedPatch(dto);

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('Не передано ни одного допустимого поля для обновления.');
    }

    const updatedSettings = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.businessSettings.findUnique({
        where: { scope: SettingsScope.DEFAULT },
      });

      if (!existing) {
        throw new NotFoundException('Business settings have not been initialized');
      }

      const previousValues = this.extractValues(existing, Object.keys(patch) as UpdatableSettingKey[]);

      const updated = await tx.businessSettings.update({
        where: { id: existing.id },
        data: {
          ...patch,
          updatedByStaffId: staff?.id ?? null,
        },
      });

      await tx.settingsAuditLog.create({
        data: {
          settingsId: existing.id,
          changedByStaffId: staff?.id ?? null,
          previousValues,
          nextValues: this.extractValues(updated, Object.keys(patch) as UpdatableSettingKey[]),
        },
      });

      return updated;
    });

    return this.mapSettings(updatedSettings);
  }

  /**
   * Update only exchange rates (cnyToRub, eurToRub) from CBR.
   * Called by the automated scheduler — no staff auth required.
   */
  async updateRatesFromCbr(rates: {
    cnyToRub: number;
    eurToRub: number;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.businessSettings.findUnique({
        where: { scope: SettingsScope.DEFAULT },
      });

      if (!existing) {
        return;
      }

      const keys: UpdatableSettingKey[] = ['cnyToRub', 'eurToRub'];
      const previousValues = this.extractValues(existing, keys);

      const updated = await tx.businessSettings.update({
        where: { id: existing.id },
        data: {
          cnyToRub: rates.cnyToRub,
          eurToRub: rates.eurToRub,
          updatedByStaffId: null,
        },
      });

      await tx.settingsAuditLog.create({
        data: {
          settingsId: existing.id,
          changedByStaffId: null,
          previousValues,
          nextValues: this.extractValues(updated, keys),
        },
      });
    });
  }

  async getAuditLogs(limit = 15): Promise<SettingsAuditLogItemDto[]> {
    const logs = await this.prisma.settingsAuditLog.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      include: {
        changedByStaff: true,
      },
    });

    return logs.map((log) => this.mapAuditLog(log));
  }

  private async getCurrentSettingsEntity(): Promise<BusinessSettings> {
    const settings = await this.prisma.businessSettings.findUnique({
      where: { scope: SettingsScope.DEFAULT },
    });

    if (!settings) {
      throw new NotFoundException('Business settings have not been initialized');
    }

    return settings;
  }

  private pickAllowedPatch(dto: UpdateBusinessSettingsRequest) {
    const patch: Partial<Record<UpdatableSettingKey, number>> = {};

    for (const key of UPDATABLE_SETTING_KEYS) {
      const value = dto[key];

      if (value !== undefined) {
        patch[key] = value;
      }
    }

    return patch;
  }

  private extractValues(
    settings: BusinessSettings,
    keys: UpdatableSettingKey[],
  ): Prisma.InputJsonObject {
    const values: Record<string, number> = {};

    for (const key of keys) {
      values[key] = this.toNumber(settings[key]);
    }

    return values as Prisma.InputJsonObject;
  }

  private mapSettings(settings: BusinessSettings): BusinessSettingsDto {
    return {
      id: settings.id,
      cnyToUsd: this.toNumber(settings.cnyToUsd),
      cnyToRub: this.toNumber(settings.cnyToRub),
      eurToRub: this.toNumber(settings.eurToRub),
      commissionPercent: this.toNumber(settings.commissionPercent),
      deliveryPricePerKgRub: this.toNumber(settings.deliveryPricePerKgRub),
      dutyThresholdEur: this.toNumber(settings.dutyThresholdEur),
      dutyPercent: this.toNumber(settings.dutyPercent),
      dutyProcessingFeeRub: this.toNumber(settings.dutyProcessingFeeRub),
      updatedAt: settings.updatedAt.toISOString(),
    };
  }

  private mapAuditLog(log: AuditLogWithActor): SettingsAuditLogItemDto {
    const previousValues = this.normalizeAuditValues(log.previousValues, true);
    const nextValues = this.normalizeAuditValues(log.nextValues) ?? {};

    return {
      id: log.id,
      changedFields: Object.keys(nextValues),
      previousValues,
      nextValues,
      createdAt: log.createdAt.toISOString(),
      changedByStaff: log.changedByStaff
        ? this.mapAuditActor(log.changedByStaff)
        : null,
    };
  }

  private mapAuditActor(staff: StaffAccount): SettingsAuditActorDto {
    return {
      id: staff.id,
      role: staff.role === StaffRole.ADMIN ? 'admin' : 'manager',
      telegramId: staff.telegramId,
      username: staff.username,
    };
  }

  private normalizeAuditValues(
    value: Prisma.JsonValue | null | undefined,
    allowNull = false,
  ): Record<string, number> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return allowNull ? null : {};
    }

    return Object.entries(value).reduce<Record<string, number>>((accumulator, [key, entry]) => {
      if (typeof entry === 'number') {
        accumulator[key] = entry;
      }

      if (typeof entry === 'string' && entry.trim() !== '' && !Number.isNaN(Number(entry))) {
        accumulator[key] = Number(entry);
      }

      return accumulator;
    }, {});
  }

  private assertStaff(staff?: StaffAccount) {
    if (!staff || !staff.isActive) {
      throw new ForbiddenException('Доступ разрешён только для сотрудников.');
    }
  }

  private toNumber(value: Prisma.Decimal | number | string) {
    return Number(value);
  }
}
