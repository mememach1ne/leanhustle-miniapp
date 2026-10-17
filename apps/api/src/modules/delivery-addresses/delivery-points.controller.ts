import type {
  DeliveryCarrier,
  DeliveryCityDto,
  DeliveryCityOptionsDto,
  DeliveryPointDto,
  DeliveryStreetSuggestionDto,
} from '@lean-poizon/shared';
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
import { RAKETA_TK, RaketaClientService } from '../raketa/raketa-client.service';

const CITY_ID_RE = /^[0-9a-f-]{36}$/i;
const POINTS_OF: Record<DeliveryCarrier, string> = {
  cdek: 'пунктов СДЭК',
  pochta: 'отделений Почты',
  raketa: 'пунктов выдачи',
};

/** City / pickup point / courier address directory (proxied from RAKETA) for the address form. */
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

  /** Which carriers have pickup points in the city and whether a courier goes there. */
  @Get('options')
  async cityOptions(@Query('cityId') cityId?: string): Promise<DeliveryCityOptionsDto> {
    if (!cityId || !CITY_ID_RE.test(cityId)) throw new BadRequestException('Укажите город.');
    try {
      const carriers = await this.raketa.getCityCarriers(cityId);
      return { pvz: carriers.pvz, courier: carriers.kd.some((c) => c === 'cdek' || c === 'pochta') };
    } catch (error) {
      this.logger.warn(`City options lookup failed (${cityId}): ${String(error)}`);
      // CDEK points exist almost everywhere — let the client go on with them.
      return { pvz: ['cdek'], courier: false };
    }
  }

  /** House suggestions for a courier address in the city. */
  @Get('streets')
  async streets(
    @Query('city') city?: string,
    @Query('region') region?: string,
    @Query('q') q?: string,
  ): Promise<DeliveryStreetSuggestionDto[]> {
    const query = (q ?? '').trim();
    if (query.length < 3) return [];
    if (query.length > 120 || (city ?? '').length > 128 || (region ?? '').length > 128) {
      throw new BadRequestException('Слишком длинный запрос.');
    }
    const cityName = (city ?? '').replace(/^г\s+/, '').trim();
    try {
      const list = await this.raketa.suggestAddress([region, cityName, query].filter(Boolean).join(' '));
      return list
        .filter((a) => a.house_number && a.index && (!cityName || (a.city ?? '').includes(cityName)))
        .map((a) => ({
          fullAddress: (a.full_adress ?? '').replace(/^\d{6},\s*/, ''),
          street: a.street_with_type ?? a.street ?? '',
          house: a.house_number as string,
          index: a.index as string,
        }))
        .slice(0, 10);
    } catch (error) {
      this.logger.warn(`Address suggestions failed: ${String(error)}`);
      throw new ServiceUnavailableException('Подсказки адресов временно недоступны. Попробуйте позже.');
    }
  }

  @Get('cdek')
  cdekPoints(@Query('cityId') cityId?: string): Promise<DeliveryPointDto[]> {
    return this.points(cityId, 'cdek');
  }

  /** Pickup points of a carrier in the city (CDEK, post offices, partner points). */
  @Get('points')
  async points(@Query('cityId') cityId?: string, @Query('carrier') carrier?: string): Promise<DeliveryPointDto[]> {
    if (!cityId || !CITY_ID_RE.test(cityId)) throw new BadRequestException('Укажите город.');
    const tk = (carrier ?? 'cdek') as DeliveryCarrier;
    if (!(tk in RAKETA_TK)) throw new BadRequestException('Неизвестная служба доставки.');
    try {
      const points = await this.raketa.getPickupPoints(tk, cityId);
      return points
        // CDEK lists parcel lockers too (sub-type "postamat") — only staffed points.
        .filter((p) => tk !== 'cdek' || (p.delivery_sub_type ?? 'pvz') === 'pvz')
        .map((p) => ({
          code: p.pvz_code,
          address: p.address || p.name || p.pvz_code,
          workTime: p.work_time ?? null,
          index: p.index ?? null,
          gps: p.GPS ?? null,
        }))
        .sort((a, b) => a.address.localeCompare(b.address, 'ru'));
    } catch (error) {
      this.logger.warn(`${tk} points lookup failed (${cityId}): ${String(error)}`);
      throw new ServiceUnavailableException(`Список ${POINTS_OF[tk]} временно недоступен. Попробуйте позже.`);
    }
  }
}
