import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';

export interface CategoryWeightLookup {
  /** Stable composite key for this L1>L2>L3 chain. */
  categoryKey: string;
  categoryL1?: string | null;
  categoryL2?: string | null;
  categoryL3?: string | null;
  /** null = exists in DB but no weight set yet; undefined = row doesn't exist yet. */
  weightKg?: number | null;
}

export interface CategoryWeightRecord {
  id: string;
  categoryKey: string;
  categoryL1: string | null;
  categoryL2: string | null;
  categoryL3: string | null;
  title: string;
  weightKg: number | null;
  encounterCount: number;
  firstSeenAt: Date;
  updatedAt: Date;
}

/**
 * Builds a stable lookup key for a Poizon category chain. Empty levels are
 * preserved so "Apparel||Tops" and "Apparel|Shirts|" don't collide.
 */
export const buildCategoryKey = (
  l1?: string | null,
  l2?: string | null,
  l3?: string | null,
): string => `${(l1 ?? '').trim()}|${(l2 ?? '').trim()}|${(l3 ?? '').trim()}`;

const deriveTitle = (
  l1?: string | null,
  l2?: string | null,
  l3?: string | null,
): string => l3?.trim() || l2?.trim() || l1?.trim() || 'Неизвестная категория';

@Injectable()
export class DeliveryCategoryWeightService {
  private readonly logger = new Logger(DeliveryCategoryWeightService.name);
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  /**
   * Look up the configured weight for a given L1>L2>L3 chain.
   * Returns `null` for "row exists but pending", `undefined` for "no row yet".
   */
  /**
   * Look up the weight for a known enum-based category (e.g. "enum:SNEAKERS").
   * Returns null if the manager has deleted it; the caller should fall back
   * to the hardcoded weight in that case.
   */
  async lookupByEnumKey(enumValue: string): Promise<number | null | undefined> {
    const row = await this.prisma.deliveryCategoryWeight.findUnique({
      where: { categoryKey: `enum:${enumValue}` },
    });
    if (!row) return undefined; // not seeded yet — caller should fall back
    return row.weightKg === null ? null : Number(row.weightKg);
  }

  async lookup(
    l1?: string | null,
    l2?: string | null,
    l3?: string | null,
  ): Promise<CategoryWeightLookup | null> {
    const categoryKey = buildCategoryKey(l1, l2, l3);
    if (categoryKey === '||') return null;

    const row = await this.prisma.deliveryCategoryWeight.findUnique({
      where: { categoryKey },
    });
    if (!row) {
      return {
        categoryKey,
        categoryL1: l1 ?? null,
        categoryL2: l2 ?? null,
        categoryL3: l3 ?? null,
        weightKg: undefined,
      };
    }
    return {
      categoryKey,
      categoryL1: row.categoryL1,
      categoryL2: row.categoryL2,
      categoryL3: row.categoryL3,
      weightKg: row.weightKg === null ? null : Number(row.weightKg),
    };
  }

  /**
   * Record an encounter for the given category. Creates a pending row if it
   * doesn't exist; bumps encounterCount otherwise. Returns the resulting row
   * (after the touch).
   */
  async recordEncounter(
    l1?: string | null,
    l2?: string | null,
    l3?: string | null,
  ): Promise<CategoryWeightRecord & { wasCreated: boolean }> {
    const categoryKey = buildCategoryKey(l1, l2, l3);
    const title = deriveTitle(l1, l2, l3);

    const existing = await this.prisma.deliveryCategoryWeight.findUnique({
      where: { categoryKey },
    });

    if (existing) {
      const updated = await this.prisma.deliveryCategoryWeight.update({
        where: { categoryKey },
        data: { encounterCount: { increment: 1 } },
      });
      return { ...this.toRecord(updated), wasCreated: false };
    }

    const created = await this.prisma.deliveryCategoryWeight.create({
      data: {
        categoryKey,
        categoryL1: l1 ?? null,
        categoryL2: l2 ?? null,
        categoryL3: l3 ?? null,
        title,
        weightKg: null,
        encounterCount: 1,
      },
    });
    this.logger.log(`New delivery category discovered: ${categoryKey}`);
    return { ...this.toRecord(created), wasCreated: true };
  }

  async listPending(): Promise<CategoryWeightRecord[]> {
    const rows = await this.prisma.deliveryCategoryWeight.findMany({
      where: { weightKg: null },
      orderBy: [{ encounterCount: 'desc' }, { firstSeenAt: 'desc' }],
    });
    return rows.map((row) => this.toRecord(row));
  }

  async listAll(): Promise<CategoryWeightRecord[]> {
    const rows = await this.prisma.deliveryCategoryWeight.findMany({
      orderBy: [{ weightKg: { sort: 'asc', nulls: 'first' } }, { firstSeenAt: 'desc' }],
    });
    return rows.map((row) => this.toRecord(row));
  }

  async getById(id: string): Promise<CategoryWeightRecord> {
    const row = await this.prisma.deliveryCategoryWeight.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Категория не найдена');
    return this.toRecord(row);
  }

  async setWeight(
    id: string,
    weightKg: number,
    staffId?: string,
  ): Promise<CategoryWeightRecord> {
    if (!Number.isFinite(weightKg) || weightKg < 0) {
      throw new Error('Вес должен быть положительным числом');
    }
    const row = await this.prisma.deliveryCategoryWeight.update({
      where: { id },
      data: {
        weightKg: new Prisma.Decimal(weightKg),
        updatedByStaffId: staffId ?? null,
      },
    });
    return this.toRecord(row);
  }

  async deleteCategory(id: string): Promise<void> {
    await this.prisma.deliveryCategoryWeight.delete({ where: { id } });
  }

  private toRecord(
    row: Prisma.DeliveryCategoryWeightGetPayload<true>,
  ): CategoryWeightRecord {
    return {
      id: row.id,
      categoryKey: row.categoryKey,
      categoryL1: row.categoryL1,
      categoryL2: row.categoryL2,
      categoryL3: row.categoryL3,
      title: row.title,
      weightKg: row.weightKg === null ? null : Number(row.weightKg),
      encounterCount: row.encounterCount,
      firstSeenAt: row.firstSeenAt,
      updatedAt: row.updatedAt,
    };
  }
}

/** Permissive parse for "0.5" / "0,5" / " 1.25 кг " etc. Returns null on invalid. */
export const parseWeightInput = (raw: string): number | null => {
  const normalized = raw.trim().replace(',', '.').replace(/[^\d.]/g, '');
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;
  return value;
};
