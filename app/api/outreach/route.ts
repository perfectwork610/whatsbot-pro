import { NextRequest, NextResponse } from 'next/server';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { sameOrigin } from '@/lib/auth';
import { dataDir } from '@/lib/paths';
import { read, update, audit, migrateLegacyOutreach } from '@/lib/store';
import { simulation } from '@/lib/whatsapp';
import { outreachWorkerLive, deleteOutreachRun } from '@/lib/outreach-engine';
import { startOutreachWorker } from '@/lib/outreach-process';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const string = (value: unknown, max = 200) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';
function required(value: unknown, max = 200) {
  const result = string(value, max);
  if (!result) throw new Error('Preencha os campos obrigatórios.');
  return result;
}
export async function GET() {
  migrateLegacyOutreach();
  const state = read();
  return NextResponse.json(
    {
      sessions: (state.outreachSessions || []).map((session) => ({
        ...session,
        qr: session.qrExpiresAt && session.qrExpiresAt > Date.now() ? session.qr : undefined,
        pairingCode:
          session.pairingCodeExpiresAt && session.pairingCodeExpiresAt > Date.now()
            ? session.pairingCode
            : undefined,
      })),
      runs: (state.outreachRuns || []).filter((run) => !run.deletedAt),
      tasks: (state.outreachTasks || []).filter((task) =>
        state.outreachRuns?.some((run) => run.id === task.runId && !run.deletedAt)),
      messages: state.outreachMessages || [],
      workerLive: outreachWorkerLive(state),
      simulation: simulation(),
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: 'Origem inválida' }, { status: 403 });
  try {
    if (Number(request.headers.get('content-length')) > 1500000)
      throw new Error('Solicitação muito grande.');
    const body = await request.json();
    let result: unknown;
    let launchWorker = false;
    update((state) => {
      state.outreachSessions ||= [];
      state.outreachRuns ||= [];
      state.outreachTasks ||= [];
      state.outreachMessages ||= [];
      if (body.action === 'worker-start') {
        launchWorker = !outreachWorkerLive(state);
      } else if (body.action === 'session-create') {
        if (body.testOnly !== undefined && typeof body.testOnly !== 'boolean')
          throw new Error('Valor inválido.');
        const name = required(body.name),
          limit = Number(body.dailyLimit);
        if (!Number.isInteger(limit) || limit < 1 || limit > 10000)
          throw new Error('Limite local inválido.');
        if (body.testOnly && !simulation())
          throw new Error('Conexões de teste só funcionam na simulação.');
        if (state.outreachSessions.length >= 20)
          throw new Error('Máximo de 20 conexões por instalação.');
        const authMethod = body.authMethod === 'qr' ? 'qr' : 'pairing';
        const pairingPhone = string(body.pairingPhone, 20).replace(/[\s()+.\-]/g, '');
        if (!body.testOnly && authMethod === 'pairing') {
          if (!/^[1-9]\d{7,14}$/.test(pairingPhone))
            throw new Error('Informe o telefone do WhatsApp com código do país.');
        }
        const id = crypto.randomUUID();
        state.outreachSessions.push({
          id,
          name,
          dailyLimit: limit,
          enabled: true,
          testOnly: body.testOnly === true,
          authMethod: body.testOnly === true ? 'qr' : authMethod,
          ...(authMethod === 'pairing' && pairingPhone ? { pairingPhone } : {}),
          desiredConnected: false,
          generation: 0,
          status: 'disconnected',
          updatedAt: Date.now(),
        });
        result = { id };
      } else if (
        ['session-connect', 'session-disconnect', 'session-update'].includes(body.action)
      ) {
        const session = state.outreachSessions.find((s) => s.id === body.id);
        if (!session) throw new Error('Conexão inexistente.');
        if (body.action === 'session-update') {
          if (body.dailyLimit !== undefined) {
            const limit = Number(body.dailyLimit);
            if (!Number.isInteger(limit) || limit < 1 || limit > 10000)
              throw new Error('Limite local inválido.');
            session.dailyLimit = limit;
          }
          if (body.enabled !== undefined) {
            if (typeof body.enabled !== 'boolean') throw new Error('Valor inválido.');
            session.enabled = body.enabled;
          }
        } else {
          // Repeated clicks/poll retries must not restart a browser that is
          // already starting, showing a QR/code, or connected.
          if (body.action === 'session-connect' && session.desiredConnected &&
              outreachWorkerLive(state) &&
              [
                'queued',
                'connecting',
                'qr',
                'pairing',
                'pairing-failed',
                'authenticated',
                'ready',
              ].includes(session.status))
            return;
          session.generation++;
          session.desiredConnected = body.action === 'session-connect';
          if (session.desiredConnected && !outreachWorkerLive(state)) launchWorker = true;
          session.status = session.desiredConnected ? 'queued' : 'disconnected';
          session.qr = undefined;
          session.qrExpiresAt = undefined;
          session.pairingCode = undefined;
          session.pairingCodeExpiresAt = undefined;
          session.pairingAction = undefined;
          if (body.action === 'session-connect') session.forceQr = false;
          session.error = undefined;
        }
        session.updatedAt = Date.now();
        if (!session.enabled || !session.desiredConnected)
          state.outreachRuns
            .filter((run) => run.senderIds.includes(session.id) && run.status === 'running')
            .forEach((run) => {
              run.status = 'paused';
            });
      } else if (
        body.action === 'session-retry-pairing' ||
        body.action === 'session-use-qr'
      ) {
        const session = state.outreachSessions.find((s) => s.id === body.id);
        if (!session) throw new Error('Conexão inexistente.');
        if (!session.desiredConnected || session.status !== 'pairing-failed')
          throw new Error('Nenhuma falha de código de telefone para resolver.');
        if (session.authMethod !== 'pairing' || !session.pairingPhone)
          throw new Error('Esta conexão não usa código de telefone.');
        if (body.action === 'session-use-qr') {
          // Restart browser in QR mode — pairing clients never register QR listeners.
          session.forceQr = true;
          session.generation++;
          session.desiredConnected = true;
          session.status = 'queued';
          session.pairingAction = undefined;
        } else {
          session.forceQr = false;
          session.pairingAction = 'retry';
          session.status = 'connecting';
        }
        session.error = undefined;
        session.qr = undefined;
        session.qrExpiresAt = undefined;
        session.pairingCode = undefined;
        session.pairingCodeExpiresAt = undefined;
        session.updatedAt = Date.now();
        if (!outreachWorkerLive(state)) launchWorker = true;
      } else if (body.action === 'session-remove') {
        const index = state.outreachSessions.findIndex((s) => s.id === body.id);
        if (index < 0) throw new Error('Conexão inexistente.');
        const session = state.outreachSessions[index];
        session.generation++;
        session.desiredConnected = false;
        session.status = 'disconnected';
        session.qr = undefined;
        session.qrExpiresAt = undefined;
        session.pairingCode = undefined;
        session.pairingCodeExpiresAt = undefined;
        session.pairingAction = undefined;
        session.forceQr = undefined;
        session.error = undefined;
        state.outreachRuns
          .filter((run) => run.senderIds.includes(session.id) && run.status === 'running')
          .forEach((run) => {
            run.status = 'paused';
          });
        for (const run of state.outreachRuns) {
          run.senderIds = run.senderIds.filter((id) => id !== session.id);
        }
        state.outreachSessions.splice(index, 1);
        audit(state, 'Robô: conexão WhatsApp removida.');
        try {
          rmSync(path.join(dataDir(), 'outreach-auth', `session-${session.id}`), {
            recursive: true,
            force: true,
          });
        } catch {
          /* Browser may still hold the profile briefly; worker will stop using it. */
        }
      } else if (body.action === 'run-create') {
        const name = required(body.name),
          message = required(body.message, 4000),
          delay = Number(body.delay);
        if (!Number.isInteger(delay) || delay < 5 || delay > 86400)
          throw new Error('Intervalo deve ser entre 5 e 86.400 segundos.');
        if (
          !Array.isArray(body.senderIds) ||
          !body.senderIds.length ||
          body.senderIds.length > 20 ||
          body.senderIds.some((id: unknown) => typeof id !== 'string')
        )
          throw new Error('Selecione conexões do robô.');
        const senderIds = [...new Set<string>(body.senderIds)];
        if (
          senderIds.some(
            (id) =>
              !state.outreachSessions!.some(
                (s) => s.id === id && s.enabled && (simulation() || !s.testOnly),
              ),
          )
        )
          throw new Error('Conexão inválida para este ambiente.');
        if (
          !Array.isArray(body.contactIds) ||
          !body.contactIds.length ||
          body.contactIds.length > 10000 ||
          body.contactIds.some((id: unknown) => typeof id !== 'string')
        )
          throw new Error('Selecione até 10.000 contatos.');
        const contactIds = [...new Set<string>(body.contactIds)];
        const eligible = new Set(
          state.contacts.filter((c) => c.consent && !c.optedOut).map((c) => c.id),
        );
        if (contactIds.some((id) => !eligible.has(id)))
          throw new Error('Todos os destinatários precisam de consentimento registrado.');
        if (typeof body.saveContacts !== 'boolean' || typeof body.syncToPhone !== 'boolean')
          throw new Error('Preferências inválidas.');
        if (body.syncToPhone && !body.saveContacts)
          throw new Error('Ative salvar contatos antes de sincronizar com o telefone.');
        const id = crypto.randomUUID();
        state.outreachRuns.unshift({
          id,
          name,
          connector: 'whatsapp-web',
          senderIds,
          message,
          delay,
          status: 'draft',
          createdAt: new Date().toISOString(),
          saveContacts: body.saveContacts,
          syncToPhone: body.syncToPhone,
          simulated: simulation(),
        });
        state.outreachTasks.push(
          ...contactIds.map((contactId, index) => ({
            id: crypto.randomUUID(),
            runId: id,
            contactId,
            senderId: senderIds[index % senderIds.length],
            status: 'pending' as const,
          })),
        );
        result = { id };
        audit(state, 'Robô: fila individual criada.');
      } else if (body.action === 'run-delete' || body.action === 'run-restore') {
        deleteOutreachRun(state, required(body.id), body.action === 'run-restore');
        audit(state, body.action === 'run-delete' ? 'Robô: fila excluída.' : 'Robô: fila restaurada.');
      } else if (body.action === 'run-status') {
        const run = state.outreachRuns.find((run) => run.id === body.id);
        if (!run || run.deletedAt || run.connector !== 'whatsapp-web')
          throw new Error('Fila inexistente ou sequência antiga somente para consulta.');
        if (!['running', 'paused'].includes(body.status)) throw new Error('Status inválido.');
        if (body.status === 'running') {
          if (run.simulated !== simulation())
            throw new Error('O ambiente mudou. Crie uma nova fila para o ambiente atual.');
          if (!outreachWorkerLive(state))
            throw new Error('Inicie o worker do robô antes de continuar.');
          if (
            !state.outreachTasks.some((task) => task.runId === run.id && task.status === 'pending')
          )
            throw new Error('Não há contatos pendentes.');
          if (
            run.senderIds.some(
              (id) =>
                !state.outreachSessions!.some(
                  (s) =>
                    s.id === id &&
                    s.enabled &&
                    s.desiredConnected &&
                    s.status === 'ready' &&
                    (simulation() || !s.testOnly),
                ),
            )
          )
            throw new Error('Conecte os números selecionados antes de iniciar.');
          if (
            state.outreachTasks.some(
              (task) => task.runId === run.id && ['needs-review', 'failed'].includes(task.status),
            )
          )
            throw new Error('Revise os contatos com falha antes de continuar.');
        }
        run.status = body.status;
      } else if (body.action === 'task-skip') {
        const task = state.outreachTasks.find((task) => task.id === body.id);
        if (!task || !['failed', 'needs-review', 'pending'].includes(task.status))
          throw new Error('Contato não disponível para revisão.');
        task.status = 'skipped';
        task.error = 'Ignorado pelo operador após revisão.';
      } else throw new Error('Ação desconhecida.');
    });
    if (launchWorker) startOutreachWorker();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha na operação' },
      { status: 400 },
    );
  }
}
