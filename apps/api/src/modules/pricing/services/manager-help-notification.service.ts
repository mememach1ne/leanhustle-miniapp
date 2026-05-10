import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DELIVERY_CATEGORY_LABELS: Record<string, string> = {
  TSHIRT: 'Футболка',
  SHORTS: 'Шорты',
  PANTS: 'Брюки',
  HOODIE: 'Худи',
  SWEATSHIRT: 'Свитшот',
  JACKET: 'Куртка',
  SNEAKERS: 'Кроссовки',
  SLIDES: 'Сланцы / сандалии',
  BOOTS: 'Ботинки',
  WATCH: 'Часы',
  GLASSES: 'Очки',
  BAG: 'Сумка',
  SMALL_ACCESSORY: 'Небольшой аксессуар',
  GENERIC_APPAREL: 'Одежда',
};

@Injectable()
export class ManagerHelpNotificationService {
  private readonly logger = new Logger(ManagerHelpNotificationService.name);
  private readonly configService: ConfigService;

  constructor(@Inject(ConfigService) configService: ConfigService) {
    this.configService = configService;
  }

  async sendHelpRequest(params: {
    dewuLink: string;
    size?: string;
    deliveryCategory: string;
    comment?: string;
    username?: string | null;
    firstName: string;
    lastName?: string | null;
    telegramId: string;
  }): Promise<void> {
    const botToken = this.configService.get<string>('telegram.botToken');
    const managerTelegramIds =
      this.configService.get<string[]>('notifications.managerTelegramIds') ?? [];

    if (!botToken || managerTelegramIds.length === 0) {
      this.logger.warn('No bot token or manager IDs configured for help request notification');
      return;
    }

    const userLine = params.username
      ? `@${params.username}`
      : `${params.firstName}${params.lastName ? ` ${params.lastName}` : ''}`;

    const categoryLabel =
      DELIVERY_CATEGORY_LABELS[params.deliveryCategory] ?? params.deliveryCategory;

    const lines = [
      '📩 Запрос помощи с расчётом',
      '',
      `Пользователь: ${userLine}`,
      `Telegram ID: ${params.telegramId}`,
      '',
      `Ссылка: ${params.dewuLink}`,
      `Категория: ${categoryLabel}`,
      ...(params.size ? [`Размер: ${params.size}`] : []),
      ...(params.comment ? [`Комментарий: ${params.comment}`] : []),
      '',
      'Клиент не смог получить данные товара через API. Пожалуйста, помогите с расчётом.',
    ];

    const text = lines.join('\n');

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
              text,
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
            `Failed to send help request notification: ${
              result.reason instanceof Error ? result.reason.message : String(result.reason)
            }`,
          );
        }
      });
    });
  }
}
