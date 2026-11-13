'use client';
import { useMemo, useRef, useState } from 'react';
import {
  Send,
  Play,
  Check,
  X,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
  FileText,
  Pause,
  BarChart3,
  MoreHorizontal,
  ChevronDown,
  ArrowUpRight,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import type { Campaign, State } from '@/lib/types';
import { overviewData } from '@/lib/overview-data';
import { useLanguage } from './language';
import MessageActivity from './message-activity';

type Status = 'all' | 'running' | 'draft' | 'completed' | 'failed' | 'paused';
export default function CampaignsPage({
  data,
  busy,
  onCreate,
  onStatus,
  onRemove,
  onRestore,
}: {
  data: State & { simulation: boolean };
  busy: boolean;
  onCreate: () => void;
  onStatus: (c: Campaign) => void;
  onRemove: (c: Campaign) => Promise<boolean>;
  onRestore: (c: Campaign) => Promise<boolean>;
}) {
  const { t, locale } = useLanguage();
  const [filter, setFilter] = useState<Status>('all'),
    [query, setQuery] = useState(''),
    [account, setAccount] = useState('all'),
    [advanced, setAdvanced] = useState(false),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [detail, setDetail] = useState<Campaign | null>(null),
    [page, setPage] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const removeDialog = useRef<HTMLDialogElement>(null);
  const [removing, setRemoving] = useState<Campaign | null>(null);
  const [removed, setRemoved] = useState<Campaign | null>(null);
  const [removeError, setRemoveError] = useState(false);
  const campaigns = data.campaigns.filter((c) => c.mode === 'bulk');
  const jobs = useMemo(() => {
    const map = new Map<string, State['jobs']>();
    for (const job of data.jobs) {
      const list = map.get(job.campaignId) || [];
      list.push(job);
      map.set(job.campaignId, list);
    }
    return map;
  }, [data.jobs]);
  const status = (c: Campaign): Status =>
    c.status !== 'running' && (jobs.get(c.id) || []).some((j) => j.status === 'failed')
      ? 'failed'
      : c.status;
  const count = (s: Status) =>
    s === 'all' ? campaigns.length : campaigns.filter((c) => status(c) === s).length;
  const ids = new Set(campaigns.map((c) => c.id));
  const messages = data.messages.filter(
    (m) => m.direction === 'in' || (m.campaignId && ids.has(m.campaignId)),
  );
  const stats = overviewData({ ...data, messages }, data.simulation);
  const failedMessages = messages.filter(
    (m) => m.direction === 'out' && !!m.simulated === data.simulation && m.status === 'failed',
  ).length;
  const failureRate =
    stats.sent + failedMessages ? (failedMessages / (stats.sent + failedMessages)) * 100 : 0;
  const filtered = campaigns.filter(
    (c) =>
      (filter === 'all' || status(c) === filter) &&
      (account === 'all' || c.accountId === account) &&
      `${c.name} ${c.template}`.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 10)),
    current = Math.min(page, pages - 1),
    rows = filtered.slice(current * 10, current * 10 + 10);
  const labels: Record<Status, string> = {
    all: 'Todas as campanhas',
    running: 'Em execução',
    draft: 'Rascunhos',
    completed: 'Concluídas',
    failed: 'Falhas',
    paused: 'Pausadas',
  };
  const singular: Record<Status, string> = {
    ...labels,
    running: 'Em execução',
    draft: 'Rascunho',
    completed: 'Concluída',
    failed: 'Falhou',
    paused: 'Pausada',
  };
  const n = (value: number) => value.toLocaleString(locale);
  const percent = (value: number) =>
    value.toLocaleString(locale, { maximumFractionDigits: 1 }) + '%';
  const showDetail = (c: Campaign) => {
    setDetail(c);
    dialog.current?.showModal();
  };
  const toggle = (id: string) =>
    setSelected((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const recent = campaigns.filter(
    (c) => Date.parse(c.createdAt) > Date.now() - 7 * 86400000,
  ).length;
  const previous = campaigns.filter((c) => {
    const age = Date.now() - Date.parse(c.createdAt);
    return age >= 7 * 86400000 && age < 14 * 86400000;
  }).length;
  return (
    <div className="campaigns-page">
      <header className="campaigns-heading">
        <div>
          <h1>
            {t('Campanhas')} <span className="campaigns-channel">{t('API oficial')}</span>
          </h1>
          <p>
            {t(
              'Envie modelos aprovados para seus contatos em escala. Acompanhe o desempenho e gerencie suas campanhas.',
            )}
          </p>
        </div>
        <button className="campaigns-create" onClick={onCreate}>
          <Plus size={20} />
          {t('Nova campanha')}
        </button>
      </header>
      {removed && <div className="campaigns-removed" role="status">
        <span>{t('Campanha removida')}: <strong>{removed.name}</strong></span>
        <button disabled={busy} onClick={async () => {
          if (await onRestore(removed)) setRemoved(null);
        }}>{t('Desfazer')}</button>
      </div>}
      <div className="campaigns-stats">
        {[
          {
            label: 'Total de campanhas',
            value: campaigns.length,
            icon: Send,
            tone: 'green',
            detail: (
              <>
                <ArrowUpRight size={16} />
                <b>
                  {previous ? `+${percent(((recent - previous) / previous) * 100)}` : n(recent)}
                </b>{' '}
                {t(previous ? 'vs. últimos 7 dias' : 'nos últimos 7 dias')}
              </>
            ),
          },
          {
            label: 'Em execução',
            value: count('running'),
            icon: Play,
            tone: 'blue',
            detail: t('Enviando agora'),
          },
          {
            label: 'Concluídas',
            value: count('completed'),
            icon: Check,
            tone: 'purple',
            detail: `${percent(campaigns.length ? (count('completed') / campaigns.length) * 100 : 0)} ${t('do total')}`,
          },
          {
            label: 'Falhas',
            value: count('failed'),
            icon: X,
            tone: 'amber',
            detail: `${percent(campaigns.length ? (count('failed') / campaigns.length) * 100 : 0)} ${t('taxa de falha')}`,
          },
        ].map((metric) => (
          <section className={`campaigns-stat campaigns-stat--${metric.tone}`} key={metric.label}>
            <span>
              <metric.icon size={35} />
            </span>
            <div>
              <h2>{t(metric.label)}</h2>
              <strong>{n(metric.value)}</strong>
              <p>{metric.detail}</p>
            </div>
          </section>
        ))}
      </div>
      <div className="campaigns-analytics">
        <section className="campaigns-performance">
          <MessageActivity
            messages={messages.filter((m) => m.direction === 'out')}
            simulation={data.simulation}
            variant="overview"
            title="Desempenho das campanhas"
          />
        </section>
        <section className="campaigns-delivery">
          <h2>{t('Entrega geral')}</h2>
          <div className="campaigns-delivery-content">
            <div
              className="campaigns-donut"
              role="img"
              aria-label={`${percent(stats.deliveryRate)} ${t('Entregues')}`}
              style={{
                background: `conic-gradient(#00b73c 0deg ${stats.deliveryRate * 3.6}deg,#e7eee9 ${stats.deliveryRate * 3.6}deg 360deg)`,
              }}
            >
              <div>
                <strong>{percent(stats.deliveryRate)}</strong>
                <span>{t('Entregues')}</span>
              </div>
            </div>
            <div className="campaigns-delivery-totals">
              {[
                { label: 'Mensagens enviadas', value: stats.sent, icon: Send, tone: 'blue' },
                { label: 'Entregues', value: stats.delivered, icon: Check, tone: 'green' },
                { label: 'Respostas', value: stats.replies, icon: MessageSquare, tone: 'cyan' },
                { label: 'Falhas', value: failedMessages, icon: X, tone: 'red' },
              ].map((metric) => (
                <div key={metric.label}>
                  <span className={`campaigns-small-icon campaigns-small-icon--${metric.tone}`}>
                    <metric.icon size={20} />
                  </span>
                  <span>{t(metric.label)}</span>
                  <strong>{n(metric.value)}</strong>
                </div>
              ))}
            </div>
          </div>
          {data.simulation && (
            <span className="campaigns-simulation-note">{t('Simulação · sem envios reais')}</span>
          )}
        </section>
      </div>
      <section className="campaigns-list">
        <div className="campaigns-list-toolbar">
          <div className="campaigns-tabs" role="tablist" aria-label={t('Filtrar campanhas')}>
            {(
              [
                'all',
                'running',
                'draft',
                'completed',
                'failed',
                ...(count('paused') ? ['paused'] : []),
              ] as Status[]
            ).map((value) => (
              <button
                key={value}
                role="tab"
                aria-selected={filter === value}
                onClick={() => {
                  setFilter(value);
                  setPage(0);
                }}
              >
                {t(labels[value])} ({n(count(value))})
              </button>
            ))}
          </div>
          <div className="campaigns-search-tools">
            <label>
              <Search size={19} />
              <input
                aria-label={t('Buscar campanha')}
                placeholder={t('Buscar campanha...')}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <button
              aria-label={t('Filtros das campanhas')}
              aria-expanded={advanced}
              onClick={() => setAdvanced(!advanced)}
            >
              <SlidersHorizontal size={20} />
            </button>
          </div>
        </div>
        {advanced && (
          <div className="campaigns-filters">
            <label>
              {t('Conta')}
              <select
                value={account}
                onChange={(e) => {
                  setAccount(e.target.value);
                  setPage(0);
                }}
              >
                <option value="all">{t('Todas as contas')}</option>
                {data.accounts.map((a) => (
                  <option value={a.id} key={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => {
                setAccount('all');
                setQuery('');
                setFilter('all');
                setPage(0);
              }}
            >
              {t('Limpar filtros')}
            </button>
          </div>
        )}
        {selected.size > 0 && (
          <div className="campaigns-selected">
            {n(selected.size)} {t('selecionadas')}
            <button
              onClick={() => {
                const c = campaigns.find((c) => selected.has(c.id));
                if (c) showDetail(c);
              }}
            >
              {t('Ver detalhes')}
            </button>
            <button onClick={() => setSelected(new Set())}>{t('Limpar seleção')}</button>
          </div>
        )}
        <div className="campaigns-table-scroll">
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label={t('Selecionar página')}
                    checked={!!rows.length && rows.every((c) => selected.has(c.id))}
                    onChange={() => {
                      const all = rows.every((c) => selected.has(c.id));
                      setSelected((old) => {
                        const next = new Set(old);
                        rows.forEach((c) => (all ? next.delete(c.id) : next.add(c.id)));
                        return next;
                      });
                    }}
                  />
                </th>
                {[
                  'Nome da campanha',
                  'Modelo',
                  'Público',
                  'Status',
                  'Progresso',
                  'Enviados / Total',
                  'Ações',
                ].map((label) => (
                  <th key={label}>{t(label)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c, index) => {
                const queue = jobs.get(c.id) || [],
                  sent = queue.filter((j) => j.status === 'sent').length,
                  progress = queue.length ? (sent / queue.length) * 100 : 0,
                  s = status(c),
                  pending = queue.some((j) => j.status === 'pending');
                return (
                  <tr key={c.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`${t('Selecionar campanha')}: ${c.name}`}
                        checked={selected.has(c.id)}
                        onChange={() => toggle(c.id)}
                      />
                    </td>
                    <td>
                      <button className="campaigns-name" onClick={() => showDetail(c)}>
                        <span
                          className={`campaigns-campaign-icon campaigns-campaign-icon--${index % 4}`}
                        >
                          <Send size={24} />
                        </span>
                        <span>
                          <strong>{c.name}</strong>
                          <time>
                            {new Date(c.createdAt).toLocaleString(locale, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </time>
                        </span>
                      </button>
                    </td>
                    <td>
                      <span className="campaigns-template">
                        <FileText size={14} />
                        {c.template}
                      </span>
                    </td>
                    <td>
                      <span className="campaigns-audience">
                        <Users size={18} />
                        {n(queue.length)}
                      </span>
                    </td>
                    <td>
                      <span className={`campaigns-status campaigns-status--${s}`}>
                        {s === 'completed' ? (
                          <Check size={16} />
                        ) : s === 'failed' ? (
                          <X size={16} />
                        ) : s === 'paused' ? (
                          <Pause size={14} />
                        ) : s === 'draft' ? (
                          <FileText size={14} />
                        ) : (
                          <Play size={14} />
                        )}{' '}
                        {t(singular[s])}
                      </span>
                    </td>
                    <td>
                      <div
                        className={`campaigns-progress ${s === 'failed' ? 'campaigns-progress--failed' : ''}`}
                      >
                        <div>
                          <span>{percent(progress)}</span>
                          <span>{percent(progress)}</span>
                        </div>
                        <div
                          role="progressbar"
                          aria-label={`${t('Progresso')}: ${c.name}`}
                          aria-valuenow={Math.round(progress)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <span style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="campaigns-sent-total">
                      {n(sent)} / {n(queue.length)}
                    </td>
                    <td>
                      <div className="campaigns-row-actions">
                        <button
                          disabled={busy || !pending}
                          aria-label={`${t(c.status === 'running' ? 'Pausar' : 'Iniciar')}: ${c.name}`}
                          onClick={() => onStatus(c)}
                        >
                          {c.status === 'running' ? (
                            <Pause size={18} />
                          ) : pending ? (
                            <Play size={18} />
                          ) : null}
                        </button>
                        <button
                          aria-label={`${t('Desempenho')}: ${c.name}`}
                          onClick={() => showDetail(c)}
                        >
                          <BarChart3 size={19} />
                        </button>
                        <button
                          aria-label={`${t('Mais ações')}: ${c.name}`}
                          onClick={() => showDetail(c)}
                        >
                          <MoreHorizontal size={21} />
                        </button>
                        <button
                          className="campaigns-remove"
                          disabled={busy}
                          aria-label={`${t('Remover campanha')}: ${c.name}`}
                          title={t('Remover campanha')}
                          onClick={() => {
                            setRemoving(c);
                            setRemoveError(false);
                            removeDialog.current?.showModal();
                          }}
                        ><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <div className="campaigns-empty">
            <Send size={30} />
            <h3>{t('Nenhuma campanha encontrada')}</h3>
            <p>{t('Crie uma campanha ou ajuste os filtros para começar.')}</p>
            <button onClick={onCreate}>{t('Nova campanha')}</button>
          </div>
        )}
        {pages > 1 && (
          <footer className="campaigns-pagination">
            <span>
              {n(current * 10 + 1)}–{n(Math.min(current * 10 + 10, filtered.length))} /{' '}
              {n(filtered.length)}
            </span>
            <button
              aria-label={t('Anterior')}
              disabled={!current}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <span>
              {current + 1} / {pages}
            </span>
            <button
              aria-label={t('Próxima')}
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </footer>
        )}
      </section>
      <dialog className="campaigns-detail campaigns-remove-dialog" ref={removeDialog} aria-labelledby="campaign-remove-title">
        <header>
          <h2 id="campaign-remove-title">{t('Remover campanha')}?</h2>
          <button disabled={busy} aria-label={t('Cancelar')} onClick={() => removeDialog.current?.close()}><X size={20} /></button>
        </header>
        <strong className="campaigns-remove-name">{removing?.name}</strong>
        <p>{t('A campanha será removida da lista e os envios pendentes serão interrompidos. Contatos e mensagens já enviadas serão preservados.')}</p>
        {removing && (jobs.get(removing.id) || []).some((j) => j.status === 'processing') &&
          <p role="alert">{t('Pause a campanha e aguarde o envio atual terminar antes de remover.')}</p>}
        {removeError && <p role="alert">{t('Não foi possível remover. Aguarde o envio atual terminar e tente novamente.')}</p>}
        <footer>
          <button className="campaigns-remove-cancel" disabled={busy} onClick={() => removeDialog.current?.close()}>{t('Cancelar')}</button>
          <button className="campaigns-remove-confirm" disabled={busy || !!(removing && (jobs.get(removing.id) || []).some((j) => j.status === 'processing'))} onClick={async () => {
            if (!removing) return;
            setRemoveError(false);
            if (await onRemove(removing)) {
              setRemoved(removing);
              setSelected((previous) => { const next = new Set(previous); next.delete(removing.id); return next; });
              removeDialog.current?.close();
            } else setRemoveError(true);
          }}><Trash2 size={16} />{t('Remover campanha')}</button>
        </footer>
      </dialog>
      <dialog
        className="campaigns-detail"
        ref={dialog}
        aria-labelledby="campaign-detail-title"
        onClose={() => setDetail(null)}
      >
        {detail && (
          <>
            <header>
              <div>
                <h2 id="campaign-detail-title">{detail.name}</h2>
                <p>
                  {t('Conta')}: {data.accounts.find((a) => a.id === detail.accountId)?.name} ·{' '}
                  {detail.template}
                </p>
              </div>
              <button aria-label={t('Fechar detalhes')} onClick={() => dialog.current?.close()}>
                <X size={20} />
              </button>
            </header>
            <div className="campaigns-detail-stats">
              {['sent', 'pending', 'processing', 'failed', 'skipped'].map((s) => (
                <div key={s}>
                  <strong>
                    {n((jobs.get(detail.id) || []).filter((j) => j.status === s).length)}
                  </strong>
                  <span>
                    {t(
                      (
                        {
                          sent: 'Enviados',
                          pending: 'Pendentes',
                          processing: 'Em processamento',
                          failed: 'Falhas',
                          skipped: 'Ignorados',
                        } as Record<string, string>
                      )[s],
                    )}
                  </span>
                </div>
              ))}
            </div>
            <p>
              {t('Intervalo por conta')}: {detail.delay}s
            </p>
            {(jobs.get(detail.id) || [])
              .filter((j) => j.error || j.status === 'processing')
              .map((j) => (
                <p className="campaigns-job-error" key={j.id}>
                  {data.contacts.find((c) => c.id === j.contactId)?.name}:{' '}
                  {t(
                    j.error ||
                      'Envio reservado. Se o processo foi interrompido, confirme na Meta antes de reenviar.',
                  )}
                </p>
              ))}
            <p className="campaigns-detail-note">
              {t('Falhas pausam a campanha e não são reenviadas automaticamente.')}
            </p>
            {(jobs.get(detail.id) || []).some((j) => j.status === 'pending') && (
              <button
                className="campaigns-create"
                disabled={busy}
                onClick={() => onStatus(data.campaigns.find((c) => c.id === detail.id) || detail)}
              >
                {t(
                  (data.campaigns.find((c) => c.id === detail.id) || detail).status === 'running'
                    ? 'Pausar'
                    : 'Iniciar',
                )}
              </button>
            )}
          </>
        )}
      </dialog>
    </div>
  );
}
