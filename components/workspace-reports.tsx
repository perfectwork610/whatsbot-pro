'use client';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCheck,
  Download,
  Send,
  TriangleAlert,
} from 'lucide-react';
import type { State } from '@/lib/types';
import { csvDownload } from '@/lib/csv';
import { messageColumns } from '@/lib/i18n';
import { useLanguage } from './language';
import { Badge, Button, Card, Empty, Initials, StatCard, statusLabels } from './workspace-ui';
import MessageActivity from './message-activity';
export default function WorkspaceReports({ data }: { data: State }) {
  const { t, locale } = useLanguage();
  return (
    <>
      <div className="workspace-report-metrics">
        {[
          { status: 'accepted', label: 'Aceita pela API', icon: Send, tone: 'green' as const },
          { status: 'delivered', label: 'Entregue', icon: Check, tone: 'blue' as const },
          { status: 'read', label: 'Lida', icon: CheckCheck, tone: 'purple' as const },
          { status: 'failed', label: 'Falha', icon: TriangleAlert, tone: 'amber' as const },
        ].map((metric) => (
          <StatCard
            key={metric.status}
            label={metric.label}
            icon={metric.icon}
            tone={metric.tone}
            value={data.messages
              .filter((m) => m.status === metric.status && !m.simulated)
              .length.toLocaleString(locale)}
            detail="Estado atual · envios reais"
          />
        ))}
      </div>
      <Card className="workspace-report-chart">
        <MessageActivity messages={data.messages} />
      </Card>
      <Card>
        <div className="workspace-section-heading">
          <div>
            <h2>{t('Registro de mensagens')}</h2>
            <p>{t('Todas as conversas, com transparência em cada envio.')}</p>
          </div>
          <Button
            secondary
            onClick={() =>
              csvDownload(locale === 'en' ? 'messages.csv' : 'mensagens.csv', [
                messageColumns[locale],
                ...data.messages.map((m) => [
                  m.createdAt,
                  data.contacts.find((c) => c.id === m.contactId)?.phone,
                  data.accounts.find((a) => a.id === m.accountId)?.name,
                  m.direction,
                  m.status,
                  m.simulated || false,
                  m.text,
                  m.error,
                ]),
              ])
            }
          >
            <Download size={15} />
            {t('Exportar relatório')}
          </Button>
        </div>
        <p className="mt-4 text-[10px] leading-6 text-slate-400">
          {t(
            'Entregas e leituras reais são atualizadas pelo webhook da Meta. Simulações ficam separadas.',
          )}
        </p>
        <div className="mt-4 max-h-[500px] overflow-auto">
          {data.messages
            .slice()
            .reverse()
            .map((message) => {
              const contact = data.contacts.find((c) => c.id === message.contactId);
              return (
                <div key={message.id} className="workspace-log-row">
                  <Initials name={contact?.name || '?'} />
                  <div>
                    <strong>{contact?.name || '—'}</strong>
                    <p>{message.text}</p>
                    <time>{new Date(message.createdAt).toLocaleString(locale)}</time>
                  </div>
                  {message.direction === 'in' ? <ArrowDownLeft /> : <ArrowUpRight />}
                  <Badge status={message.status} />
                </div>
              );
            })}
          {!data.messages.length && (
            <Empty>{t('Os resultados aparecerão após os primeiros envios.')}</Empty>
          )}
        </div>
      </Card>
    </>
  );
}
