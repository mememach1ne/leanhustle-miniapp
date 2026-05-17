import { BadRequestException, Injectable } from '@nestjs/common';

interface ResolvedDewuLink {
  originalLink: string;
  resolvedUrl: string;
  dwSpuId: string;
}

@Injectable()
export class DewuLinkResolverService {
  async resolve(rawLink: string): Promise<ResolvedDewuLink> {
    const normalizedLink = rawLink.trim();

    if (!normalizedLink) {
      throw new BadRequestException('Вставьте ссылку на товар Dewu.');
    }

    const parsedUrl = this.parseUrl(normalizedLink);

    if (!this.isSupportedHost(parsedUrl.hostname)) {
      throw new BadRequestException(
        'Ссылка не распознана. Поддерживаются короткие ссылки dw4.co и полные ссылки Dewu.',
      );
    }

    // Short links (dw4.co) are resolved directly by RapidAPI
    // because dw4.co servers are unreachable from non-Chinese hosts
    if (this.isShortLink(parsedUrl.hostname)) {
      return {
        originalLink: normalizedLink,
        resolvedUrl: normalizedLink,
        dwSpuId: '__short_link__',
      };
    }

    const dwSpuId = this.extractDwSpuId(normalizedLink);

    if (!dwSpuId) {
      throw new BadRequestException('Не удалось извлечь dwSpuId из ссылки Dewu.');
    }

    return {
      originalLink: normalizedLink,
      resolvedUrl: normalizedLink,
      dwSpuId,
    };
  }

  private parseUrl(rawLink: string): URL {
    try {
      return new URL(rawLink);
    } catch {
      throw new BadRequestException('Некорректная ссылка. Проверьте формат URL.');
    }
  }

  private isSupportedHost(hostname: string): boolean {
    return (
      this.isShortLink(hostname) ||
      hostname === 'dewu.com' ||
      hostname.endsWith('.dewu.com') ||
      hostname === 'poizon.com' ||
      hostname.endsWith('.poizon.com') ||
      hostname === 'poizonresell.com' ||
      hostname.endsWith('.poizonresell.com')
    );
  }

  private isShortLink(hostname: string): boolean {
    return hostname === 'dw4.co' || hostname.endsWith('.dw4.co');
  }

  private extractDwSpuId(link: string): string | null {
    const parsedUrl = this.parseUrl(link);

    const directMatch =
      parsedUrl.searchParams.get('spuId') ??
      parsedUrl.searchParams.get('dwSpuId') ??
      parsedUrl.searchParams.get('spu_id');

    if (directMatch) {
      return directMatch;
    }

    const pathnameMatch = parsedUrl.pathname.match(/(?:spuId|dwSpuId|productDetail)[=/:_-]?(\d+)/i);

    if (pathnameMatch?.[1]) {
      return pathnameMatch[1];
    }

    const fullLinkMatch = link.match(/(?:spuId|dwSpuId|spu_id)=([0-9]+)/i);

    return fullLinkMatch?.[1] ?? null;
  }
}
