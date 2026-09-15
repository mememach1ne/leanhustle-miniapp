import type { CatalogSyncResultDto } from '@lean-poizon/shared';
import { CATALOG_SNAPSHOT_KEYWORDS } from '@lean-poizon/shared';
import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { BusinessSettings } from '@prisma/client';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { SettingsService } from '../../settings/settings.service';
import { CatalogEngineClientService, type CatalogEngineItem } from './catalog-engine-client.service';

/** Safety cap on how many pages we'll ever walk for the "Популярное" feed.
 * The engine currently only returns real items on page 1 (see
 * docs/SHOP_MVP_PLAN.md §1); this just bounds the loop once
 * pagination lands on the engine side and K grows. */
const MAX_PAGES = 20;
const PAGE_PAUSE_MS = 1000;
/** Pause between GET /search?q= calls — plan calls for ~1-2s between engine hits. */
const KEYWORD_PAUSE_MS = 1500;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * "64w+" → 640000, "1.2w+" → 12000, "999+" → 999. Fallback for /catalog
 * items, which only carry soldText; /search items carry a pre-parsed
 * soldRank from the engine itself (see resolveSoldRank).
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

    // ─── Pass 1: "Популярное" — GET /catalog?page= ───────────────
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

        const upsertedId = await this.upsertItem(item, settings, { popularityOrder });
        if (upsertedId) {
          seenSpuIds.add(upsertedId);
          popularityOrder += 1;
        }
      }

      if (page < MAX_PAGES) {
        await sleep(PAGE_PAUSE_MS);
      }
    }

    // ─── Pass 2: curated keyword search — GET /search?q= ─────────
    // Pre-warms the DB snapshot for the filters/search panel (brands,
    // types, top brand+type combos — see docs/SHOP_MVP_PLAN.md
    // §"Фильтры и поиск (v2)"). An item already seen in pass 1 is still
    // processed here (to pick up the keyword tag), so no seenSpuIds guard
    // before the call — upsertItem is idempotent either way.
    let keywordsSynced = 0;
    let keywordErrors = 0;

    for (const keyword of CATALOG_SNAPSHOT_KEYWORDS) {
      try {
        const items = await this.engineClient.search(keyword);
        for (const item of items) {
          const upsertedId = await this.upsertItem(item, settings, { keyword });
          if (upsertedId) {
            seenSpuIds.add(upsertedId);
          }
        }
        keywordsSynced += 1;
      } catch (error) {
        keywordErrors += 1;
        this.logger.warn(
          `Catalog keyword sync failed for "${keyword}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      await sleep(KEYWORD_PAUSE_MS);
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
      keywordsSynced,
      keywordErrors,
      syncedAt: new Date().toISOString(),
    };

    this.logger.log(
      `Catalog sync done: synced=${syncResult.synced} deactivated=${syncResult.deactivated} ` +
        `pagesRead=${syncResult.pagesRead} keywordsSynced=${syncResult.keywordsSynced} keywordErrors=${syncResult.keywordErrors}`,
    );

    return syncResult;
  }

  /**
   * On-demand sync for a single keyword, outside the nightly schedule —
   * used by CatalogService's live-search fallback when a user's
   * brand/type/q combo isn't part of the curated snapshot (see
   * docs/SHOP_MVP_PLAN.md §"Кэш-стратегия"). Tags matches with this
   * keyword so the next identical search is served straight from the DB;
   * an ad-hoc tag not repeated again naturally falls off at the next
   * nightly deactivation sweep. Does not touch popularityOrder or run the
   * deactivation pass — this is additive, not a full sync.
   */
  async syncKeywordNow(keyword: string): Promise<void> {
    const settings = await this.settingsService.getCurrentSettings();
    const items = await this.engineClient.search(keyword);
    for (const item of items) {
      await this.upsertItem(item, settings, { keyword });
    }
  }

  /**
   * Upserts one engine item into CatalogProduct. Shared by both passes:
   * - Pass 1 passes `popularityOrder` (never `keyword`) — position in the
   *   main feed; omitted from `update` so a later keyword-pass match
   *   doesn't clobber it.
   * - Pass 2 passes `keyword` (never `popularityOrder`) — merges it into
   *   the row's existing `keywords` array (deduped) rather than
   *   overwriting, since one product can match several keywords across
   *   the run (and across nights).
   * Returns the spuId on success, or null if the item was skipped
   * (missing spuId, or no valid priceCny — the engine returns priceCny:
   * null for items it couldn't price, observed on both /catalog and
   * /search).
   */
  private async upsertItem(
    item: CatalogEngineItem,
    settings: BusinessSettings,
    options: { popularityOrder?: number; keyword?: string },
  ): Promise<string | null> {
    const spuId = String(item.spuId ?? '').trim();
    if (!spuId) return null;

    const priceCnyValue = this.resolvePriceCnyValue(item);
    if (priceCnyValue === null) {
      this.logger.warn(`Catalog item spuId=${spuId} has no valid priceCny — skipped`);
      return null;
    }

    const priceCny = new Prisma.Decimal(priceCnyValue);
    const priceUsd = this.computePriceUsd(priceCnyValue, settings);
    const soldRank = this.resolveSoldRank(item);

    let keywords: string[] | undefined;
    if (options.keyword) {
      const existing = await this.prisma.catalogProduct.findUnique({
        where: { spuId },
        select: { keywords: true },
      });
      keywords = existing
        ? Array.from(new Set([...existing.keywords, options.keyword]))
        : [options.keyword];
    }

    const data = {
      title: item.title,
      article: item.article ?? null,
      imageUrl: item.image,
      priceCny,
      priceUsd,
      soldText: item.soldText ?? null,
      soldRank,
      isActive: true,
      lastSyncedAt: new Date(),
      ...(options.popularityOrder !== undefined ? { popularityOrder: options.popularityOrder } : {}),
      ...(keywords !== undefined ? { keywords } : {}),
    };

    await this.prisma.catalogProduct.upsert({
      where: { spuId },
      create: { spuId, ...data },
      update: data,
    });

    return spuId;
  }

  /** null when the engine couldn't price the item (observed: priceCny: null for some rows). */
  private resolvePriceCnyValue(item: CatalogEngineItem): number | null {
    const value = Number(item.priceCny);
    if (!item.priceCny || !Number.isFinite(value) || value <= 0) return null;
    return value;
  }

  /**
   * Match the detail-card formula exactly (GLOBAL + ¥2, ×cnyToUsd,
   * ×(1+commission)) so the "от $…" shown on the shelf equals the
   * totalUsd the customer sees once they open the card — see
   * docs/SHOP_MVP_PLAN.md §6. RUB conversion is deferred for now.
   */
  private computePriceUsd(priceCnyValue: number, settings: BusinessSettings): Prisma.Decimal {
    return new Prisma.Decimal(priceCnyValue)
      .plus(2)
      .mul(settings.cnyToUsd)
      .mul(new Prisma.Decimal(1).plus(settings.commissionPercent.div(100)))
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  }

  /** /search results carry a pre-parsed soldRank; /catalog only has soldText. */
  private resolveSoldRank(item: CatalogEngineItem): number {
    if (typeof item.soldRank === 'number' && Number.isFinite(item.soldRank) && item.soldRank > 0) {
      return item.soldRank;
    }
    return parseSoldRank(item.soldText);
  }
}
