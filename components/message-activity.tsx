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
import { overviewMessageDays } from '@/lib/overview-data';
export default function MessageActivity({
  messages,
  variant = 'default',
  simulation = false,
  title = 'Atividade de mensagens',
}: {
  messages: Message[];
  variant?: 'default' | 'overview';
  simulation?: boolean;
  title?: string;
}) {
  const { t, locale } = useLanguage();
  const gradient = useId().replaceAll(':', '');
  const days =
    variant === 'overview'
      ? overviewMessageDays(messages, simulation, locale)
      : Array.from({ length: 7 }, (_, index) => {
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
              (m) =>
                m.direction === 'out' && !['failed', 'processing', 'skipped'].includes(m.status),
            ).length,
            received: selected.filter((m) => m.direction === 'in').length,
          };
        });
  return (
    <div className={`workspace-activity ${variant === 'overview' ? 'overview-activity' : ''}`}>
      <div className="workspace-section-heading">
        <div>
          <h2>{t(title)}</h2>
          {variant === 'default' && <p>{t('Uma visão diária das suas conversas.')}</p>}
        </div>
        {variant === 'overview' ? (
          <div className="overview-chart-legend">
            <span>
              <i />
              {t('Enviadas')}
            </span>
            <span>
              <i />
              {t('Entregues')}
            </span>
          </div>
        ) : (
          <span className="workspace-period">
            <CalendarDays size={14} />
            {t('Últimos 7 dias')}
          </span>
        )}
      </div>
      <div
        className="workspace-chart"
        role="img"
        aria-label={t(
          variant === 'overview'
            ? 'Mensagens enviadas e entregues nos últimos sete dias'
            : 'Mensagens enviadas e recebidas nos últimos sete dias',
        )}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart
            data={days}
            margin={
              variant === 'overview'
                ? { top: 16, right: 14, left: 0, bottom: 0 }
                : { top: 20, right: 5, left: -22, bottom: 0 }
            }
          >
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#08b66b" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#08b66b" stopOpacity={0} />
              </linearGradient>
              <linearGradient id={`${gradient}-delivered`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5dc7ff" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#5dc7ff" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="#e9eff0"
              strokeDasharray={variant === 'overview' ? undefined : '3 5'}
              vertical={false}
            />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{
                fontSize: variant === 'overview' ? 13 : 11,
                fill: variant === 'overview' ? '#526e7c' : '#91a198',
              }}
              dy={10}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#91a198' }}
              domain={[0, 'auto']}
              tickFormatter={(value) =>
                variant === 'overview' && value >= 1000 ? `${value / 1000}K` : String(value)
              }
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
              isAnimationActive={false}
              dot={variant === 'overview' ? { r: 4, fill: 'white', strokeWidth: 2 } : false}
            />
            <Area
              type="monotone"
              dataKey={variant === 'overview' ? 'delivered' : 'received'}
              name={t(variant === 'overview' ? 'Entregues' : 'Recebidas')}
              stroke={variant === 'overview' ? '#42b4fa' : '#8ca4ef'}
              strokeWidth={2}
              fill={variant === 'overview' ? `url(#${gradient}-delivered)` : 'transparent'}
              isAnimationActive={false}
              dot={variant === 'overview' ? { r: 4, fill: 'white', strokeWidth: 2 } : false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {variant === 'default' && (
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
      )}
    </div>
  );
}
