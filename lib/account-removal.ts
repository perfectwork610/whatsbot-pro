import type { State } from './types';

export function removeAccount(state: State, id: unknown, restore = false) {
  const account = state.accounts.find(a => a.id === id);
  if (!account) throw new Error('Conta inexistente.');
  const campaigns = new Set(state.campaigns.filter(c => c.accountId === account.id).map(c => c.id));
  if (!restore && (state.jobs.some(j => campaigns.has(j.campaignId) && j.status === 'processing') ||
      state.messages.some(m => m.accountId === account.id && m.status === 'processing')))
    throw new Error('Aguarde o envio atual terminar antes de excluir esta conta.');
  account.deletedAt = restore ? undefined : account.deletedAt || new Date().toISOString();
  account.enabled = false;
  for (const campaign of state.campaigns) {
    if (campaign.accountId === account.id && campaign.status === 'running') campaign.status = 'paused';
  }
  // Keep campaign/message records and server credentials. Undo remains inactive.
}
