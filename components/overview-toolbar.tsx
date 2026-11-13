'use client';
import { useEffect, useRef, useState } from 'react';
import { Bell, Check } from 'lucide-react';
import type { State } from '@/lib/types';
import { LanguageSelector, useLanguage } from './language';
import LogoutButton from './logout-button';
export default function OverviewToolbar({ data }: { data: State & { simulation: boolean } }) {
  const { t, locale } = useLanguage();
  const [open, setOpen] = useState<'activity' | 'profile' | null>(null);
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
          aria-label={t('Atividade recente')}
          aria-expanded={open === 'activity'}
          onClick={() => setOpen(open === 'activity' ? null : 'activity')}
        >
          <Bell size={23} />
          {data.audit.length > 0 && data.workspace?.notifyActivity !== false && <i />}
        </button>
        {open === 'activity' && (
          <div className="overview-toolbar-popover">
            <h2>{t('Atividade recente')}</h2>
            {data.audit.length ? (
              data.audit.slice(0, 3).map((event, index) => (
                <div className="overview-notification" key={`${event.at}-${index}`}>
                  <Check size={15} />
                  <div>
                    <p>{t(event.text)}</p>
                    <time>{new Date(event.at).toLocaleString(locale)}</time>
                  </div>
                </div>
              ))
            ) : (
              <p>{t('Nenhum evento registrado.')}</p>
            )}
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
