export type OutreachSession = {
  id: string;
  name: string;
  dailyLimit: number;
  enabled: boolean;
  testOnly: boolean;
  /** How the phone is linked: QR scan or 8-character pairing code. */
  authMethod?: 'qr' | 'pairing';
  /** E.164 digits without symbols, used for pairing-code link. */
  pairingPhone?: string;
  desiredConnected: boolean;
  generation: number;
  status:
    | 'disconnected'
    | 'queued'
    | 'connecting'
    | 'qr'
    | 'pairing'
    | 'authenticated'
    | 'ready'
    | 'error';
  phone?: string;
  qr?: string;
  qrExpiresAt?: number;
  pairingCode?: string;
  pairingCodeExpiresAt?: number;
  error?: string;
  updatedAt: number;
};
export type OutreachRun = {
  id: string;
  name: string;
  connector: 'whatsapp-web' | 'official-api';
  senderIds: string[];
  message: string;
  delay: number;
  status: 'draft' | 'running' | 'paused' | 'completed';
  createdAt: string;
  deletedAt?: string;
  saveContacts?: boolean;
  syncToPhone?: boolean;
  simulated?: boolean;
  nextSendAt?: number;
  legacyTemplate?: { template: string; language: string; parameters: string[] };
};
export type OutreachTask = {
  id: string;
  runId: string;
  contactId: string;
  senderId?: string;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'skipped' | 'needs-review';
  savedContact?: boolean;
  phase?: 'saving' | 'sending';
  error?: string;
  completedAt?: string;
};
