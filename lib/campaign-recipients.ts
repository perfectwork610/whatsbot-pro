import type { Contact, Job, Message } from './types';

export function campaignRecipients(campaignId: string, jobs: Job[], contacts: Contact[], messages: Message[]) {
  const people = new Map(contacts.map(c => [c.id, c]));
  const deliveries = new Map<string, Message>();
  for (const message of messages) {
    if (message.campaignId !== campaignId || message.direction !== 'out') continue;
    const previous = deliveries.get(message.contactId);
    if (!previous || Date.parse(message.createdAt) >= Date.parse(previous.createdAt))
      deliveries.set(message.contactId, message);
  }
  return jobs.filter(j => j.campaignId === campaignId).map(job => {
    const contact = people.get(job.contactId), delivery = deliveries.get(job.contactId);
    return { id: job.id, name: contact?.name, phone: contact?.phone,
      status: delivery?.status === 'failed' ? 'failed' : job.status,
      delivery: delivery?.status, error: delivery?.error || job.error };
  });
}
