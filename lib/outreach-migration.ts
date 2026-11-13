import type { Campaign, Job, State } from './types';

import type { OutreachRun, OutreachTask } from './outreach-types';
export type SeparatedOutreachState = State & {
  outreachRuns: OutreachRun[];
  outreachTasks: OutreachTask[];
};

/** Prepare a copy for migration; never starts a sender or changes the original state. */
export function separateLegacyOutreach(state: State): SeparatedOutreachState {
  const next = structuredClone(state) as SeparatedOutreachState;
  next.outreachRuns ||= [];
  next.outreachTasks ||= [];
  const legacy = next.campaigns.filter((campaign) => campaign.mode === 'sequential');
  const ids = new Set(legacy.map((campaign) => campaign.id));
  for (const campaign of legacy) {
    if (next.outreachRuns.some((run) => run.id === campaign.id))
      throw new Error('Outreach migration ID conflict.');
    next.outreachRuns.push({
      id: campaign.id,
      name: campaign.name,
      connector: 'official-api',
      senderIds: [campaign.accountId],
      message: '',
      delay: campaign.delay,
      status: campaign.status === 'running' ? 'paused' : campaign.status,
      createdAt: campaign.createdAt,
      legacyTemplate: {
        template: campaign.template,
        language: campaign.language,
        parameters: campaign.parameters,
      },
    });
  }
  for (const job of next.jobs.filter((job) => ids.has(job.campaignId))) {
    const campaign = legacy.find((campaign) => campaign.id === job.campaignId)!;
    next.outreachTasks.push({
      id: job.id,
      runId: job.campaignId,
      senderId: campaign.accountId,
      contactId: job.contactId,
      status: job.status === 'processing' ? 'needs-review' : job.status,
      ...(job.error ? { error: job.error } : {}),
    });
  }
  next.campaigns = next.campaigns.filter((campaign) => !ids.has(campaign.id));
  next.jobs = next.jobs.filter((job) => !ids.has(job.campaignId));
  // Preserve historical messages and provider IDs verbatim, including legacy campaign references.
  return next;
}
