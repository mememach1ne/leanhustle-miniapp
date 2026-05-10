'use client';

import { SubscriptionVerificationStatus } from '@lean-poizon/shared';
import Link from 'next/link';
import { useState } from 'react';

import { AuthDebugBlock } from '../../../components/debug/auth-debug-block';
import { EmptyState } from '../../../components/ui/empty-state';
import { FaqAccordion } from '../../../components/ui/faq-accordion';
import { FeedbackMessage } from '../../../components/ui/feedback-message';
import { LoadingBlock } from '../../../components/ui/loading-block';
import { PageSection } from '../../../components/ui/page-section';
import { SectionCard } from '../../../components/ui/section-card';
import { authApi } from '../../../lib/api-client';
import { extractAxiosMessage } from '../../../lib/error-utils';
import { useAuthStore } from '../../../store/auth-store';

const FAQ_ITEMS = [
  {
    question: 'Сколько ждать доставку?',
    answer: 'Среднее время доставки из Китая — 14-21 день. После отправки вы получите трек-код для отслеживания.',
  },
  {
    question: 'Что такое пошлина?',
    answer: 'Таможенная пошлина взимается при превышении лимита беспошлинного ввоза. Мы заранее рассчитываем примерную сумму и включаем в расчёт.',
  },
  {
    question: 'Как проверить подлинность?',
    answer: 'Все товары заказываются через Dewu (Poizon), которая проводит проверку подлинности каждого товара перед отправкой.',
  },
  {
    question: 'Как отслеживать заказ?',
    answer: 'Менеджер введёт трек-код в заявку. Вы получите уведомление в Telegram и сможете отследить посылку.',
  },
  {
    question: 'Можно ли вернуть товар?',
    answer: 'Возврат и обмен возможны только в случае брака или несоответствия описанию. Свяжитесь с менеджером.',
  },
  {
    question: 'Как происходит оплата?',
    answer: 'Менеджер отправит реквизиты для оплаты. Выкуп — в USD, доставка и пошлина — в RUB.',
  },
];

export default function ProfilePage() {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const error = useAuthStore((state) => state.error);
  const setUser = useAuthStore((state) => state.setUser);

  const [isRefreshingSubscription, setIsRefreshingSubscription] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const handleRefreshSubscription = async () => {
    setIsRefreshingSubscription(true);
    setRefreshMessage(null);
    setRefreshError(null);

    try {
      const response = await authApi.refreshChannelSubscription();
      setUser(response.user);

      if (response.verificationStatus === SubscriptionVerificationStatus.VERIFIED) {
        setRefreshMessage(
          response.user.isChannelSubscriber
            ? 'Статус подписки подтверждён.'
            : 'Подписка не найдена. Если вы только что подписались, попробуйте ещё раз через несколько секунд.',
        );
        return;
      }

      setRefreshError(
        response.message ??
          'Не удалось проверить подписку через Telegram. Попробуйте позже.',
      );
    } catch (requestError) {
      setRefreshError(
        extractAxiosMessage(requestError) ??
          'Не удалось обновить статус подписки. Попробуйте позже.',
      );
    } finally {
      setIsRefreshingSubscription(false);
    }
  };

  if (status === 'loading' || status === 'idle') {
    return (
      <PageSection>
        <AuthDebugBlock />
        <LoadingBlock
          title="Профиль загружается"
          description="Скоро покажем аккаунт, статус подписки и переход к заказам."
        />
      </PageSection>
    );
  }

  if (!user) {
    return (
      <PageSection>
        <AuthDebugBlock />
        <EmptyState
          title="Нужен вход через Telegram"
          description={
            error ??
            'Откройте mini app из Telegram, чтобы получить доступ к профилю и заказам.'
          }
        />
      </PageSection>
    );
  }

  return (
    <PageSection>
      <AuthDebugBlock />
      {refreshMessage ? <FeedbackMessage tone="success">{refreshMessage}</FeedbackMessage> : null}
      {refreshError ? <FeedbackMessage tone="error">{refreshError}</FeedbackMessage> : null}

      {/* Profile card */}
      <SectionCard>
        <div className="flex items-center gap-4">
          {user.photoUrl ? (
            <img
              src={user.photoUrl}
              alt={user.firstName}
              loading="lazy"
              decoding="async"
              className="h-16 w-16 rounded-[22px] bg-white/5 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[var(--accent)] text-lg font-semibold text-slate-950">
              {user.firstName.slice(0, 1).toUpperCase()}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-semibold text-white">
              {[user.firstName, user.lastName].filter(Boolean).join(' ')}
            </h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {user.username ? `@${user.username}` : 'Без username'}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          <Link
            href="/profile/delivery"
            className="w-full rounded-[20px] bg-[var(--accent)] px-4 py-3 text-center text-sm font-semibold text-slate-950 transition-opacity"
          >
            Мои данные
          </Link>

          <Link
            href="/profile/orders"
            className="w-full rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Мои заказы
          </Link>
        </div>
      </SectionCard>

      {/* Subscription card */}
      <SectionCard
        className={
          user.isChannelSubscriber
            ? 'border-emerald-400/20 bg-gradient-to-br from-emerald-400/5 to-transparent'
            : 'border-amber-400/20 bg-gradient-to-br from-amber-400/5 to-transparent'
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Приватный канал</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {user.isChannelSubscriber
                ? 'Подписка активна — скидка на комиссию применяется автоматически при заказе.'
                : 'Подпишитесь на приватный канал и получите скидку на комиссию при каждом заказе.'}
            </p>
          </div>
          <span
            className={[
              'shrink-0 rounded-full border px-3 py-1 text-xs font-semibold',
              user.isChannelSubscriber
                ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-200'
                : 'border-amber-300/30 bg-amber-400/15 text-amber-200',
            ].join(' ')}
          >
            {user.isChannelSubscriber ? 'Активна' : 'Не активна'}
          </span>
        </div>

        <div className="mt-4 grid gap-2">
          {!user.isChannelSubscriber ? (
            <a
              href="https://t.me/lh_crypto1/8439"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full rounded-[18px] bg-[var(--accent)] px-4 py-3 text-center text-sm font-semibold text-slate-950 transition active:scale-[0.98]"
            >
              Подписаться на канал
            </a>
          ) : null}
          <button
            type="button"
            onClick={handleRefreshSubscription}
            disabled={isRefreshingSubscription}
            className="w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRefreshingSubscription ? 'Проверяем...' : 'Обновить статус подписки'}
          </button>
        </div>
      </SectionCard>

      <div className="mt-2">
        <details className="group">
          <summary className="flex cursor-pointer items-center gap-2 px-1 py-2 text-sm font-semibold text-[var(--muted)] transition hover:text-white [&::-webkit-details-marker]:hidden">
            <span className="flex-shrink-0 text-xs transition-transform group-open:rotate-90">▶</span>
            Частые вопросы
          </summary>
          <div className="mt-2">
            <FaqAccordion items={FAQ_ITEMS} />
          </div>
        </details>
      </div>
    </PageSection>
  );
}
