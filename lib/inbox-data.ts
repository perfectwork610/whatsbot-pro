import type { State, Message } from './types';
export type ConversationMeta = {
  status: 'open' | 'progress' | 'resolved';
  starred: boolean;
  tags: string[];
  readAt?: string;
};
export function inboxConversations(state: State, simulated: boolean) {
  const contacts = new Map(state.contacts.map((contact) => [contact.id, contact]));
  const accounts = new Map(state.accounts.map((account) => [account.id, account]));
  const groups = new Map<string, Message[]>();
  for (const message of state.messages) {
    if (
      !!message.simulated !== simulated ||
      !contacts.has(message.contactId) ||
      !accounts.has(message.accountId)
    )
      continue;
    const key = `${message.accountId}:${message.contactId}`;
    const messages = groups.get(key) || [];
    messages.push(message);
    groups.set(key, messages);
  }
  return Array.from(groups, ([key, unsorted]) => {
    const messages = [...unsorted].sort(
      (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
    );
    const latest = messages[messages.length - 1];
    const meta = state.conversations?.[key] || {
      status: 'open' as const,
      starred: false,
      tags: [],
    };
    return {
      key,
      messages,
      latest,
      meta,
      contact: contacts.get(latest.contactId)!,
      account: accounts.get(latest.accountId)!,
      unread: messages.filter(
        (message) =>
          message.direction === 'in' &&
          Date.parse(message.createdAt) > (meta.readAt ? Date.parse(meta.readAt) : 0),
      ).length,
    };
  }).sort((a, b) => Date.parse(b.latest.createdAt) - Date.parse(a.latest.createdAt));
}
