import { randomBytes } from 'crypto';

import type { AuthPayload } from '@lean-poizon/shared';
import { Injectable, NotFoundException } from '@nestjs/common';

const TTL_MS = 10 * 60 * 1000;
const BOT_USERNAME = 'lh_poizonbot';
const START_PREFIX = 'login_';

/** Sites the bot may send the user back to after confirming a login. */
const RETURN_ORIGINS = new Set([
  'https://china.leanhustle.net',
  'https://leanhustle.ru',
  'https://www.leanhustle.ru',
  'http://localhost:3000',
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
  | ({ status: 'confirmed' } & AuthPayload);

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
    return login.auth ? { status: 'confirmed', ...login.auth } : { status: 'pending' };
  }

  /** Called by the bot once the Telegram user is known; returns where to send them back. */
  confirm(token: string, auth: AuthPayload): { returnUrl: string } {
    const login = this.get(token);
    login.auth = auth;
    return { returnUrl: `${login.origin}/catalog?bot_login=${encodeURIComponent(token)}` };
  }

  /** Throws if the code is unknown or expired. */
  assertPending(token: string): void {
    this.get(token);
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
