'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  ShieldCheck,
  MessageCircle,
  MessagesSquare,
  Clock,
  Settings,
  Sparkles,
  Smile,
  Braces,
  ClipboardType,
  Lightbulb,
  CircleCheck,
  ChevronLeft,
  Wifi,
  Signal,
  BatteryFull,
  Video,
  Phone,
  MoreVertical,
  Paperclip,
  Camera,
  Mic,
  Send,
  ArrowRight,
} from 'lucide-react';
import type { State } from '@/lib/types';
import { greetingText } from '@/lib/greeting-text';
import { useLanguage } from './language';
import WhatsAppMark from './whatsapp-mark';
import type { WorkspaceTab } from './workspace-sidebar';
export default function WorkspaceService({
  settings,
  onAction,
  busy,
  workspaceName,
  onNavigate,
}: {
  settings: State['settings'];
  onAction: (payload: object, message: string) => Promise<boolean>;
  busy: boolean;
  workspaceName?: string;
  onNavigate: (tab: WorkspaceTab) => void;
}) {
  const { t, locale } = useLanguage();
  const [tab, setTab] = useState('reply'),
    [greeting, setGreeting] = useState(settings.greeting),
    [enabled, setEnabled] = useState(settings.botEnabled),
    [menu, setMenu] = useState<'emoji' | 'variables' | 'template' | null>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const tools = useRef<HTMLDivElement>(null);
  const tabs = [
    { value: 'reply', label: 'Resposta automática', icon: MessageCircle },
    { value: 'keywords', label: 'Palavras-chave', icon: MessagesSquare },
    { value: 'responses', label: 'Respostas padrão', icon: MessagesSquare },
    { value: 'hours', label: 'Horário comercial', icon: Clock },
    { value: 'handover', label: 'Transferência', icon: Clock },
    { value: 'settings', label: 'Configurações', icon: Settings },
  ];
  const snippets = [
    {
      name: 'Saudação amigável',
      text:
        locale === 'en'
          ? 'Hello! 👋\nThanks for contacting us.\n\nHow can we help you today?'
          : 'Olá! 👋\nObrigado por entrar em contato.\n\nComo podemos ajudar hoje?',
    },
    {
      name: 'Boas-vindas personalizadas',
      text:
        locale === 'en'
          ? 'Hi {{name}}! 👋\nWelcome to {{business}}.\nHow can we help?'
          : 'Olá, {{nome}}! 👋\nBoas-vindas à {{empresa}}.\nComo podemos ajudar?',
    },
    {
      name: 'Mensagem de recebimento',
      text:
        locale === 'en'
          ? 'Thanks for your message!\nOur team will respond as soon as possible.'
          : 'Obrigado pela sua mensagem!\nNossa equipe responderá assim que possível.',
    },
  ];
  useEffect(() => {
    if (!menu) return;
    function outside(e: PointerEvent) {
      if (!tools.current?.contains(e.target as Node)) setMenu(null);
    }
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenu(null);
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', key);
    };
  }, [menu]);
  function insert(text: string) {
    const start = editor.current?.selectionStart ?? greeting.length,
      end = editor.current?.selectionEnd ?? start;
    const next = (greeting.slice(0, start) + text + greeting.slice(end)).slice(0, 2000);
    setGreeting(next);
    setMenu(null);
    requestAnimationFrame(() => {
      editor.current?.focus();
      editor.current?.setSelectionRange(
        Math.min(start + text.length, next.length),
        Math.min(start + text.length, next.length),
      );
    });
  }
  function choose(text: string) {
    setGreeting(text);
    setMenu(null);
    setTab('reply');
  }
  const preview = greetingText(greeting, t('Cliente'), workspaceName || 'WhatsBot Pro');
  return (
    <div className="service-page">
      <header className="service-heading">
        <div>
          <h1>{t('Atendimento')}</h1>
          <p>
            {t(
              'Automatize e simplifique o atendimento no WhatsApp com respostas rápidas e consistentes.',
            )}
          </p>
        </div>
        <button
          className="service-assistant"
          role="switch"
          aria-checked={enabled}
          disabled={busy}
          aria-label={t('Ativar saudação automática')}
          onClick={() => setEnabled(!enabled)}
        >
          <Sparkles size={19} />
          {t('Resposta automática')}
          <span className="service-mini-switch">
            <i />
          </span>
        </button>
      </header>
      <div className="service-tabs" role="tablist" aria-label={t('Configurações do atendimento')}>
        {tabs.map((item) => (
          <button
            key={item.value}
            role="tab"
            aria-selected={tab === item.value}
            onClick={() => {
              setTab(item.value);
              setMenu(null);
            }}
          >
            <item.icon size={21} />
            {t(item.label)}
          </button>
        ))}
      </div>
      <div className="service-layout">
        <section className="service-editor-card">
          {tab === 'reply' ? (
            <>
              <header className="service-editor-heading">
                <span>
                  <Bot size={29} />
                </span>
                <div>
                  <h2>{t('Resposta inicial automática')}</h2>
                  <p>{t('Envie uma resposta amigável quando um cliente entrar em contato.')}</p>
                </div>
                <button
                  className="service-switch"
                  role="switch"
                  aria-checked={enabled}
                  disabled={busy}
                  aria-label={t('Resposta inicial automática')}
                  onClick={() => setEnabled(!enabled)}
                >
                  <i />
                </button>
              </header>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void onAction(
                    { action: 'settings', botEnabled: enabled, greeting },
                    'Atendimento atualizado.',
                  );
                }}
              >
                <label className="service-reply-label">
                  {t('Conteúdo da resposta')}
                  <textarea
                    ref={editor}
                    name="greeting"
                    value={greeting}
                    onChange={(e) => setGreeting(e.target.value)}
                    required
                    maxLength={2000}
                    disabled={busy}
                    rows={6}
                  />
                </label>
                <div className="service-editor-tools" ref={tools}>
                  <div className="service-tool-buttons">
                    <button
                      type="button"
                      aria-expanded={menu === 'emoji'}
                      onClick={() => setMenu(menu === 'emoji' ? null : 'emoji')}
                    >
                      <Smile size={20} />
                      {t('Emoji')}
                    </button>
                    <button
                      type="button"
                      aria-expanded={menu === 'variables'}
                      onClick={() => setMenu(menu === 'variables' ? null : 'variables')}
                    >
                      <Braces size={20} />
                      {t('Variáveis')}
                    </button>
                    <button
                      type="button"
                      aria-expanded={menu === 'template'}
                      onClick={() => setMenu(menu === 'template' ? null : 'template')}
                    >
                      <ClipboardType size={19} />
                      {t('Modelo')}
                    </button>
                  </div>
                  <span className="service-counter">{greeting.length} / 2000</span>
                  {menu && (
                    <div className={`service-tool-popover service-tool-popover--${menu}`}>
                      {menu === 'emoji' ? (
                        [
                          '👋',
                          '😊',
                          '💚',
                          '🙏',
                          '👍',
                          '✅',
                          '✨',
                          '🎉',
                          '📦',
                          '🙂',
                          '🤝',
                          '❤️',
                        ].map((icon) => (
                          <button
                            type="button"
                            key={icon}
                            aria-label={icon}
                            onClick={() => insert(icon)}
                          >
                            {icon}
                          </button>
                        ))
                      ) : menu === 'variables' ? (
                        <>
                          <strong>{t('Personalizar resposta')}</strong>
                          <button
                            type="button"
                            onClick={() => insert(locale === 'en' ? '{{name}}' : '{{nome}}')}
                          >
                            <code>{locale === 'en' ? '{{name}}' : '{{nome}}'}</code>
                            <span>{t('Nome do cliente')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => insert(locale === 'en' ? '{{business}}' : '{{empresa}}')}
                          >
                            <code>{locale === 'en' ? '{{business}}' : '{{empresa}}'}</code>
                            <span>{t('Nome do espaço de trabalho')}</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <strong>{t('Textos rápidos para a resposta')}</strong>
                          {snippets.map((snippet) => (
                            <button
                              type="button"
                              key={snippet.name}
                              onClick={() => choose(snippet.text)}
                            >
                              {t(snippet.name)}
                            </button>
                          ))}
                          <p>
                            {t(
                              'Estes textos são para respostas automáticas, não modelos aprovados da Meta.',
                            )}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="service-tips">
                  <h3>
                    <Lightbulb size={23} />
                    {t('Dicas para uma ótima primeira resposta')}
                  </h3>
                  <ul>
                    <li>{t('Seja amigável e breve.')}</li>
                    <li>{t('Explique como você pode ajudar.')}</li>
                    <li>{t('Defina expectativas claras, como o tempo de resposta.')}</li>
                  </ul>
                </div>
                <button className="service-save" type="submit" disabled={busy}>
                  <CircleCheck size={20} />
                  {t('Salvar configurações')}
                </button>
              </form>
            </>
          ) : (
            <div className="service-tab-content">
              <span className="service-tab-icon">
                {tab === 'handover' ? (
                  <MessagesSquare size={30} />
                ) : tab === 'hours' ? (
                  <Clock size={30} />
                ) : tab === 'settings' ? (
                  <Settings size={30} />
                ) : (
                  <MessageCircle size={30} />
                )}
              </span>
              <h2>{t(tabs.find((item) => item.value === tab)?.label || 'Atendimento')}</h2>
              {tab === 'responses' ? (
                <>
                  <p>{t('Escolha um texto para editar e visualizar antes de salvar.')}</p>
                  <div className="service-snippets">
                    {snippets.map((snippet) => (
                      <button key={snippet.name} onClick={() => choose(snippet.text)}>
                        <strong>{t(snippet.name)}</strong>
                        <span>{snippet.text}</span>
                        <ArrowRight size={18} />
                      </button>
                    ))}
                  </div>
                </>
              ) : tab === 'handover' ? (
                <>
                  <p>
                    {t(
                      'Depois da primeira resposta, sua equipe continua a conversa pela caixa de entrada.',
                    )}
                  </p>
                  <button className="service-save" onClick={() => onNavigate('Conversas')}>
                    {t('Abrir caixa de entrada')}
                    <ArrowRight size={18} />
                  </button>
                </>
              ) : tab === 'hours' ? (
                <>
                  <p>
                    {t(
                      'A saudação automática fica disponível 24 horas por dia quando ativada. Não há um horário comercial configurado.',
                    )}
                  </p>
                  <p className="service-policy">
                    {t(
                      'Informe seu horário de atendimento no texto da resposta para definir expectativas.',
                    )}
                  </p>
                  <button className="service-save" onClick={() => setTab('reply')}>
                    {t('Editar resposta')}
                    <ArrowRight size={18} />
                  </button>
                </>
              ) : tab === 'keywords' ? (
                <>
                  <p>
                    {t(
                      'Não há regras de palavras-chave configuradas. A saudação atual responde à primeira mensagem de cada janela de 24 horas.',
                    )}
                  </p>
                  <p className="service-policy">
                    {t(
                      'SAIR, PARAR, STOP e CANCELAR bloqueiam novos envios para o contato. Receber uma pergunta não registra consentimento para campanhas futuras.',
                    )}
                  </p>
                </>
              ) : (
                <>
                  <p>
                    {t(
                      'Responde à primeira mensagem de cada janela de 24 horas. O restante da conversa fica com a equipe na caixa de entrada.',
                    )}
                  </p>
                  <p className="service-policy">
                    {t('A prévia não envia mensagens. Salve para aplicar suas alterações.')}
                  </p>
                  <button className="service-save" onClick={() => onNavigate('Configurações')}>
                    {t('Configurações do espaço de trabalho')}
                    <ArrowRight size={18} />
                  </button>
                </>
              )}
            </div>
          )}
        </section>
        <section className="service-preview-card">
          <h2>{t('Prévia da mensagem')}</h2>
          <p>{t('Veja como sua resposta automática aparecerá para os clientes.')}</p>
          <div className="service-phone">
            <div className="service-phone-status" aria-hidden="true">
              <strong>10:24</strong>
              <span>
                <Signal size={18} />
                <Wifi size={18} />
                <BatteryFull size={24} />
              </span>
            </div>
            <header className="service-phone-header">
              <ChevronLeft size={23} />
              <span className="service-phone-logo">
                <WhatsAppMark />
              </span>
              <div>
                <strong>{workspaceName || 'WhatsBot Pro'}</strong>
                <small>{t('Prévia')}</small>
              </div>
              <span className="service-phone-actions" aria-hidden="true">
                <Video size={24} />
                <Phone size={22} />
                <MoreVertical size={22} />
              </span>
            </header>
            <div className="service-phone-canvas">
              <div className="service-phone-bubble">
                <p>{preview || '…'}</p>
                <time>10:24</time>
              </div>
            </div>
            <div className="service-phone-compose" aria-hidden="true">
              <span>
                <Smile size={23} />
                <i>{t('Mensagem...')}</i>
                <Paperclip size={23} />
                <Camera size={25} />
              </span>
              <b>
                <Mic size={27} />
              </b>
            </div>
          </div>
          <small className="service-preview-note">
            <ShieldCheck size={13} />
            {t('A prévia não envia mensagens.')}
          </small>
        </section>
      </div>
    </div>
  );
}
