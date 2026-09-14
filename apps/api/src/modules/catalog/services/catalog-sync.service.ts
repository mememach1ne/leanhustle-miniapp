import type { CatalogSyncResultDto } from '@lean-poizon/shared';
import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { SettingsService } from '../../settings/settings.service';
import { CatalogEngineClientService } from './catalog-engine-client.service';

/** Safety cap on how many pages we'll ever walk in one sync run. The engine
 * currently only returns real items on page 1 (see docs/SHOP_MVP_PLAN.md §1);
 * this just bounds the loop once categories/pagination land on the engine
 * side and K grows. */
const MAX_PAGES = 20;
const PAGE_PAUSE_MS = 1000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * "64w+" → 640000, "1.2w+" → 12000, "999+" → 999. Used purely for ordering
 * within the popularity sort; returns 0 for anything unparseable.
 */
export function parseSoldRank(soldText: string | null | undefined): number {
  if (!soldText) return 0;
  const match = soldText.trim().match(/^(\d+(?:\.\d+)?)\s*([wW万]?)\+?$/);
  if (!match) return 0;
  const num = Number.parseFloat(match[1]);
  if (!Number.isFinite(num)) return 0;
  return Math.round(match[2] ? num * 10000 : num);
}

@Injectable()
export class CatalogSyncService {
  private readonly logger = new Logger(CatalogSyncService.name);
  private readonly prisma: PrismaService;
  private readonly engineClient: CatalogEngineClientService;
  private readonly settingsService: SettingsService;
  private isSyncing = false;

  constructor(
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(CatalogEngineClientService) engineClient: CatalogEngineClientService,
    @Inject(SettingsService) settingsService: SettingsService,
  ) {
    this.prisma = prisma;
    this.engineClient = engineClient;
    this.settingsService = settingsService;
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduledSync(): Promise<void> {
    try {
      await this.sync();
    } catch (error) {
      this.logger.error(
        `Scheduled catalog sync failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Entry point for both the cron job and the manual admin trigger. */
  async sync(): Promise<CatalogSyncResultDto> {
    if (this.isSyncing) {
      throw new ConflictException('Синхронизация каталога уже выполняется.');
    }
    this.isSyncing = true;
    try {
      return await this.runSync();
    } finally {
      this.isSyncing = false;
    }
  }

  private async runSync(): Promise<CatalogSyncResultDto> {
    const settings = await this.settingsService.getCurrentSettings();
    const seenSpuIds = new Set<string>();
    let popularityOrder = 0;
    let pagesRead = 0;

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const items = await this.engineClient.fetchPage(page);
      pagesRead += 1;

      // Contract: the engine returns an empty items list once it has
      // nothing more (currently: everything past page 1) — stop there.
      if (items.length === 0) {
        break;
      }

      for (const item of items) {
        const spuId = String(item.spuId ?? '').trim();
        if (!spuId || seenSpuIds.has(spuId)) continue;

        // The engine returns priceCny: null for items it couldn't price
        // (observed: ~2/60, likely sold out) — skip rather than crash the
        // whole sync. Not marking spuId as seen means a previously-active
        // row for it gets deactivated below, which is the right outcome
        // for something we can no longer show a price for.
        const priceCnyValue = Number(item.priceCny);
        if (!item.priceCny || !Number.isFinite(priceCnyValue) || priceCnyValue <= 0) {
          this.logger.warn(`Catalog item spuId=${spuId} has no valid priceCny — skipped`);
          continue;
        }

        seenSpuIds.add(spuId);
        const priceCny = new Prisma.Decimal(priceCnyValue);
        // Match the detail-card formula (GLOBAL + ¥2, same FX rate) so the
        // "от ₽…" shown on the shelf equals the number the customer sees
        // once they open the card — see docs/SHOP_MVP_PLAN.md §6.
        const priceRub = priceCny
          .plus(2)
          .mul(settings.cnyToRub)
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

        const data = {
          title: item.title,
          article: item.article ?? null,
          imageUrl: item.image,
          priceCny,
          priceRub,
          soldText: item.soldText ?? null,
          soldRank: parseSoldRank(item.soldText),
          popularityOrder,
          isActive: true,
          lastSyncedAt: new Date(),
        };

        await this.prisma.catalogProduct.upsert({
          where: { spuId },
          create: { spuId, ...data },
          update: data,
        });

        popularityOrder += 1;
      }

      if (page < MAX_PAGES) {
        await sleep(PAGE_PAUSE_MS);
      }
    }

    // Deactivate (never delete) anything not seen in this pass. Skip this
    // when the run found nothing at all — an all-empty result almost always
    // means the engine hiccupped, not that the catalog is actually empty,
    // and we don't want to wipe the shelf over a transient failure.
    let deactivated = 0;
    if (seenSpuIds.size > 0) {
      const result = await this.prisma.catalogProduct.updateMany({
        where: { isActive: true, spuId: { notIn: [...seenSpuIds] } },
        data: { isActive: false },
      });
      deactivated = result.count;
    } else {
      this.logger.warn('Catalog sync fetched 0 items — skipping deactivation pass.');
    }

    const syncResult: CatalogSyncResultDto = {
      synced: seenSpuIds.size,
      deactivated,
      pagesRead,
      syncedAt: new Date().toISOString(),
    };

    this.logger.log(
      `Catalog sync done: synced=${syncResult.synced} deactivated=${syncResult.deactivated} pagesRead=${syncResult.pagesRead}`,
    );

    return syncResult;
  }
}
