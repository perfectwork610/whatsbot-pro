'use client';
import {
  BarChart3,
  Bot,
  LayoutDashboard,
  Send,
  Settings,
  Smartphone,
  Users,
} from 'lucide-react';
import { useLanguage } from './language';
import WhatsAppMark from './whatsapp-mark';
export type WorkspaceTab =
  | 'Visão geral'
  | 'Contatos'
  | 'Campanhas'
  | 'Robô de envio'
  | 'Contas WhatsApp'
  | 'Relatórios'
  | 'Configurações';
const groups = [
  {
    label: 'ESPAÇO DE TRABALHO',
    kind: 'shared',
    description: '',
    items: [
      { name: 'Visão geral', icon: LayoutDashboard },
      { name: 'Contatos', icon: Users },
    ],
  },
  {
    label: '01 · WHATSAPP BUSINESS API',
    kind: 'api',
    description: 'Campanhas com modelos aprovados pela Meta',
    items: [
      { name: 'Campanhas', icon: Send },
      { name: 'Contas WhatsApp', icon: Smartphone },
      { name: 'Relatórios', icon: BarChart3 },
    ],
  },
  {
    label: '02 · WHATSAPP WEB · QR',
    kind: 'qr',
    description: 'Contato individual com números conectados por QR',
    items: [{ name: 'Robô de envio', icon: Bot }],
  },
  { label: 'PREFERÊNCIAS', kind: 'shared', description: '', items: [{ name: 'Configurações', icon: Settings }] },
];
export default function WorkspaceSidebar({
  tab,
  onNavigate,
}: {
  tab: WorkspaceTab;
  onNavigate: (tab: WorkspaceTab) => void;
}) {
  const { t } = useLanguage();
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
          <div key={group.label} className={`workspace-nav-group workspace-nav-group--${group.kind}`}>
            <p>{t(group.label)}</p>
            {group.description && <div className="workspace-nav-description">{t(group.description)}</div>}
            {group.items.map((item) => (
              <button
                key={item.name}
                aria-current={tab === item.name ? 'page' : undefined}
                onClick={() => onNavigate(item.name as WorkspaceTab)}
              >
                <item.icon size={18} />
                <span>{t(item.name)}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>
    </>
  );
}
