import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { RaketaClientService } from './raketa-client.service';

@Module({
  imports: [ConfigModule],
  providers: [RaketaClientService],
  exports: [RaketaClientService],
})
export class RaketaModule {}
