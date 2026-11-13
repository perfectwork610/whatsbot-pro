'use client';
import { useState } from 'react';
import { Bot, ShieldCheck } from 'lucide-react';
import type { State } from '@/lib/types';
import { useLanguage } from './language';
import { Badge, Button, Card, Label } from './workspace-ui';
import WhatsAppMark from './whatsapp-mark';
export default function WorkspaceService({
  settings,
  onAction,
  busy,
}: {
  settings: State['settings'];
  onAction: (payload: object, message: string) => Promise<boolean>;
  busy: boolean;
}) {
  const { t } = useLanguage();
  const [preview, setPreview] = useState(settings.greeting);
  return (
    <div className="workspace-service-grid">
      <Card>
        <div className="workspace-service-title">
          <span>
            <Bot size={23} />
          </span>
          <div>
            <h2>{t('Resposta inicial automática')}</h2>
            <p>{t('Um primeiro contato que faz a diferença.')}</p>
          </div>
        </div>
        <p className="mt-5 text-xs leading-7 text-slate-500">
          {t(
            'Responde à primeira mensagem de cada janela de 24 horas. O restante da conversa fica com a equipe na caixa de entrada.',
          )}
        </p>
        <form
          key={`${settings.botEnabled}:${settings.greeting}`}
          className="mt-6 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void onAction(
              {
                action: 'settings',
                botEnabled: form.get('botEnabled') === 'on',
                greeting: form.get('greeting'),
              },
              'Atendimento atualizado.',
            );
          }}
        >
          <label className="workspace-service-switch">
            <input
              name="botEnabled"
              type="checkbox"
              role="switch"
              defaultChecked={settings.botEnabled}
            />
            {t('Ativar saudação automática')}
          </label>
          <Label>
            {t('Mensagem de boas-vindas')}
            <textarea
              required
              name="greeting"
              defaultValue={settings.greeting}
              onChange={(event) => setPreview(event.target.value)}
              rows={5}
              maxLength={2000}
              className="workspace-input mt-2 w-full"
            />
          </Label>
          <Button disabled={busy} type="submit">
            {t('Salvar atendimento')}
          </Button>
        </form>
        <p className="mt-5 text-[10px] leading-6 text-slate-400">
          {t(
            'SAIR, PARAR, STOP e CANCELAR bloqueiam novos envios para o contato. Receber uma pergunta não registra consentimento para campanhas futuras.',
          )}
        </p>
      </Card>
      <Card className="workspace-service-preview">
        <div className="workspace-section-heading">
          <div>
            <h2>{t('Prévia da mensagem')}</h2>
            <p>{t('Uma boa conversa começa com uma boa recepção.')}</p>
          </div>
          <Badge status={settings.botEnabled ? 'running' : 'paused'} />
        </div>
        <div className="workspace-preview-window">
          <header>
            <WhatsAppMark />
            WhatsApp
          </header>
          <div>
            <p>{preview || '…'}</p>
          </div>
        </div>
        <div className="workspace-preview-note flex gap-2">
          <ShieldCheck size={17} className="shrink-0" />
          <span>{t('A prévia não envia mensagens. Salve para aplicar suas alterações.')}</span>
        </div>
      </Card>
    </div>
  );
}
