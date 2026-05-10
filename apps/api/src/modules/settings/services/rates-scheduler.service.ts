import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { SettingsService } from '../settings.service';
import { CbrRatesService } from './cbr-rates.service';

@Injectable()
export class RatesSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(RatesSchedulerService.name);
  private readonly cbrRatesService: CbrRatesService;
  private readonly settingsService: SettingsService;

  /** Track the last successfully applied date to avoid duplicate updates */
  private lastAppliedDate: string | null = null;

  /** Retry state */
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;
  private readonly MAX_RETRIES = 18; // 18 × 10 min = 3 hours max
  private readonly RETRY_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

  constructor(
    @Inject(CbrRatesService) cbrRatesService: CbrRatesService,
    @Inject(SettingsService) settingsService: SettingsService,
  ) {
    this.cbrRatesService = cbrRatesService;
    this.settingsService = settingsService;
  }

  /**
   * On app startup: check if rates are stale (updatedAt < today) and update if needed.
   * Uses a short delay to let the rest of the app initialize first.
   */
  async onModuleInit(): Promise<void> {
    // Small delay so startup logs are clean and DB connections are ready
    setTimeout(() => {
      void this.checkAndUpdateOnStartup();
    }, 5_000);
  }

  private async checkAndUpdateOnStartup(): Promise<void> {
    try {
      const settings = await this.settingsService.getCurrentSettings();
      const updatedAt = new Date(settings.updatedAt);
      const today = new Date();

      // Compare dates (ignore time) in Moscow timezone (UTC+3)
      const mskOffset = 3 * 60 * 60 * 1000;
      const updatedDateMsk = new Date(updatedAt.getTime() + mskOffset)
        .toISOString()
        .slice(0, 10);
      const todayDateMsk = new Date(today.getTime() + mskOffset)
        .toISOString()
        .slice(0, 10);

      if (updatedDateMsk === todayDateMsk) {
        this.logger.log(
          `CBR rates already updated today (${updatedDateMsk}), skipping startup update.`,
        );
        return;
      }

      this.logger.log(
        `CBR rates last updated ${updatedDateMsk}, today is ${todayDateMsk}. Updating on startup...`,
      );

      this.retryCount = 0;
      await this.tryUpdateRates();
    } catch (error) {
      this.logger.warn(
        `Startup rates check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Primary trigger: every day at 12:00 Moscow time (UTC+3 = 09:00 UTC).
   */
  @Cron('0 9 * * *', { name: 'cbr-rates-update' })
  async handleDailyUpdate(): Promise<void> {
    this.logger.log('Starting daily CBR rates update...');
    this.retryCount = 0;
    this.clearRetryTimer();
    await this.tryUpdateRates();
  }

  private async tryUpdateRates(): Promise<void> {
    const rates = await this.cbrRatesService.fetchRates();

    if (!rates) {
      this.scheduleRetry('Failed to fetch rates from CBR');
      return;
    }

    // Check if rates have actually updated (new date)
    if (this.lastAppliedDate === rates.date) {
      this.scheduleRetry(`CBR rates date unchanged (${rates.date}), waiting for update`);
      return;
    }

    try {
      await this.settingsService.updateRatesFromCbr({
        cnyToRub: rates.cnyToRub,
        eurToRub: rates.eurToRub,
      });

      this.lastAppliedDate = rates.date;
      this.retryCount = 0;
      this.clearRetryTimer();

      this.logger.log(
        `CBR rates applied: CNY/RUB=${rates.cnyToRub}, EUR/RUB=${rates.eurToRub} (date: ${rates.date})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to save CBR rates: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.scheduleRetry('Failed to save rates to database');
    }
  }

  private scheduleRetry(reason: string): void {
    this.retryCount++;

    if (this.retryCount > this.MAX_RETRIES) {
      this.logger.warn(
        `Giving up on CBR rates update after ${this.MAX_RETRIES} retries. Reason: ${reason}`,
      );
      return;
    }

    this.logger.log(
      `${reason}. Retry ${this.retryCount}/${this.MAX_RETRIES} in 10 minutes.`,
    );

    this.clearRetryTimer();
    this.retryTimer = setTimeout(() => {
      void this.tryUpdateRates();
    }, this.RETRY_INTERVAL_MS);
  }

  private clearRetryTimer(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }
}
