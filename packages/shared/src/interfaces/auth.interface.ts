import type { UserProfile } from './user-profile.interface';

export interface TelegramAuthRequest {
  initData: string;
}

/**
 * Payload returned by the Telegram Login Widget (browser login, outside the
 * Mini App). All fields come straight from Telegram; the server re-validates
 * `hash` against the bot token before trusting any of them.
 */
export interface TelegramLoginWidgetPayload {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
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
