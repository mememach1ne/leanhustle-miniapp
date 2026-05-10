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
      'Все товары заказываются напрямую через платформу Dewu (Poizon), которая проводит собственную проверку подлинности. Каждый товар проходит аутентификацию перед отправкой покупателю.',
  },
  {
    question: 'Как отслеживать заказ?',
    answer:
      'После выкупа товара менеджер введёт трек-код в вашу заявку. Вы получите уведомление в Telegram и сможете отследить посылку по трек-коду на сайте транспортной компании.',
  },
  {
    question: 'Можно ли вернуть или обменять товар?',
    answer:
      'Так как товар заказывается индивидуально из Китая, возврат и обмен возможны только в случае брака или несоответствия товара описанию. Свяжитесь с менеджером для решения вопроса.',
  },
  {
    question: 'Почему цена может отличаться от Dewu?',
    answer:
      'Итоговая цена включает стоимость товара на Dewu, комиссию сервиса, доставку из Китая и таможенную пошлину. Курс юаня обновляется менеджером и может незначительно отличаться от рыночного.',
  },
  {
    question: 'Как происходит оплата?',
    answer:
      'После оформления заявки менеджер отправит вам реквизиты для оплаты. Выкуп товара оплачивается в долларах (USD), доставка и пошлина — в рублях (RUB).',
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
