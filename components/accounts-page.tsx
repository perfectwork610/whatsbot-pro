'use client';
import DismissibleDialog from './dismissible-dialog';
import { useEffect, useRef, useState } from 'react';
import {
  Smartphone,
  Check,
  Send,
  Users,
  Plus,
  Search,
  LayoutGrid,
  List,
  MoreHorizontal,
  RefreshCw,
  Settings,
  X,
  CircleCheck,
  FlaskConical,
  Link2Off,
  FileText,
  Trash2,
} from 'lucide-react';
import type { Account, State } from '@/lib/types';
import { useLanguage } from './language';
import WhatsAppMark from './whatsapp-mark';
import { Badge } from './workspace-ui';
type AccountData = Account & { configured: boolean };
type Data = Omit<State, 'accounts'> & { accounts: AccountData[]; simulation: boolean };
export default function AccountsPage({
  data,
  busy,
  onAdd,
  onAction,
}: {
  data: Data;
  busy: boolean;
  onAdd: () => void;
  onAction: (payload: object, message: string) => Promise<boolean>;
}) {
  const { t, locale } = useLanguage();
  const [filter, setFilter] = useState('all'),
    [search, setSearch] = useState(''),
    [view, setView] = useState('grid'),
    [menu, setMenu] = useState<string | null>(null),
    [editing, setEditing] = useState<AccountData | null>(null),
    [panel, setPanel] = useState('settings'),
    [saveError, setSaveError] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const [deleting, setDeleting] = useState<AccountData | null>(null);
  const [deleted, setDeleted] = useState<AccountData | null>(null);
  const [deleteError, setDeleteError] = useState(false);
  function confirmDelete(account: AccountData) {
    setDeleting(account);
    setDeleteError(false);
    setMenu(null);
    deleteDialog.current?.showModal();
  }
  useEffect(() => {
    if (!menu) return;
    const outside = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('.accounts-menu-area')) setMenu(null);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [menu]);
  const ready = (a: AccountData) =>
    a.enabled !== false && (data.simulation || (!a.simulationOnly && a.configured));
  const readyCount = data.accounts.filter(ready).length;
  const sending = new Set(
    data.campaigns
      .filter(
        (c) =>
          c.status === 'running' && data.accounts.some((a) => a.id === c.accountId && ready(a)),
      )
      .map((c) => c.accountId),
  ).size;
  const limit = data.accounts.reduce((sum, a) => sum + a.dailyLimit, 0);
  const sent = (id: string) =>
    data.messages.filter(
      (m) =>
        m.accountId === id &&
        m.direction === 'out' &&
        m.status !== 'failed' &&
        Date.parse(m.createdAt) > Date.now() - 86400000,
    ).length;
  const rows = data.accounts.filter(
    (a) =>
      (filter === 'all' || (filter === 'ready' ? ready(a) : !ready(a))) &&
      `${a.name} ${a.displayPhone || ''} ${a.phoneId}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );
  const n = (x: number) => x.toLocaleString(locale);
  const current = editing ? data.accounts.find((a) => a.id === editing.id) || editing : null;
  function open(a: AccountData, tab = 'settings') {
    setEditing(a);
    setPanel(tab);
    setSaveError(false);
    setMenu(null);
    dialog.current?.showModal();
  }
  function phone(a: AccountData) {
    const value = a.displayPhone;
    if (!value) return `Phone Number ID: ${a.phoneId}`;
    if (/^55\d{11}$/.test(value))
      return `+55 ${value.slice(2, 4)} ${value.slice(4, 9)}-${value.slice(9)}`;
    return '+' + value;
  }
  function status(a: AccountData) {
    return a.enabled === false
      ? 'Inativa'
      : data.simulation
        ? 'Simulação'
        : a.simulationOnly
          ? 'Conta de teste'
          : a.configured
            ? 'Credencial configurada'
            : 'Não configurada';
  }
  async function sync(a: AccountData) {
    const ok = await onAction({ action: 'sync', id: a.id }, 'Modelos sincronizados.');
    if (!ok) setSaveError(true);
  }
  return (
    <div className="accounts-page">
      <header className="accounts-heading">
        <div>
          <h1>{t('Contas WhatsApp')}</h1>
          <p>
            {t(
              'Gerencie e conecte suas contas do WhatsApp Business. Use vários números para ampliar sua operação.',
            )}
          </p>
        </div>
        <button className="accounts-primary" onClick={onAdd}>
          <Plus size={20} />
          {t('Adicionar conta')}
        </button>
      </header>
      {deleted && <div className="accounts-deleted" role="status">
        <span>{t('Conta excluída')}: <strong>{deleted.name}</strong></span>
        <button disabled={busy} onClick={async () => {
          if (await onAction({ action: 'account-restore', id: deleted.id }, 'Conta restaurada como inativa.')) setDeleted(null);
        }}>{t('Desfazer')}</button>
      </div>}
      <div className="accounts-stats">
        {[
          {
            label: 'Total de contas',
            value: data.accounts.length,
            icon: Smartphone,
            tone: 'green',
            detail: t('Contas cadastradas'),
          },
          {
            label: 'Prontas para envio',
            value: readyCount,
            icon: Check,
            tone: 'mint',
            detail: t(data.simulation ? 'Prontas na simulação' : 'Credenciais configuradas'),
          },
          {
            label: 'Enviando',
            value: sending,
            icon: Send,
            tone: 'purple',
            detail: t('Campanhas ativas'),
          },
          {
            label: 'Limite diário',
            value: limit,
            icon: Users,
            tone: 'amber',
            detail: t('Total em todas as contas'),
          },
        ].map((metric) => (
          <section className={`accounts-stat accounts-stat--${metric.tone}`} key={metric.label}>
            <span>
              <metric.icon size={33} />
            </span>
            <div>
              <h2>{t(metric.label)}</h2>
              <strong>{n(metric.value)}</strong>
              <p>{metric.detail}</p>
            </div>
          </section>
        ))}
      </div>
      <div className="accounts-toolbar">
        <div className="accounts-tabs" role="tablist" aria-label={t('Filtrar contas')}>
          {[
            { value: 'all', label: 'Todas as contas', count: data.accounts.length },
            { value: 'ready', label: 'Prontas', count: readyCount },
            {
              value: 'unavailable',
              label: 'Indisponíveis',
              count: data.accounts.length - readyCount,
            },
          ].map((tab) => (
            <button
              key={tab.value}
              role="tab"
              aria-selected={filter === tab.value}
              onClick={() => setFilter(tab.value)}
            >
              {t(tab.label)} ({n(tab.count)})
            </button>
          ))}
        </div>
        <label className="accounts-search">
          <Search size={19} />
          <input
            aria-label={t('Buscar conta')}
            placeholder={t('Buscar conta, número ou nome...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="accounts-view" role="group" aria-label={t('Visualização')}>
          {[
            { value: 'grid', label: 'Grade', icon: LayoutGrid },
            { value: 'list', label: 'Lista', icon: List },
          ].map((v) => (
            <button
              key={v.value}
              aria-label={t(v.label)}
              aria-pressed={view === v.value}
              onClick={() => setView(v.value)}
            >
              <v.icon size={22} />
            </button>
          ))}
        </div>
      </div>
      <div className={`accounts-grid accounts-grid--${view}`}>
        {rows.map((a) => {
          const used = sent(a.id),
            percentage = a.dailyLimit ? Math.round((used / a.dailyLimit) * 100) : 0;
          return (
            <article className="accounts-account" key={a.id}>
              <header>
                <span className="accounts-wa-icon">
                  <WhatsAppMark />
                </span>
                <div className="accounts-identity">
                  <div>
                    <button onClick={() => open(a)}>{a.name}</button>
                    <span className={`accounts-badge ${ready(a) ? 'accounts-badge--ready' : ''}`}>
                      {data.simulation ? (
                        <FlaskConical size={12} />
                      ) : ready(a) ? (
                        <CircleCheck size={12} />
                      ) : (
                        <Link2Off size={12} />
                      )}{' '}
                      {t(status(a))}
                    </span>
                  </div>
                  <p title={phone(a)}>{phone(a)}</p>
                </div>
                <div className="accounts-menu-area">
                  <button
                    className="accounts-more"
                    aria-label={`${t('Mais ações')}: ${a.name}`}
                    aria-expanded={menu === a.id}
                    onClick={() => setMenu(menu === a.id ? null : a.id)}
                  >
                    <MoreHorizontal size={23} />
                  </button>
                  {menu === a.id && (
                    <div role="menu" className="accounts-menu">
                      <button role="menuitem" onClick={() => open(a)}>
                        {t('Configurações')}
                      </button>
                      <button role="menuitem" onClick={() => open(a, 'templates')}>
                        {t('Modelos da conta')}
                      </button>
                      <button className="accounts-delete" role="menuitem" disabled={busy} onClick={() => confirmDelete(a)}>
                        {t('Excluir conta')}
                      </button>
                    </div>
                  )}
                </div>
              </header>
              <div className="accounts-usage">
                <div>
                  <span className="accounts-usage-icon">
                    <Smartphone size={23} />
                  </span>
                  <div>
                    <p>{t('Limite diário')}</p>
                    <strong>{n(a.dailyLimit)}</strong>
                  </div>
                </div>
                <div>
                  <span className="accounts-usage-icon accounts-usage-icon--blue">
                    <Send size={23} />
                  </span>
                  <div>
                    <p>{t('Enviados (24h)')}</p>
                    <strong>{n(used)}</strong>
                  </div>
                </div>
                <div
                  className="accounts-usage-ring"
                  role="img"
                  aria-label={`${percentage}% ${t('do limite local')}`}
                  style={{
                    background: `conic-gradient(#00ce27 0deg ${Math.min(100, percentage) * 3.6}deg,#e7f0ec ${Math.min(100, percentage) * 3.6}deg 360deg)`,
                  }}
                >
                  <span>{percentage}%</span>
                </div>
              </div>
              <footer>
                <button
                  className="accounts-toggle-control"
                  role="switch"
                  aria-checked={a.enabled !== false}
                  aria-label={`${t('Conta ativa')}: ${a.name}`}
                  disabled={busy}
                  onClick={() =>
                    void onAction(
                      { action: 'account-update', id: a.id, enabled: a.enabled === false },
                      a.enabled === false
                        ? 'Conta ativada.'
                        : 'Conta desativada. Campanhas em execução foram pausadas.',
                    )
                  }
                >
                  <span className="accounts-toggle">
                    <i />
                  </span>
                  <span>{t(a.enabled === false ? 'Inativa' : 'Ativa')}</span>
                </button>
                <button
                  disabled={busy || data.simulation || a.simulationOnly || !a.configured}
                  onClick={() => void sync(a)}
                  title={t(
                    data.simulation
                      ? 'A simulação já inclui o modelo hello_world.'
                      : 'Sincronizar modelos aprovados na Meta',
                  )}
                >
                  <RefreshCw size={18} />
                  {t('Sincronizar modelos')}
                </button>
                <button onClick={() => open(a)}>
                  <Settings size={18} />
                  {t('Configurações')}
                </button>
                <button className="accounts-delete" disabled={busy} aria-label={`${t('Excluir conta')}: ${a.name}`} onClick={() => confirmDelete(a)}>
                  <Trash2 size={18} />{t('Excluir')}
                </button>
              </footer>
            </article>
          );
        })}
      </div>
      {!rows.length && (
        <div className="accounts-empty">
          <WhatsAppMark />
          <h2>{t('Nenhuma conta encontrada')}</h2>
          <p>{t('Adicione uma conta ou ajuste os filtros para começar.')}</p>
          <button className="accounts-primary" onClick={onAdd}>
            {t('Adicionar conta')}
          </button>
        </div>
      )}
      <DismissibleDialog ref={deleteDialog} className="accounts-settings accounts-delete-dialog" aria-labelledby="account-delete-title">
        <header>
          <h2 id="account-delete-title">{t('Excluir conta')}?</h2>
          <button disabled={busy} aria-label={t('Cancelar')} onClick={() => deleteDialog.current?.close()}><X size={20} /></button>
        </header>
        <strong>{deleting?.name}</strong>
        <p>{t('A conta será removida deste aplicativo e suas campanhas em execução serão pausadas. O histórico de mensagens será preservado.')}</p>
        <p>{t('Isso não exclui sua conta no WhatsApp ou na Meta. Ao desfazer, a conta permanece inativa.')}</p>
        {deleteError && <p role="alert">{t('Não foi possível excluir. Aguarde o envio atual terminar e tente novamente.')}</p>}
        <footer>
          <button disabled={busy} onClick={() => deleteDialog.current?.close()}>{t('Cancelar')}</button>
          <button className="accounts-delete-confirm" disabled={busy} onClick={async () => {
            if (!deleting) return;
            setDeleteError(false);
            if (await onAction({ action: 'account-delete', id: deleting.id }, 'Conta excluída. Campanhas em execução foram pausadas.')) {
              setDeleted(deleting);
              deleteDialog.current?.close();
            } else setDeleteError(true);
          }}><Trash2 size={16} />{t('Excluir conta')}</button>
        </footer>
      </DismissibleDialog>
      <DismissibleDialog
        ref={dialog}
        className="accounts-settings"
        aria-labelledby="account-settings-title"
        onClose={() => setEditing(null)}
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        {current && (
          <>
            <header>
              <div>
                <h2 id="account-settings-title">{current.name}</h2>
                <p>{t(status(current))}</p>
              </div>
              <button
                aria-label={t('Fechar configurações')}
                disabled={busy}
                onClick={() => dialog.current?.close()}
              >
                <X size={20} />
              </button>
            </header>
            <div className="accounts-settings-tabs">
              <button aria-pressed={panel === 'settings'} onClick={() => setPanel('settings')}>
                {t('Configurações')}
              </button>
              <button aria-pressed={panel === 'templates'} onClick={() => setPanel('templates')}>
                {t('Modelos da conta')} ({current.templates.length})
              </button>
            </div>
            {saveError && (
              <p role="alert" className="accounts-save-error">
                {t('Não foi possível salvar. Verifique os dados e tente novamente.')}
              </p>
            )}
            {panel === 'settings' ? (
              <form
                key={current.id}
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSaveError(false);
                  const values = Object.fromEntries(new FormData(e.currentTarget));
                  if (
                    await onAction(
                      { action: 'account-update', id: current.id, ...values },
                      'Configurações da conta atualizadas.',
                    )
                  )
                    dialog.current?.close();
                  else setSaveError(true);
                }}
              >
                <label>
                  {t('Nome da conta')}
                  <input name="name" required maxLength={200} defaultValue={current.name} />
                </label>
                <label>
                  {t('Telefone de identificação (opcional)')}
                  <input
                    name="displayPhone"
                    defaultValue={current.displayPhone || ''}
                    pattern="[+0-9 () .-]{8,25}"
                    placeholder="+55 11 99999-9999"
                  />
                </label>
                <label>
                  {t('Teto local de envios por 24h')}
                  <input
                    name="dailyLimit"
                    type="number"
                    required
                    min={1}
                    max={100000}
                    defaultValue={current.dailyLimit}
                  />
                </label>
                <div className="accounts-connection-info">
                  <p>
                    Phone Number ID: <strong>{current.phoneId}</strong>
                  </p>
                  {!current.simulationOnly && (
                    <>
                      <p>
                        WABA ID: <strong>{current.wabaId}</strong>
                      </p>
                      <p>
                        {t('Variável do token')}: <strong>{current.tokenEnv}</strong>
                      </p>
                    </>
                  )}
                  <p>
                    {t(
                      current.simulationOnly
                        ? 'Esta conta não está conectada a um número real.'
                        : 'A credencial é armazenada somente no servidor.',
                    )}
                  </p>
                </div>
                <p className="accounts-settings-note">
                  {t(
                    'O limite é um teto local em 24 horas, não a capacidade concedida pela Meta. O telefone de identificação não conecta um número.',
                  )}
                </p>
                <button className="accounts-primary" type="submit" disabled={busy}>
                  {t(busy ? 'Salvando…' : 'Salvar alterações')}
                </button>
              </form>
            ) : (
              <div className="accounts-templates">
                {current.templates.map((template) => (
                  <div key={template.name + template.language}>
                    <FileText size={19} />
                    <span>
                      <strong>{template.name}</strong>
                      <small>{template.language}</small>
                    </span>
                    <Badge status={template.status} />
                  </div>
                ))}
                {!current.templates.length && <p>{t('Nenhum modelo sincronizado.')}</p>}
                <button
                  className="accounts-primary"
                  disabled={
                    busy || data.simulation || current.simulationOnly || !current.configured
                  }
                  onClick={() => void sync(current)}
                >
                  <RefreshCw size={16} />
                  {t('Sincronizar modelos')}
                </button>
                {data.simulation && <p>{t('A simulação já inclui o modelo hello_world.')}</p>}
              </div>
            )}
          </>
        )}
      </DismissibleDialog>
    </div>
  );
}

