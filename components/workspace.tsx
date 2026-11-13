'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Bot,
  Check,
  ChevronRight,
  Download,
  LoaderCircle,
  Menu,
  MessageCircle,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Upload,
  Users,
  X,
} from 'lucide-react';
import type { State } from '@/lib/types';
import { csvDownload, parseCSV } from '@/lib/csv';
import { LanguageSelector, useLanguage } from '@/components/language';
import { contactColumns } from '@/lib/i18n';
import LogoutButton from '@/components/logout-button';
import WorkspaceSidebar from '@/components/workspace-sidebar';
import Overview from '@/components/overview';
import {
  Badge,
  Button,
  Card,
  Empty,
  Initials,
  Label,
  StatCard,
  statusLabels as labels,
} from '@/components/workspace-ui';
import './workspace.css';
import WorkspaceInbox from '@/components/workspace-inbox';
import WorkspaceReports from '@/components/workspace-reports';
import WorkspaceService from '@/components/workspace-service';

type Data = Omit<State, 'accounts'> & {
  simulation: boolean;
  accounts: (State['accounts'][number] & { configured: boolean })[];
};
type Tab =
  | 'Visão geral'
  | 'Contatos'
  | 'Campanhas'
  | 'Robô de envio'
  | 'Conversas'
  | 'Contas WhatsApp'
  | 'Atendimento'
  | 'Relatórios'
  | 'Configurações';
const field = 'workspace-input mt-1.5 w-full';
function values(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  return Object.fromEntries(new FormData(e.currentTarget));
}

