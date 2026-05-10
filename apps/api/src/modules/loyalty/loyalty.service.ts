import { Injectable } from '@nestjs/common';

import { LoyaltyQueryDto } from './dto/loyalty-query.dto';

@Injectable()
export class LoyaltyService {
  getStatus(query: LoyaltyQueryDto) {
    return {
      message: 'Loyalty stub',
      query,
    };
  }
}
