'use client';
import { useId, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowUpRight,
  ArrowDownRight,
  Check,
  Download,
  Send,
  X,
  CalendarDays,
  MessageCircle,
  BarChart3,
  Megaphone,
  FileText,
  ArrowRight,
  Clock,
} from 'lucide-react';
import type { State } from '@/lib/types';
import { csvDownload } from '@/lib/csv';
import { messageColumns } from '@/lib/i18n';
import { reportData } from '@/lib/reports-data';
import { useLanguage } from './language';
export default function WorkspaceReports({ data }: { data: State & { simulation: boolean } }) {
  const { t, locale } = useLanguage();
  const [days, setDays] = useState(7),
    [simulated, setSimulated] = useState(data.simulation),
    [detail, setDetail] = useState<'campaigns' | 'messages'>('campaigns'),
    [page, setPage] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const gradient = useId().replaceAll(':', '');
  const zone = data.workspace?.timeZone || 'UTC';
  const report = useMemo(
    () => reportData(data, simulated, days, zone),
    [data, simulated, days, zone],
  );
  const s = report.summary;
  const n = (value: number) => value.toLocaleString(locale),
    percent = (value: number) =>
      value.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  const date = (at: string) =>
    new Date(at).toLocaleString(locale, {
      timeZone: zone,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  const shortDate = (key: string) =>
    new Date(key + 'T12:00:00Z').toLocaleDateString(locale, {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
    });
  const contactNames = new Map(data.contacts.map((c) => [c.id, c.name]));
  const phones = new Map(data.contacts.map((c) => [c.id, c.phone]));
  const accounts = new Map(data.accounts.map((a) => [a.id, a.name]));
  const chart = report.chart.map((point) => ({ ...point, day: shortDate(point.key) }));
  function open(kind: 'campaigns' | 'messages') {
    setDetail(kind);
    setPage(0);
    dialog.current?.showModal();
  }
  function exportReport() {
    csvDownload(locale === 'en' ? 'report.csv' : 'relatorio.csv', [
      messageColumns[locale],
      ...report.messages.map((m) => [
        m.createdAt,
        phones.get(m.contactId),
        accounts.get(m.accountId),
        m.direction,
        m.status,
        m.simulated || false,
        m.text,
        m.error,
      ]),
    ]);
  }
  function campaignTable(all = false) {
    const rows = all ? report.campaigns : report.campaigns.slice(0, 3);
    return (
      <div className="reports-table-scroll">
        <table>
          <thead>
            <tr>
              {[
                'Nome da campanha',
                'Enviadas',
                'Entregues',
                'Lidas',
                'Falhas',
                'Taxa de entrega',
              ].map((label) => (
                <th key={label}>{t(label)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.campaign.id}>
                <td>
                  <span className="reports-campaign-name">
                    <span className={`reports-campaign-icon reports-campaign-icon--${i % 3}`}>
                      <Megaphone size={21} />
                    </span>
                    <span>
                      <strong>{row.campaign.name}</strong>
                      <time>{date(row.campaign.createdAt)}</time>
                    </span>
                  </span>
                </td>
                <td>{n(row.sent)}</td>
                <td>{n(row.delivered)}</td>
                <td>{n(row.read)}</td>
                <td>{n(row.failed)}</td>
                <td>
                  <div className="reports-campaign-rate">
                    <strong>{percent(row.deliveryRate)}</strong>
                    <span>
                      <i style={{ width: `${row.deliveryRate}%` }} />
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="reports-empty">{t('Nenhuma campanha neste período.')}</div>
        )}
      </div>
    );
  }
  return (
    <div className="reports-page">
      <header className="reports-heading">
        <div>
          <h1>{t('Relatórios')}</h1>
          <p>{t('Acompanhe o desempenho das mensagens, entregas e engajamento.')}</p>
        </div>
        <div className="reports-heading-actions">
          <label className="reports-period">
            <CalendarDays size={21} />
            <select
              aria-label={t('Período do relatório')}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {[7, 30, 90].map((value) => (
                <option key={value} value={value}>
                  {t('Últimos')} {value} {t('dias')}
                </option>
              ))}
            </select>
          </label>
          <button className="reports-export" onClick={exportReport}>
            <Download size={20} />
            {t('Exportar relatório')}
          </button>
        </div>
      </header>
      <div className="reports-mode">
        <label>
          {t('Dados do relatório')}
          <select
            aria-label={t('Dados do relatório')}
            value={simulated ? 'simulation' : 'live'}
            onChange={(e) => setSimulated(e.target.value === 'simulation')}
          >
            <option value="live">{t('Envios reais')}</option>
            <option value="simulation">{t('Simulação')}</option>
          </select>
        </label>
        <span>
          {report.start} — {report.end} · {zone}
        </span>
      </div>
      <div className="reports-stats">
        {[
          {
            label: 'Mensagens enviadas',
            value: s.sent,
            icon: Send,
            tone: 'green',
            detail:
              report.change === null ? (
                <>
                  <b>{n(s.sent)}</b> {t('no período selecionado')}
                </>
              ) : (
                <>
                  {report.change >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  <b>
                    {report.change > 0 ? '+' : ''}
                    {percent(report.change)}
                  </b>{' '}
                  {t('vs. período anterior')}
                </>
              ),
          },
          {
            label: 'Entregues',
            value: s.delivered,
            icon: Check,
            tone: 'mint',
            detail: (
              <>
                <b>{percent(s.deliveryRate)}</b> {t('taxa de entrega')}
              </>
            ),
          },
          {
            label: 'Lidas',
            value: s.read,
            icon: MessageCircle,
            tone: 'purple',
            detail: (
              <>
                <b>{percent(s.readRate)}</b> {t('taxa de leitura')}
              </>
            ),
          },
          {
            label: 'Falhas',
            value: s.failed,
            icon: X,
            tone: 'amber',
            detail: (
              <>
                <b>{percent(s.failureRate)}</b> {t('taxa de falha')}
              </>
            ),
          },
        ].map((metric) => (
          <section className={`reports-stat reports-stat--${metric.tone}`} key={metric.label}>
            <span>
              <metric.icon size={34} />
            </span>
            <div>
              <h2>{t(metric.label)}</h2>
              <strong>{n(metric.value)}</strong>
              <p>{metric.detail}</p>
            </div>
          </section>
        ))}
      </div>
      <div className="reports-analytics">
        <section className="reports-activity reports-card">
          <header>
            <div>
              <h2>{t('Atividade de mensagens')}</h2>
              <p>{t('Volume diário de mensagens enviadas, entregues e lidas.')}</p>
            </div>
            <div className="reports-legend">
              {[
                { key: 'sent', label: 'Enviadas' },
                { key: 'delivered', label: 'Entregues' },
                { key: 'read', label: 'Lidas' },
              ].map((item) => (
                <span key={item.key}>
                  <i className={`reports-legend--${item.key}`} />
                  {t(item.label)}
                </span>
              ))}
            </div>
          </header>
          <div
            className="reports-chart"
            role="img"
            aria-label={t('Mensagens enviadas, entregues e lidas por dia')}
          >
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={chart} margin={{ top: 15, right: 20, left: -12, bottom: 0 }}>
                <defs>
                  {[
                    { key: 'sent', color: '#17b54c' },
                    { key: 'delivered', color: '#0087ff' },
                    { key: 'read', color: '#a244ff' },
                  ].map((item) => (
                    <linearGradient
                      key={item.key}
                      id={`${gradient}-${item.key}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={item.color} stopOpacity={0.17} />
                      <stop offset="100%" stopColor={item.color} stopOpacity={0.01} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid stroke="#edf1f5" strokeDasharray="3 4" vertical={false} />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#34536a' }}
                  minTickGap={35}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#34536a' }}
                  tickFormatter={(value) => (value >= 1000 ? `${value / 1000}K` : String(value))}
                />
                <Tooltip
                  formatter={(value, name) => [
                    n(Number(value)),
                    t(
                      (
                        { sent: 'Enviadas', delivered: 'Entregues', read: 'Lidas' } as Record<
                          string,
                          string
                        >
                      )[String(name)],
                    ),
                  ]}
                  contentStyle={{ borderRadius: 12, borderColor: '#e4eee8', fontSize: 12 }}
                />
                {[
                  { key: 'sent', color: '#17b54c' },
                  { key: 'delivered', color: '#0087ff' },
                  { key: 'read', color: '#a244ff' },
                ].map((item) => (
                  <Area
                    key={item.key}
                    type="monotone"
                    dataKey={item.key}
                    stroke={item.color}
                    strokeWidth={3}
                    fill={`url(#${gradient}-${item.key})`}
                    dot={days <= 30 ? { r: 3, strokeWidth: 1, fill: item.color } : false}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="reports-delivery reports-card">
          <h2>{t('Visão geral das entregas')}</h2>
          <div className="reports-delivery-body">
            <div
              className="reports-ring"
              role="img"
              aria-label={`${percent(s.deliveryRate)} ${t('Entregues')}`}
              style={{
                background: `conic-gradient(#159d58 0deg ${s.deliveryRate * 3.6}deg,#e9f1ec ${s.deliveryRate * 3.6}deg 360deg)`,
              }}
            >
              <div>
                <strong>{percent(s.deliveryRate)}</strong>
                <span>{t('Entregues')}</span>
              </div>
            </div>
            <div className="reports-delivery-totals">
              {[
                { label: 'Enviadas', value: s.sent, icon: Send, tone: 'green' },
                { label: 'Entregues', value: s.delivered, icon: Check, tone: 'blue' },
                { label: 'Lidas', value: s.read, icon: MessageCircle, tone: 'purple' },
                { label: 'Falhas', value: s.failed, icon: X, tone: 'red' },
              ].map((item) => (
                <div key={item.label}>
                  <span className={`reports-tiny-icon reports-tiny-icon--${item.tone}`}>
                    <item.icon size={18} />
                  </span>
                  <span>{t(item.label)}</span>
                  <strong>{n(item.value)}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      <div className="reports-bottom">
        <section className="reports-campaigns reports-card">
          <header>
            <div>
              <h2>{t('Desempenho das campanhas')}</h2>
              <p>{t('Resultados das suas campanhas recentes.')}</p>
            </div>
            <button onClick={() => open('campaigns')}>
              {t('Ver tudo')}
              <ArrowRight size={17} />
            </button>
          </header>
          {campaignTable()}
        </section>
        <section className="reports-insights reports-card">
          <h2>
            <BarChart3 size={23} />
            {t('Principais indicadores')}
          </h2>
          <div className="reports-insight">
            <span>
              <ArrowUpRight size={26} />
            </span>
            <div>
              <strong>
                {report.change === null
                  ? n(s.sent)
                  : `${report.change > 0 ? '+' : ''}${percent(report.change)}`}
              </strong>
              <p>
                {t(
                  report.change === null
                    ? 'Mensagens enviadas no período selecionado.'
                    : 'Variação dos envios em relação ao período anterior.',
                )}
              </p>
            </div>
          </div>
          <div className="reports-insight">
            <span>
              <Check size={26} />
            </span>
            <div>
              <strong>{percent(s.deliveryRate)}</strong>
              <p>{t('Mensagens entregues em relação às enviadas.')}</p>
            </div>
          </div>
          <div className="reports-insight reports-insight--purple">
            <span>
              <MessageCircle size={26} />
            </span>
            <div>
              <strong>{percent(s.readRate)}</strong>
              <p>{t('Mensagens lidas em relação às enviadas.')}</p>
            </div>
          </div>
          <button className="reports-log-button" onClick={() => open('messages')}>
            <FileText size={15} />
            {t('Registro de mensagens')}
            <ArrowRight size={15} />
          </button>
        </section>
      </div>
      <dialog ref={dialog} className="reports-dialog" aria-labelledby="reports-dialog-title">
        <header>
          <h2 id="reports-dialog-title">
            {t(detail === 'campaigns' ? 'Desempenho das campanhas' : 'Registro de mensagens')}
          </h2>
          <button aria-label={t('Fechar relatório')} onClick={() => dialog.current?.close()}>
            <X size={20} />
          </button>
        </header>
        <p className="reports-dialog-period">
          {report.start} — {report.end} · {t(simulated ? 'Simulação' : 'Envios reais')}
        </p>
        {detail === 'campaigns' ? (
          campaignTable(true)
        ) : (
          <>
            <div className="reports-message-log">
              {[...report.messages]
                .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
                .slice(page * 50, page * 50 + 50)
                .map((m) => (
                  <article key={m.id}>
                    <div>
                      <strong>{contactNames.get(m.contactId) || '—'}</strong>
                      <span>
                        {accounts.get(m.accountId)} ·{' '}
                        {t(m.direction === 'in' ? 'Recebida' : 'Enviada')} · {m.status}
                      </span>
                      <time>{date(m.createdAt)}</time>
                    </div>
                    <p>{m.text}</p>
                    {m.error && <small>{t(m.error)}</small>}
                  </article>
                ))}
              {!report.messages.length && (
                <p className="reports-empty">{t('Nenhuma mensagem neste período.')}</p>
              )}
            </div>
            <footer>
              <button disabled={!page} onClick={() => setPage(page - 1)}>
                {t('Anterior')}
              </button>
              <span>
                {page + 1} / {Math.max(1, Math.ceil(report.messages.length / 50))}
              </span>
              <button
                disabled={(page + 1) * 50 >= report.messages.length}
                onClick={() => setPage(page + 1)}
              >
                {t('Próxima')}
              </button>
            </footer>
          </>
        )}
      </dialog>
    </div>
  );
}
