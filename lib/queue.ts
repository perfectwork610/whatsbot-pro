import { audit, read, update } from './store';
import { send, simulation } from './whatsapp';
import type { Account, Campaign, Contact } from './types';
export async function tick() {
  const reserved = update((s) => {
    for (const campaign of s.campaigns.filter((c) => c.status === 'running' && c.mode === 'bulk')) {
      const account = s.accounts.find((a) => a.id === campaign.accountId);
      if (
        !account ||
        account.enabled === false ||
        (s.nextSend[account.id] || 0) > Date.now() ||
        s.jobs.some(
          (j) =>
            j.status === 'processing' &&
            s.campaigns.find((c) => c.id === j.campaignId)?.accountId === account.id,
        )
      )
        continue;
      const recent = s.messages.filter(
        (m) =>
          m.accountId === account.id &&
          m.direction === 'out' &&
          new Date(m.createdAt).getTime() > Date.now() - 86400000 &&
          m.status !== 'failed',
      ).length;
      if (recent >= account.dailyLimit) continue;
      const job = s.jobs.find((j) => j.campaignId === campaign.id && j.status === 'pending');
      if (!job) {
        if (!s.jobs.some((j) => j.campaignId === campaign.id && j.status === 'processing'))
          campaign.status = 'completed';
        continue;
      }
      const contact = s.contacts.find((c) => c.id === job.contactId);
      if (!contact?.consent || contact.optedOut) {
        job.status = 'skipped';
        continue;
      }
      if (
        !account.templates.some(
          (t) =>
            t.name === campaign.template &&
            t.language === campaign.language &&
            t.status === 'APPROVED',
        )
      ) {
        campaign.status = 'paused';
        audit(s, `Campanha ${campaign.name} pausada: modelo não aprovado.`);
        continue;
      }
      job.status = 'processing';
      s.nextSend[account.id] = Date.now() + campaign.delay * 1000;
      return {
        jobId: job.id,
        campaign: structuredClone(campaign),
        account: structuredClone(account),
        contact: structuredClone(contact),
      };
    }
    return null;
  });
  if (!reserved) return { processed: false };
  const { campaign, account, contact, jobId } = reserved as {
    campaign: Campaign;
    account: Account;
    contact: Contact;
    jobId: string;
  };
  try {
    // Recheck suppression immediately before the external side effect.
    const current = read().contacts.find((c) => c.id === contact.id);
    if (!current?.consent || current.optedOut) {
      update((s) => {
        s.jobs.find((j) => j.id === jobId)!.status = 'skipped';
      });
      return { processed: false };
    }
    const parameters = campaign.parameters.map((text) => ({
      type: 'text',
      text: text.replaceAll('{{nome}}', contact.name),
    }));
    const providerId = await send(account, contact.phone, {
      type: 'template',
      template: {
        name: campaign.template,
        language: { code: campaign.language },
        ...(parameters.length ? { components: [{ type: 'body', parameters }] } : {}),
      },
    });
    update((s) => {
      s.jobs.find((j) => j.id === jobId)!.status = 'sent';
      s.messages.push({
        id: crypto.randomUUID(),
        contactId: contact.id,
        accountId: account.id,
        campaignId: campaign.id,
        direction: 'out',
        text: `[${campaign.template}] ${parameters.map((p) => p.text).join(' · ')}`,
        status: simulation() ? 'simulated' : 'accepted',
        providerId,
        simulated: simulation(),
        createdAt: new Date().toISOString(),
      });
    });
    return { processed: true };
  } catch (error) {
    update((s) => {
      const job = s.jobs.find((j) => j.id === jobId)!;
      job.status = 'failed';
      job.error = String(error);
      s.campaigns.find((c) => c.id === campaign.id)!.status = 'paused';
      audit(s, `Envio falhou; campanha pausada. ${String(error)}`);
    });
    return { processed: true, error: String(error) };
  }
}
