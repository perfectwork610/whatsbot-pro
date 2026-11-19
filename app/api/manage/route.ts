import { NextRequest, NextResponse } from 'next/server';
import { sameOrigin } from '@/lib/auth';
import { audit, read, update, migrateLegacyOutreach } from '@/lib/store';
import { graph, send, simulation } from '@/lib/whatsapp';
import { randomInt } from 'node:crypto';
import { removeContacts } from '@/lib/contact-removal';
import { removeAccount } from '@/lib/account-removal';
import { markNotificationsRead } from '@/lib/notifications';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const text = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
function required(v: unknown, label: string, max = 200) {
  const result = text(v, max);
  if (!result) throw new Error(`${label} obrigatório.`);
  return result;
}
export async function GET() {
  migrateLegacyOutreach();
  const s = read();
  return NextResponse.json(
    {
      ...s,
      contacts: s.contacts.filter((c) => !c.deletedAt),
      campaigns: s.campaigns.filter((c) => !c.deletedAt),
      accounts: s.accounts.filter(a => !a.deletedAt).map((a) => ({ ...a, configured: !!process.env[a.tokenEnv] })),
      simulation: simulation(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
export async function POST(req: NextRequest) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: 'Origem inválida' }, { status: 403 });
  try {
    if (Number(req.headers.get('content-length')) > 2_000_000)
      throw new Error('Arquivo muito grande. Máximo 2 MB.');
    const b = await req.json();
    let result: unknown;
    if (b.action === 'notifications-read') {
      update(s => markNotificationsRead(s.audit, b.ids));
    } else if (b.action === 'contacts') {
      if (!Array.isArray(b.rows) || b.rows.length > 10000)
        throw new Error('Importe até 10.000 contatos por vez.');
      result = update((s) => {
        let added = 0,
          duplicates = 0,
          invalid = 0;
        // Soft-deleted contacts are not on the current list; reimport may restore them.
        const activePhones = new Set(
          s.contacts.filter((contact) => !contact.deletedAt).map((contact) => contact.phone),
        );
        for (const row of b.rows) {
          const phone = text(row.phone).replace(/[\s()+.\-]/g, '');
          if (!/^[1-9]\d{7,14}$/.test(phone)) {
            invalid++;
            continue;
          }
          if (activePhones.has(phone)) {
            duplicates++;
            continue;
          }
          activePhones.add(phone);
          const name = text(row.name) || phone;
          const company = text(row.company, 200);
          const consent = true;
          const source = text(row.source, 500) || 'Importação';
          const removed = s.contacts.find((contact) => contact.phone === phone && contact.deletedAt);
          if (removed) {
            removed.deletedAt = undefined;
            removed.name = name;
            removed.company = company || undefined;
            removed.source = source;
            // Restore to the current list without bypassing a prior opt-out.
            removed.consent = consent && !removed.optedOut;
            added++;
            continue;
          }
          s.contacts.push({
            id: crypto.randomUUID(),
            name,
            ...(company ? { company } : {}),
            phone,
            source,
            consent,
            optedOut: false,
            createdAt: new Date().toISOString(),
          });
          added++;
        }
        audit(s, `Importação: ${added} novos, ${duplicates} duplicados, ${invalid} inválidos.`);
        return { added, duplicates, invalid };
      });
    } else if (b.action === 'contact-create') {
      const name = required(b.name, 'Nome');
      const phone = required(b.phone, 'Telefone').replace(/[\s()+.\-]/g, '');
      if (!/^[1-9]\d{7,14}$/.test(phone))
        throw new Error('Informe um telefone internacional válido com código do país.');
      const source = text(b.source, 500);
      if (b.consent === true && !source)
        throw new Error('Informe a origem e data do consentimento.');
      result = update((s) => {
        const existing = s.contacts.find(c => c.phone === phone);
        if (existing && !existing.deletedAt)
          throw new Error('Este número já está na lista de contatos. Busque pelo telefone para editar o contato existente.');
        if (existing) {
          existing.deletedAt = undefined;
          existing.name = name;
          // Restore identity/history without undoing suppression or canceled jobs.
          existing.consent = false;
          audit(s, 'Contato removido restaurado pelo cadastro manual.');
          return { restored: true, id: existing.id };
        }
        const id = crypto.randomUUID();
        s.contacts.push({ id, name, phone, source, consent: b.consent === true && !!source,
          optedOut: false, createdAt: new Date().toISOString() });
        audit(s, 'Contato cadastrado manualmente.');
        return { restored: false, id };
      });
    } else if (b.action === 'contacts-remove' || b.action === 'contacts-restore') {
      result = update((s) => {
        const result = removeContacts(s, b.ids, b.action === 'contacts-restore');
        audit(s, `${result.count} contato(s) ${b.action === 'contacts-remove' ? 'removidos' : 'restaurados'}.`);
        return result;
      });
    } else if (b.action === 'contact-update') {
      const name = required(b.name, 'Nome');
      const phone = required(b.phone, 'Telefone').replace(/[\s()+.\-]/g, '');
      if (!/^[1-9]\d{7,14}$/.test(phone))
        throw new Error('Informe um telefone internacional válido com código do país.');
      if (
        !Array.isArray(b.lists) ||
        b.lists.length > 20 ||
        b.lists.some(
          (list: unknown) => typeof list !== 'string' || !list.trim() || list.length > 60,
        )
      )
        throw new Error('Listas inválidas.');
      update((s) => {
        const contact = s.contacts.find((c) => c.id === b.id);
        if (!contact || contact.deletedAt) throw new Error('Contato inexistente.');
        if (s.contacts.some((c) => c.id !== contact.id && c.phone === phone))
          throw new Error('Número já cadastrado.');
        // Consent evidence belongs to the original number and cannot be transferred.
        if (contact.phone !== phone) {
          contact.consent = false;
          contact.source = '';
        }
        contact.name = name;
        contact.phone = phone;
        contact.lists = [...new Set<string>(b.lists.map((list: string) => list.trim()))];
        audit(s, 'Contato atualizado.');
      });
    } else if (b.action === 'consent') {
      const ids = Array.isArray(b.ids)
        ? b.ids
        : typeof b.id === 'string'
          ? [b.id]
          : null;
      if (
        !ids?.length ||
        ids.length > 50000 ||
        ids.some((id: unknown) => typeof id !== 'string')
      )
        throw new Error('Selecione contatos válidos.');
      const grant = b.consent === true;
      const source = grant ? required(b.source, 'Comprovante de consentimento', 500) : '';
      result = update((s) => {
        const selected = new Set<string>(ids);
        const contacts = s.contacts.filter((c) => selected.has(c.id) && !c.deletedAt);
        if (contacts.length !== selected.size) throw new Error('Contato inexistente.');
        for (const contact of contacts) {
          contact.consent = grant;
          if (grant) {
            contact.source = source;
            contact.optedOut = false;
          } else contact.optedOut = true;
        }
        audit(
          s,
          grant
            ? `Permissão registrada para ${contacts.length} contato(s).`
            : `Descadastrados ${contacts.length} contato(s).`,
        );
        return { count: contacts.length };
      });
    } else if (b.action === 'account') {
      const name = required(b.name, 'Nome');
      const testAccount = b.testAccount === true;
      if (testAccount && !simulation())
        throw new Error('Contas de teste só podem ser criadas na simulação.');
      const displayPhone = text(b.displayPhone).replace(/[\s()+.\-]/g, '');
      if (displayPhone && !/^[1-9]\d{7,14}$/.test(displayPhone))
        throw new Error('Informe um telefone internacional válido com código do país.');
      const phoneId = testAccount
        ? `9${randomInt(100000000000, 999999999999)}`
        : required(b.phoneId, 'Phone Number ID');
      const tokenEnv = testAccount
        ? 'WA_TOKEN_SIMULATION'
        : required(b.tokenEnv, 'Variável do token');
      const wabaId = testAccount ? '0' : required(b.wabaId, 'WABA ID');
      if (!/^\d+$/.test(phoneId) || !/^\d+$/.test(wabaId))
        throw new Error(
          'Phone Number ID e WABA ID são identificadores numéricos da Meta, não seu telefone.',
        );
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
          ...(testAccount
            ? { simulationOnly: true, ...(displayPhone ? { displayPhone } : {}) }
            : {}),
          templates: simulation()
            ? [{ name: 'hello_world', language: 'en_US', status: 'APPROVED' }]
            : [],
        });
        audit(s, `Conta ${name} cadastrada.`);
      });
    } else if (b.action === 'account-delete' || b.action === 'account-restore') {
      update((s) => {
        removeAccount(s, b.id, b.action === 'account-restore');
        audit(s, b.action === 'account-delete' ? 'Conta WhatsApp excluída.' : 'Conta WhatsApp restaurada como inativa.');
      });
    } else if (b.action === 'account-update') {
      update((s) => {
        const account = s.accounts.find((a) => a.id === b.id);
        if (!account || account.deletedAt) throw new Error('Conta inexistente.');
        if (b.name !== undefined) account.name = required(b.name, 'Nome');
        if (b.dailyLimit !== undefined) {
          const limit = Number(b.dailyLimit);
          if (!Number.isInteger(limit) || limit < 1 || limit > 100000)
            throw new Error('Limite local inválido.');
          account.dailyLimit = limit;
        }
        if (b.displayPhone !== undefined) {
          const phone = text(b.displayPhone).replace(/[\s()+.\-]/g, '');
          if (phone && !/^[1-9]\d{7,14}$/.test(phone))
            throw new Error('Informe um telefone internacional válido com código do país.');
          account.displayPhone = phone;
        }
        if (b.enabled !== undefined) {
          if (typeof b.enabled !== 'boolean') throw new Error('Valor inválido.');
          account.enabled = b.enabled;
          if (!b.enabled)
            s.campaigns
              .filter((c) => c.accountId === account.id && c.status === 'running')
              .forEach((c) => {
                c.status = 'paused';
              });
        }
        audit(s, 'Configurações da conta atualizadas.');
      });
    } else if (b.action === 'sync') {
      const account = read().accounts.find((a) => a.id === b.id);
      if (!account || account.deletedAt) throw new Error('Conta inexistente.');
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
      if (b.mode === 'sequential')
        throw new Error('Use o robô de contato individual com conexão QR.');
      const name = required(b.name, 'Nome');
      const delay = Number(b.delay);
      if (!Number.isInteger(delay) || delay < 5 || delay > 86400)
        throw new Error('Intervalo deve ser entre 5 e 86.400 segundos.');
      update((s) => {
        const a = s.accounts.find((a) => a.id === b.accountId);
        if (!a || a.deletedAt) throw new Error('Escolha uma conta.');
        if (a.simulationOnly && !simulation())
          throw new Error(
            'Esta conta é apenas de teste. Conecte uma conta oficial para envios reais.',
          );
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
          mode: 'bulk',
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
    } else if (b.action === 'campaign-remove' || b.action === 'campaign-restore') {
      update((s) => {
        const c = s.campaigns.find((c) => c.id === b.id);
        if (!c || c.mode !== 'bulk') throw new Error('Campanha inexistente.');
        if (b.action === 'campaign-restore') {
          c.deletedAt = undefined;
        } else {
          if (s.jobs.some((j) => j.campaignId === c.id && j.status === 'processing'))
            throw new Error('Pause a campanha e aguarde o envio atual terminar antes de remover.');
          if (c.status === 'running') c.status = 'paused';
          c.deletedAt ||= new Date().toISOString();
        }
        audit(s, `Campanha ${c.name}: ${b.action === 'campaign-remove' ? 'removida' : 'restaurada'}.`);
      });
    } else if (b.action === 'campaign-status') {
      update((s) => {
        const c = s.campaigns.find((c) => c.id === b.id);
        if (!c || c.deletedAt) throw new Error('Campanha inexistente.');
        if (!['running', 'paused'].includes(b.status)) throw new Error('Status inválido.');
        if (
          b.status === 'running' &&
          s.accounts.find((a) => a.id === c.accountId)?.enabled === false
        )
          throw new Error('Esta conta está inativa. Ative a conta para enviar mensagens.');
        if (!s.jobs.some((j) => j.campaignId === c.id && j.status === 'pending'))
          throw new Error('Não há envios pendentes. Falhas exigem revisão antes de nova campanha.');
        c.status = b.status;
        audit(s, `Campanha ${c.name}: ${c.status}.`);
      });
    } else if (b.action === 'workspace-settings') {
      const name = b.name === undefined ? undefined : required(b.name, 'Nome do espaço de trabalho', 100);
      const timeZone = required(b.timeZone, 'Fuso horário', 100);
      try {
        new Intl.DateTimeFormat('en', { timeZone }).format();
      } catch {
        throw new Error('Fuso horário inválido.');
      }
      if (
        !['en', 'pt-BR'].includes(b.language) ||
        typeof b.keepCampaignLogs !== 'boolean' ||
        typeof b.notifyActivity !== 'boolean'
      )
        throw new Error('Preferências inválidas.');
      update((s) => {
        s.workspace = {
          name: name ?? s.workspace?.name ?? 'WhatsBot Pro',
          timeZone,
          language: b.language,
          keepCampaignLogs: b.keepCampaignLogs,
          notifyActivity: b.notifyActivity,
        };
        audit(s, 'Configurações do espaço de trabalho atualizadas.');
      });
    } else if (b.action === 'reply') {
      const s = read();
      const c = s.contacts.find((c) => c.id === b.contactId);
      const a = s.accounts.find((a) => a.id === b.accountId);
      const body = required(b.text, 'Mensagem', 4000);
      if (!c || c.deletedAt || !a || c.optedOut) throw new Error('Contato ou conta indisponível.');
      if (a.enabled === false)
        throw new Error('Esta conta está inativa. Ative a conta para enviar mensagens.');
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
    } else if (b.action === 'conversation') {
      update((s) => {
        if (
          !s.contacts.some((c) => c.id === b.contactId) ||
          !s.accounts.some((a) => a.id === b.accountId)
        )
          throw new Error('Selecione contato e conta.');
        const key = b.accountId + ':' + b.contactId;
        const meta = s.conversations?.[key] || {
          status: 'open' as const,
          starred: false,
          tags: [],
        };
        if (b.status !== undefined) {
          if (!['open', 'progress', 'resolved'].includes(b.status))
            throw new Error('Status inválido.');
          meta.status = b.status;
        }
        if (b.starred !== undefined) {
          if (typeof b.starred !== 'boolean') throw new Error('Valor inválido.');
          meta.starred = b.starred;
        }
        if (b.tags !== undefined) {
          if (
            !Array.isArray(b.tags) ||
            b.tags.length > 10 ||
            b.tags.some((tag: unknown) => typeof tag !== 'string' || !tag.trim() || tag.length > 40)
          )
            throw new Error('Etiquetas inválidas.');
          meta.tags = [...new Set<string>(b.tags.map((tag: string) => tag.trim()))];
        }
        if (b.read !== undefined) {
          if (typeof b.read !== 'boolean') throw new Error('Valor inválido.');
          meta.readAt = b.read ? new Date().toISOString() : '1970-01-01T00:00:00.000Z';
        }
        s.conversations ||= {};
        s.conversations[key] = meta;
      });
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
