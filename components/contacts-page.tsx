'use client';
import DismissibleDialog from './dismissible-dialog';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Users,
  ShieldCheck,
  ContactRound,
  Upload,
  Download,
  Plus,
  Search,
  List,
  ListFilter,
  LayoutGrid,
  Check,
  Pencil,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowUpRight,
  Trash2,
} from 'lucide-react';
import type { Contact } from '@/lib/types';
import { useLanguage } from './language';
import WhatsAppMark from './whatsapp-mark';
import { csvDownload } from '@/lib/csv';
import { contactColumns } from '@/lib/i18n';

type Filter = 'all' | 'yes' | 'no' | 'out';
export default function ContactsPage({
  contacts,
  busy,
  onImport,
  onAdd,
  onSave,
  onPermission,
  onRemove,
  onRestore,
}: {
  contacts: Contact[];
  busy: boolean;
  onImport: () => void;
  onAdd: () => void;
  onSave: (c: Pick<Contact, 'id' | 'name' | 'phone' | 'lists'>) => Promise<boolean>;
  onPermission: (c: Contact) => void;
  onRemove: (ids: string[]) => Promise<boolean>;
  onRestore: (ids: string[]) => Promise<boolean>;
}) {
  const { t, locale } = useLanguage();
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState<Filter>('all'),
    [permission, setPermission] = useState('all'),
    [list, setList] = useState('all'),
    [source, setSource] = useState('all');
  const [page, setPage] = useState(0),
    [size, setSize] = useState(10),
    [view, setView] = useState('list'),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [menu, setMenu] = useState<string | null>(null),
    [editing, setEditing] = useState<Contact | null>(null);
  const editor = useRef<HTMLDialogElement>(null);
  const removalDialog = useRef<HTMLDialogElement>(null);
  const [removing, setRemoving] = useState<Contact[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [removeError, setRemoveError] = useState(false);
  function showRemoval(items: Contact[]) {
    setRemoving(items);
    setRemoveError(false);
    setMenu(null);
    removalDialog.current?.showModal();
  }
  useEffect(() => {
    setPage(0);
    setSelected(new Set());
  }, [query, filter, permission, list, source]);
  useEffect(() => { setPage(0); }, [size]);
  useEffect(() => {
    if (editing) editor.current?.showModal();
  }, [editing]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('.contacts-row-menu')) setMenu(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', key);
    };
  }, [menu]);
  const lists = useMemo(
    () => Array.from(new Set(contacts.flatMap((c) => c.lists || []))).sort(),
    [contacts],
  );
  const sources = useMemo(
    () => Array.from(new Set(contacts.map((c) => c.source).filter(Boolean))).sort(),
    [contacts],
  );
  const status = (c: Contact): Filter => (c.optedOut ? 'out' : c.consent ? 'yes' : 'no');
  const counts = {
    all: contacts.length,
    yes: contacts.filter((c) => status(c) === 'yes').length,
    no: contacts.filter((c) => status(c) === 'no').length,
    out: contacts.filter((c) => status(c) === 'out').length,
  };
  const filtered = useMemo(
    () =>
      contacts.filter(
        (c) =>
          (filter === 'all' || status(c) === filter) &&
          (permission === 'all' || status(c) === permission) &&
          (list === 'all' || c.lists?.includes(list)) &&
          (source === 'all' || c.source === source) &&
          (c.name + ' ' + c.phone + ' ' + (c.lists || []).join(' '))
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase()),
      ),
    [contacts, query, filter, permission, list, source],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / size)),
    current = Math.min(page, totalPages - 1),
    rows = filtered.slice(current * size, (current + 1) * size);
  const number = (n: number) => n.toLocaleString(locale);
  const exportRows = (items: Contact[]) =>
    csvDownload(locale === 'en' ? 'contacts.csv' : 'contatos.csv', [
      contactColumns[locale],
      ...items.map((c) => [c.name, c.phone, c.consent, c.source, c.optedOut]),
    ]);
  const toggle = (id: string) =>
    setSelected((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allChecked = !!filtered.length && filtered.every((c) => selected.has(c.id));
  const selectAll = () => setSelected(new Set(filtered.map((c) => c.id)));
  const selectionCheckbox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectionCheckbox.current)
      selectionCheckbox.current.indeterminate = selected.size > 0 && !allChecked;
  }, [selected, allChecked, view]);
  const pages = Array.from(
    new Set([
      0,
      ...(current < 3 ? [0, 1, 2, 3, 4] : [current - 1, current, current + 1]).filter((n) => n >= 0 && n < totalPages),
      totalPages - 1,
    ]),
  ).sort((a, b) => a - b);
  const recent = contacts.filter(
    (c) => Date.parse(c.createdAt) >= Date.now() - 7 * 86400000,
  ).length;
  const tabs: [Filter, string][] = [
    ['all', 'Todos os contatos'],
    ['yes', 'Com permissão'],
    ['no', 'Sem permissão'],
    ['out', 'Descadastrados'],
  ];
  function name(c: Contact, index: number) {
    return (
      <span className="contacts-person">
        <span className={`contacts-avatar contacts-avatar--${index % 4}`}>
          {c.name
            .split(/\s+/)
            .map((x) => x[0])
            .slice(0, 2)
            .join('')
            .toUpperCase()}
        </span>
        <strong>{c.name}</strong>
      </span>
    );
  }
  function permissionBadge(c: Contact) {
    return (
      <span className={`contacts-permission contacts-permission--${status(c)}`}>
        {status(c) === 'yes' ? <Check size={15} /> : <X size={13} />}{' '}
        {t(status(c) === 'yes' ? 'Sim' : status(c) === 'out' ? 'Descadastrado' : 'Sem permissão')}
      </span>
    );
  }
  function tags(c: Contact) {
    return c.lists?.length ? (
      c.lists.map((tag, i) => (
        <span className={`contacts-tag contacts-tag--${i % 4}`} key={tag}>
          {tag}
        </span>
      ))
    ) : (
      <span className="contacts-muted">—</span>
    );
  }
  function actions(c: Contact) {
    return (
      <div className="contacts-actions">
        <button aria-label={`${t('Editar contato')}: ${c.name}`} onClick={() => setEditing(c)}>
          <Pencil size={17} />
        </button>
        <button className="contacts-remove" disabled={busy} title={t('Remover contato')}
          aria-label={`${t('Remover contato')}: ${c.name}`} onClick={() => showRemoval([c])}>
          <Trash2 size={17} />
        </button>
        <div className="contacts-row-menu">
          <button
            aria-label={`${t('Mais ações')}: ${c.name}`}
            aria-expanded={menu === c.id}
            onClick={() => setMenu(menu === c.id ? null : c.id)}
          >
            <MoreHorizontal size={21} />
          </button>
          {menu === c.id && (
            <div className="contacts-menu" role="menu">
              <button
                role="menuitem"
                onClick={() => {
                  onPermission(c);
                  setMenu(null);
                }}
              >
                {t(status(c) === 'yes' ? 'Descadastrar' : 'Registrar permissão')}
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  exportRows([c]);
                  setMenu(null);
                }}
              >
                {t('Exportar contato')}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="contacts-page">
      <header className="contacts-heading">
        <div>
          <h1>{t('Contatos')}</h1>
          <p>{t('Gerencie seus contatos do WhatsApp, organize listas e controle permissões.')}</p>
        </div>
        <div className="contacts-heading-actions">
          <button onClick={onImport}>
            <Upload size={18} />
            {t('Importar lista')}
          </button>
          <button
            onClick={() =>
              exportRows(selected.size ? filtered.filter((c) => selected.has(c.id)) : filtered)
            }
          >
            <Download size={18} />
            {t('Exportar')}
            {selected.size > 0 && ` (${number(selected.size)})`}
          </button>
          <button className="contacts-primary" onClick={onAdd}>
            <Plus size={20} />
            {t('Adicionar contato')}
          </button>
        </div>
      </header>
      {removed.length > 0 && <div className="contacts-removal-notice" role="status">
        <span>{number(removed.length)} {t('contatos removidos')}</span>
        <button disabled={busy} onClick={async () => {
          if (await onRestore(removed)) setRemoved([]);
        }}>{t('Desfazer')}</button>
      </div>}
      <div className="contacts-stats">
        {[
          {
            label: 'Total de contatos',
            value: contacts.length,
            icon: Users,
            tone: 'green',
            detail: (
              <>
                <ArrowUpRight size={14} />
                <b>{number(recent)}</b> {t('nos últimos 7 dias')}
              </>
            ),
          },
          {
            label: 'Listas',
            value: lists.length,
            icon: Users,
            tone: 'blue',
            detail: t('Listas de contatos ativas'),
          },
          {
            label: 'Com permissão',
            value: counts.yes,
            icon: ShieldCheck,
            tone: 'purple',
            detail: `${contacts.length ? ((counts.yes / contacts.length) * 100).toLocaleString(locale, { maximumFractionDigits: 2 }) : 0}% ${t('do total')}`,
          },
          {
            label: 'Descadastrados',
            value: counts.out,
            icon: ContactRound,
            tone: 'amber',
            detail: `${contacts.length ? ((counts.out / contacts.length) * 100).toLocaleString(locale, { maximumFractionDigits: 2 }) : 0}% ${t('do total')}`,
          },
        ].map((metric) => (
          <section className={`contacts-stat contacts-stat--${metric.tone}`} key={metric.label}>
            <span className="contacts-stat-icon">
              <metric.icon size={30} />
            </span>
            <div>
              <h2>{t(metric.label)}</h2>
              <strong>{number(metric.value)}</strong>
              <p>{metric.detail}</p>
            </div>
          </section>
        ))}
      </div>
      <section className="contacts-panel">
        <div className="contacts-tabs" role="tablist" aria-label={t('Filtrar por permissão')}>
          {tabs.map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
            >
              {t(label)} <span>({number(counts[value])})</span>
            </button>
          ))}
        </div>
        <div className="contacts-controls">
          <label className="contacts-search">
            <Search size={19} />
            <input
              aria-label={t('Buscar contatos')}
              placeholder={t('Buscar por nome, telefone ou lista...')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label={t('Filtrar listas')}
            value={list}
            onChange={(e) => setList(e.target.value)}
          >
            <option value="all">{t('Todas as listas')}</option>
            {lists.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            aria-label={t('Filtrar permissões')}
            value={permission}
            onChange={(e) => setPermission(e.target.value)}
          >
            <option value="all">{t('Todas as permissões')}</option>
            {tabs.slice(1).map(([value, label]) => (
              <option value={value} key={value}>
                {t(label)}
              </option>
            ))}
          </select>
          <select
            aria-label={t('Filtrar origens')}
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="all">{t('Todas as origens')}</option>
            {sources.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <div className="contacts-view" role="group" aria-label={t('Visualização')}>
            {[
              { value: 'list', label: 'Lista', icon: List },
              { value: 'compact', label: 'Compacta', icon: ListFilter },
              { value: 'grid', label: 'Grade', icon: LayoutGrid },
            ].map((x) => (
              <button
                key={x.value}
                aria-label={t(x.label)}
                aria-pressed={view === x.value}
                onClick={() => setView(x.value)}
              >
                <x.icon size={19} />
              </button>
            ))}
          </div>
        </div>
        {filtered.length > 0 && <div className="contacts-selection-bar">
          <strong>{number(selected.size)} {t('selecionados')}</strong>
          <button disabled={busy || allChecked} onClick={selectAll}>
            {t('Selecionar todos os contatos')} ({number(filtered.length)})
          </button>
          <span>{t('Em todas as páginas, respeitando os filtros atuais.')}</span>
          {selected.size > 0 && <button disabled={busy} onClick={() => setSelected(new Set())}>{t('Limpar seleção')}</button>}
          {selected.size > 0 && <button className="contacts-selected-remove" disabled={busy} onClick={() => showRemoval(contacts.filter(c => selected.has(c.id)))}>
            <Trash2 size={16} />{t('Remover selecionados')} ({number(selected.size)})
          </button>}
        </div>}
        <div className={`contacts-results contacts-results--${view}`}>
          {view === 'grid' ? (
            <div className="contacts-grid">
              {rows.map((c, i) => (
                <article key={c.id}>
                  <input type="checkbox" aria-label={`${t('Selecionar contato')}: ${c.name}`}
                    checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                  {name(c, i)}
                  <p>
                    <WhatsAppMark variant="whatsapp" /> +{c.phone}
                  </p>
                  <div className="contacts-tags">{tags(c)}</div>
                  {permissionBadge(c)}
                  {actions(c)}
                </article>
              ))}
            </div>
          ) : (
            <div className="contacts-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        ref={selectionCheckbox}
                        aria-label={t('Selecionar todos os contatos')}
                        aria-checked={selected.size > 0 && !allChecked ? 'mixed' : allChecked}
                        title={t('Em todas as páginas, respeitando os filtros atuais.')}
                        checked={allChecked}
                        onChange={() => allChecked ? setSelected(new Set()) : selectAll()}
                      />
                    </th>
                    {[
                      'Nome',
                      'Telefone',
                      'Listas',
                      'Permissão',
                      'Origem',
                      'Adicionado em',
                      'Ações',
                    ].map((x) => (
                      <th key={x}>{t(x)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c, i) => (
                    <tr key={c.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`${t('Selecionar contato')}: ${c.name}`}
                          checked={selected.has(c.id)}
                          onChange={() => toggle(c.id)}
                        />
                      </td>
                      <td>{name(c, i)}</td>
                      <td>
                        <span className="contacts-phone">
                          <WhatsAppMark variant="whatsapp" />+{c.phone}
                        </span>
                      </td>
                      <td>
                        <div className="contacts-tags">{tags(c)}</div>
                      </td>
                      <td>{permissionBadge(c)}</td>
                      <td className="contacts-source" title={c.source}>
                        {c.source || '—'}
                      </td>
                      <td className="contacts-date">
                        {new Date(c.createdAt).toLocaleString(locale, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td>{actions(c)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!filtered.length && (
            <div className="contacts-empty">
              <Users size={32} />
              <h3>{t('Nenhum contato encontrado')}</h3>
              <p>{t('Adicione um contato, importe uma lista ou ajuste os filtros.')}</p>
            </div>
          )}
        </div>
        <footer className="contacts-pagination">
          <span>
            {t('Exibindo')} {number(filtered.length ? current * size + 1 : 0)}–
            {number(Math.min((current + 1) * size, filtered.length))} {t('de')}{' '}
            {number(filtered.length)} {t('contatos')}
          </span>
          <nav aria-label={t('Paginação dos contatos')}>
            <button
              aria-label={t('Anterior')}
              disabled={!current}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            {pages.map((n, i) => (
              <span key={n}>
                {i > 0 && n > pages[i - 1] + 1 && <span className="contacts-page-gap">…</span>}
                <button
                  aria-label={`${t('Página')} ${n + 1}`}
                  aria-current={current === n ? 'page' : undefined}
                  onClick={() => setPage(n)}
                >
                  {number(n + 1)}
                </button>
              </span>
            ))}
            <button
              aria-label={t('Próxima')}
              disabled={current >= totalPages - 1}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </nav>
          <label>
            {t('Linhas por página')}
            <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
              {[10, 25, 50, 100].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
        </footer>
      </section>
      <DismissibleDialog ref={removalDialog} className="contacts-editor contacts-remove-dialog" aria-labelledby="contacts-remove-title">
        <header>
          <h2 id="contacts-remove-title">{t(removing.length === 1 ? 'Remover contato' : 'Remover contatos')}?</h2>
          <button disabled={busy} aria-label={t('Cancelar')} onClick={() => removalDialog.current?.close()}><X size={20} /></button>
        </header>
        <p><strong>{removing.length === 1 ? removing[0]?.name : `${number(removing.length)} ${t('contatos selecionados')}`}</strong></p>
        <p>{t('Os contatos serão removidos da lista e seus envios pendentes serão cancelados. O histórico de mensagens será preservado.')}</p>
        <p>{t('Ao desfazer, registre a permissão novamente antes de enviar.')}</p>
        {removeError && <p role="alert">{t('Não foi possível remover. Aguarde os envios em processamento terminarem e tente novamente.')}</p>}
        <footer>
          <button disabled={busy} onClick={() => removalDialog.current?.close()}>{t('Cancelar')}</button>
          <button className="contacts-selected-remove" disabled={busy} onClick={async () => {
            const ids = removing.map(c => c.id);
            if (await onRemove(ids)) {
              setRemoved(ids);
              const removedIds = new Set(ids);
              setSelected(previous => new Set([...previous].filter(id => !removedIds.has(id))));
              removalDialog.current?.close();
            } else setRemoveError(true);
          }}><Trash2 size={16} />{t('Remover')} ({number(removing.length)})</button>
        </footer>
      </DismissibleDialog>
      <DismissibleDialog
        ref={editor}
        className="contacts-editor"
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setEditing(null);
        }}
        onClose={() => setEditing(null)}
        aria-labelledby="contact-edit-title"
      >
        {editing && (
          <form
            key={editing.id}
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const ok = await onSave({
                id: editing.id,
                name: String(form.get('name')),
                phone: String(form.get('phone')),
                lists: String(form.get('lists'))
                  .split(',')
                  .map((x) => x.trim())
                  .filter(Boolean),
              });
              if (ok) {
                editor.current?.close();
                setEditing(null);
              }
            }}
          >
            <header>
              <h2 id="contact-edit-title">{t('Editar contato')}</h2>
              <button
                type="button"
                aria-label={t('Fechar formulário')}
                disabled={busy}
                onClick={() => editor.current?.close()}
              >
                <X size={20} />
              </button>
            </header>
            <label>
              {t('Nome')}
              <input name="name" required maxLength={200} defaultValue={editing.name} />
            </label>
            <label>
              {t('Telefone com código do país')}
              <input
                name="phone"
                required
                pattern="[+0-9 () .-]{8,25}"
                defaultValue={editing.phone}
              />
            </label>
            <p className="contacts-edit-note">
              {t('Ao alterar o telefone, registre novamente a permissão para o novo número.')}
            </p>
            <label>
              {t('Listas (separadas por vírgula)')}
              <input
                name="lists"
                defaultValue={editing.lists?.join(', ') || ''}
                placeholder={t('Ex.: Clientes, Promoção')}
              />
            </label>
            <button className="contacts-primary" disabled={busy} type="submit">
              {t(busy ? 'Salvando…' : 'Salvar contato')}
            </button>
          </form>
        )}
      </DismissibleDialog>
    </div>
  );
}

