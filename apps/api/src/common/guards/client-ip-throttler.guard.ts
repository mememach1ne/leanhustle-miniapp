import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

type RequestLike = {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
};

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

const header = (req: RequestLike, name: string): string | undefined => {
  const value = req.headers[name];
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
};

/**
 * Rate-limits per real client IP. All public traffic arrives as
 * Cloudflare → nginx → api, so req.ip is always 127.0.0.1 and the default
 * guard put every user into one shared bucket. Cloudflare's
 * CF-Connecting-IP carries the visitor's address.
 *
 * Direct loopback calls without nginx's headers come from our own bot
 * (port 3002 is firewalled from the internet) and are not throttled.
 */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: RequestLike): Promise<string> {
    return header(req, 'cf-connecting-ip') ?? header(req, 'x-real-ip') ?? req.ip ?? 'unknown';
  }

  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestLike>();
    const viaProxy = Boolean(header(req, 'x-real-ip') || header(req, 'cf-connecting-ip'));
    return !viaProxy && LOOPBACK.has(req.ip ?? '');
  }
}
