'use client';
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  Inbox,
  MessageCircle,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
} from 'lucide-react';
import type { State } from '@/lib/types';
import { useLanguage } from './language';
import { Button, Card, Empty, StatCard } from './workspace-ui';
import WhatsAppMark from './whatsapp-mark';
import MessageActivity from './message-activity';
export default function Overview({
  data,
  navigate,
}: {
  data: State & { simulation: boolean };
  navigate: (tab: 'Contatos' | 'Campanhas' | 'Conversas' | 'Contas WhatsApp') => void;
}) {
  const { t, locale } = useLanguage();
  const eligible = data.contacts.filter((c) => c.consent && !c.optedOut);
  const outbound = data.messages.filter((m) => m.direction === 'out');
  const format = (value: number) => value.toLocaleString(locale);
  const steps = [
    {
      title: 'Conecte seu WhatsApp',
      desc: 'Adicione seu número e configure sua conta oficial.',
      done: data.accounts.length > 0,
      icon: Smartphone,
      to: 'Contas WhatsApp' as const,
    },
    {
      title: 'Conheça seu público',
      desc: 'Importe seus contatos e registre as permissões.',
      done: eligible.length > 0,
      icon: Users,
      to: 'Contatos' as const,
    },
    {
      title: 'Comece a conversar',
      desc: 'Crie sua primeira campanha com um modelo aprovado.',
      done: data.campaigns.length > 0,
      icon: Send,
      to: 'Campanhas' as const,
    },
  ];
  return (
    <>
      <section className="workspace-welcome">
        <div className="workspace-welcome-copy">
          <span className="workspace-welcome-tag">
            <Sparkles size={13} />
            {t('Menos tarefas. Mais conexões.')}
          </span>
          <h2>
            {t('Cada conversa,')}
            <br />
            <span>{t('uma nova oportunidade.')}</span>
          </h2>
          <p>
            {t('Transforme sua comunicação em relacionamentos. Sua próxima conversa começa aqui.')}
          </p>
          <button onClick={() => navigate('Contatos')}>
            {t('Explorar meus contatos')}
            <ArrowRight size={17} />
          </button>
        </div>
        <div className="workspace-welcome-art" aria-hidden="true">
          <div className="workspace-orbit workspace-orbit--outer" />
          <div className="workspace-orbit workspace-orbit--inner" />
          <div className="workspace-orbit-center">
            <WhatsAppMark />
          </div>
          <div className="workspace-orbit-chip workspace-orbit-chip--top">
            <CheckCheck size={18} />
            {t('Conexões que importam')}
          </div>
          <div className="workspace-orbit-chip workspace-orbit-chip--bottom">
            <Users size={18} />
            <strong>{format(data.contacts.length)}</strong>
            {t('Contatos')}
          </div>
          <span className="workspace-art-spark workspace-art-spark--one" />
          <span className="workspace-art-spark workspace-art-spark--two" />
        </div>
      </section>
      <div className="workspace-metrics">
        <StatCard
          label="Contatos na base"
          value={format(data.contacts.length)}
          detail={`${eligible.length} com permissão`}
          icon={Users}
        />
        <StatCard
          label="Envios reais aceitos"
          value={format(
            outbound.filter(
              (m) => !m.simulated && !['failed', 'processing', 'skipped'].includes(m.status),
            ).length,
          )}
          detail={`${outbound.filter((m) => m.simulated).length} simulações`}
          icon={Send}
          tone="blue"
        />
        <StatCard
          label="Na fila"
          value={format(data.jobs.filter((j) => j.status === 'pending').length)}
          detail={`${data.campaigns.filter((c) => c.status === 'running').length} campanhas ativas`}
          icon={Clock3}
          tone="purple"
        />
        <StatCard
          label="Mensagens recebidas"
          value={format(data.messages.filter((m) => m.direction === 'in').length)}
          detail={`${data.accounts.length} contas cadastradas`}
          icon={MessageCircle}
          tone="amber"
        />
      </div>
      <div className="workspace-overview-grid">
        <Card>
          <MessageActivity messages={data.messages} />
        </Card>
        <Card className="workspace-recent">
          <div className="workspace-section-heading">
            <div>
              <h2>{t('Atividade recente')}</h2>
              <p>{t('Os últimos passos da sua operação.')}</p>
            </div>
            <span className="workspace-icon-muted">
              <Clock3 size={18} />
            </span>
          </div>
          {data.audit.length ? (
            <div className="workspace-timeline">
              {data.audit.slice(0, 5).map((event, index) => (
                <div key={`${event.at}-${index}`}>
                  <span className="workspace-timeline-dot">
                    <Check size={12} />
                  </span>
                  <div>
                    <p>{t(event.text)}</p>
                    <time>{new Date(event.at).toLocaleString(locale)}</time>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon={Clock3}>{t('Sua atividade aparecerá aqui.')}</Empty>
          )}
        </Card>
      </div>
      <Card className="workspace-get-started">
        <div className="workspace-section-heading">
          <div>
            <h2>{t('Seu próximo passo')}</h2>
            <p>{t('Uma operação completa, em três etapas simples.')}</p>
          </div>
          <span className="workspace-setup-count">
            {steps.filter((step) => step.done).length} / 3 <CheckCheck size={15} />
          </span>
        </div>
        <div className="workspace-setup-grid">
          {steps.map((step, index) => (
            <button key={step.to} onClick={() => navigate(step.to)}>
              <span className={`workspace-step-icon ${step.done ? 'is-complete' : ''}`}>
                {step.done ? <Check size={20} /> : <step.icon size={21} />}
              </span>
              <span>
                <small>
                  {t('Etapa')} 0{index + 1}
                </small>
                <strong>{t(step.title)}</strong>
                <p>{t(step.desc)}</p>
              </span>
              <ArrowUpRight size={17} />
            </button>
          ))}
        </div>
      </Card>
    </>
  );
}
