import type { Account } from './types';
export const simulation = () => process.env.WHATSAPP_MODE !== 'live';
export async function graph(account: Account, endpoint: string, body?: unknown) {
  const token = process.env[account.tokenEnv];
  if (!token) throw new Error(`Configure ${account.tokenEnv} no servidor.`);
  const version = process.env.META_GRAPH_VERSION;
  if (!version || !/^v\d+\.\d+$/.test(version))
    throw new Error('Configure META_GRAPH_VERSION com a versão ativa do seu app Meta.');
  const response = await fetch(`https://graph.facebook.com/${version}/${endpoint}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(`Meta ${response.status}: ${data.error?.message || 'Falha na API'}`);
  return data;
}
export async function send(account: Account, phone: string, payload: object): Promise<string> {
  if (simulation()) return `sim_${crypto.randomUUID()}`;
  const data = await graph(account, `${account.phoneId}/messages`, {
    messaging_product: 'whatsapp',
    to: phone,
    ...payload,
  });
  if (!data.messages?.[0]?.id)
    throw new Error('API não retornou ID da mensagem; confirme o resultado antes de reenviar.');
  return data.messages[0].id;
}
