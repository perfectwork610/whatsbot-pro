import type { State } from './types';
import type { OutreachSession } from './outreach-types';
import { reserveOutreach, renderOutreachText } from './outreach-engine.ts';
type Store = { read: () => State; update: <T>(fn: (state: State) => T) => T };
export type OutreachSender = {
  numberId: (phone: string) => Promise<string | null>;
  saveContact: (phone: string, name: string, sync: boolean) => Promise<void>;
  send: (id: string, text: string) => Promise<string>;
};
export async function dispatchOutreach(
  store: Store,
  simulated: boolean,
  senderFor: (session: OutreachSession) => OutreachSender | undefined,
) {
  const reserved = store.update((state) => reserveOutreach(state, simulated));
  if (!reserved) return { processed: false };
  const { run, task, session, contact } = reserved;
  let sending = false;
  function allowed() {
    const state = store.read(),
      current = state.contacts.find((c) => c.id === contact.id),
      connection = state.outreachSessions?.find((s) => s.id === session.id),
      active = state.outreachRuns?.find((r) => r.id === run.id);
    return (
      !!current?.consent &&
      !current.optedOut &&
      connection?.enabled &&
      connection.desiredConnected &&
      connection.status === 'ready' &&
      connection.generation === session.generation &&
      active?.status === 'running' &&
      state.outreachTasks?.find((job) => job.id === task.id)?.status === 'processing'
    );
  }
  function defer() {
    store.update((state) => {
      const job = state.outreachTasks!.find((j) => j.id === task.id)!;
      const current = state.contacts.find((c) => c.id === contact.id);
      job.status = !current?.consent || current.optedOut ? 'skipped' : 'pending';
      job.phase = undefined;
    });
    return { processed: false };
  }
  try {
    if (!allowed()) return defer();
    const sender = simulated ? undefined : senderFor(session);
    if (!simulated && !sender) throw new Error('Conexão WhatsApp Web não está pronta.');
    const destination = simulated ? contact.phone : await sender!.numberId(contact.phone);
    if (!destination) throw new Error('O telefone não está registrado no WhatsApp.');
    if (!allowed()) return defer();
    if (run.saveContacts && !task.savedContact && !simulated) {
      await sender!.saveContact(contact.phone, contact.name, run.syncToPhone === true);
      store.update((state) => {
        state.outreachTasks!.find((j) => j.id === task.id)!.savedContact = true;
      });
    }
    if (!allowed()) return defer();
    const text = renderOutreachText(
      run.message,
      contact.name,
      store.read().workspace?.name || 'WhatsBot Pro',
    );
    store.update((state) => {
      state.outreachTasks!.find((j) => j.id === task.id)!.phase = 'sending';
    });
    sending = true;
    const providerId = simulated
      ? 'sim_web_' + crypto.randomUUID()
      : await sender!.send(destination, text);
    if (!providerId)
      throw new Error('Envio sem confirmação. Verifique a conversa antes de continuar.');
    store.update((state) => {
      const job = state.outreachTasks!.find((j) => j.id === task.id)!;
      job.status = 'sent';
      job.phase = undefined;
      job.completedAt = new Date().toISOString();
      state.outreachMessages ||= [];
      state.outreachMessages.push({
        id: crypto.randomUUID(),
        contactId: contact.id,
        accountId: session.id,
        outreachId: run.id,
        direction: 'out',
        text,
        status: simulated ? 'simulated' : 'sent',
        providerId,
        simulated,
        createdAt: new Date().toISOString(),
      });
    });
    return { processed: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha no envio individual.';
    store.update((state) => {
      const job = state.outreachTasks!.find((j) => j.id === task.id)!;
      job.status = sending ? 'needs-review' : 'failed';
      job.error = message;
      state.outreachRuns!.find((r) => r.id === run.id)!.status = 'paused';
    });
    return { processed: true, error: message };
  }
}