export default function Workspace() {
  const { locale, t } = useLanguage();
  const date = (s: string) => new Date(s).toLocaleString(locale);
  const [data, setData] = useState<Data>();
  const [tab, setTab] = useState<Tab>('Visão geral');
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<
    'contact' | 'import' | 'account' | 'campaign' | 'consent' | null
  >(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [consentContactId, setConsentContactId] = useState('');
  const modalPanel = useRef<HTMLDivElement>(null);
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
  const [accountId, setAccountId] = useState('');
  const [contactId, setContactId] = useState('');
  const [campaignAccount, setCampaignAccount] = useState('');
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [csv, setCsv] = useState('');
  const [templateKey, setTemplateKey] = useState('');
  async function refresh() {
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
        body.result?.added !== undefined
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
  function navigate(name: Tab) {
    setTab(name);
    setMenu(false);
    setQuery('');
    setPage(0);
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
  const filtered = data.contacts.filter((c) =>
    `${c.name} ${c.phone}`.toLowerCase().includes(query.toLowerCase()),
  );
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
      contactCount={data.contacts.length}
    />
  );
  return (
    <div className="workspace min-h-screen">
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
        </header>
        <main className="workspace-main mx-auto max-w-[1500px] px-5 py-8 sm:px-8">
          <div className="workspace-page-heading mb-7 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[.18em] text-emerald-700">
                WhatsBot Pro / {t(tab)}
              </p>
              <h1 className="text-3xl font-bold tracking-tight">{t(tab)}</h1>
              <p className="mt-2 text-sm text-slate-500">
                {tab === 'Visão geral'
                  ? t('Contatos, campanhas e conversas. Acompanhe o que acontece de verdade.')
                  : tab === 'Robô de envio'
                    ? t('Salve sua lista e inicie conversas uma a uma, com intervalo configurável.')
                    : tab === 'Campanhas'
                      ? t('Organize envios de modelos aprovados para sua base com permissão.')
                      : t('Gerencie sua operação no WhatsApp.')}
              </p>
            </div>
            {['Campanhas', 'Robô de envio', 'Visão geral'].includes(tab) && (
              <Button onClick={openCampaign}>
                <Plus size={17} />{' '}
                {tab === 'Robô de envio' ? t('Nova sequência') : t('Nova campanha')}
              </Button>
            )}
            {tab === 'Contatos' && (
              <div className="flex gap-2">
                <Button
                  secondary
                  onClick={() => {
                    setCsv('');
                    setModal('import');
                  }}
                >
                  <Upload size={16} />
                  {t('Importar CSV')}
                </Button>
                <Button onClick={() => setModal('contact')}>
                  <Plus size={16} />
                  {t('Contato')}
                </Button>
              </div>
            )}
            {tab === 'Contas WhatsApp' && (
              <Button onClick={() => setModal('account')}>
                <Plus size={16} />
                {t('Adicionar conta')}
              </Button>
            )}
          </div>
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
          {tab === 'Visão geral' && <Overview data={data} navigate={navigate} />}
          {tab === 'Contatos' && (
            <>
              <div className="workspace-contact-stats">
                <StatCard
                  label="Contatos na base"
                  value={data.contacts.length.toLocaleString(locale)}
                  icon={Users}
                />
                <StatCard
                  label="Autorizado"
                  value={eligible.length.toLocaleString(locale)}
                  icon={ShieldCheck}
                  tone="blue"
                />
                <StatCard
                  label="Descadastrado"
                  value={data.contacts.filter((c) => c.optedOut).length.toLocaleString(locale)}
                  icon={X}
                  tone="amber"
                />
              </div>
              <Card>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      aria-label={t('Buscar contatos')}
                      placeholder={t('Buscar nome ou telefone')}
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setPage(0);
                      }}
                      className={`${field} !mt-0 pl-10`}
                    />
                  </div>
                  <Button
                    secondary
                    onClick={() =>
                      csvDownload(locale === 'en' ? 'contacts.csv' : 'contatos.csv', [
                        contactColumns[locale],
                        ...filtered.map((c) => [c.name, c.phone, c.consent, c.source, c.optedOut]),
                      ])
                    }
                  >
                    <Download size={15} />
                    {t('Exportar')}
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-y border-slate-100 bg-slate-50 text-xs text-slate-500">
                      <tr>
                        {['Nome', 'Telefone', 'Permissão', 'Origem', 'Ações'].map((x) => (
                          <th className="px-3 py-3" key={t(x)}>
                            {t(x)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(page * 100, page * 100 + 100).map((c) => (
                        <tr key={c.id} className="border-b border-slate-100">
                          <td className="px-3 py-4 font-semibold">
                            <span className="workspace-contact-name">
                              <Initials name={c.name} />
                              <span>{c.name}</span>
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 text-slate-500">+{c.phone}</td>
                          <td className="px-3">
                            <Badge
                              status={
                                c.optedOut
                                  ? t('Descadastrado')
                                  : c.consent
                                    ? t('Autorizado')
                                    : t('Sem permissão')
                              }
                            />
                          </td>
                          <td className="max-w-64 px-3 text-xs text-slate-500">
                            {c.source || '—'}
                          </td>
                          <td className="px-3">
                            <button
                              disabled={busy}
                              className="text-xs font-semibold text-emerald-700"
                              onClick={() => {
                                if (c.consent)
                                  void act(
                                    { action: 'consent', id: c.id, consent: false },
                                    'Contato descadastrado.',
                                  );
                                else {
                                  setConsentContactId(c.id);
                                  setModal('consent');
                                }
                              }}
                            >
                              {c.consent ? t('Descadastrar') : t('Registrar permissão')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!filtered.length && (
                  <Empty icon={Users}>
                    {t('Adicione um contato ou importe uma lista CSV para começar.')}
                  </Empty>
                )}
                <div className="workspace-pagination mt-4 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {filtered.length} {t('contatos · página')} {page + 1}
                  </span>
                  <div className="flex gap-3">
                    <button disabled={!page} onClick={() => setPage(page - 1)}>
                      {t('Anterior')}
                    </button>
                    <button
                      disabled={(page + 1) * 100 >= filtered.length}
                      onClick={() => setPage(page + 1)}
                    >
                      {t('Próxima')}
                    </button>
                  </div>
                </div>
              </Card>
            </>
          )}
          {['Campanhas', 'Robô de envio'].includes(tab) && (
            <>
              <div className="mb-5 grid gap-4 sm:grid-cols-3">
                {['draft', 'running', 'completed'].map((status) => (
                  <Card key={status} className="workspace-status-card">
                    <p className="text-xs text-slate-500">{t(labels[status])}</p>
                    <p className="mt-2 text-2xl font-bold">
                      {campaigns.filter((c) => c.status === status).length}
                    </p>
                  </Card>
                ))}
              </div>
              <div className="space-y-4">
                {campaigns.map((c) => {
                  const jobs = data.jobs.filter((j) => j.campaignId === c.id);
                  const sent = jobs.filter((j) => j.status === 'sent').length;
                  return (
                    <Card key={c.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-3">
                            <h2 className="font-bold">{c.name}</h2>
                            <Badge status={c.status} />
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            {data.accounts.find((a) => a.id === c.accountId)?.name} · {c.template}{' '}
                            {t('· intervalo de')} {c.delay}s
                          </p>
                        </div>
                        <Button
                          secondary
                          disabled={busy || !jobs.some((j) => j.status === 'pending')}
                          onClick={() =>
                            void act(
                              {
                                action: 'campaign-status',
                                id: c.id,
                                status: c.status === 'running' ? 'paused' : 'running',
                              },
                              c.status === 'running'
                                ? 'Campanha pausada.'
                                : 'Fila ativada. Mantenha o worker em execução.',
                            )
                          }
                        >
                          {c.status === 'running' ? <Pause size={15} /> : <Play size={15} />}{' '}
                          {c.status === 'running' ? t('Pausar') : t('Iniciar')}
                        </Button>
                      </div>
                      <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-600 transition-all"
                          style={{ width: `${jobs.length ? (sent / jobs.length) * 100 : 0}%` }}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-5 text-xs text-slate-500">
                        <span>
                          {sent}/{jobs.length} {data.simulation ? t('processados') : t('aceitos')}
                        </span>
                        <span>
                          {jobs.filter((j) => j.status === 'pending').length} {t('pendentes')}
                        </span>
                        <span>
                          {jobs.filter((j) => j.status === 'failed').length} {t('falhas')}
                        </span>
                        <span>
                          {jobs.filter((j) => j.status === 'skipped').length} {t('ignorados')}
                        </span>
                      </div>
                      {jobs
                        .filter((j) => j.status === 'processing' || j.error)
                        .map((j) => (
                          <p
                            className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800"
                            key={j.id}
                          >
                            {data.contacts.find((c) => c.id === j.contactId)?.phone}:{' '}
                            {j.error
                              ? t(j.error)
                              : t(
                                  'Envio reservado. Se o processo foi interrompido, confirme na Meta antes de reenviar.',
                                )}
                          </p>
                        ))}
                    </Card>
                  );
                })}
                {!campaigns.length && (
                  <Card>
                    <Empty icon={tab === 'Robô de envio' ? Bot : Send}>
                      {tab === 'Robô de envio'
                        ? t(
                            'Nenhuma sequência criada. Importe sua lista e escolha um modelo para iniciar o contato individual.',
                          )
                        : t(
                            'Sua primeira campanha começa aqui. Escolha uma conta, um modelo e seus destinatários.',
                          )}
                    </Empty>
                  </Card>
                )}
              </div>
              <p className="mt-5 text-xs leading-6 text-slate-400">
                {t(
                  'O worker processa um envio por vez e respeita o intervalo por conta. Limites locais são um teto operacional; os limites reais e a elegibilidade são definidos pela Meta. Falhas pausam a campanha e não são reenviadas automaticamente.',
                )}
              </p>
            </>
          )}
          {tab === 'Contas WhatsApp' && (
            <div className="grid gap-5 md:grid-cols-2">
              {data.accounts.map((a) => (
                <Card key={a.id} className="workspace-account-card">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
                      <Smartphone />
                    </div>
                    <div>
                      <h2 className="font-bold">{a.name}</h2>
                      <p className="mt-1 text-xs text-slate-500">Phone Number ID: {a.phoneId}</p>
                    </div>
                  </div>
                  <div className="my-5 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-xs">
                    <div className="text-slate-500">
                      {t('Teto local / 24h')}
                      <p className="mt-1 font-bold text-slate-800">
                        {a.dailyLimit.toLocaleString(locale)}
                      </p>
                    </div>
                    <div className="text-slate-500">
                      {t('Credencial')}
                      <p className="mt-1 font-bold text-slate-800">
                        {a.configured ? t('Configurada no servidor') : t('Pendente')}
                      </p>
                    </div>
                  </div>
                  <p className="mb-4 break-all text-xs text-slate-500">
                    Token: {a.tokenEnv} · WABA: {a.wabaId}
                  </p>
                  <Button
                    secondary
                    disabled={busy || data.simulation}
                    onClick={() => void act({ action: 'sync', id: a.id }, 'Modelos sincronizados.')}
                  >
                    <RefreshCw size={14} />
                    {t('Sincronizar modelos')}
                  </Button>
                  <div className="mt-4 space-y-2">
                    {a.templates.map((t) => (
                      <div
                        key={`${t.name}:${t.language}`}
                        className="flex justify-between gap-2 text-xs"
                      >
                        <span>
                          {t.name} · {t.language}
                        </span>
                        <Badge status={t.status} />
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
              {!data.accounts.length && (
                <Card className="md:col-span-2">
                  <Empty icon={Smartphone}>
                    {t('Nenhum número cadastrado. Na simulação, use IDs numéricos de exemplo.')}
                  </Empty>
                </Card>
              )}
            </div>
          )}
          {tab === 'Conversas' && (
            <WorkspaceInbox
              data={data}
              accountId={accountId}
              contactId={contactId}
              setAccountId={setAccountId}
              setContactId={setContactId}
              onAction={act}
              busy={busy}
            />
          )}
          {tab === 'Atendimento' && (
            <WorkspaceService settings={data.settings} onAction={act} busy={busy} />
          )}
          {tab === 'Relatórios' && <WorkspaceReports data={data} />}
          {tab === 'Configurações' && (
            <div className="grid gap-5 xl:grid-cols-2">
              <Card className="workspace-settings-card">
                <h2 className="font-bold">{t('Conexão e execução')}</h2>
                <div className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
                  <p>
                    {t('Ambiente:')} <strong>{data.simulation ? t('Simulação') : 'Live'}</strong>
                    {t('. Altere WHATSAPP_MODE no arquivo .env.local e reinicie o servidor.')}
                  </p>
                  <p>
                    {t('Webhook público:')} <code>/api/webhook</code>
                    {t('. Configure META_VERIFY_TOKEN e META_APP_SECRET no servidor.')}
                  </p>
                  <p>
                    {t('Mantenha')} <code>npm run worker</code>{' '}
                    {t('em execução para processar campanhas com a página aberta ou fechada.')}
                  </p>
                  <p>
                    {t(
                      'Use variáveis WA_TOKEN_NOME para credenciais. O painel nunca recebe os tokens.',
                    )}
                  </p>
                  <p>
                    {t(
                      'Backup: copie o banco SQLite em data usando uma ferramenta compatível com SQLite. Consulte o README para implantação e recuperação.',
                    )}
                  </p>
                </div>
              </Card>
              <Card>
                <h2 className="font-bold">{t('Histórico de operação')}</h2>
                <div className="mt-4 max-h-96 overflow-auto">
                  {data.audit.map((a, i) => (
                    <div key={i} className="border-b border-slate-100 py-3">
                      <p className="text-xs leading-5">{t(a.text)}</p>
                      <p className="mt-1 text-[10px] text-slate-400">{date(a.at)}</p>
                    </div>
                  ))}
                  {!data.audit.length && <Empty>{t('Nenhum evento registrado.')}</Empty>}
                </div>
              </Card>
            </div>
          )}
        </main>
      </div>
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
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
                        ? t('Adicionar conta oficial')
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
                    { action: 'contacts', rows: [{ ...v, consent: v.consent === 'on' }] },
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
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  try {
                    const rows = parseCSV(csv).map((r) => ({
                      name: r.nome || r.name,
                      phone: r.telefone || r.phone || r.numero || r['número'],
                      source: r.origem || r.source,
                      consent: ['true', 'sim', '1', 'yes'].includes(
                        (r.consentimento || r.consent || '').toLowerCase(),
                      ),
                    }));
                    void act({ action: 'contacts', rows }, '', true);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <p className="text-sm leading-6 text-slate-500">
                  {t(
                    'CSV com colunas nome, telefone, consentimento, origem. Use código do país. Duplicados são ignorados; contatos sem origem de consentimento ficam sem permissão.',
                  )}
                </p>
                <Button
                  secondary
                  onClick={() =>
                    csvDownload(locale === 'en' ? 'contacts-example.csv' : 'modelo-contatos.csv', [
                      contactColumns[locale].slice(0, 4),
                      locale === 'en'
                        ? ['Example customer', '5511999999999', 'yes', 'Website form, Nov 13, 2026']
                        : [
                            'Cliente exemplo',
                            '5511999999999',
                            'sim',
                            'Formulário do site em 13/11/2026',
                          ],
                    ])
                  }
                >
                  <Download size={14} />
                  {t('Baixar modelo')}
                </Button>
                <input
                  aria-label={t('Arquivo CSV')}
                  type="file"
                  accept=".csv,text/csv"
                  className="block w-full text-sm"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 2_000_000) {
                        setError('Máximo de 2 MB.');
                        return;
                      }
                      setCsv(await file.text());
                    }
                  }}
                />
                <textarea
                  aria-label={t('Conteúdo CSV')}
                  value={csv}
                  onChange={(e) => setCsv(e.target.value)}
                  className={`${field} font-mono text-xs`}
                  rows={7}
                  placeholder={t('nome,telefone,consentimento,origem\n')}
                />
                <Button type="submit" disabled={busy || !csv.trim()}>
                  {t('Validar e importar')}
                </Button>
              </form>
            )}
            {modal === 'account' && (
              <form
                className="space-y-4"
                onSubmit={(e) =>
                  void act({ action: 'account', ...values(e) }, 'Conta cadastrada.', true)
                }
              >
                <p className="text-sm leading-6 text-slate-500">
                  {data.simulation
                    ? t(
                        'Use IDs numéricos de teste. O modelo hello_world será disponibilizado para simulação.',
                      )
                    : t('Informe os IDs do seu app Meta. Depois sincronize os modelos aprovados.')}
                </p>
                <Label>
                  {t('Nome da conta')}
                  <input
                    name="name"
                    required
                    className={field}
                    placeholder={t('Vendas principal')}
                  />
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <Label>
                    Phone Number ID
                    <input name="phoneId" required pattern="[0-9]+" className={field} />
                  </Label>
                  <Label>
                    WABA ID
                    <input name="wabaId" required pattern="[0-9]+" className={field} />
                  </Label>
                </div>
                <Label>
                  {t('Nome da variável do token')}
                  <input
                    name="tokenEnv"
                    required
                    pattern="WA_TOKEN_[A-Z0-9_]+"
                    defaultValue="WA_TOKEN_PRIMARY"
                    className={field}
                  />
                </Label>
                <Label>
                  {t('Teto local de envios por 24h')}
                  <input
                    name="dailyLimit"
                    type="number"
                    required
                    min={1}
                    max={100000}
                    defaultValue={250}
                    className={field}
                  />
                </Label>
                <p className="text-xs leading-5 text-slate-400">
                  {t(
                    'O teto local não concede capacidade de envio na Meta. Guarde o token somente no servidor, na variável indicada acima.',
                  )}
                </p>
                <Button disabled={busy} type="submit">
                  {t('Cadastrar conta')}
                </Button>
              </form>
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
                      mode: tab === 'Robô de envio' ? 'sequential' : 'bulk',
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
