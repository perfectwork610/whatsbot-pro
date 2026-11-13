'use client';
import type { ReactNode } from 'react';
import { Check, Inbox, type LucideIcon } from 'lucide-react';
import { useLanguage } from './language';

export const statusLabels: Record<string, string> = {
  draft: 'Rascunho',
  running: 'Em andamento',
  paused: 'Pausada',
  completed: 'Concluída',
  pending: 'Pendente',
  processing: 'Verificar envio',
  sent: 'Enviada',
  accepted: 'Aceita pela API',
  delivered: 'Entregue',
  read: 'Lida',
  failed: 'Falha',
  skipped: 'Ignorada',
  received: 'Recebida',
  simulated: 'Simulada',
};
export function Button({
  children,
  onClick,
  secondary = false,
  disabled = false,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`workspace-button ${secondary ? 'workspace-button--secondary' : 'workspace-button--primary'}`}
    >
      {children}
    </button>
  );
}
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`workspace-card ${className}`}>{children}</section>;
}
export function Empty({
  children,
  icon: Icon = Inbox,
}: {
  children: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="workspace-empty">
      <div className="workspace-empty-art" aria-hidden="true">
        <span />
        <Icon size={29} strokeWidth={1.6} />
        <i />
      </div>
      <p>{children}</p>
    </div>
  );
}
export function Badge({ status }: { status: string }) {
  const { t } = useLanguage();
  const tone = ['failed', 'paused'].includes(status)
    ? 'warning'
    : ['running', 'delivered', 'read', 'sent', 'APPROVED', 'Autorizado', 'Authorized'].includes(
          status,
        )
      ? 'success'
      : 'neutral';
  return (
    <span className={`workspace-badge workspace-badge--${tone}`}>
      <span />
      {t(statusLabels[status] || status)}
    </span>
  );
}
export function Label({ children }: { children: ReactNode }) {
  return <label className="workspace-label">{children}</label>;
}
export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'green',
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon: LucideIcon;
  tone?: 'green' | 'blue' | 'purple' | 'amber';
}) {
  const { t } = useLanguage();
  return (
    <Card className={`workspace-stat workspace-stat--${tone}`}>
      <div className="workspace-stat-heading">
        <span>{t(label)}</span>
        <div>
          <Icon size={20} />
        </div>
      </div>
      <strong className="workspace-stat-value">{value}</strong>
      {detail && (
        <p className="workspace-stat-detail">
          <span />
          <span>{t(detail)}</span>
        </p>
      )}
    </Card>
  );
}
export function Initials({ name }: { name: string }) {
  return (
    <span className="workspace-avatar" aria-hidden="true">
      {name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0))
        .join('')
        .toUpperCase() || <Check size={15} />}
    </span>
  );
}
