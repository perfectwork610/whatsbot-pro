import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { audit, read, update } from '@/lib/store';
import { send, simulation } from '@/lib/whatsapp';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (
    process.env.META_VERIFY_TOKEN &&
    q.get('hub.mode') === 'subscribe' &&
    q.get('hub.verify_token') === process.env.META_VERIFY_TOKEN
  )
    return new NextResponse(q.get('hub.challenge'), { status: 200 });
  return new NextResponse('Forbidden', { status: 403 });
}
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = process.env.META_APP_SECRET;
  if (!secret) return new NextResponse('Webhook not configured', { status: 503 });
  const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`);
  const actual = Buffer.from(req.headers.get('x-hub-signature-256') || '');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return new NextResponse('Invalid signature', { status: 401 });
  try {
    const payload = JSON.parse(raw);
    const replies: { id: string; contactId: string; accountId: string; text: string }[] = [];
    update((s) => {
      for (const entry of payload.entry || [])
        for (const change of entry.changes || []) {
          const value = change.value;
          if (!value) continue;
          const account = s.accounts.find((a) => a.phoneId === value.metadata?.phone_number_id);
          if (!account) continue;
          for (const status of value.statuses || []) {
            const message = s.messages.find((m) => m.providerId === status.id);
            if (message) {
              const rank: Record<string, number> = {
                processing: 0,
                accepted: 1,
                sent: 2,
                delivered: 3,
                read: 4,
              };
              if (
                status.status === 'failed' ||
                (rank[status.status] ?? -1) > (rank[message.status] ?? -1)
              )
                message.status = status.status;
              if (status.errors?.length)
                message.error = status.errors
                  .map((e: { message?: string; title?: string }) => e.message || e.title)
                  .join('; ');
            }
          }
          for (const msg of value.messages || []) {
            if (!msg.id || s.events.includes(msg.id)) continue;
            s.events.push(msg.id);
            let contact = s.contacts.find((c) => c.phone === msg.from);
            if (!contact) {
              contact = {
                id: crypto.randomUUID(),
                name:
                  value.contacts?.find((c: { wa_id: string }) => c.wa_id === msg.from)?.profile
                    ?.name || msg.from,
                phone: msg.from,
                consent: false,
                source: '',
                optedOut: false,
                createdAt: new Date().toISOString(),
              };
              s.contacts.push(contact);
            }
            const body =
              msg.text?.body ||
              msg.button?.text ||
              msg.interactive?.button_reply?.title ||
              `[${msg.type}]`;
            const timestamp = Number(msg.timestamp) * 1000;
            const createdAt =
              Number.isFinite(timestamp) && timestamp > 0
                ? new Date(timestamp).toISOString()
                : new Date().toISOString();
            const firstInWindow = !s.messages.some(
              (m) =>
                m.direction === 'in' &&
                m.contactId === contact!.id &&
                m.accountId === account.id &&
                Date.parse(createdAt) - Date.parse(m.createdAt) < 86400000,
            );
            s.messages.push({
              id: crypto.randomUUID(),
              providerId: msg.id,
              contactId: contact.id,
              accountId: account.id,
              direction: 'in',
              text: body,
              status: 'received',
              createdAt,
            });
            if (/^(sair|parar|stop|cancelar)$/i.test(body.trim())) {
              contact.consent = false;
              contact.optedOut = true;
              audit(s, `Descadastro solicitado por ${contact.phone}.`);
            } else if (
              s.settings.botEnabled &&
              firstInWindow &&
              !contact.optedOut &&
              Date.now() - Date.parse(createdAt) < 86400000
            ) {
              const reply = {
                id: crypto.randomUUID(),
                contactId: contact.id,
                accountId: account.id,
                text: s.settings.greeting,
              };
              s.messages.push({
                ...reply,
                direction: 'out',
                status: 'processing',
                createdAt: new Date().toISOString(),
                simulated: simulation(),
              });
              replies.push(reply);
            }
          }
        }
    });
    for (const reply of replies) {
      try {
        const s = read();
        const contact = s.contacts.find((c) => c.id === reply.contactId)!;
        const account = s.accounts.find((a) => a.id === reply.accountId)!;
        if (contact.optedOut) {
          update((s) => {
            s.messages.find((m) => m.id === reply.id)!.status = 'skipped';
          });
          continue;
        }
        const providerId = await send(account, contact.phone, {
          type: 'text',
          text: { body: reply.text },
        });
        update((s) => {
          Object.assign(
            s.messages.find((m) => m.id === reply.id)!,
            { providerId, status: simulation() ? 'simulated' : 'accepted' },
          );
        });
      } catch (e) {
        update((s) => {
          Object.assign(
            s.messages.find((m) => m.id === reply.id)!,
            { status: 'failed', error: String(e) },
          );
          audit(s, 'Falha na resposta automática; verificar conversa.');
        });
      }
    }
    return NextResponse.json({ ok: true });
  } catch {
    return new NextResponse('Invalid event', { status: 400 });
  }
}
