'use client';
import { useState, type FormEvent } from 'react';
import { MessageCircle, Search, Send } from 'lucide-react';
import type { State } from '@/lib/types';
import { useLanguage } from './language';
import { Badge, Button, Card, Empty, Initials, Label, statusLabels } from './workspace-ui';
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
  const [search, setSearch] = useState('');
  const contact = data.contacts.find((c) => c.id === contactId);
  const conversation = data.messages.filter(
    (m) => m.contactId === contactId && m.accountId === accountId,
  );
  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const text = new FormData(form).get('text');
    if (await onAction({ action: 'reply', contactId, accountId, text }, 'Resposta registrada.'))
      form.reset();
  }
  return (
    <Card className="workspace-inbox">
      <aside className="workspace-inbox-sidebar">
        <div className="workspace-inbox-sidebar-heading">
          <h2>{t('Suas conversas')}</h2>
          <Label>
            {t('Conta')}
            <select
              className="workspace-input mt-1.5 w-full"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">{t('Selecione uma conta')}</option>
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Label>
          <div className="workspace-inbox-search">
            <Search size={14} />
            <input
              aria-label={t('Buscar contatos')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Buscar nome ou telefone')}
            />
          </div>
        </div>
        <div className="workspace-inbox-people">
          {data.contacts
            .filter((c) => `${c.name} ${c.phone}`.toLowerCase().includes(search.toLowerCase()))
            .map((c) => {
              const latest = data.messages
                .filter((m) => m.contactId === c.id && (!accountId || m.accountId === accountId))
                .at(-1);
              return (
                <button
                  key={c.id}
                  className={`workspace-inbox-person ${c.id === contactId ? 'is-selected' : ''}`}
                  onClick={() => setContactId(c.id)}
                  aria-pressed={c.id === contactId}
                >
                  <Initials name={c.name} />
                  <span>
                    <strong>{c.name}</strong>
                    <small>{latest?.text || `+${c.phone}`}</small>
                  </span>
                </button>
              );
            })}
          {!data.contacts.length && (
            <Empty icon={MessageCircle}>{t('Importe contatos para começar suas conversas.')}</Empty>
          )}
        </div>
      </aside>
      <div className="workspace-inbox-body">
        <div className="workspace-inbox-header">
          {contact ? (
            <Initials name={contact.name} />
          ) : (
            <span className="workspace-avatar">
              <MessageCircle size={17} />
            </span>
          )}
          <div>
            <h2>{contact?.name || t('Cada conversa importa')}</h2>
            <p>{contact ? `+${contact.phone}` : t('Selecione um contato para começar.')}</p>
          </div>
          {contact?.optedOut && <Badge status="Descadastrado" />}
        </div>
        <div className="workspace-inbox-canvas">
          {conversation.map((message) => (
            <div
              key={message.id}
              className={`mb-4 flex ${message.direction === 'out' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`workspace-chat-bubble ${message.direction === 'out' ? 'is-outgoing' : 'is-incoming'}`}
              >
                <p className="whitespace-pre-wrap">{message.text}</p>
                <p className="mt-2">
                  {new Date(message.createdAt).toLocaleString(locale)} ·{' '}
                  {t(statusLabels[message.status] || message.status)}
                  {message.simulated ? t(' · simulação') : ''}
                </p>
                {message.error && <p className="mt-1 text-xs text-red-700">{t(message.error)}</p>}
              </div>
            </div>
          ))}
          {!conversation.length && (
            <Empty icon={MessageCircle}>
              {t('Selecione uma conta e um contato para ver as mensagens.')}
            </Empty>
          )}
        </div>
        <div className="workspace-inbox-compose">
          <form onSubmit={reply}>
            <input
              className="workspace-input flex-1"
              name="text"
              aria-label={t('Resposta')}
              placeholder={t('Digite sua resposta…')}
              required
              maxLength={4000}
            />
            <Button type="submit" disabled={busy || !contactId || !accountId}>
              <Send size={16} />
              {t('Enviar')}
            </Button>
          </form>
          <p>
            {t('Respostas livres exigem uma mensagem recebida nesta conta nas últimas 24 horas.')}
          </p>
        </div>
        {data.simulation && (
          <form
            className="workspace-inbox-test"
            onSubmit={(event) => {
              event.preventDefault();
              void onAction(
                {
                  action: 'simulate-inbound',
                  contactId,
                  accountId,
                  text: new FormData(event.currentTarget).get('text'),
                },
                'Mensagem de teste recebida.',
              );
            }}
          >
            <Label>
              {t('Testar recebimento (use SAIR para testar descadastro)')}
              <input
                name="text"
                required
                defaultValue={t('Olá, gostaria de saber mais.')}
                className="workspace-input mt-1.5 w-full"
              />
            </Label>
            <Button secondary type="submit" disabled={busy || !contactId || !accountId}>
              {t('Simular cliente')}
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}
