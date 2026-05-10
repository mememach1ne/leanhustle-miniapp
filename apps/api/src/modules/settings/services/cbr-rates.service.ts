import { Injectable, Logger } from '@nestjs/common';

interface CbrValute {
  CharCode: string;
  Nominal: number;
  Value: number;
}

interface CbrDailyResponse {
  Date: string;
  Valute: Record<string, CbrValute>;
}

export interface CbrParsedRates {
  cnyToRub: number;
  eurToRub: number;
  date: string;
}

@Injectable()
export class CbrRatesService {
  private readonly logger = new Logger(CbrRatesService.name);

  private readonly JSON_URL = 'https://www.cbr-xml-daily.ru/daily_json.js';

  async fetchRates(): Promise<CbrParsedRates | null> {
    try {
      const response = await fetch(this.JSON_URL, {
        signal: AbortSignal.timeout(15_000),
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        this.logger.warn(`CBR API responded with status ${response.status}`);
        return null;
      }

      const data = (await response.json()) as CbrDailyResponse;

      const cny = data.Valute?.CNY;
      const eur = data.Valute?.EUR;

      if (!cny || !eur) {
        this.logger.warn('CBR response missing CNY or EUR valute data');
        return null;
      }

      // Nominal is usually 1 for EUR, and 1 for CNY
      // Value is the rate for Nominal units of currency
      const cnyToRub = cny.Value / cny.Nominal;
      const eurToRub = eur.Value / eur.Nominal;

      this.logger.log(
        `Fetched CBR rates for ${data.Date}: CNY/RUB=${cnyToRub.toFixed(4)}, EUR/RUB=${eurToRub.toFixed(4)}`,
      );

      return {
        cnyToRub: Math.round(cnyToRub * 10000) / 10000,
        eurToRub: Math.round(eurToRub * 10000) / 10000,
        date: data.Date,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch CBR rates: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
