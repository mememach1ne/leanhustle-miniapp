import { randomBytes } from 'crypto';

import type { AuthPayload } from '@lean-poizon/shared';
import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';

const TTL_MS = 10 * 60 * 1000;
/** After the bot confirms, the code only needs to live long enough to get back to the site. */
const CONFIRMED_TTL_MS = 3 * 60 * 1000;
/** Upper bound on outstanding codes so the in-memory map can't be grown without limit. */
const MAX_PENDING = 20_000;
const BOT_USERNAME = 'lh_poizonbot';
const START_PREFIX = 'login_';

/** Sites the bot may send the user back to after confirming a login. */
const RETURN_ORIGINS = new Set([
  'https://china.leanhustle.net',
  'https://leanhustle.ru',
  'https://www.leanhustle.ru',
  ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000']),
]);
const DEFAULT_ORIGIN = 'https://china.leanhustle.net';

interface PendingLogin {
  origin: string;
  expiresAt: number;
  auth?: AuthPayload;
}

export interface BotLoginStartResult {
  token: string;
  botUrl: string;
  expiresAt: string;
}

export type BotLoginStatus =
  | { status: 'pending' }
  | { status: 'confirmed'; accessToken: string };

/**
 * Website login through the Telegram bot: the site gets a one-time code,
 * sends the visitor to t.me/<bot>?start=login_<code>, the bot confirms it
 * (after its channel-subscription gate) and the site polls for the JWT.
 *
 * Codes live in memory — a single api process, 10-minute lifetime; an api
 * restart just means the visitor clicks "Войти" again.
 */
@Injectable()
export class BotLoginService {
  private readonly logins = new Map<string, PendingLogin>();

  start(rawOrigin?: string): BotLoginStartResult {
    this.prune();
    if (this.logins.size >= MAX_PENDING) {
      throw new ServiceUnavailableException('Слишком много попыток входа. Попробуйте через минуту.');
    }
    const token = randomBytes(24).toString('base64url');
    const origin = rawOrigin && RETURN_ORIGINS.has(rawOrigin) ? rawOrigin : DEFAULT_ORIGIN;
    const expiresAt = Date.now() + TTL_MS;
    this.logins.set(token, { origin, expiresAt });

    return {
      token,
      botUrl: `https://t.me/${BOT_USERNAME}?start=${START_PREFIX}${token}`,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  status(token: string): BotLoginStatus {
    const login = this.get(token);
    return login.auth
      ? { status: 'confirmed', accessToken: login.auth.accessToken }
      : { status: 'pending' };
  }

  /** Called by the bot once the Telegram user is known; returns where to send them back. */
  confirm(token: string, auth: AuthPayload): { returnUrl: string } {
    const login = this.get(token);
    if (login.auth) {
      throw new NotFoundException('Этот вход уже подтверждён. Нажмите «Войти» на сайте ещё раз.');
    }
    login.auth = auth;
    login.expiresAt = Math.min(login.expiresAt, Date.now() + CONFIRMED_TTL_MS);
    return { returnUrl: `${login.origin}/catalog?bot_login=${encodeURIComponent(token)}` };
  }

  /** Throws if the code is unknown, expired or already confirmed. */
  assertPending(token: string): void {
    if (this.get(token).auth) {
      throw new NotFoundException('Этот вход уже подтверждён. Нажмите «Войти» на сайте ещё раз.');
    }
  }

  private get(token: string): PendingLogin {
    const login = this.logins.get(token);
    if (!login || login.expiresAt < Date.now()) {
      this.logins.delete(token);
      throw new NotFoundException('Ссылка для входа устарела. Нажмите «Войти» на сайте ещё раз.');
    }
    return login;
  }

  private prune(): void {
    const now = Date.now();
    for (const [token, login] of this.logins) {
      if (login.expiresAt < now) this.logins.delete(token);
    }
  }
}
