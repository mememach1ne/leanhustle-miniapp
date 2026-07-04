'use client';

import { OrderStatus, SubscriptionVerificationStatus } from '@lean-poizon/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { AuthDebugBlock } from '../../../components/debug/auth-debug-block';
import { LoyaltyCard } from '../../../components/profile/loyalty-card';
import { EmptyState } from '../../../components/ui/empty-state';
import { FaqAccordion } from '../../../components/ui/faq-accordion';
import { FeedbackMessage } from '../../../components/ui/feedback-message';
import { LoadingBlock } from '../../../components/ui/loading-block';
import { PageSection } from '../../../components/ui/page-section';
import { SectionCard } from '../../../components/ui/section-card';
import { authApi, ordersApi } from '../../../lib/api-client';
import { extractAxiosMessage } from '../../../lib/error-utils';
import { tokenStorage } from '../../../lib/token-storage';
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
    answer: 'Все товары заказываются через Poizon, которая проводит проверку подлинности (легит-чек) каждого товара перед отправкой. Если вещь окажется неоригинальной, платформа отменит заказ и вернёт деньги.',
  },
  {
    question: 'Как отслеживать заказ?',
    answer: 'Менеджер после получения трек-кода введет его в заказ. Вы получите уведомление в Telegram и сможете отследить посылку.',
  },
  {
    question: 'Можно ли вернуть товар?',
    answer: 'Возврат возможен только в том случае, если товар еще не прибыл на склад в Китае. Свяжитесь с менеджером.',
  },
  {
    question: 'Как происходит оплата?',
    answer: 'Менеджер отправит реквизиты для оплаты. Выкуп — в USD, доставка и пошлина — в RUB.',
  },
  {
    question: 'Почему на POIZON всё так дешево?',
    answer:
      'Это не дешево — это реальные цены за эти товары, но без накрутки со стороны ретейлеров и посредников. Мы берем комиссию непосредственно за заказ и более ни за что. Стоковые магазины в России, в которых вы можете обнаружить тот же Nike, но в 4 раза дороже, накручивают цену, так как их издержки на персонал, логистику, аренду и так далее, куда выше, чем наши. Если вы зайдете на официальные сайты брендов в Европе или США, вы увидите те же самые цены, что и на POIZON.',
  },
  {
    question: 'Как правильно подобрать размер?',
    answer: (
      <>
        Чаще всего у товаров указаны размерные сетки, но если вы не разобрались в них, вы можете
        обратиться к{' '}
        <a
          href="https://t.me/lh_poizonmanager"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--accent)] underline-offset-2 hover:underline"
        >
          нашему менеджеру
        </a>
        , и он обязательно поможет вам с решением данного вопроса.
      </>
    ),
  },
  {
    question: 'Где почитать отзывы?',
    answer: (
      <>
        Реальные отзывы наших клиентов и примеры выкупленных заказов — в наших каналах:
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="https://t.me/lh_poizonreviews"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/15 px-3 py-1.5 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/25 active:scale-95"
          >
            ⭐️ Отзывы
          </a>
          <a
            href="https://t.me/lh_poizonpurchases"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/15 px-3 py-1.5 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/25 active:scale-95"
          >
            📦 Выкупы
          </a>
        </div>
      </>
    ),
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
  const [orderStats, setOrderStats] = useState<{ count: number; sumUsd: number } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    ordersApi
      .getOrders()
      .then((orders) => {
        if (cancelled) return;
        const active = orders.filter((o) => o.status !== OrderStatus.CANCELLED);
        const sumUsd = active.reduce((sum, o) => sum + o.totalUsd, 0);
        setOrderStats({ count: active.length, sumUsd });
      })
      .catch(() => {
        // Non-critical — the stat cards just show a dash.
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const roleLabel = user.staffRole
    ? user.staffRole === 'ADMIN'
      ? 'Администратор'
      : 'Менеджер'
    : 'Клиент';

  return (
    <PageSection>
      <AuthDebugBlock />
      {refreshMessage ? <FeedbackMessage tone="success">{refreshMessage}</FeedbackMessage> : null}
      {refreshError ? <FeedbackMessage tone="error">{refreshError}</FeedbackMessage> : null}

      {/* Account header */}
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

          <span className="hidden shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60 sm:inline-block">
            {roleLabel}
          </span>
        </div>
      </SectionCard>

      {/* Real stats — no overlap with the subscription panel. */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Заказов"
          value={orderStats === null ? '—' : String(orderStats.count)}
        />
        <StatCard
          label="Сумма заказов"
          value={orderStats === null ? '—' : `$${orderStats.sumUsd.toFixed(2)}`}
          accent
        />
      </div>

      {/* Subscription — mobile only; on desktop it lives in the sidebar. */}
      <div className="lg:hidden">
        <div className="lg-accent-card rounded-[28px] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Приватный канал</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {user.isChannelSubscriber
                  ? 'Подписка активна — скидка на комиссию применяется автоматически при заказе.'
                  : 'Подпишитесь и получайте скидку на комиссию при каждом заказе.'}
              </p>
            </div>
            <span
              className={[
                'shrink-0 rounded-full border px-3 py-1 text-xs font-semibold',
                user.isChannelSubscriber
                  ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-200'
                  : 'border-[var(--accent)]/30 bg-[var(--accent)]/15 text-[var(--accent)]',
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
                className="lg-accent-button w-full rounded-[18px] px-4 py-3 text-center text-sm font-semibold text-slate-950 transition active:scale-[0.98]"
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
        </div>
      </div>

      {/* Two equal-height columns: account actions | loyalty teaser. */}
      <div className="lg:grid lg:grid-cols-2 lg:items-stretch lg:gap-6">
        {/* Quick actions */}
        <SectionCard className="flex flex-col">
          <div className="flex flex-1 flex-col justify-center gap-2">
            <Link
              href="/profile/delivery"
              className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 px-4 py-3.5 transition hover:bg-white/10"
            >
              <div>
                <p className="text-sm font-medium text-white">Мои данные</p>
                <p className="mt-0.5 text-xs text-white/40">ФИО, адрес СДЭК, телефон</p>
              </div>
              <span className="text-white/30">→</span>
            </Link>
            <Link
              href="/profile/orders"
              className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 px-4 py-3.5 transition hover:bg-white/10"
            >
              <div>
                <p className="text-sm font-medium text-white">Мои заказы</p>
                <p className="mt-0.5 text-xs text-white/40">История и статусы заказов</p>
              </div>
              <span className="text-white/30">→</span>
            </Link>
          </div>
        </SectionCard>

        {/* Loyalty program — live tier / discount / progress. */}
        <LoyaltyCard className="mt-4 lg:mt-0" />
      </div>

      {/* FAQ — full-width, left aligned, two columns on desktop */}
      <details className="group">
        <summary className="flex cursor-pointer items-center gap-2 py-2 text-base font-semibold text-white [&::-webkit-details-marker]:hidden">
          <span className="flex-shrink-0 text-xs text-[var(--muted)] transition-transform group-open:rotate-90">▶</span>
          Часто задаваемые вопросы
        </summary>
        <div className="mt-3">
          <FaqAccordion
            items={FAQ_ITEMS}
            className="space-y-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0"
          />
        </div>
      </details>

      {/* Logout — mobile browser only (desktop uses the sidebar). */}
      <div className="lg:hidden">
        <LogoutButton />
      </div>
    </PageSection>
  );
}

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <SectionCard className="!px-4 !py-3">
      <p className={['text-lg font-bold', accent ? 'text-[var(--accent)]' : 'text-white'].join(' ')}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-white/40">{label}</p>
    </SectionCard>
  );
}

/**
 * Browser-only "Выйти" button. Hidden inside Telegram, where the session is
 * managed by the Mini App and there's nothing to log out of.
 */
function LogoutButton() {
  const isTelegramEnvironment = useAuthStore((state) => state.isTelegramEnvironment);
  const logout = useAuthStore((state) => state.logout);

  if (isTelegramEnvironment) return null;

  const handleLogout = () => {
    tokenStorage.clear();
    logout();
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="mt-4 w-full rounded-[18px] border border-rose-400/30 bg-rose-400/10 px-4 py-2.5 text-sm font-semibold text-rose-200 transition hover:bg-rose-400/20"
    >
      Выйти
    </button>
  );
}
