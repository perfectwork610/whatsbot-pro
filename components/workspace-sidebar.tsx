'use client';
import {
  BarChart3,
  Bot,
  ChevronRight,
  Inbox,
  LayoutDashboard,
  Send,
  Settings,
  ShieldCheck,
  Smartphone,
  Users,
  MessageCircle,
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
  | 'Atendimento'
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
      { name: 'Atendimento', icon: MessageCircle },
      { name: 'Relatórios', icon: BarChart3 },
    ],
  },
  { label: 'ESPAÇO DE TRABALHO', items: [{ name: 'Configurações', icon: Settings }] },
];
export default function WorkspaceSidebar({
  tab,
  onNavigate,
  simulation,
  contactCount,
}: {
  tab: WorkspaceTab;
  onNavigate: (tab: WorkspaceTab) => void;
  simulation: boolean;
  contactCount: number;
}) {
  const { t, locale } = useLanguage();
  return (
    <>
      <a href="/" className="workspace-brand">
        <WhatsAppMark />
        <span>
          WhatsBot <strong>Pro</strong>
          <small>{t('SUA OPERAÇÃO, CONECTADA')}</small>
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
                {item.name === 'Contatos' && contactCount > 0 ? (
                  <small>{contactCount.toLocaleString(locale)}</small>
                ) : tab === item.name ? (
                  <span className="workspace-nav-active-dot" />
                ) : null}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="workspace-sidebar-bottom">
        <div className="workspace-channel-note">
          <span>
            <ShieldCheck size={20} />
          </span>
          <div>
            <strong>{simulation ? t('Ambiente de simulação') : 'WhatsApp Cloud API'}</strong>
            <p>{simulation ? t('Teste antes de conectar.') : t('Integração oficial Meta.')}</p>
          </div>
          <button onClick={() => onNavigate('Contas WhatsApp')} aria-label={t('Contas WhatsApp')}>
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="workspace-operator">
          <span>
            A<span />
          </span>
          <div>
            <strong>{t('Administrador')}</strong>
            <small>{t('Meu espaço de trabalho')}</small>
          </div>
          <span className="workspace-operator-dot" />
        </div>
      </div>
    </>
  );
}
