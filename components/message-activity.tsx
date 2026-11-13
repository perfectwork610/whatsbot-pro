'use client';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useId } from 'react';
import { CalendarDays } from 'lucide-react';
import type { Message } from '@/lib/types';
import { useLanguage } from './language';
export default function MessageActivity({ messages }: { messages: Message[] }) {
  const { t, locale } = useLanguage();
  const gradient = useId().replaceAll(':', '');
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - 6 + index);
    day.setHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setDate(end.getDate() + 1);
    const selected = messages.filter(
      (message) =>
        Date.parse(message.createdAt) >= day.getTime() &&
        Date.parse(message.createdAt) < end.getTime(),
    );
    return {
      day: day.toLocaleDateString(locale, { weekday: 'short' }),
      sent: selected.filter(
        (m) => m.direction === 'out' && !['failed', 'processing', 'skipped'].includes(m.status),
      ).length,
      received: selected.filter((m) => m.direction === 'in').length,
    };
  });
  return (
    <div className="workspace-activity">
      <div className="workspace-section-heading">
        <div>
          <h2>{t('Atividade de mensagens')}</h2>
          <p>{t('Uma visão diária das suas conversas.')}</p>
        </div>
        <span className="workspace-period">
          <CalendarDays size={14} />
          {t('Últimos 7 dias')}
        </span>
      </div>
      <div
        className="workspace-chart"
        role="img"
        aria-label={t('Mensagens enviadas e recebidas nos últimos sete dias')}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart data={days} margin={{ top: 20, right: 5, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#08b66b" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#08b66b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#edf3ef" strokeDasharray="3 5" vertical={false} />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#91a198' }}
              dy={10}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#91a198' }}
              domain={[0, 'auto']}
            />
            <Tooltip
              contentStyle={{
                border: '1px solid #e4eee7',
                borderRadius: 14,
                boxShadow: '0 12px 25px #052f2210',
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="sent"
              name={t('Enviadas')}
              stroke="#08ad65"
              strokeWidth={2.5}
              fill={`url(#${gradient})`}
            />
            <Area
              type="monotone"
              dataKey="received"
              name={t('Recebidas')}
              stroke="#8ca4ef"
              strokeWidth={2}
              fill="transparent"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="workspace-chart-legend">
        <span>
          <i />
          {t('Enviadas')}
        </span>
        <span>
          <i />
          {t('Recebidas')}
        </span>
        <small>{t('Inclui simulações identificadas nos relatórios.')}</small>
      </div>
    </div>
  );
}
