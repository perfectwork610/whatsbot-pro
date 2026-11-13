'use client';
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  MessageSquareMore,
  Send,
  Smartphone,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { State } from '@/lib/types';
import { overviewData } from '@/lib/overview-data';
import { useLanguage } from './language';
import { Card, Empty } from './workspace-ui';
import WhatsAppMark from './whatsapp-mark';
import MessageActivity from './message-activity';

function HeaderArtwork() {
  return (
    <div className="overview-header-art" aria-hidden="true">
      <svg className="overview-ribbon" viewBox="0 0 560 190">
        <defs>
          <linearGradient id="overview-wave" x1="0" y1="0" x2="1" y2="0">
            <stop stopColor="#6af3b1" stopOpacity="0" />
            <stop offset=".5" stopColor="#34ef8e" stopOpacity=".55" />
            <stop offset="1" stopColor="#48f7a1" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 132C100 190 117-9 254 80S409 146 560 40V122C420 78 409 190 262 132S137 163 0 170Z"
          fill="url(#overview-wave)"
        />
        <path
          d="M0 145C120 202 145 30 265 91S445 144 560 79"
          fill="none"
          stroke="url(#overview-wave)"
          strokeWidth="23"
        />
      </svg>
      <span className="overview-header-tile">
        <WhatsAppMark />
      </span>
      <span className="overview-mini-tile overview-mini-tile--left">
        <MessageSquareMore size={22} />
      </span>
      <span className="overview-mini-tile overview-mini-tile--right">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

function MetricGlyph({ kind }: { kind: string }) {
  if (kind === 'Total de contatos')
    return (
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="11" r="8" fill="currentColor" />
        <path d="M5 36v-5c0-7 6-10 15-10s15 3 15 10v5H5Z" fill="currentColor" />
      </svg>
    );
  if (kind === 'Mensagens enviadas')
    return (
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <path d="M4 17.5 35 4 28.5 36 18 25 4 21Z" fill="currentColor" />
        <path
          d="m10 20 18-9-10 14 1 7"
          stroke="#e9f9ff"
          strokeWidth="2"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  if (kind === 'Respostas')
    return (
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <path
          d="M5 16c0-7 4-10 15-10s15 3 15 10v7c0 6-4 9-15 9h-5l-7 5 1-8c-3-2-4-5-4-9Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <circle cx="15" cy="19" r="2" fill="currentColor" />
        <circle cx="25" cy="19" r="2" fill="currentColor" />
      </svg>
    );
  return <Check />;
}

export default function Overview({
  data,
  navigate,
  onCampaign,
  onAddAccount,
  onImport,
}: {
  data: State & { simulation: boolean };
  navigate: (
    tab:
      'Contatos' | 'Campanhas' | 'Conversas' | 'Contas WhatsApp' | 'Robô de envio' | 'Configurações',
  ) => void;
  onCampaign: () => void;
  onAddAccount: () => void;
  onImport: () => void;
}) {
  const { t, locale } = useLanguage();
  const stats = overviewData(data, data.simulation);
  const number = (value: number) => value.toLocaleString(locale);
  const rate = (value: number) =>
    value.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  function trend(value: { recent: number; percent: number | null }) {
    return value.percent === null ? (
      <>
        <span className="overview-trend-number">{number(value.recent)}</span>{' '}
        {t('nos últimos 7 dias')}
      </>
    ) : (
      <>
        <ArrowUpRight size={14} />
        <span className="overview-trend-number">
          {value.percent > 0 ? '+' : ''}
          {rate(value.percent)}
        </span>{' '}
        <span>{t('vs. últimos 7 dias')}</span>
      </>
    );
  }
  const metrics = [
    {
      title: 'Total de contatos',
      value: stats.contacts,
      icon: Users,
      tone: 'green',
      detail: trend(stats.contactChange),
    },
    {
      title: 'Mensagens enviadas',
      value: stats.sent,
      icon: Send,
      tone: 'blue',
      detail: trend(stats.sentChange),
    },
    {
      title: 'Entregues',
      value: stats.delivered,
      icon: Check,
      tone: 'cyan',
      detail: (
        <>
          <span className="overview-trend-number">{rate(stats.deliveryRate)}</span>{' '}
          {t('taxa de entrega')}
        </>
      ),
    },
    {
      title: 'Respostas',
      value: stats.replies,
      icon: MessageSquareMore,
      tone: 'purple',
      detail: (
        <>
          <span className="overview-trend-number">{rate(stats.replyRate)}</span>{' '}
          {t('taxa de resposta')}
        </>
      ),
    },
  ];
  const actions = [
    {
      title: 'Adicionar número WhatsApp',
      description: 'Conecte seu número comercial pela API oficial.',
      icon: Smartphone,
      tone: 'green',
      action: onAddAccount,
    },
    {
      title: 'Importar contatos',
      description: 'Envie CSV/TXT e organize seu público.',
      icon: Users,
      tone: 'blue',
      action: onImport,
    },
    {
      title: 'Criar campanha',
      description: 'Envie modelos de mensagem para seus contatos.',
      icon: Send,
      tone: 'purple',
      action: onCampaign,
    },
    {
      title: 'Robô de envio',
      description: 'Conecte números por QR e envie mensagens individuais.',
      icon: Bot,
      tone: 'orange',
      action: () => navigate('Robô de envio'),
    },
  ];
  function activityIcon(text: string): { icon: LucideIcon; tone: string } {
    if (text.startsWith('Importação')) return { icon: Users, tone: 'blue' };
    if (text.startsWith('Campanha')) return { icon: Send, tone: 'green' };
    if (text.includes('atendimento') || text.includes('automática'))
      return { icon: MessageSquareMore, tone: 'blue' };
    return { icon: Check, tone: 'green' };
  }
  function relative(at: string) {
    const minutes = Math.round((Date.parse(at) - Date.now()) / 60000);
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute');
    if (Math.abs(minutes) < 1440) return formatter.format(Math.round(minutes / 60), 'hour');
    return new Date(at).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  }
  return (
    <div className="overview-design">
      <section className="overview-header">
        <div className="overview-header-copy">
          <p className="overview-eyebrow">WHATS BOT PRO</p>
          <h1>{t('Sua operação em um só lugar')}</h1>
          <p className="overview-subtitle">
            {t('Contatos, campanhas e automação. Acompanhe suas atividades em tempo real.')}
          </p>
        </div>
        <HeaderArtwork />
        <button className="overview-new-campaign" onClick={onCampaign}>
          <span>＋</span>
          {t('Nova campanha')}
        </button>
      </section>
      <div className="overview-metrics">
        {metrics.map((metric) => (
          <Card key={metric.title} className={`overview-metric overview-tone--${metric.tone}`}>
            <span className="overview-metric-icon">
              <MetricGlyph kind={metric.title} />
            </span>
            <div>
              <h2>{t(metric.title)}</h2>
              <strong>{number(metric.value)}</strong>
              <p className="overview-metric-detail">{metric.detail}</p>
            </div>
          </Card>
        ))}
      </div>
      <div className="overview-data-grid">
        <Card className="overview-chart-card">
          <MessageActivity
            messages={data.messages}
            variant="overview"
            simulation={data.simulation}
          />
        </Card>
        <Card className="overview-recent-card">
          <div className="overview-section-heading">
            <h2>{t('Atividade recente')}</h2>
            <button onClick={() => navigate('Configurações')}>
              {t('Ver tudo')}
              <ArrowRight size={15} />
            </button>
          </div>
          {data.audit.length ? (
            <div className="overview-activity-feed">
              {data.audit.slice(0, 4).map((event, index) => {
                const { icon: Icon, tone } = activityIcon(event.text);
                return (
                  <div
                    className={`overview-activity-row overview-tone--${tone}`}
                    key={`${event.at}-${index}`}
                  >
                    <span className="overview-activity-icon">
                      <Icon size={24} />
                    </span>
                    <div>
                      <strong>{t(event.text)}</strong>
                      <time dateTime={event.at}>{relative(event.at)}</time>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty>{t('Sua atividade aparecerá aqui.')}</Empty>
          )}
        </Card>
      </div>
      <div className="overview-quick-actions">
        {actions.map((action) => (
          <button
            key={action.title}
            className={`overview-quick-action overview-tone--${action.tone}`}
            onClick={action.action}
          >
            <span className="overview-action-heading">
              <span className="overview-action-icon">
                {action.tone === 'green' ? <WhatsAppMark /> : <action.icon />}
              </span>
              <strong>{t(action.title)}</strong>
              <ArrowRight size={20} />
            </span>
            <span className="overview-action-bottom">
              <span>{t(action.description)}</span>
              <span>
                <ArrowRight size={21} />
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
