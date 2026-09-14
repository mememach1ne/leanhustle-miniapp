import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CatalogEngineClientService } from './services/catalog-engine-client.service';
import { CatalogSyncService } from './services/catalog-sync.service';

@Module({
  imports: [AuthModule, SettingsModule],
  controllers: [CatalogController],
  providers: [CatalogService, CatalogEngineClientService, CatalogSyncService],
  exports: [CatalogSyncService],
})
export class CatalogModule {}
