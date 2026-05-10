import { SubscriptionVerificationStatus } from '@lean-poizon/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface MembershipCheckResult {
  isChannelSubscriber: boolean;
  verificationStatus: SubscriptionVerificationStatus;
  message?: string;
}

interface TelegramChatMemberResponse {
  ok: boolean;
  result?: {
    status: string;
  };
  description?: string;
}

const SUBSCRIBER_STATUSES = new Set(['member', 'administrator', 'creator']);
const NON_SUBSCRIBER_STATUSES = new Set(['left', 'kicked', 'restricted']);

@Injectable()
export class TelegramChannelMembershipService {
  private readonly logger = new Logger(TelegramChannelMembershipService.name);
  private readonly configService: ConfigService;

  constructor(@Inject(ConfigService) configService: ConfigService) {
    this.configService = configService;
  }

  async checkMembership(telegramId: string): Promise<MembershipCheckResult> {
    const botToken = this.configService.get<string>('telegram.botToken');
    const privateChannelId = this.configService.get<string>('telegram.privateChannelId');

    if (!botToken || !privateChannelId) {
      return {
        isChannelSubscriber: false,
        verificationStatus: SubscriptionVerificationStatus.FAILED,
        message: 'Проверка подписки не настроена на сервере.',
      };
    }

    try {
      const url = new URL(`https://api.telegram.org/bot${botToken}/getChatMember`);
      url.searchParams.set('chat_id', privateChannelId);
      url.searchParams.set('user_id', telegramId);

      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(10_000),
        headers: {
          Accept: 'application/json',
        },
      });
      const payload = (await response.json()) as TelegramChatMemberResponse;

      if (!response.ok || !payload.ok) {
        throw {
          description: payload.description ?? `Telegram API responded with status ${response.status}`,
        };
      }

      const memberStatus = payload.result?.status;

      if (memberStatus && SUBSCRIBER_STATUSES.has(memberStatus)) {
        return {
          isChannelSubscriber: true,
          verificationStatus: SubscriptionVerificationStatus.VERIFIED,
        };
      }

      if (memberStatus && NON_SUBSCRIBER_STATUSES.has(memberStatus)) {
        return {
          isChannelSubscriber: false,
          verificationStatus: SubscriptionVerificationStatus.VERIFIED,
        };
      }

      return {
        isChannelSubscriber: false,
        verificationStatus: SubscriptionVerificationStatus.FAILED,
        message: 'Telegram вернул неожиданный статус участника канала.',
      };
    } catch (error) {
      if (this.isTelegramApiError(error)) {
        const description = error.description.toLowerCase();

        if (description.includes('user not found') || description.includes('participant_id_invalid')) {
          return {
            isChannelSubscriber: false,
            verificationStatus: SubscriptionVerificationStatus.VERIFIED,
          };
        }

        if (
          description.includes('chat not found') ||
          description.includes('forbidden') ||
          description.includes('not enough rights')
        ) {
          this.logger.warn('Telegram channel membership check is not permitted', {
            description,
            telegramId,
          });

          return {
            isChannelSubscriber: false,
            verificationStatus: SubscriptionVerificationStatus.FAILED,
            message:
              'Бот не может проверить канал. Убедитесь, что бот добавлен в канал как администратор.',
          };
        }
      }

      this.logger.warn('Telegram channel membership check failed', {
        telegramId,
        error: this.getErrorMessage(error),
      });

      return {
        isChannelSubscriber: false,
        verificationStatus: SubscriptionVerificationStatus.FAILED,
        message: 'Не удалось проверить подписку через Telegram. Попробуйте ещё раз позже.',
      };
    }
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  private isTelegramApiError(error: unknown): error is { description: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'description' in error &&
      typeof (error as { description?: unknown }).description === 'string'
    );
  }
}
