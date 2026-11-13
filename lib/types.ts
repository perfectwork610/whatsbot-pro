import type { OutreachRun, OutreachTask, OutreachSession } from './outreach-types';
export type Contact = {
  lists?: string[];
  id: string;
  name: string;
  phone: string;
  consent: boolean;
  source: string;
  optedOut: boolean;
  createdAt: string;
};
export type Account = {
  enabled?: boolean;
  id: string;
  name: string;
  phoneId: string;
  wabaId: string;
  tokenEnv: string;
  dailyLimit: number;
  simulationOnly?: boolean;
  displayPhone?: string;
  templates: { name: string; language: string; status: string }[];
};
export type Campaign = {
  id: string;
  name: string;
  accountId: string;
  template: string;
  language: string;
  parameters: string[];
  mode: 'bulk' | 'sequential';
  delay: number;
  status: 'draft' | 'running' | 'paused' | 'completed';
  createdAt: string;
};
export type Message = {
  id: string;
  contactId: string;
  accountId: string;
  campaignId?: string;
  outreachId?: string;
  direction: 'in' | 'out';
  text: string;
  status: string;
  providerId?: string;
  error?: string;
  createdAt: string;
  simulated?: boolean;
};
export type Job = {
  id: string;
  campaignId: string;
  contactId: string;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'skipped';
  error?: string;
};
export type State = {
  outreachRuns?: OutreachRun[];
  outreachTasks?: OutreachTask[];
  outreachSessions?: OutreachSession[];
  outreachMessages?: Message[];
  outreachNextSend?: Record<string, number>;
  outreachWorker?: { owner: string; heartbeat: number; expiresAt: number };
  workspace?: {
    name: string;
    timeZone: string;
    language: 'en' | 'pt-BR';
    keepCampaignLogs: boolean;
    notifyActivity: boolean;
  };
  conversations?: Record<
    string,
    { status: 'open' | 'progress' | 'resolved'; starred: boolean; tags: string[]; readAt?: string }
  >;
  contacts: Contact[];
  accounts: Account[];
  campaigns: Campaign[];
  messages: Message[];
  jobs: Job[];
  events: string[];
  nextSend: Record<string, number>;
  settings: { botEnabled: boolean; greeting: string };
  audit: { at: string; text: string }[];
};
