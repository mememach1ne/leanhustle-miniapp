import type { JwtAccessPayload } from '@lean-poizon/shared';
import type { User } from '@prisma/client';

interface AuthHeaders {
  authorization?: string;
  [key: string]: string | string[] | undefined;
}

export interface AuthenticatedRequest {
  headers: AuthHeaders;
  user?: User;
  auth?: JwtAccessPayload;
}
