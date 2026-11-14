'use client';
import { useEffect, useRef, useState } from 'react';
import { Bell, Check } from 'lucide-react';
import type { State } from '@/lib/types';
import { LanguageSelector, useLanguage } from './language';
import LogoutButton from './logout-button';
import { notificationKey } from '@/lib/notifications';
export default function OverviewToolbar({ data, onMarkRead }: {
  data: State & { simulation: boolean };
  onMarkRead: (ids: string[]) => Promise<boolean>;
}) {
  const { t, locale } = useLanguage();
  const [open, setOpen] = useState<'activity' | 'profile' | null>(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState(false);
  const [visible, setVisible] = useState(20);
  const unread = data.audit.filter(event => !event.readAt);
  async function markRead(ids: string[]) {
    if (reading) return;
    setReading(true);
    setReadError(false);
    try { setReadError(!await onMarkRead(ids)); }
    finally { setReading(false); }
  }
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(null);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(null);
        root.current?.querySelector<HTMLButtonElement>(`[data-overview-menu="${open}"]`)?.focus();
      }
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div className="overview-toolbar" ref={root}>
      <span className="overview-mode">{data.simulation ? t('Simulação') : 'Live'}</span>
      <LanguageSelector />
      <div className="overview-toolbar-menu">
        <button
          className="overview-bell"
          data-overview-menu="activity"
          aria-label={`${t('Atividade recente')} · ${unread.length} ${t('não lidas')}`}
          aria-expanded={open === 'activity'}
          onClick={() => setOpen(open === 'activity' ? null : 'activity')}
        >
          <Bell size={23} />
          {unread.length > 0 && data.workspace?.notifyActivity !== false && <i className="overview-unread-badge" aria-hidden="true">{unread.length > 99 ? '99+' : unread.length}</i>}
        </button>
        {open === 'activity' && (
          <div className="overview-toolbar-popover">
            <h2>{t('Atividade recente')}</h2>
            {data.audit.length > 0 && <div className="overview-notification-tools">
              <span>{unread.length} {t('não lidas')}</span>
              <button disabled={reading || !unread.length} onClick={() => void markRead(unread.map(notificationKey))}>
                {t('Marcar todas como lidas')}
              </button>
            </div>}
            {readError && <p role="alert">{t('Não foi possível marcar como lida. Tente novamente.')}</p>}
            <div className="overview-notification-list">
            {data.audit.length ? (
              data.audit.slice(0, visible).map((event) => (
                <div className={`overview-notification ${event.readAt ? 'is-read' : 'is-unread'}`} key={notificationKey(event)}>
                  <Check size={15} />
                  <div>
                    <p>{t(event.text)}</p>
                    <time>{new Date(event.at).toLocaleString(locale)}</time>
                    <div className="overview-notification-state">
                      <span>{t(event.readAt ? 'Lida' : 'Não lida')}</span>
                      {!event.readAt && <button disabled={reading} onClick={() => void markRead([notificationKey(event)])}>
                        {t('Marcar como lida')}
                      </button>}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p>{t('Nenhum evento registrado.')}</p>
            )}
            </div>
            {visible < data.audit.length && <button className="overview-notification-more" onClick={() => setVisible(visible + 20)}>{t('Mostrar mais')}</button>}
          </div>
        )}
      </div>
      <div className="overview-toolbar-menu">
        <button
          className="overview-profile"
          data-overview-menu="profile"
          aria-label={t('Menu da conta')}
          aria-expanded={open === 'profile'}
          onClick={() => setOpen(open === 'profile' ? null : 'profile')}
        >
          A
        </button>
        {open === 'profile' && (
          <div className="overview-toolbar-popover overview-profile-popover">
            <h2>{t('Administrador')}</h2>
            <p>{t('Meu espaço de trabalho')}</p>
            <LogoutButton />
          </div>
        )}
      </div>
    </div>
  );
}
