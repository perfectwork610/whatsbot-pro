'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Bot,
  Check,
  ChevronRight,
  LoaderCircle,
  Menu,
  MessageCircle,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Users,
  X,
} from 'lucide-react';
import type { State } from '@/lib/types';
import { contactImportBatches, type ImportedContact } from '@/lib/csv';
import { LanguageSelector, useLanguage } from '@/components/language';
import LogoutButton from '@/components/logout-button';
import WorkspaceSidebar from '@/components/workspace-sidebar';
import Overview from '@/components/overview';
import {
  Badge,
  Button,
  Card,
  Empty,
  Label,
  StatCard,
  statusLabels as labels,
} from '@/components/workspace-ui';
import './workspace.css';
import WorkspaceReports from '@/components/workspace-reports';
import AccountForm from '@/components/account-form';
import ContactImport from '@/components/contact-import';
import OverviewToolbar from '@/components/overview-toolbar';
import './overview.css';
import ContactsPage from './contacts-page';
import './contacts-page.css';
import CampaignsPage from './campaigns-page';
import './campaigns-page.css';
import AccountsPage from './accounts-page';
import './accounts-page.css';
import SettingsPage from './settings-page';
import './settings-page.css';
import './reports-page.css';
import './workspace-typography.css';
import OutreachPage from './outreach-page';
import './outreach-page.css';

type Data = Omit<State, 'accounts'> & {
  simulation: boolean;
  accounts: (State['accounts'][number] & { configured: boolean })[];
};
type Tab =
  | 'Visão geral'
  | 'Contatos'
  | 'Campanhas'
  | 'Robô de envio'
  | 'Contas WhatsApp'
  | 'Relatórios'
  | 'Configurações';
const field = 'workspace-input mt-1.5 w-full';
function values(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  return Object.fromEntries(new FormData(e.currentTarget));
}

