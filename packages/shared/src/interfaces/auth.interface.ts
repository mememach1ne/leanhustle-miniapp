import type { UserProfile } from './user-profile.interface';

export interface TelegramAuthRequest {
  initData: string;
}

export interface AuthPayload {
  accessToken: string;
  user: UserProfile;
}

export interface JwtAccessPayload {
  sub: string;
  telegramId: string;
  iat?: number;
  exp?: number;
}
