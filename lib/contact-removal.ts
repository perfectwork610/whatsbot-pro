import type { State } from './types';

export function removeContacts(state: State, ids: unknown, restore = false) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 50000 || ids.some(id => typeof id !== 'string'))
    throw new Error('Selecione contatos válidos.');
  const selected = new Set<string>(ids);
  const contacts = state.contacts.filter(c => selected.has(c.id));
  if (contacts.length !== selected.size) throw new Error('Contato inexistente.');
  if (!restore && (state.jobs.some(j => selected.has(j.contactId) && j.status === 'processing') ||
      state.outreachTasks?.some(j => selected.has(j.contactId) && j.status === 'processing')))
    throw new Error('Aguarde os envios em processamento terminarem antes de remover estes contatos.');
  for (const contact of contacts) {
    contact.deletedAt = restore ? undefined : contact.deletedAt || new Date().toISOString();
    // Removal and undo never authorize a future send.
    contact.consent = false;
  }
  if (!restore) {
    for (const task of [...state.jobs, ...(state.outreachTasks || [])]) {
      if (selected.has(task.contactId) && task.status === 'pending') task.status = 'skipped';
    }
  }
  return { count: contacts.length };
}