export default function Workspace() {
  const { locale, t, setLocale } = useLanguage();
  const date = (s: string) => new Date(s).toLocaleString(locale);
  const [data, setData] = useState<Data>();
  const languageInitialized = useRef(false);
  useEffect(() => {
    if (!data || languageInitialized.current) return;
    languageInitialized.current = true;
    try {
      if (!localStorage.getItem('whatsbot.language') && data.workspace?.language)
        setLocale(data.workspace.language);
    } catch {}
  }, [data, setLocale]);
  const [tab, setTab] = useState<Tab>('Visão geral');
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<
    'contact' | 'import' | 'account' | 'campaign' | 'consent' | null
  >(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [consentContactId, setConsentContactId] = useState('');
  const modalPanel = useRef<HTMLDivElement>(null);
  const modalBackdropPressed = useRef(false);
  useEffect(() => {
    if (!modal || !modalPanel.current) return;
    const panel = modalPanel.current;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const controls = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]',
        ),
      ).filter((element) => element.getClientRects().length > 0);
    (
      panel.querySelector<HTMLElement>(
        'input:not([disabled]),select:not([disabled]),textarea:not([disabled])',
      ) || controls()[0]
    )?.focus();
    function keyboard(event: KeyboardEvent) {
      if (
        event.key === 'Escape' &&
        !panel.querySelector<HTMLButtonElement>('[data-modal-close]')?.disabled
      ) {
        event.preventDefault();
        setModal(null);
      }
      if (event.key === 'Tab') {
        const items = controls();
        if (!items.length) {
          event.preventDefault();
          return;
        }
        const first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener('keydown', keyboard);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', keyboard);
      if (previous?.isConnected) previous.focus();
    };
  }, [modal]);
  const [campaignAccount, setCampaignAccount] = useState('');
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const importActive = useRef(false);
  const [importProgress, setImportProgress] = useState<{ processed: number; total: number } | null>(
    null,
  );
  const [templateKey, setTemplateKey] = useState('');
  async function refresh() {
    if (importActive.current) return;
    const response = await fetch('/api/manage', { cache: 'no-store' });
    if (response.status === 401) {
      window.location.replace('/login');
      throw new Error('Sessão expirada. Entre novamente.');
    }
    if (!response.ok) throw new Error(`Servidor indisponível (${response.status}).`);
    setData(await response.json());
  }
  useEffect(() => {
    const checkHistory = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener('pageshow', checkHistory);
    refresh().catch((e) => setError(e.message));
    const timer = setInterval(() => refresh().catch((e) => setError(e.message)), 5000);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pageshow', checkHistory);
    };
  }, []);
  async function act(payload: object, message = 'Salvo com sucesso.', close = false) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const r = await fetch('/api/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await r.json();
      if (r.status === 401) window.location.replace('/login');
      if (!r.ok) throw new Error(body.error);
      await refresh();
      setNotice(
        body.result?.restored === true
          ? 'Contato restaurado. Registre a permissão antes de enviar novamente.'
          : body.result?.added !== undefined
          ? `${body.result.added} importados · ${body.result.duplicates} duplicados · ${body.result.invalid} inválidos`
          : message,
      );
      if (close) setModal(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha na operação');
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function importContacts(rows: ImportedContact[]) {
    if (importActive.current) return;
    setBusy(true);
    setError('');
    setNotice('');
    importActive.current = true;
    setImportProgress({ processed: 0, total: rows.length });
    let added = 0,
      duplicates = 0,
      invalid = 0,
      processed = 0;
    try {
      for (const batch of contactImportBatches(rows)) {
        const response = await fetch('/api/manage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'contacts', rows: batch }),
        });
        if (response.status === 401) {
          window.location.replace('/login');
          throw new Error('Sessão expirada. Entre novamente.');
        }
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Falha na operação');
        added += body.result.added;
        duplicates += body.result.duplicates;
        invalid += body.result.invalid;
        processed += batch.length;
        setImportProgress({ processed, total: rows.length });
      }
      setNotice(added + ' importados · ' + duplicates + ' duplicados · ' + invalid + ' inválidos');
      setImportProgress(null);
      setModal(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Falha na operação');
    } finally {
      importActive.current = false;
      try {
        await refresh();
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Falha na operação');
      }
      setBusy(false);
    }
  }
  function navigate(name: Tab) {
    setTab(name);
    setMenu(false);
    setError('');
    setNotice('');
  }
  function openCampaign() {
    setCampaignAccount(data?.accounts[0]?.id || '');
    setTemplateKey('');
    setRecipientIds([]);
    setModal('campaign');
  }
  if (!data)
    return (
      <main className="grid min-h-screen place-content-center gap-4 text-center">
        <div className="fixed right-5 top-5">
          <LanguageSelector />
        </div>
        <MessageCircle className="mx-auto text-emerald-700" size={40} />
        <p>{error ? t(error) : t('Abrindo sua operação…')}</p>
        <Button onClick={() => refresh().catch((e) => setError(e.message))}>
          {t('Tentar novamente')}
        </Button>
      </main>
    );
  const eligible = data.contacts.filter((c) => c.consent && !c.optedOut);
  const campaigns = data.campaigns.filter(
    (c) => c.mode === (tab === 'Robô de envio' ? 'sequential' : 'bulk'),
  );
  const selectedAccount = data.accounts.find((a) => a.id === campaignAccount);
  const templates = selectedAccount?.templates.filter((t) => t.status === 'APPROVED') || [];
  const nav = (
    <WorkspaceSidebar
      tab={tab}
      onNavigate={navigate}
      simulation={data.simulation}
      accountCount={data.accounts.length}
      workspaceName={data.workspace?.name}
    />
  );
  return (
    <div
      className={`workspace min-h-screen ${tab === 'Visão geral' ? 'workspace--overview' : tab === 'Contatos' ? 'workspace--contacts' : tab === 'Campanhas' ? 'workspace--campaigns' : tab === 'Contas WhatsApp' ? 'workspace--accounts' : tab === 'Configurações' ? 'workspace--settings' : tab === 'Relatórios' ? 'workspace--reports' : tab === 'Robô de envio' ? 'workspace--outreach' : ''}`}
    >
      <aside className="workspace-sidebar fixed inset-y-0 left-0 z-40 hidden w-64 flex-col text-white lg:flex">
        {nav}
      </aside>
      {menu && (
        <div className="fixed inset-0 z-50 bg-black/40 lg:hidden">
          <button
            className="absolute inset-0"
            aria-label={t('Fechar menu')}
            onClick={() => setMenu(false)}
          />
          <aside className="workspace-sidebar workspace-mobile-sidebar relative flex h-full w-72 flex-col text-white">
            <button
              className="absolute left-60 top-3 p-2"
              aria-label={t('Fechar menu')}
              onClick={() => setMenu(false)}
            >
              <X />
            </button>
            {nav}
          </aside>
        </div>
      )}
      <div className="workspace-shell lg:pl-64">
        <header className="workspace-topbar sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              aria-label={t('Abrir menu')}
              className="lg:hidden"
              onClick={() => setMenu(true)}
            >
              <Menu />
            </button>
            <span className="hidden text-sm text-slate-400 sm:inline">{t('Workspace')}</span>
            <ChevronRight size={14} className="hidden text-slate-300 sm:block" />
            <span className="truncate text-sm font-semibold">{t(tab)}</span>
          </div>
          {tab === 'Visão geral' ||
          tab === 'Contatos' ||
          tab === 'Campanhas' ||
          tab === 'Contas WhatsApp' ||
          tab === 'Configurações' ||
          tab === 'Relatórios' ||
          tab === 'Robô de envio' ? (
            <OverviewToolbar data={data} onMarkRead={(ids) => act({ action: 'notifications-read', ids }, '')} />
          ) : (
            <div className="flex items-center gap-2 sm:gap-4">
              <LanguageSelector />
              <span
                className={`hidden rounded-full px-3 py-1 text-xs font-semibold sm:inline-flex ${data.simulation ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}
              >
                {data.simulation ? t('Simulação · sem envios reais') : t('Modo live')}
              </span>
              <button
                aria-label={t('Atualizar dados')}
                onClick={() => refresh().catch((e) => setError(e.message))}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <RefreshCw size={17} />
              </button>
              <LogoutButton />
            </div>
          )}
        </header>
        <main className="workspace-main mx-auto max-w-[1500px] px-5 py-8 sm:px-8">
          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              {t(error)}
              <button aria-label={t('Fechar erro')} onClick={() => setError('')}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div
              role="status"
              className="mb-5 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
            >
              <span className="flex gap-2">
                <Check size={18} />
                {t(notice)}
              </span>
              <button aria-label={t('Fechar aviso')} onClick={() => setNotice('')}>
                <X size={16} />
              </button>
            </div>
          )}
          {tab === 'Visão geral' && (
            <Overview
              data={data}
              navigate={navigate}
              onCampaign={openCampaign}
              onAddAccount={() => {
                navigate('Contas WhatsApp');
                setModal('account');
              }}
              onImport={() => {
                navigate('Contatos');
                setImportProgress(null);
                setModal('import');
              }}
            />
          )}
          {tab === 'Contatos' && (
            <ContactsPage
              contacts={data.contacts}
              busy={busy}
              onRemove={(ids) => act({ action: 'contacts-remove', ids }, 'Contatos removidos.')}
              onRestore={(ids) => act({ action: 'contacts-restore', ids }, 'Contatos restaurados. Registre a permissão antes de enviar novamente.')}
              onImport={() => {
                setImportProgress(null);
                setModal('import');
              }}
              onAdd={() => setModal('contact')}
              onSave={async (contact) =>
                act({ action: 'contact-update', ...contact }, 'Contato salvo.')
              }
              onPermission={(contact) => {
                if (contact.consent && !contact.optedOut)
                  void act(
                    { action: 'consent', id: contact.id, consent: false },
                    'Contato descadastrado.',
                  );
                else {
                  setConsentContactId(contact.id);
                  setModal('consent');
                }
              }}
            />
          )}
          {tab === 'Campanhas' && (
            <CampaignsPage
              data={data}
              busy={busy}
              onRemove={(c) => act({ action: 'campaign-remove', id: c.id }, 'Campanha removida.')}
              onRestore={(c) => act({ action: 'campaign-restore', id: c.id }, 'Campanha restaurada.')}
              onCreate={openCampaign}
              onStatus={(c) => {
                void act(
                  {
                    action: 'campaign-status',
                    id: c.id,
                    status: c.status === 'running' ? 'paused' : 'running',
                  },
                  c.status === 'running'
                    ? 'Campanha pausada.'
                    : 'Fila ativada. Mantenha o worker em execução.',
                );
              }}
            />
          )}
          {tab === 'Robô de envio' && (
            <OutreachPage
              contacts={data.contacts}
              onChanged={refresh}
              onImport={() => {
                setImportProgress(null);
                setModal('import');
              }}
              onContacts={() => navigate('Contatos')}
            />
          )}
          {tab === 'Contas WhatsApp' && (
            <AccountsPage
              data={data}
              busy={busy}
              onAdd={() => setModal('account')}
              onAction={act}
            />
          )}
          {tab === 'Relatórios' && <WorkspaceReports data={data} />}
          {tab === 'Configurações' && (
            <SettingsPage data={data} busy={busy} onAction={act} onNavigate={navigate} />
          )}
        </main>
      </div>
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onPointerDown={(event) => {
            modalBackdropPressed.current = event.target === event.currentTarget;
          }}
          onClick={(event) => {
            if (modalBackdropPressed.current && event.target === event.currentTarget && !busy)
              setModal(null);
            modalBackdropPressed.current = false;
          }}>
          <div
            ref={modalPanel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className="workspace-dialog max-h-[90vh] w-full max-w-xl overflow-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 id="modal-title" className="text-xl font-bold">
                {modal === 'consent'
                  ? t('Registrar permissão')
                  : modal === 'contact'
                    ? t('Novo contato')
                    : modal === 'import'
                      ? t('Importar contatos')
                      : modal === 'account'
                        ? t(data.simulation ? 'Criar conta de teste' : 'Adicionar conta oficial')
                        : tab === 'Robô de envio'
                          ? t('Nova sequência')
                          : t('Nova campanha')}
              </h2>
              <button
                data-modal-close
                aria-label={t('Fechar formulário')}
                disabled={busy}
                onClick={() => setModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            {error && (
              <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {t(error)}
              </p>
            )}
            {modal === 'consent' && (
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void act(
                    {
                      action: 'consent',
                      id: consentContactId,
                      consent: true,
                      source: new FormData(event.currentTarget).get('source'),
                    },
                    'Consentimento registrado.',
                    true,
                  );
                }}
              >
                <p>{t('Informe a origem e a data do novo consentimento:')}</p>
                <Label>
                  {t('Origem e data do consentimento')}
                  <input
                    name="source"
                    required
                    className={field}
                    placeholder={t('Ex.: formulário do site, 13/11/2026')}
                  />
                </Label>
                <Button type="submit" disabled={busy}>
                  {t('Registrar permissão')}
                </Button>
              </form>
            )}
            {modal === 'contact' && (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  const v = values(e);
                  void act(
                    { action: 'contact-create', ...v, consent: v.consent === 'on' },
                    'Contato salvo.',
                    true,
                  );
                }}
              >
                <Label>
                  {t('Nome')}
                  <input name="name" required className={field} />
                </Label>
                <Label>
                  {t('Telefone com código do país')}
                  <input
                    name="phone"
                    placeholder="5511999999999"
                    required
                    pattern="[+0-9 () .-]{8,25}"
                    className={field}
                  />
                </Label>
                <Label>
                  {t('Origem e data do consentimento')}
                  <input
                    name="source"
                    placeholder={t('Ex.: formulário do site, 13/11/2026')}
                    className={field}
                  />
                </Label>
                <label className="flex gap-2 text-sm">
                  <input type="checkbox" name="consent" />
                  {t('O contato autorizou receber mensagens')}
                </label>
                <Button type="submit" disabled={busy}>
                  {t('Salvar contato')}
                </Button>
              </form>
            )}
            {modal === 'import' && (
              <ContactImport
                busy={busy}
                progress={importProgress}
                onImport={importContacts}
                onError={setError}
              />
            )}
            {modal === 'account' && (
              <AccountForm
                simulation={data.simulation}
                busy={busy}
                onSave={(payload) => void act(payload, 'Conta cadastrada.', true)}
              />
            )}
            {modal === 'campaign' && (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  const v = values(e);
                  const t = templates.find((t) => `${t.name}:${t.language}` === templateKey);
                  void act(
                    {
                      action: 'campaign',
                      ...v,
                      accountId: campaignAccount,
                      template: t?.name,
                      language: t?.language,
                      parameters: String(v.parameters || '')
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean),
                      contactIds: recipientIds,
                      mode: 'bulk',
                    },
                    'Rascunho criado. Revise e inicie a fila.',
                    true,
                  );
                }}
              >
                <Label>
                  {t('Nome')}
                  <input
                    name="name"
                    required
                    className={field}
                    placeholder={t('Ex.: Apresentação de serviços')}
                  />
                </Label>
                <Label>
                  {t('Conta')}
                  <select
                    required
                    value={campaignAccount}
                    onChange={(e) => {
                      if (e.target.value === '__add-account__') {
                        navigate('Contas WhatsApp');
                        setModal('account');
                        return;
                      }
                      setCampaignAccount(e.target.value);
                      setTemplateKey('');
                    }}
                    className={field}
                  >
                    <option value="">{t('Selecione')}</option>
                    {data.accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                    <option value="__add-account__">＋ {t('Adicionar conta')}</option>
                  </select>
                </Label>
                <Label>
                  {t('Modelo aprovado')}
                  <select
                    value={templateKey}
                    onChange={(e) => setTemplateKey(e.target.value)}
                    required
                    className={field}
                  >
                    <option value="">{t('Selecione um modelo')}</option>
                    {templates.map((t) => (
                      <option key={`${t.name}:${t.language}`} value={`${t.name}:${t.language}`}>
                        {t.name} · {t.language}
                      </option>
                    ))}
                  </select>
                </Label>
                <Label>
                  {t('Parâmetros do corpo (um por linha; use')} {'{{nome}}'}{' '}
                  {t('para personalizar)')}
                  <textarea name="parameters" rows={2} className={field} />
                </Label>
                <Label>
                  {t('Intervalo por conta, em segundos')}
                  <input
                    type="number"
                    name="delay"
                    required
                    min={5}
                    max={86400}
                    defaultValue={30}
                    className={field}
                  />
                </Label>
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold">
                      {t('Destinatários autorizados ·')} {recipientIds.length} {t('selecionados')}
                    </p>
                    <button
                      type="button"
                      className="text-xs text-emerald-700"
                      onClick={() =>
                        setRecipientIds(
                          recipientIds.length === eligible.length ? [] : eligible.map((c) => c.id),
                        )
                      }
                    >
                      {recipientIds.length === eligible.length
                        ? t('Limpar')
                        : t('Selecionar todos')}
                    </button>
                  </div>
                  <div className="mt-3 max-h-36 space-y-2 overflow-auto">
                    {eligible.slice(0, 100).map((c) => (
                      <label key={c.id} className="flex gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={recipientIds.includes(c.id)}
                          onChange={(e) =>
                            setRecipientIds(
                              e.target.checked
                                ? [...recipientIds, c.id]
                                : recipientIds.filter((id) => id !== c.id),
                            )
                          }
                        />
                        {c.name} · +{c.phone}
                      </label>
                    ))}
                    {!eligible.length && (
                      <p className="text-xs text-slate-400">
                        {t('Importe contatos e registre as permissões primeiro.')}
                      </p>
                    )}
                    {eligible.length > 100 && (
                      <p className="text-xs text-slate-400">
                        {t('Mostrando 100. Selecionar todos inclui os')} {eligible.length}{' '}
                        {t('autorizados.')}
                      </p>
                    )}
                  </div>
                </div>
                <Button type="submit" disabled={busy || !recipientIds.length || !templateKey}>
                  {busy ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={16} />}
                  {t('Criar rascunho')}
                </Button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
