import { Module } from '@nestjs/common';

import { StaffModule } from '../staff/staff.module';
import { CbrRatesService } from './services/cbr-rates.service';
import { RatesSchedulerService } from './services/rates-scheduler.service';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [StaffModule],
  controllers: [SettingsController],
  providers: [SettingsService, CbrRatesService, RatesSchedulerService],
  exports: [SettingsService],
})
export class SettingsModule {}
