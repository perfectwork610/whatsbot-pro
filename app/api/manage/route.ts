import { NextRequest, NextResponse } from 'next/server';
import { audit, read, update } from '@/lib/store';
import { graph, send, simulation } from '@/lib/whatsapp';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const text = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
function required(v: unknown, label: string, max = 200) {
  const result = text(v, max);
  if (!result) throw new Error(`${label} obrigatório.`);
  return result;
}
export async function GET() {
  const s = read();
  return NextResponse.json(
    {
      ...s,
      accounts: s.accounts.map((a) => ({ ...a, configured: !!process.env[a.tokenEnv] })),
      simulation: simulation(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
export async function POST(req: NextRequest) {
  const allowedOrigin =
    process.env.APP_URL || `${req.nextUrl.protocol}//${req.headers.get('host')}`;
  if (req.headers.get('origin') !== allowedOrigin)
    return NextResponse.json({ error: 'Origem inválida' }, { status: 403 });
  try {
    if (Number(req.headers.get('content-length')) > 2_000_000)
      throw new Error('Arquivo muito grande. Máximo 2 MB.');
    const b = await req.json();
    let result: unknown;
    if (b.action === 'contacts') {
      if (!Array.isArray(b.rows) || b.rows.length > 10000)
        throw new Error('Importe até 10.000 contatos por vez.');
      result = update((s) => {
        let added = 0,
          duplicates = 0,
          invalid = 0;
        for (const row of b.rows) {
          const phone = text(row.phone).replace(/[\s()+.\-]/g, '');
          if (!/^[1-9]\d{7,14}$/.test(phone)) {
            invalid++;
            continue;
          }
          if (s.contacts.some((c) => c.phone === phone)) {
            duplicates++;
            continue;
          }
          const source = text(row.source, 500);
          s.contacts.push({
            id: crypto.randomUUID(),
            name: text(row.name) || phone,
            phone,
            source,
            consent: row.consent === true && !!source,
            optedOut: false,
            createdAt: new Date().toISOString(),
          });
          added++;
        }
        audit(s, `Importação: ${added} novos, ${duplicates} duplicados, ${invalid} inválidos.`);
        return { added, duplicates, invalid };
      });
    } else if (b.action === 'consent') {
      update((s) => {
        const c = s.contacts.find((c) => c.id === b.id);
        if (!c) throw new Error('Contato inexistente.');
        c.consent = b.consent === true;
        if (c.consent) {
          c.source = required(b.source, 'Comprovante de consentimento', 500);
          c.optedOut = false;
        } else c.optedOut = true;
        audit(s, `Permissão atualizada para ${c.phone}: ${c.consent}.`);
      });
    } else if (b.action === 'account') {
      const name = required(b.name, 'Nome');
      const phoneId = required(b.phoneId, 'Phone Number ID');
      const tokenEnv = required(b.tokenEnv, 'Variável do token');
      const wabaId = required(b.wabaId, 'WABA ID');
      if (
        !/^\d+$/.test(phoneId) ||
        !/^\d+$/.test(wabaId) ||
        !/^WA_TOKEN_[A-Z0-9_]+$/.test(tokenEnv)
      )
        throw new Error('IDs devem ser numéricos. Variável do token: WA_TOKEN_NOME.');
      const dailyLimit = Number(b.dailyLimit);
      if (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 100000)
        throw new Error('Limite local inválido.');
      update((s) => {
        if (s.accounts.some((a) => a.phoneId === phoneId)) throw new Error('Número já cadastrado.');
        s.accounts.push({
          id: crypto.randomUUID(),
          name,
          phoneId,
          wabaId,
          tokenEnv,
          dailyLimit,
          templates: simulation()
            ? [{ name: 'hello_world', language: 'en_US', status: 'APPROVED' }]
            : [],
        });
        audit(s, `Conta ${name} cadastrada.`);
      });
    } else if (b.action === 'sync') {
      const account = read().accounts.find((a) => a.id === b.id);
      if (!account) throw new Error('Conta inexistente.');
      if (simulation())
        throw new Error('Sincronização disponível no modo live. Simulação inclui hello_world.');
      const data = await graph(
        account,
        `${account.wabaId}/message_templates?fields=name,language,status&limit=100`,
      );
      update((s) => {
        s.accounts.find((a) => a.id === account.id)!.templates = data.data.map(
          (t: { name: string; language: string; status: string }) => ({
            name: t.name,
            language: t.language,
            status: t.status,
          }),
        );
        audit(s, `Modelos sincronizados: ${account.name}.`);
      });
    } else if (b.action === 'campaign') {
      const name = required(b.name, 'Nome');
      const delay = Number(b.delay);
      if (!Number.isInteger(delay) || delay < 5 || delay > 86400)
        throw new Error('Intervalo deve ser entre 5 e 86.400 segundos.');
      update((s) => {
        const a = s.accounts.find((a) => a.id === b.accountId);
        if (!a) throw new Error('Escolha uma conta.');
        const t = a.templates.find(
          (t) => t.name === b.template && t.language === b.language && t.status === 'APPROVED',
        );
        if (!t) throw new Error('Selecione um modelo aprovado.');
        if (!Array.isArray(b.contactIds) || !b.contactIds.length)
          throw new Error('Selecione contatos.');
        const recipients = s.contacts.filter(
          (c) => b.contactIds.includes(c.id) && c.consent && !c.optedOut,
        );
        if (recipients.length !== new Set(b.contactIds).size)
          throw new Error('Todos os destinatários precisam de consentimento registrado.');
        const id = crypto.randomUUID();
        s.campaigns.unshift({
          id,
          name,
          accountId: a.id,
          template: t.name,
          language: t.language,
          parameters: Array.isArray(b.parameters)
            ? b.parameters.map((p: unknown) => text(p, 1024)).slice(0, 20)
            : [],
          mode: b.mode === 'sequential' ? 'sequential' : 'bulk',
          delay,
          status: 'draft',
          createdAt: new Date().toISOString(),
        });
        s.jobs.push(
          ...recipients.map((c) => ({
            id: crypto.randomUUID(),
            campaignId: id,
            contactId: c.id,
            status: 'pending' as const,
          })),
        );
        audit(s, `Campanha ${name} criada com ${recipients.length} destinatários.`);
      });
    } else if (b.action === 'campaign-status') {
      update((s) => {
        const c = s.campaigns.find((c) => c.id === b.id);
        if (!c) throw new Error('Campanha inexistente.');
        if (!['running', 'paused'].includes(b.status)) throw new Error('Status inválido.');
        if (!s.jobs.some((j) => j.campaignId === c.id && j.status === 'pending'))
          throw new Error('Não há envios pendentes. Falhas exigem revisão antes de nova campanha.');
        c.status = b.status;
        audit(s, `Campanha ${c.name}: ${c.status}.`);
      });
    } else if (b.action === 'settings') {
      update((s) => {
        s.settings = {
          botEnabled: b.botEnabled === true,
          greeting: required(b.greeting, 'Saudação', 2000),
        };
        audit(s, 'Configuração do atendimento atualizada.');
      });
    } else if (b.action === 'reply') {
      const s = read();
      const c = s.contacts.find((c) => c.id === b.contactId);
      const a = s.accounts.find((a) => a.id === b.accountId);
      const body = required(b.text, 'Mensagem', 4000);
      if (!c || !a || c.optedOut) throw new Error('Contato ou conta indisponível.');
      if (
        !s.messages.some(
          (m) =>
            m.contactId === c.id &&
            m.accountId === a.id &&
            m.direction === 'in' &&
            Date.now() - Date.parse(m.createdAt) < 86400000,
        )
      )
        throw new Error('Sem mensagem recebida nas últimas 24h. Inicie com modelo aprovado.');
      const id = crypto.randomUUID();
      update((s) =>
        s.messages.push({
          id,
          contactId: c.id,
          accountId: a.id,
          direction: 'out',
          text: body,
          status: 'processing',
          createdAt: new Date().toISOString(),
          simulated: simulation(),
        }),
      );
      try {
        const providerId = await send(a, c.phone, { type: 'text', text: { body } });
        update((s) => {
          Object.assign(
            s.messages.find((m) => m.id === id)!,
            { providerId, status: simulation() ? 'simulated' : 'accepted' },
          );
        });
      } catch (e) {
        update((s) =>
          Object.assign(
            s.messages.find((m) => m.id === id)!,
            { status: 'failed', error: String(e) },
          ),
        );
        throw e;
      }
    } else if (b.action === 'simulate-inbound') {
      if (!simulation()) throw new Error('Disponível apenas na simulação.');
      update((s) => {
        const c = s.contacts.find((c) => c.id === b.contactId);
        const a = s.accounts.find((a) => a.id === b.accountId);
        if (!c || !a) throw new Error('Selecione contato e conta.');
        const body = required(b.text, 'Mensagem');
        if (/^(sair|parar|stop|cancelar)$/i.test(body)) {
          c.consent = false;
          c.optedOut = true;
        }
        s.messages.push({
          id: crypto.randomUUID(),
          contactId: c.id,
          accountId: a.id,
          direction: 'in',
          text: body,
          status: 'received',
          simulated: true,
          createdAt: new Date().toISOString(),
        });
        if (s.settings.botEnabled && !c.optedOut)
          s.messages.push({
            id: crypto.randomUUID(),
            contactId: c.id,
            accountId: a.id,
            direction: 'out',
            text: s.settings.greeting,
            status: 'simulated',
            simulated: true,
            createdAt: new Date().toISOString(),
          });
      });
    } else throw new Error('Ação desconhecida.');
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro inesperado' },
      { status: 400 },
    );
  }
}
