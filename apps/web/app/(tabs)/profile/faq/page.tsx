'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';

import { FaqAccordion } from '../../../../components/ui/faq-accordion';
import { PageSection } from '../../../../components/ui/page-section';
import { getTelegramWebApp } from '../../../../lib/telegram-web-app';

const FAQ_ITEMS = [
  {
    question: 'Сколько ждать доставку?',
    answer:
      'Среднее время доставки из Китая — 14-21 день. Сроки зависят от типа товара, загруженности логистики и таможенного оформления. После отправки вы получите трек-код для отслеживания.',
  },
  {
    question: 'Что такое пошлина и когда она применяется?',
    answer:
      'Таможенная пошлина взимается при превышении лимита беспошлинного ввоза. Мы заранее рассчитываем примерную сумму пошлины и включаем её в расчёт. Точная сумма может незначительно отличаться.',
  },
  {
    question: 'Как проверить подлинность товара?',
    answer:
      'Все товары заказываются напрямую через платформу Poizon, которая проводит проверку подлинности (легит-чек) каждого товара перед отправкой. Если вещь окажется неоригинальной, платформа отменит заказ и вернёт деньги.',
  },
  {
    question: 'Как отслеживать заказ?',
    answer:
      'Менеджер после получения трек-кода введет его в заказ. Вы получите уведомление в Telegram и сможете отследить посылку.',
  },
  {
    question: 'Можно ли вернуть или обменять товар?',
    answer:
      'Возврат возможен только в том случае, если товар еще не прибыл на склад в Китае. Свяжитесь с менеджером.',
  },
  {
    question: 'Почему цена может отличаться от Poizon?',
    answer:
      'Итоговая цена включает стоимость товара на Poizon, комиссию сервиса, доставку из Китая и таможенную пошлину. Курс юаня обновляется менеджером и может незначительно отличаться от рыночного.',
  },
  {
    question: 'Как происходит оплата?',
    answer:
      'После оформления заявки менеджер отправит вам реквизиты для оплаты. Выкуп товара оплачивается в долларах (USD), доставка и пошлина — в рублях (RUB).',
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
        Реальные отзывы наших клиентов и примеры выкупленных заказов можно посмотреть в наших
        каналах:{' '}
        <a
          href="https://t.me/lh_poizonreviews"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--accent)] underline-offset-2 hover:underline"
        >
          Отзывы
        </a>{' '}
        и{' '}
        <a
          href="https://t.me/lh_poizonpurchases"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--accent)] underline-offset-2 hover:underline"
        >
          Выкупы
        </a>
        .
      </>
    ),
  },
];

export default function FaqPage() {
  const router = useRouter();

  const handleBack = useCallback(() => {
    router.push('/profile');
  }, [router]);

  useEffect(() => {
    const webApp = getTelegramWebApp();
    const backButton = webApp?.BackButton;

    if (backButton) {
      backButton.onClick(handleBack);
      backButton.show();
    }

    return () => {
      if (backButton) {
        backButton.offClick(handleBack);
        backButton.hide();
      }
    };
  }, [handleBack]);

  return (
    <PageSection>
      <button
        type="button"
        onClick={handleBack}
        className="mb-2 text-xs text-[var(--muted)] transition hover:text-white"
      >
        ← Назад к профилю
      </button>
      <FaqAccordion items={FAQ_ITEMS} />
    </PageSection>
  );
}
