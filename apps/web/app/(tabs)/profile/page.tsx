'use client';

import { OrderStatus } from '@lean-poizon/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { AuthDebugBlock } from '../../../components/debug/auth-debug-block';
import { LoyaltyCard } from '../../../components/profile/loyalty-card';
import { EmptyState } from '../../../components/ui/empty-state';
import { FaqAccordion } from '../../../components/ui/faq-accordion';
import { ChatIcon, HelpIcon, LockIcon, MapPinIcon, ReceiptIcon } from '../../../components/ui/icons';
import { LoadingBlock } from '../../../components/ui/loading-block';
import { PageSection } from '../../../components/ui/page-section';
import { SectionCard } from '../../../components/ui/section-card';
import { ordersApi } from '../../../lib/api-client';
import { tokenStorage } from '../../../lib/token-storage';
import { useAuthStore } from '../../../store/auth-store';

const SUPPORT_TELEGRAM_URL = 'https://t.me/lh_poizonmanager';

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

  if (status === 'loading' || status === 'idle') {
    return (
      <PageSection>
        <AuthDebugBlock />
        <LoadingBlock
          title="Профиль загружается"
          description="Скоро покажем аккаунт и переход к заказам."
        />
      </PageSection>
    );
  }

  if (!user) {
    return (
      <PageSection>
        <AuthDebugBlock />
        <EmptyState
          icon={<LockIcon />}
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

      {/* Account card with stats. */}
      <SectionCard>
        <div className="flex items-center gap-3">
          {user.photoUrl ? (
            <img
              src={user.photoUrl}
              alt={user.firstName}
              loading="lazy"
              decoding="async"
              className="h-14 w-14 shrink-0 rounded-[18px] bg-white/5 object-cover"
            />
          ) : (
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-[linear-gradient(135deg,#5b4bd6,#29C3C5)] text-xl font-extrabold text-white">
              {user.firstName.slice(0, 1).toUpperCase()}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-extrabold text-white">
              {[user.firstName, user.lastName].filter(Boolean).join(' ')}
            </h3>
            <p className="mt-0.5 truncate text-[13px] font-semibold text-[var(--muted)]">
              {user.username ? `@${user.username}` : 'Без username'}
              {user.staffRole ? ` · ${roleLabel}` : ''}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat label="Заказов" value={orderStats === null ? '—' : String(orderStats.count)} />
          <Stat
            label="Сумма заказов"
            value={orderStats === null ? '—' : `$${orderStats.sumUsd.toFixed(2)}`}
          />
        </div>
      </SectionCard>

      {/* Quick actions — round icon buttons. */}
      <div className="lg-surface grid grid-cols-4 gap-1 rounded-[22px] px-1.5 py-3">
        <ActionButton href="/profile/orders" label="Заказы" icon={<ReceiptIcon className="h-[21px] w-[21px]" />} />
        <ActionButton href="/profile/delivery" label="Адреса" icon={<MapPinIcon className="h-[21px] w-[21px]" />} />
        <ActionButton href={SUPPORT_TELEGRAM_URL} external label="Поддержка" icon={<ChatIcon className="h-[21px] w-[21px]" />} />
        <ActionButton href="/profile/faq" label="FAQ" icon={<HelpIcon className="h-[21px] w-[21px]" />} />
      </div>

      <div>
        {/* Loyalty program — live tier / discount / progress. */}
        <LoyaltyCard />
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] px-3 py-2.5">
      <p className="font-display text-[16px] font-bold text-white">{value}</p>
      <p className="mt-0.5 text-[11.5px] font-semibold text-[var(--muted)]">{label}</p>
    </div>
  );
}

function ActionButton({
  href,
  label,
  icon,
  external = false,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  external?: boolean;
}) {
  const content = (
    <>
      <span className="mx-auto mb-1.5 grid h-11 w-11 place-items-center rounded-full bg-[var(--surface-2)] text-white">
        {icon}
      </span>
      <span className="block text-center text-[11.5px] font-bold text-white">{label}</span>
    </>
  );
  const className = 'block transition active:scale-95';

  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {content}
    </a>
  ) : (
    <Link href={href} className={className}>
      {content}
    </Link>
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
