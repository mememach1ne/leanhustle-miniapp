import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { StaffAccount } from '@prisma/client';

import type { StaffBotRequest } from '../guards/staff-bot-auth.guard';

export const CurrentStaff = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): StaffAccount | undefined => {
    const request = ctx.switchToHttp().getRequest<StaffBotRequest>();
    return request.staff;
  },
);
