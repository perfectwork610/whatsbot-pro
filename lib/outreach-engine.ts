import type { State } from './types';
export function renderOutreachText(template: string, name: string, business: string) {
  return template
    .replace(/\{\{\s*(nome|name|empresa|business)\s*\}\}/gi, (_, key: string) =>
      ['nome', 'name'].includes(key.toLowerCase()) ? name : business,
    )
    .slice(0, 4000);
}
export function outreachWorkerLive(state: State, now = Date.now()) {
  return (
    !!state.outreachWorker &&
    state.outreachWorker.expiresAt > now &&
    state.outreachWorker.heartbeat > now - 20000
  );
}
export function reserveOutreach(state: State, simulated: boolean, now = Date.now()) {
  const tasks = state.outreachTasks || [],
    sessions = state.outreachSessions || [];
  for (const run of state.outreachRuns || []) {
    if (run.connector !== 'whatsapp-web' || run.status !== 'running') continue;
    const queue = tasks.filter((task) => task.runId === run.id);
    if (!queue.some((task) => task.status === 'pending' || task.status === 'processing')) {
      run.status = queue.some((task) => ['failed', 'needs-review'].includes(task.status))
        ? 'paused'
        : 'completed';
      continue;
    }
    if (run.simulated !== simulated) {
      run.status = 'paused';
      continue;
    }
    if ((run.nextSendAt || 0) > now || queue.some((task) => task.status === 'processing')) continue;
    for (const task of queue.filter((task) => task.status === 'pending')) {
      const contact = state.contacts.find((contact) => contact.id === task.contactId);
      if (!contact?.consent || contact.optedOut) {
        task.status = 'skipped';
        task.error = 'Contato sem permissão ou descadastrado.';
        continue;
      }
      const session = sessions.find((session) => session.id === task.senderId);
      if (
        !session ||
        !session.enabled ||
        !session.desiredConnected ||
        session.status !== 'ready' ||
        (!simulated && session.testOnly)
      )
        continue;
      if ((state.outreachNextSend?.[session.id] || 0) > now) continue;
      const sent = (state.outreachMessages || []).filter(
        (message) =>
          message.accountId === session.id &&
          message.direction === 'out' &&
          Date.parse(message.createdAt) > now - 86400000 &&
          !['failed', 'skipped'].includes(message.status),
      ).length;
      if (sent >= session.dailyLimit) continue;
      task.status = 'processing';
      task.phase = 'saving';
      state.outreachNextSend ||= {};
      state.outreachNextSend[session.id] = now + run.delay * 1000;
      run.nextSendAt = now + run.delay * 1000;
      return structuredClone({ run, task, session, contact });
    }
  }
  return null;
}
export function outreachAckStatus(current: string, acknowledgement: number): string {
  const next =
    acknowledgement >= 3
      ? 'read'
      : acknowledgement === 2
        ? 'delivered'
        : acknowledgement === 1
          ? 'sent'
          : acknowledgement === -1
            ? 'failed'
            : undefined;
  if (!next) return current;
  const rank: Record<string, number> = { failed: 0, sent: 1, delivered: 2, read: 3 };
  if (next === 'failed') return ['delivered', 'read'].includes(current) ? current : next;
  return (rank[next] ?? 0) > (rank[current] ?? 0) ? next : current;
}
