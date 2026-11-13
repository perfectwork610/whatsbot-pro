'use client';
import {
  BarChart3,
  Bot,
  Inbox,
  LayoutDashboard,
  Send,
  Settings,
  Smartphone,
  Users,
  Crown,
  ArrowRight,
} from 'lucide-react';
import { useLanguage } from './language';
import WhatsAppMark from './whatsapp-mark';
export type WorkspaceTab =
  | 'Visão geral'
  | 'Contatos'
  | 'Campanhas'
  | 'Robô de envio'
  | 'Conversas'
  | 'Contas WhatsApp'
  | 'Relatórios'
  | 'Configurações';
const groups = [
  {
    label: 'PRINCIPAL',
    items: [
      { name: 'Visão geral', icon: LayoutDashboard },
      { name: 'Contatos', icon: Users },
      { name: 'Campanhas', icon: Send },
      { name: 'Robô de envio', icon: Bot },
      { name: 'Conversas', icon: Inbox },
    ],
  },
  {
    label: 'CANAIS E ANÁLISES',
    items: [
      { name: 'Contas WhatsApp', icon: Smartphone },
      { name: 'Relatórios', icon: BarChart3 },
    ],
  },
  { label: 'ESPAÇO DE TRABALHO', items: [{ name: 'Configurações', icon: Settings }] },
];
export default function WorkspaceSidebar({
  tab,
  onNavigate,
  simulation,
  accountCount = 0,
  incomingCount = 0,
  workspaceName,
}: {
  tab: WorkspaceTab;
  onNavigate: (tab: WorkspaceTab) => void;
  simulation: boolean;
  accountCount?: number;
  incomingCount?: number;
  workspaceName?: string;
}) {
  const { t, locale } = useLanguage();
  return (
    <>
      <a href="/" className="workspace-brand">
        <WhatsAppMark />
        <span>
          WhatsBot <strong>Pro</strong>
          <small>{t('Automação do WhatsApp')}</small>
        </span>
      </a>
      <nav className="workspace-nav" aria-label={t('Navegação principal')}>
        {groups.map((group) => (
          <div key={group.label} className="workspace-nav-group">
            <p>{t(group.label)}</p>
            {group.items.map((item) => (
              <button
                key={item.name}
                aria-current={tab === item.name ? 'page' : undefined}
                onClick={() => onNavigate(item.name as WorkspaceTab)}
              >
                <item.icon size={18} />
                <span>{t(item.name)}</span>
                {item.name === 'Conversas' && incomingCount > 0 ? (
                  <small className="overview-inbox-count">
                    {incomingCount.toLocaleString(locale)}
                  </small>
                ) : null}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="overview-workspace-card">
        <h3>
          <Crown size={20} />
          {workspaceName || t('Meu espaço de trabalho')}
        </h3>
        <p>
          {accountCount.toLocaleString(locale)} {t('Contas WhatsApp')}
        </p>
        <span className="overview-workspace-mode">
          {t(simulation ? 'Ambiente de simulação' : 'Integração oficial Meta.')}
        </span>
        <div className="overview-workspace-accent" aria-hidden="true" />
        <button onClick={() => onNavigate('Contas WhatsApp')}>
          {t('Gerenciar contas')}
          <ArrowRight size={16} />
        </button>
      </div>
    </>
  );
}
