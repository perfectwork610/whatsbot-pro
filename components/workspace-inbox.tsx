'use client';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  MessageCircle,
  Search,
  Send,
  Inbox,
  MessagesSquare,
  Check,
  CheckCheck,
  Filter,
  Tag,
  Star,
  MoreHorizontal,
  Smile,
  Paperclip,
  Mic,
  X,
  Plus,
  ArrowLeft,
  FlaskConical,
  ChevronDown,
  Clock,
} from 'lucide-react';
import type { State, Contact } from '@/lib/types';
import { inboxConversations, type ConversationMeta } from '@/lib/inbox-data';
import { useLanguage } from './language';
import WhatsAppMark from './whatsapp-mark';
import { statusLabels } from './workspace-ui';

type InboxRow = ReturnType<typeof inboxConversations>[number];
export default function WorkspaceInbox({
  data,
  accountId,
  contactId,
  setAccountId,
  setContactId,
  onAction,
  busy,
}: {
  data: State & { simulation: boolean };
  accountId: string;
  contactId: string;
  setAccountId: (id: string) => void;
  setContactId: (id: string) => void;
  onAction: (payload: object, message: string) => Promise<boolean>;
  busy: boolean;
}) {
  const { t, locale } = useLanguage();
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [accountFilter, setAccountFilter] = useState('all'),
    [filters, setFilters] = useState(false),
    [onlyStarred, setOnlyStarred] = useState(false),
    [newChat, setNewChat] = useState(false),
    [mobileChat, setMobileChat] = useState(false),
    [draft, setDraft] = useState(''),
    [emoji, setEmoji] = useState(false),
    [tools, setTools] = useState<'tags' | 'more' | 'test' | null>(null),
    [tagText, setTagText] = useState('');
  const canvas = useRef<HTMLDivElement>(null),
    composer = useRef<HTMLInputElement>(null),
    menuRoot = useRef<HTMLDivElement>(null);
  const conversations = useMemo(() => inboxConversations(data, data.simulation), [data]);
  const [newContact, setNewContact] = useState<Contact | null>(null);
  const active =
    conversations.find((c) => c.contact.id === contactId && c.account.id === accountId) ||
    (!contactId ? conversations[0] : undefined);
  const contact = active?.contact || newContact;
  const activeAccount = active?.account || data.accounts.find((a) => a.id === accountId);
  const messages = active?.messages || [];
  const meta: ConversationMeta = active?.meta ||
    (contact && activeAccount
      ? data.conversations?.[`${activeAccount.id}:${contact.id}`]
      : undefined) || { status: 'open', starred: false, tags: [] };
  const shown = conversations.filter(
    (c) =>
      (accountFilter === 'all' || c.account.id === accountFilter) &&
      (filter === 'all' || c.meta.status === filter) &&
      (!onlyStarred || c.meta.starred) &&
      `${c.contact.name} ${c.contact.phone}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  const [limit, setLimit] = useState(60);
  const statuses = [
    {
      value: 'all',
      label: 'Todas',
      title: 'Todas as conversas',
      icon: MessageCircle,
      tone: 'green',
    },
    { value: 'open', label: 'Abertas', title: 'Abertas', icon: Inbox, tone: 'blue' },
    {
      value: 'progress',
      label: 'Em andamento',
      title: 'Em andamento',
      icon: MessagesSquare,
      tone: 'purple',
    },
    { value: 'resolved', label: 'Resolvidas', title: 'Resolvidas', icon: Check, tone: 'green' },
  ];
  const count = (status: string) =>
    status === 'all'
      ? conversations.length
      : conversations.filter((c) => c.meta.status === status).length;
  const n = (value: number) => value.toLocaleString(locale);
  const lastInbound = messages.filter((m) => m.direction === 'in').at(-1);
  const windowOpen = !!lastInbound && Date.now() - Date.parse(lastInbound.createdAt) < 24 * 3600000;
  const canReply =
    !!contact &&
    !!activeAccount &&
    windowOpen &&
    !contact.optedOut &&
    activeAccount.enabled !== false;
  useEffect(() => {
    canvas.current?.scrollTo({ top: canvas.current.scrollHeight });
  }, [active?.key, messages.length]);
  useEffect(() => {
    setDraft('');
    setEmoji(false);
    setTools(null);
  }, [active?.key, newContact?.id]);
  useEffect(() => {
    if (!tools && !emoji) return;
    const outside = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest('.inbox-menu-area')) {
        setTools(null);
        setEmoji(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTools(null);
        setEmoji(false);
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [tools, emoji]);
  async function updateMeta(patch: object) {
    if (contact && activeAccount)
      return onAction(
        { action: 'conversation', contactId: contact.id, accountId: activeAccount.id, ...patch },
        '',
      );
    return false;
  }
  function select(c: InboxRow) {
    setContactId(c.contact.id);
    setAccountId(c.account.id);
    setNewContact(null);
    setMobileChat(true);
    if (c.unread)
      void onAction(
        { action: 'conversation', contactId: c.contact.id, accountId: c.account.id, read: true },
        '',
      );
  }
  function avatar(c: Contact, small = false) {
    return (
      <span className={`inbox-avatar ${small ? 'inbox-avatar--small' : ''}`}>
        <span>
          {c.name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((x) => x[0])
            .join('')
            .toUpperCase()}
        </span>
        {small && (
          <i>
            <WhatsAppMark />
          </i>
        )}
      </span>
    );
  }
  function time(at: string) {
    const date = new Date(at),
      today = new Date();
    return date.toDateString() === today.toDateString()
      ? date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  }
  async function reply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canReply || !draft.trim()) return;
    if (
      await onAction(
        {
          action: 'reply',
          contactId: contact!.id,
          accountId: activeAccount!.id,
          text: draft.trim(),
        },
        'Resposta registrada.',
      )
    ) {
      setDraft('');
      setEmoji(false);
      composer.current?.focus();
    }
  }
  return (
    <div className="inbox-page">
      <div className="inbox-page-heading">
        <div>
          <h1>{t('Conversas')}</h1>
          <p>{t('Gerencie suas conversas do WhatsApp em tempo real.')}</p>
        </div>
        <div className="inbox-summary">
          {statuses.map((s) => (
            <button
              key={s.value}
              className={`inbox-summary-card inbox-summary-card--${s.tone}`}
              aria-pressed={filter === s.value}
              onClick={() => {
                setFilter(s.value);
                setLimit(60);
              }}
            >
              <span>
                <s.icon size={28} />
              </span>
              <div>
                <h2>{t(s.title)}</h2>
                <strong>{n(count(s.value))}</strong>
              </div>
            </button>
          ))}
        </div>
        <button
          className="inbox-new-chat"
          aria-label={t('Nova conversa')}
          title={t('Nova conversa')}
          onClick={() => {
            setNewChat(!newChat);
            setSearch('');
          }}
        >
          <Plus size={20} />
        </button>
      </div>
      <div className={`inbox-layout ${mobileChat ? 'inbox-layout--chat' : ''}`}>
        <aside className="inbox-list-panel">
          <div className="inbox-list-search">
            <label>
              <Search size={19} />
              <input
                aria-label={t('Buscar conversas')}
                placeholder={t('Buscar por nome ou telefone...')}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setLimit(60);
                }}
              />
            </label>
            <button
              className={filters ? 'is-active' : ''}
              aria-label={t('Filtrar conversas')}
              aria-expanded={filters}
              onClick={() => setFilters(!filters)}
            >
              <Filter size={22} />
              {accountFilter !== 'all' && <i />}
            </button>
          </div>
          {filters && (
            <div className="inbox-list-filters">
              <label>
                {t('Conta')}
                <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
                  <option value="all">{t('Todas as contas')}</option>
                  {data.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inbox-starred-filter">
                <input
                  type="checkbox"
                  checked={onlyStarred}
                  onChange={(e) => setOnlyStarred(e.target.checked)}
                />
                {t('Somente favoritas')}
              </label>
            </div>
          )}
          <div
            className="inbox-conversation-tabs"
            role="tablist"
            aria-label={t('Status das conversas')}
          >
            {statuses.map((s) => (
              <button
                role="tab"
                aria-selected={filter === s.value}
                key={s.value}
                onClick={() => {
                  setFilter(s.value);
                  setNewChat(false);
                  setLimit(60);
                }}
              >
                {t(s.label)}
                {['open', 'progress'].includes(s.value) && count(s.value) > 0 && (
                  <span>{n(count(s.value))}</span>
                )}
              </button>
            ))}
          </div>
          <div className="inbox-conversation-list">
            {newChat ? (
              <>
                <div className="inbox-start-heading">
                  <strong>{t('Nova conversa')}</strong>
                  <button aria-label={t('Fechar')} onClick={() => setNewChat(false)}>
                    <X size={17} />
                  </button>
                </div>
                {data.contacts
                  .filter((c) =>
                    `${c.name} ${c.phone}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
                  )
                  .slice(0, 50)
                  .map((c) => (
                    <button
                      className="inbox-conversation"
                      key={c.id}
                      onClick={() => {
                        const a =
                          data.accounts.find((a) => a.id === accountFilter) || data.accounts[0];
                        if (!a) return;
                        setContactId(c.id);
                        setAccountId(a.id);
                        setNewContact(c);
                        setMobileChat(true);
                        setNewChat(false);
                      }}
                    >
                      {avatar(c, true)}
                      <span className="inbox-conversation-copy">
                        <strong>{c.name}</strong>
                        <small>+{c.phone}</small>
                      </span>
                    </button>
                  ))}
                {!data.accounts.length && (
                  <p className="inbox-list-note">
                    {t('Adicione uma conta WhatsApp para começar.')}
                  </p>
                )}
              </>
            ) : (
              <>
                {shown.slice(0, limit).map((c) => (
                  <button
                    className={`inbox-conversation ${active?.key === c.key ? 'is-selected' : ''}`}
                    key={c.key}
                    aria-pressed={active?.key === c.key}
                    onClick={() => select(c)}
                  >
                    {avatar(c.contact, true)}
                    <span className="inbox-conversation-copy">
                      <strong>
                        {c.contact.name}
                        {c.meta.starred && <Star size={13} fill="currentColor" />}
                      </strong>
                      <small>{c.latest.text}</small>
                      <em>{c.account.name}</em>
                    </span>
                    <span className="inbox-conversation-meta">
                      <time>{time(c.latest.createdAt)}</time>
                      {c.unread > 0 && <b>{n(c.unread)}</b>}
                    </span>
                  </button>
                ))}
                {shown.length > limit && (
                  <button className="inbox-load-more" onClick={() => setLimit(limit + 60)}>
                    {t('Carregar mais')}
                  </button>
                )}
                {!shown.length && (
                  <div className="inbox-empty-list">
                    <MessageCircle size={30} />
                    <p>{t('Nenhuma conversa encontrada.')}</p>
                    <button onClick={() => setNewChat(true)}>{t('Nova conversa')}</button>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>
        <section className="inbox-chat-panel" aria-label={t('Conversa')}>
          <header className="inbox-chat-header">
            <button
              className="inbox-back"
              aria-label={t('Voltar às conversas')}
              onClick={() => setMobileChat(false)}
            >
              <ArrowLeft size={21} />
            </button>
            {contact ? (
              avatar(contact)
            ) : (
              <span className="inbox-avatar">
                <MessageCircle size={24} />
              </span>
            )}
            <div className="inbox-chat-person">
              <h2>{contact?.name || t('Suas conversas')}</h2>
              <p>
                {contact
                  ? `+${contact.phone} · ${activeAccount?.name || ''}`
                  : t('Selecione uma conversa para começar.')}
              </p>
            </div>
            {contact && (
              <div className="inbox-chat-tools inbox-menu-area" ref={menuRoot}>
                <label className="inbox-status-select">
                  <select
                    aria-label={t('Status da conversa')}
                    value={meta.status}
                    disabled={busy}
                    onChange={(e) => void updateMeta({ status: e.target.value })}
                  >
                    {statuses.slice(1).map((s) => (
                      <option value={s.value} key={s.value}>
                        {t(s.title)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={15} />
                </label>
                <button
                  aria-label={t('Etiquetas')}
                  aria-expanded={tools === 'tags'}
                  onClick={() => {
                    setTagText(meta.tags.join(', '));
                    setTools(tools === 'tags' ? null : 'tags');
                  }}
                >
                  <Tag size={21} />
                </button>
                <button
                  aria-label={t(meta.starred ? 'Remover dos favoritos' : 'Adicionar aos favoritos')}
                  aria-pressed={meta.starred}
                  disabled={busy}
                  onClick={() => void updateMeta({ starred: !meta.starred })}
                >
                  <Star size={21} fill={meta.starred ? '#f6c545' : 'none'} />
                </button>
                <button
                  aria-label={t('Mais opções da conversa')}
                  aria-expanded={tools === 'more'}
                  onClick={() => setTools(tools === 'more' ? null : 'more')}
                >
                  <MoreHorizontal size={23} />
                </button>
                {tools === 'tags' && (
                  <form
                    className="inbox-header-popover"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (
                        await updateMeta({
                          tags: tagText
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      )
                        setTools(null);
                    }}
                  >
                    <label>
                      {t('Etiquetas (separadas por vírgula)')}
                      <input
                        maxLength={400}
                        value={tagText}
                        onChange={(e) => setTagText(e.target.value)}
                      />
                    </label>
                    <button disabled={busy}>{t('Salvar')}</button>
                  </form>
                )}
                {tools === 'more' && (
                  <div className="inbox-header-popover inbox-options">
                    <button
                      disabled={busy}
                      onClick={() => {
                        void updateMeta({ read: false });
                        setTools(null);
                      }}
                    >
                      {t('Marcar como não lida')}
                    </button>
                    {data.simulation && (
                      <button onClick={() => setTools('test')}>
                        <FlaskConical size={16} />
                        {t('Simular cliente')}
                      </button>
                    )}
                  </div>
                )}
                {tools === 'test' && (
                  <form
                    className="inbox-header-popover"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const text = new FormData(e.currentTarget).get('text');
                      if (
                        await onAction(
                          {
                            action: 'simulate-inbound',
                            accountId: activeAccount?.id,
                            contactId: contact.id,
                            text,
                          },
                          'Mensagem de teste recebida.',
                        )
                      )
                        setTools(null);
                    }}
                  >
                    <label>
                      {t('Mensagem de teste')}
                      <input
                        name="text"
                        required
                        maxLength={200}
                        defaultValue={t('Olá, gostaria de saber mais.')}
                      />
                    </label>
                    <p>{t('Use SAIR para testar descadastro.')}</p>
                    <button disabled={busy}>{t('Simular cliente')}</button>
                  </form>
                )}
              </div>
            )}
          </header>
          {meta.tags.length > 0 && (
            <div className="inbox-chat-tags">
              {meta.tags.map((tag) => (
                <span key={tag}>
                  <Tag size={12} />
                  {tag}
                </span>
              ))}
            </div>
          )}
          <div className="inbox-chat-canvas" ref={canvas}>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`inbox-message-row inbox-message-row--${message.direction}`}
              >
                <div className="inbox-message-bubble">
                  <p>{message.text}</p>
                  <div className="inbox-message-meta">
                    <time title={new Date(message.createdAt).toLocaleString(locale)}>
                      {new Date(message.createdAt).toLocaleTimeString(locale, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                    {message.simulated && (
                      <span title={t('Simulação')}>
                        <FlaskConical size={12} />
                      </span>
                    )}
                    {message.direction === 'out' && (
                      <span
                        className={message.status === 'read' ? 'inbox-read-ticks' : ''}
                        title={t(statusLabels[message.status] || message.status)}
                      >
                        {['read', 'delivered'].includes(message.status) ? (
                          <CheckCheck size={18} />
                        ) : ['sent', 'accepted', 'simulated'].includes(message.status) ? (
                          <Check size={16} />
                        ) : (
                          <Clock size={13} />
                        )}
                      </span>
                    )}
                  </div>
                  {message.error && <p className="inbox-message-error">{t(message.error)}</p>}
                </div>
              </div>
            ))}
            {!messages.length && (
              <div className="inbox-chat-empty">
                <MessageCircle size={40} />
                <h3>{t('Cada conversa importa')}</h3>
                <p>
                  {t(
                    contact
                      ? 'Nenhuma mensagem nesta conversa.'
                      : 'Selecione uma conversa para começar.',
                  )}
                </p>
              </div>
            )}
          </div>
          <div className="inbox-composer">
            <form onSubmit={reply}>
              <div className="inbox-emoji inbox-menu-area">
                <button
                  type="button"
                  aria-label={t('Adicionar emoji')}
                  aria-expanded={emoji}
                  onClick={() => setEmoji(!emoji)}
                  disabled={!contact}
                >
                  <Smile size={22} />
                </button>
                {emoji && (
                  <div className="inbox-emoji-picker">
                    {['😊', '👋', '👍', '🙏', '💚', '✅', '🎉', '📦', '🙂', '❤️', '✨', '🤝'].map(
                      (icon) => (
                        <button
                          type="button"
                          key={icon}
                          aria-label={icon}
                          onClick={() => {
                            setDraft(draft + icon);
                            setEmoji(false);
                            composer.current?.focus();
                          }}
                        >
                          {icon}
                        </button>
                      ),
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                disabled
                className="inbox-unavailable"
                aria-label={t('Anexos indisponíveis')}
                title={t('Esta versão envia mensagens de texto.')}
              >
                <Paperclip size={21} />
              </button>
              <button
                type="button"
                disabled
                className="inbox-unavailable"
                aria-label={t('Áudio indisponível')}
                title={t('Esta versão envia mensagens de texto.')}
              >
                <Mic size={21} />
              </button>
              <input
                ref={composer}
                name="text"
                aria-label={t('Resposta')}
                placeholder={t('Digite uma mensagem...')}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={4000}
                required
                disabled={!contact || busy}
              />
              <button
                type="submit"
                className="inbox-send"
                aria-label={t('Enviar')}
                disabled={busy || !canReply || !draft.trim()}
              >
                <Send size={23} />
              </button>
            </form>
            {contact && !canReply && (
              <p className="inbox-reply-note">
                {t(
                  contact.optedOut
                    ? 'Este contato está descadastrado.'
                    : activeAccount?.enabled === false
                      ? 'Esta conta está inativa. Ative a conta para enviar mensagens.'
                      : 'Respostas livres exigem uma mensagem recebida nesta conta nas últimas 24 horas.',
                )}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
