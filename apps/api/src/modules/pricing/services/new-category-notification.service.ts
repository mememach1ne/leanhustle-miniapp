import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface NewCategoryEvent {
  categoryL1?: string | null;
  categoryL2?: string | null;
  categoryL3?: string | null;
  productTitle: string;
  dewuLink: string;
  username?: string | null;
  firstName: string;
  telegramId: string;
  /** True if the row was just created (first time we see this category). */
  isFirstEncounter: boolean;
  encounterCount: number;
}

@Injectable()
export class NewCategoryNotificationService {
  private readonly logger = new Logger(NewCategoryNotificationService.name);
  private readonly configService: ConfigService;

  constructor(@Inject(ConfigService) configService: ConfigService) {
    this.configService = configService;
  }

  async notify(event: NewCategoryEvent): Promise<void> {
    const botToken = this.configService.get<string>('telegram.botToken');
    const managerTelegramIds =
      this.configService.get<string[]>('notifications.managerTelegramIds') ?? [];

    if (!botToken || managerTelegramIds.length === 0) {
      return;
    }

    const userLine = event.username
      ? `@${event.username}`
      : `${event.firstName} (id ${event.telegramId})`;

    const chain = [event.categoryL1, event.categoryL2, event.categoryL3]
      .filter(Boolean)
      .join(' › ') || 'нет категории от Poizon';

    const header = event.isFirstEncounter
      ? '🆕 Новая категория без веса'
      : '⏳ Товар без веса добавлен в корзину';

    const lines = [
      header,
      '',
      `Категория: ${chain}`,
      `Товар: ${event.productTitle}`,
      `Ссылка: ${event.dewuLink}`,
      '',
      `Пользователь: ${userLine}`,
      `Кол-во встреч: ${event.encounterCount}`,
      '',
      'Открой раздел «Непроверенные категории» в меню чтобы ввести вес.',
    ];

    await Promise.allSettled(
      managerTelegramIds.map(async (chatId) => {
        const response = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: 'POST',
            signal: AbortSignal.timeout(10_000),
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              chat_id: chatId,
              text: lines.join('\n'),
              disable_web_page_preview: true,
            }),
          },
        );
        const payload = (await response.json()) as { ok?: boolean; description?: string };
        if (!response.ok || !payload.ok) {
          throw new Error(payload.description ?? 'Telegram sendMessage failed');
        }
      }),
    ).then((results) => {
      results.forEach((result) => {
        if (result.status === 'rejected') {
          this.logger.warn(
            `Failed to send new-category notification: ${
              result.reason instanceof Error ? result.reason.message : String(result.reason)
            }`,
          );
        }
      });
    });
  }
}
