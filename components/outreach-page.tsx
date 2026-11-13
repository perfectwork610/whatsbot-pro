'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  QrCode,
  Plus,
  Play,
  Pause,
  Upload,
  MessageCircle,
  Users,
  Check,
  RefreshCw,
  Link2Off,
  Send,
  X,
  Clock,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import type { Contact, Message } from '@/lib/types';
import type { OutreachSession, OutreachRun, OutreachTask } from '@/lib/outreach-types';
import { useLanguage } from './language';
import WhatsAppMark from './whatsapp-mark';
import { renderOutreachText } from '@/lib/outreach-engine';
type Snapshot = {
  sessions: OutreachSession[];
  runs: OutreachRun[];
  tasks: OutreachTask[];
  messages: Message[];
  workerLive: boolean;
  simulation: boolean;
};
export default function OutreachPage({
  contacts,
  onChanged,
  onImport,
  onContacts,
}: {
  contacts: Contact[];
  onChanged: () => Promise<void>;
  onImport: () => void;
  onContacts: () => void;
}) {
  const { t, locale } = useLanguage();
  const [data, setData] = useState<Snapshot>(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState('runs'),
    [search, setSearch] = useState(''),
    [sessionName, setSessionName] = useState(''),
    [limit, setLimit] = useState(20),
    [testOnly, setTestOnly] = useState(false),
    [senderIds, setSenderIds] = useState<string[]>([]),
    [recipientIds, setRecipientIds] = useState<string[]>([]),
    [name, setName] = useState(''),
    [message, setMessage] = useState(''),
    [delay, setDelay] = useState(30),
    [saveContacts, setSaveContacts] = useState(true),
    [syncToPhone, setSyncToPhone] = useState(false),
    [detail, setDetail] = useState<string | null>(null);
  const connectionDialog = useRef<HTMLDialogElement>(null),
    runDialog = useRef<HTMLDialogElement>(null),
    detailDialog = useRef<HTMLDialogElement>(null);
  const refresh = useCallback(async () => {
    const response = await fetch('/api/outreach', { cache: 'no-store' });
    if (response.status === 401) {
      window.location.replace('/login');
      return;
    }
    const body = await response.json();
    if (!response.ok) throw Error(body.error);
    setData(body);
  }, []);
  useEffect(() => {
    let mounted = true;
    const load = () =>
      refresh().catch((e) => {
        if (mounted) setError(e.message);
      });
    void load();
    const timer = setInterval(load, 2500);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [refresh]);
  async function action(payload: object) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.status === 401) {
        window.location.replace('/login');
        return false;
      }
      const body = await response.json();
      if (!response.ok) throw Error(body.error);
      await refresh();
      await onChanged();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha na operação');
      return false;
    } finally {
      setBusy(false);
    }
  }
  const eligible = contacts.filter(
    (c) =>
      c.consent &&
      !c.optedOut &&
      `${c.name} ${c.phone}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const contactNames = new Map(contacts.map((c) => [c.id, c.name]));
  const sessions = data?.sessions || [],
    runs = data?.runs || [],
    tasks = data?.tasks || [];
  const labels: Record<string, string> = {
    draft: 'Rascunho',
    running: 'Em execução',
    paused: 'Pausada',
    completed: 'Concluída',
    pending: 'Pendente',
    processing: 'Em processamento',
    sent: 'Enviada',
    failed: 'Falha',
    skipped: 'Ignorada',
    'needs-review': 'Revisão necessária',
    disconnected: 'Desconectada',
    queued: 'Aguardando worker',
    connecting: 'Conectando',
    qr: 'Escaneie o QR',
    authenticated: 'Autenticada',
    ready: 'Conectada',
    error: 'Erro',
  };
  const n = (value: number) => value.toLocaleString(locale);
  function showRun() {
    setSearch('');
    setName('');
    setMessage('');
    setRecipientIds([]);
    setSenderIds(
      sessions
        .filter((s) => s.enabled && (data?.simulation || !s.testOnly))
        .slice(0, 1)
        .map((s) => s.id),
    );
    setSaveContacts(true);
    setSyncToPhone(false);
    setError('');
    runDialog.current?.showModal();
  }
  function showConnection() {
    setSessionName('');
    setLimit(20);
    setTestOnly(false);
    setError('');
    connectionDialog.current?.showModal();
  }
  function showDetails(id: string) {
    setDetail(id);
    detailDialog.current?.showModal();
  }
  function toggle(list: string[], id: string) {
    return list.includes(id) ? list.filter((value) => value !== id) : [...list, id];
  }
  const chosen = runs.find((run) => run.id === detail),
    queue = tasks.filter((task) => task.runId === detail);
  function banner() {
    return error ? (
      <p className="outreach-error" role="alert">
        {t(error)}
        <button aria-label={t('Fechar erro')} onClick={() => setError('')}>
          <X size={15} />
        </button>
      </p>
    ) : null;
  }
  if (!data)
    return (
      <section className="outreach-page">
        <p>{error || t('Carregando...')}</p>
      </section>
    );
  return (
    <div className="outreach-page">
      <header className="outreach-heading">
        <div>
          <span className="outreach-eyebrow">WHATSAPP WEB · QR</span>
          <h1>{t('Robô de contato individual')}</h1>
          <p>
            {t('Salve contatos e envie uma mensagem por vez pelos seus números conectados por QR.')}
          </p>
        </div>
        <div>
          <button className="outreach-secondary" onClick={onImport}>
            <Upload size={16} />
            {t('Importar lista')}
          </button>
          <button className="outreach-primary" onClick={showRun} disabled={!sessions.length}>
            <Plus size={17} />
            {t('Nova fila individual')}
          </button>
        </div>
      </header>
      {banner()}
      <div className="outreach-mode">
        <ShieldCheck size={18} />
        <span>
          {t(
            data?.simulation
              ? 'Simulação: nenhuma mensagem real ou contato externo será alterado.'
              : 'Modo live: mensagens enviadas pelos números conectados.',
          )}
        </span>
        <b className={data?.workerLive ? 'is-online' : ''}>
          {t(data?.workerLive ? 'Robô online' : 'Robô offline')}
        </b>
        {!data?.workerLive && (
          <button disabled={busy} onClick={() => void action({ action: 'worker-start' })}>
            {t('Iniciar robô')}
          </button>
        )}
      </div>
      <div className="outreach-stats">
        {[
          { label: 'Conexões QR', value: sessions.length, icon: QrCode },
          {
            label: 'Filas individuais',
            value: runs.filter((r) => r.connector === 'whatsapp-web').length,
            icon: Users,
          },
          {
            label: 'Contatos concluídos',
            value: tasks.filter((task) => task.status === 'sent').length,
            icon: Check,
          },
          {
            label: 'Aguardando envio',
            value: tasks.filter((task) => task.status === 'pending').length,
            icon: Clock,
          },
        ].map((metric) => (
          <section key={metric.label}>
            <span>
              <metric.icon size={24} />
            </span>
            <div>
              <h2>{t(metric.label)}</h2>
              <strong>{n(metric.value)}</strong>
            </div>
          </section>
        ))}
      </div>
      <div className="outreach-tabs">
        <div role="tablist" aria-label={t('Fluxo do robô')}>
          {[
            { value: 'runs', label: 'Filas de contato' },
            { value: 'connections', label: 'Conexões QR' },
          ].map((item) => (
            <button
              role="tab"
              key={item.value}
              aria-selected={tab === item.value}
              onClick={() => setTab(item.value)}
            >
              {t(item.label)}
            </button>
          ))}
        </div>
        <button onClick={showConnection}>
          <Plus size={16} />
          {t('Conectar WhatsApp por QR')}
        </button>
      </div>
      {tab === 'connections' ? (
        <div className="outreach-connections">
          {sessions.map((session) => (
            <article key={session.id}>
              <header>
                <span className="outreach-wa">
                  <WhatsAppMark />
                </span>
                <div>
                  <h2>{session.name}</h2>
                  <p>
                    {session.phone
                      ? '+' + session.phone
                      : t(session.testOnly ? 'Conexão de teste' : 'WhatsApp Web')}
                  </p>
                </div>
                <span
                  className={`outreach-status ${session.status === 'ready' && data?.workerLive ? 'is-success' : ''}`}
                >
                  {t(
                    session.testOnly && session.status === 'ready'
                      ? 'Teste pronto'
                      : !data?.workerLive && session.status === 'ready'
                        ? 'Robô offline'
                        : labels[session.status],
                  )}
                </span>
              </header>
              {session.qr && session.status === 'qr' ? (
                <div className="outreach-qr">
                  <img src={session.qr} alt={t('QR para conectar seu WhatsApp')} />
                  <p>
                    {t(
                      'No WhatsApp: Dispositivos conectados → Conectar dispositivo. Escaneie este QR.',
                    )}
                  </p>
                </div>
              ) : (
                <div className="outreach-connection-info">
                  <QrCode size={30} />
                  <span>
                    {t(
                      session.status === 'ready'
                        ? 'Conexão disponível para suas filas individuais.'
                        : session.desiredConnected
                          ? 'Preparando a conexão. O QR aparecerá aqui.'
                          : 'Clique em conectar para gerar um QR.',
                    )}
                  </span>
                </div>
              )}
              {session.error && <p className="outreach-session-error">{session.error}</p>}
              <footer>
                <label>
                  {t('Limite local / 24h')}
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    defaultValue={session.dailyLimit}
                    key={`${session.id}:${session.dailyLimit}`}
                    onBlur={(e) => {
                      if (Number(e.target.value) !== session.dailyLimit)
                        void action({
                          action: 'session-update',
                          id: session.id,
                          dailyLimit: Number(e.target.value),
                        });
                    }}
                  />
                </label>
                <button
                  disabled={busy}
                  className="outreach-secondary"
                  onClick={() =>
                    void action({
                      action: session.desiredConnected ? 'session-disconnect' : 'session-connect',
                      id: session.id,
                    })
                  }
                >
                  {session.desiredConnected ? <Link2Off size={16} /> : <QrCode size={16} />}{' '}
                  {t(session.desiredConnected ? 'Desconectar' : 'Conectar')}
                </button>
              </footer>
            </article>
          ))}
          {!sessions.length && (
            <div className="outreach-empty">
              <QrCode size={35} />
              <h2>{t('Conecte seu primeiro número')}</h2>
              <p>{t('As conexões deste robô são independentes das contas da API oficial.')}</p>
              <button className="outreach-primary" onClick={showConnection}>
                {t('Conectar WhatsApp por QR')}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="outreach-runs">
          {runs.map((run) => {
            const jobs = tasks.filter((task) => task.runId === run.id),
              sent = jobs.filter((task) => task.status === 'sent').length,
              review = jobs.filter((task) =>
                ['needs-review', 'failed'].includes(task.status),
              ).length;
            return (
              <article key={run.id}>
                <header>
                  <span className="outreach-wa">
                    <Send size={23} />
                  </span>
                  <div>
                    <h2>{run.name}</h2>
                    <p>
                      {t(
                        run.connector === 'official-api'
                          ? 'Sequência antiga da API · somente histórico'
                          : run.simulated
                            ? 'WhatsApp Web · simulação'
                            : 'WhatsApp Web · envio real',
                      )}
                    </p>
                  </div>
                  <span className="outreach-status">{t(labels[run.status])}</span>
                </header>
                <p className="outreach-message-sample">
                  {run.connector === 'official-api' ? run.legacyTemplate?.template : run.message}
                </p>
                <div className="outreach-progress">
                  <span style={{ width: `${jobs.length ? (sent / jobs.length) * 100 : 0}%` }} />
                </div>
                <div className="outreach-run-meta">
                  <span>
                    {sent} / {jobs.length} {t('concluídos')}
                  </span>
                  <span>
                    {run.delay}s {t('entre contatos')}
                  </span>
                  {review > 0 && (
                    <b>
                      {review} {t('para revisar')}
                    </b>
                  )}
                </div>
                <footer>
                  <button className="outreach-secondary" onClick={() => showDetails(run.id)}>
                    {t('Ver contatos e respostas')}
                  </button>
                  {run.connector === 'whatsapp-web' && (
                    <button
                      className="outreach-primary"
                      disabled={
                        busy ||
                        run.status === 'completed' ||
                        (!jobs.some((task) => task.status === 'pending') &&
                          run.status !== 'running')
                      }
                      onClick={() =>
                        void action({
                          action: 'run-status',
                          id: run.id,
                          status: run.status === 'running' ? 'paused' : 'running',
                        })
                      }
                    >
                      {run.status === 'running' ? <Pause size={16} /> : <Play size={16} />}{' '}
                      {t(run.status === 'running' ? 'Pausar' : 'Iniciar')}
                    </button>
                  )}
                </footer>
              </article>
            );
          })}
          {!runs.length && (
            <div className="outreach-empty">
              <MessageCircle size={34} />
              <h2>{t('Uma fila para o trabalho individual')}</h2>
              <p>
                {t(
                  'Conecte um número por QR, escolha contatos autorizados e escreva a mensagem. Não é necessário um modelo da Meta.',
                )}
              </p>
              <button
                className="outreach-primary"
                onClick={() => (sessions.length ? showRun() : setTab('connections'))}
              >
                {t(sessions.length ? 'Nova fila individual' : 'Ver conexões QR')}
              </button>
            </div>
          )}
        </div>
      )}
      <div className="outreach-separation">
        <QrCode size={19} />
        <p>
          {t(
            'Este robô usa WhatsApp Web. Campanhas em massa e contas da API oficial continuam em suas próprias páginas.',
          )}
        </p>
      </div>
      <dialog
        ref={connectionDialog}
        className="outreach-dialog"
        aria-labelledby="outreach-connection-title"
      >
        <header>
          <h2 id="outreach-connection-title">{t('Conectar WhatsApp por QR')}</h2>
          <button
            disabled={busy}
            aria-label={t('Fechar formulário')}
            onClick={() => connectionDialog.current?.close()}
          >
            <X size={20} />
          </button>
        </header>
        {banner()}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await action({
                action: 'session-create',
                name: sessionName,
                dailyLimit: limit,
                testOnly,
              })
            ) {
              connectionDialog.current?.close();
              setTab('connections');
            }
          }}
        >
          <label>
            {t('Nome da conexão')}
            <input
              required
              maxLength={200}
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
            />
          </label>
          <label>
            {t('Limite local / 24h')}
            <input
              type="number"
              required
              min={1}
              max={10000}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            />
          </label>
          {data?.simulation && (
            <label className="outreach-check">
              <input
                type="checkbox"
                checked={testOnly}
                onChange={(e) => setTestOnly(e.target.checked)}
              />
              {t('Usar conexão de teste sem QR (somente simulação)')}
            </label>
          )}
          <p>
            {t(
              'Depois de adicionar, clique em Conectar e escaneie o QR com o telefone. As credenciais ficam somente neste servidor.',
            )}
          </p>
          <button className="outreach-primary" disabled={busy}>
            {t('Adicionar conexão')}
          </button>
        </form>
      </dialog>
      <dialog
        ref={runDialog}
        className="outreach-dialog outreach-dialog--wide"
        aria-labelledby="outreach-run-title"
      >
        <header>
          <h2 id="outreach-run-title">{t('Nova fila individual')}</h2>
          <button
            disabled={busy}
            aria-label={t('Fechar formulário')}
            onClick={() => runDialog.current?.close()}
          >
            <X size={20} />
          </button>
        </header>
        {banner()}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await action({
                action: 'run-create',
                name,
                message,
                delay,
                senderIds,
                contactIds: recipientIds,
                saveContacts,
                syncToPhone,
              })
            ) {
              runDialog.current?.close();
              setTab('runs');
            }
          }}
        >
          <label>
            {t('Nome da fila')}
            <input
              required
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <fieldset>
            <legend>{t('Números do robô')}</legend>
            {sessions
              .filter((s) => s.enabled && (data?.simulation || !s.testOnly))
              .map((session) => (
                <label className="outreach-check" key={session.id}>
                  <input
                    type="checkbox"
                    checked={senderIds.includes(session.id)}
                    onChange={() => setSenderIds(toggle(senderIds, session.id))}
                  />
                  {session.name} · {t(labels[session.status])}
                </label>
              ))}
          </fieldset>
          <label>
            {t('Mensagem individual')}
            <textarea
              required
              maxLength={4000}
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('Use {{nome}} ou {{name}} para personalizar.')}
            />
          </label>
          <div className="outreach-preview">
            <strong>{t('Prévia')}</strong>
            <p>
              {renderOutreachText(
                message,
                contacts.find((c) => recipientIds.includes(c.id))?.name || t('Cliente'),
                'WhatsBot Pro',
              ) || '…'}
            </p>
          </div>
          <label>
            {t('Intervalo entre contatos (segundos)')}
            <input
              type="number"
              required
              min={5}
              max={86400}
              value={delay}
              onChange={(e) => setDelay(Number(e.target.value))}
            />
          </label>
          <label className="outreach-check">
            <input
              type="checkbox"
              checked={saveContacts}
              onChange={(e) => {
                setSaveContacts(e.target.checked);
                if (!e.target.checked) setSyncToPhone(false);
              }}
            />
            {t('Salvar contato no WhatsApp antes de enviar')}
          </label>
          <label className="outreach-check">
            <input
              type="checkbox"
              disabled={!saveContacts}
              checked={syncToPhone}
              onChange={(e) => setSyncToPhone(e.target.checked)}
            />
            {t('Também sincronizar com a agenda do telefone')}
          </label>
          <fieldset>
            <legend>
              {t('Contatos autorizados')} · {recipientIds.length}
            </legend>
            <div className="outreach-select-tools">
              <input
                aria-label={t('Buscar contatos')}
                placeholder={t('Buscar contatos')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setRecipientIds(eligible.slice(0, 10000).map((c) => c.id))}
              >
                {t('Selecionar filtrados')}
              </button>
            </div>
            <div className="outreach-recipients">
              {eligible.slice(0, 100).map((contact) => (
                <label key={contact.id} className="outreach-check">
                  <input
                    type="checkbox"
                    checked={recipientIds.includes(contact.id)}
                    onChange={() => setRecipientIds(toggle(recipientIds, contact.id))}
                  />
                  {contact.name} · +{contact.phone}
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                runDialog.current?.close();
                onContacts();
              }}
            >
              {t('Gerenciar permissões dos contatos')}
            </button>
          </fieldset>
          <p>
            {t(
              'Cada contato é atribuído a um número fixo. A fila respeita o intervalo e o limite de cada conexão, sem trocar números automaticamente quando um limite é atingido.',
            )}
          </p>
          <button
            className="outreach-primary"
            disabled={busy || !senderIds.length || !recipientIds.length}
          >
            {t('Criar rascunho individual')}
          </button>
        </form>
      </dialog>
      <dialog
        ref={detailDialog}
        className="outreach-dialog outreach-dialog--wide"
        aria-labelledby="outreach-detail-title"
      >
        <header>
          <h2 id="outreach-detail-title">{chosen?.name || t('Fila individual')}</h2>
          <button aria-label={t('Fechar detalhes')} onClick={() => detailDialog.current?.close()}>
            <X size={20} />
          </button>
        </header>
        {banner()}
        <div className="outreach-task-list">
          {queue.map((task) => (
            <article key={task.id}>
              <div>
                <strong>{contactNames.get(task.contactId) || task.contactId}</strong>
                <small>
                  {sessions.find((s) => s.id === task.senderId)?.name || t('Conta da API antiga')} ·{' '}
                  {t(labels[task.status])}
                </small>
                {task.savedContact && <small>{t('Contato salvo no WhatsApp')}</small>}
                {task.error && <p>{t(task.error)}</p>}
              </div>
              {['needs-review', 'failed', 'pending'].includes(task.status) &&
                chosen?.connector === 'whatsapp-web' && (
                  <button
                    disabled={busy}
                    onClick={() => void action({ action: 'task-skip', id: task.id })}
                  >
                    {t('Ignorar após revisão')}
                  </button>
                )}
            </article>
          ))}
        </div>
        <h3>{t('Mensagens e respostas')}</h3>
        <div className="outreach-history">
          {(data?.messages || [])
            .filter((m) =>
              queue.some((task) => task.contactId === m.contactId && task.senderId === m.accountId),
            )
            .slice(-100)
            .map((m) => (
              <article key={m.id}>
                <strong>
                  {contactNames.get(m.contactId)} ·{' '}
                  {t(m.direction === 'in' ? 'Recebida' : 'Enviada')}
                </strong>
                <p>{m.text}</p>
                <small>
                  {new Date(m.createdAt).toLocaleString(locale)} · {m.status}
                  {m.simulated ? ' · ' + t('Simulação') : ''}
                </small>
              </article>
            ))}
        </div>
        <p>
          {t(
            'Uma entrega incerta nunca é reenviada automaticamente. Verifique a conversa e ignore o item após revisão para continuar.',
          )}
        </p>
      </dialog>
    </div>
  );
}
