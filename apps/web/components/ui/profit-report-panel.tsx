'use client';

import type { ProfitReportDto } from '@lean-poizon/shared';
import { useState } from 'react';

import { adminApi } from '../../lib/api-client';
import { extractAxiosMessage } from '../../lib/error-utils';
import { FeedbackMessage } from './feedback-message';
import { SectionCard } from './section-card';

// Default to the current month [1st .. today].
const firstOfMonth = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};
const today = (): string => new Date().toISOString().slice(0, 10);

const fmtRub = (n: number) => `${n.toLocaleString('ru-RU')} ₽`;
const fmtUsd = (n: number) => `$${n.toFixed(2)}`;

export function ProfitReportPanel({ onClose }: { onClose: () => void }) {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [report, setReport] = useState<ProfitReportDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = async () => {
    if (from > to) {
      setError('Начальная дата не может быть позже конечной.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getProfitReport(from, to);
      setReport(data);
    } catch (err) {
      setError(extractAxiosMessage(err) ?? 'Не удалось посчитать прибыль.');
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = async () => {
    if (from > to) {
      setError('Начальная дата не может быть позже конечной.');
      return;
    }
    setDownloading(true);
    setError(null);
    try {
      const blob = await adminApi.exportProfitReportExcel(from, to);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `profit_${from}_${to}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(extractAxiosMessage(err) ?? 'Не удалось скачать Excel.');
    } finally {
      setDownloading(false);
    }
  };

  const inputClass =
    'w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[var(--accent)]';

  return (
    <SectionCard>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Отчёт о прибыли</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white"
        >
          Закрыть
        </button>
      </div>

      {error ? <FeedbackMessage tone="error">{error}</FeedbackMessage> : null}

      <div className="space-y-3">
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="mb-1 block text-xs text-white/60">С</span>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex-1">
            <span className="mb-1 block text-xs text-white/60">По</span>
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <button
          type="button"
          onClick={loadPreview}
          disabled={loading}
          className="w-full rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
        >
          {loading ? 'Считаем…' : 'Посчитать'}
        </button>

        {report ? (
          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
            <Row label="Заказов учтено" value={String(report.ordersCount)} />
            <Row label="Выручка" value={fmtUsd(report.revenueUsd)} />
            <Row label="Комиссия сервиса" value={fmtUsd(report.grossCommissionUsd)} />
            <Row label="Скидки подписчикам" value={`−${fmtUsd(report.discountUsd)}`} />
            <div className="my-1 border-t border-white/10" />
            <Row
              label="Чистая прибыль"
              value={`${fmtUsd(report.netProfitUsd)} · ${fmtRub(report.netProfitRub)}`}
              accent
            />
            <div className="my-1 border-t border-white/10" />
            <Row
              label={`Доля инвестора (${report.investorSharePercent}%)`}
              value={fmtRub(report.investorShareRub)}
              accent
            />
            <Row
              label={`Ваша доля (${100 - report.investorSharePercent}%)`}
              value={fmtRub(report.ownerShareRub)}
              accent
            />
          </div>
        ) : null}

        <button
          type="button"
          onClick={downloadExcel}
          disabled={downloading}
          className="w-full rounded-[18px] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-slate-950 transition disabled:opacity-50"
        >
          {downloading ? 'Готовим файл…' : '📊 Скачать Excel'}
        </button>
      </div>
    </SectionCard>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-white/60">{label}</span>
      <span className={accent ? 'font-semibold text-[var(--accent)]' : 'text-white'}>
        {value}
      </span>
    </div>
  );
}
