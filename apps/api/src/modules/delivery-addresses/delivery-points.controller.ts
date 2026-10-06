import type { DeliveryCityDto, DeliveryPointDto } from '@lean-poizon/shared';
import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Logger,
  Query,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RaketaClientService } from '../raketa/raketa-client.service';

/** City / CDEK pickup point directory (proxied from RAKETA) for the address form. */
@Controller('delivery-points')
@UseGuards(JwtAuthGuard)
export class DeliveryPointsController {
  private readonly logger = new Logger(DeliveryPointsController.name);
  private readonly raketa: RaketaClientService;

  constructor(@Inject(RaketaClientService) raketa: RaketaClientService) {
    this.raketa = raketa;
  }

  @Get('cities')
  async cities(@Query('q') q?: string): Promise<DeliveryCityDto[]> {
    const query = (q ?? '').trim();
    if (query.length < 2) return [];
    if (query.length > 64) throw new BadRequestException('Слишком длинный запрос.');
    try {
      const cities = await this.raketa.searchCities(query);
      return cities.map((c) => ({
        id: c.id,
        city: c.city.replace(/^г\s+/, ''),
        region: c.region && c.region !== c.city ? c.region.trim() : null,
      }));
    } catch (error) {
      this.logger.warn(`City search failed: ${String(error)}`);
      throw new ServiceUnavailableException('Справочник городов временно недоступен. Попробуйте позже.');
    }
  }

  @Get('cdek')
  async cdekPoints(@Query('cityId') cityId?: string): Promise<DeliveryPointDto[]> {
    if (!cityId || !/^[0-9a-f-]{36}$/i.test(cityId)) throw new BadRequestException('Укажите город.');
    try {
      const points = await this.raketa.getCdekPickupPoints(cityId);
      return points
        .filter((p) => (p.delivery_sub_type ?? 'pvz') === 'pvz')
        .map((p) => ({
          code: p.pvz_code,
          address: p.address || p.name || p.pvz_code,
          workTime: p.work_time ?? null,
          index: p.index ?? null,
          gps: p.GPS ?? null,
        }))
        .sort((a, b) => a.address.localeCompare(b.address, 'ru'));
    } catch (error) {
      this.logger.warn(`CDEK points lookup failed (${cityId}): ${String(error)}`);
      throw new ServiceUnavailableException('Список пунктов СДЭК временно недоступен. Попробуйте позже.');
    }
  }
}
