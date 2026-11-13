'use client';
import DismissibleDialog from './dismissible-dialog';
import { useRef, useState } from 'react';
import {
  Settings,
  MessageCircle,
  Users,
  Bot,
  ClipboardList,
  Bell,
  CreditCard,
  Clock,
  Building2,
  Globe,
  Check,
  ArrowRight,
  Send,
  FileText,
  X,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import type { State } from '@/lib/types';
import { useLanguage } from './language';
import type { WorkspaceTab } from './workspace-sidebar';
import WhatsAppMark from './whatsapp-mark';
export default function SettingsPage({
  data,
  busy,
  onAction,
  onNavigate,
}: {
  data: State & { simulation: boolean };
  busy: boolean;
  onAction: (payload: object, message: string) => Promise<boolean>;
  onNavigate: (tab: WorkspaceTab) => void;
}) {
  const { t, locale, setLocale } = useLanguage();
  const prefs = data.workspace || {
    name: 'WhatsBot Pro',
    timeZone: 'UTC',
    language: locale,
    keepCampaignLogs: true,
    notifyActivity: true,
  };
  const [tab, setTab] = useState('general'),
    [name, setName] = useState(prefs.name),
    [zone, setZone] = useState(prefs.timeZone),
    [language, setLanguage] = useState(prefs.language),
    [logs, setLogs] = useState(prefs.keepCampaignLogs),
    [notifications, setNotifications] = useState(prefs.notifyActivity),
    [search, setSearch] = useState('');
  const history = useRef<HTMLDialogElement>(null);
  const tabs = [
    { value: 'general', label: 'Geral', icon: Settings },
    { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { value: 'team', label: 'Equipe', icon: Users },
    { value: 'automation', label: 'Automação', icon: Bot },
    { value: 'templates', label: 'Modelos', icon: ClipboardList },
    { value: 'notifications', label: 'Notificações', icon: Bell },
    { value: 'billing', label: 'Faturamento', icon: CreditCard },
  ];
  const zones = Array.from(
    new Set([
      'UTC',
      'America/Sao_Paulo',
      'America/Manaus',
      'America/New_York',
      'America/Los_Angeles',
      'Europe/Lisbon',
      'Europe/London',
      'Asia/Shanghai',
      'Asia/Tokyo',
      prefs.timeZone,
    ]),
  );
  async function save() {
    const ok = await onAction(
      {
        action: 'workspace-settings',
        name,
        timeZone: zone,
        language,
        keepCampaignLogs: logs,
        notifyActivity: notifications,
      },
      'Configurações do espaço de trabalho atualizadas.',
    );
    if (ok) setLocale(language);
  }
  const format = (at: string) =>
    new Date(at).toLocaleString(locale, {
      timeZone: data.workspace?.timeZone || 'UTC',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  function historyIcon(text: string) {
    return /^Campanha/.test(text)
      ? Send
      : /^Importa/.test(text)
        ? Users
        : /[Mm]odelos/.test(text)
          ? ClipboardList
          : /^Conta/.test(text)
            ? MessageCircle
            : Settings;
  }
  function entries(all = false) {
    const rows = all
      ? data.audit.filter((a) => t(a.text).toLocaleLowerCase().includes(search.toLocaleLowerCase()))
      : data.audit.slice(0, 5);
    return rows.length ? (
      rows.map((event, index) => {
        const Icon = historyIcon(event.text);
        const success =
          /^Importação:|^Conta .*cadastrada|^Modelos sincronizados|^Campanha .*criada|^Campanha .*: running/.test(
            event.text,
          );
        return (
          <div className="settings-history-event" key={event.at + index}>
            <span
              className={`settings-event-icon ${Icon === Users || Icon === Settings ? 'settings-event-icon--gray' : ''}`}
            >
              <Icon size={26} />
            </span>
            <div>
              <strong>{t(event.text)}</strong>
              <time>{format(event.at)}</time>
            </div>
            <span
              className={`settings-event-badge ${success ? 'settings-event-badge--success' : ''}`}
            >
              {t(success ? 'Sucesso' : 'Info')}
            </span>
          </div>
        );
      })
    ) : (
      <p className="settings-empty">{t('Nenhum evento registrado.')}</p>
    );
  }
  function sectionHeading(title: string, subtitle: string, Icon = Settings) {
    return (
      <header className="settings-card-heading">
        <span>
          <Icon size={26} />
        </span>
        <div>
          <h2>{t(title)}</h2>
          <p>{t(subtitle)}</p>
        </div>
      </header>
    );
  }
  return (
    <div className="settings-page">
      <header className="settings-page-heading">
        <h1>{t('Configurações')}</h1>
        <p>{t('Gerencie seu espaço de trabalho, contas e preferências de operação.')}</p>
      </header>
      <div className="settings-tabs" role="tablist" aria-label={t('Seções das configurações')}>
        {tabs.map((item) => (
          <button
            role="tab"
            aria-selected={tab === item.value}
            key={item.value}
            onClick={() => setTab(item.value)}
          >
            <item.icon size={21} />
            {t(item.label)}
          </button>
        ))}
      </div>
      <div className="settings-layout">
        <section className="settings-main-card">
          {tab === 'general' ? (
            <>
              <div>
                {sectionHeading(
                  'Configurações gerais',
                  'Configuração básica do seu espaço de trabalho.',
                )}
              </div>
              <form
                className="settings-general-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
              >
                <label>
                  {t('Nome do espaço de trabalho')}
                  <span className="settings-field">
                    <Building2 size={20} />
                    <input
                      name="workspaceName"
                      required
                      maxLength={100}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </span>
                </label>
                <label>
                  {t('Fuso horário')}
                  <span className="settings-field">
                    <Clock size={20} />
                    <select name="timeZone" value={zone} onChange={(e) => setZone(e.target.value)}>
                      {zones.map((value) => (
                        <option key={value} value={value}>
                          {value === 'UTC'
                            ? t('(UTC+0) Tempo Universal Coordenado')
                            : value.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </span>
                </label>
                <label>
                  {t('Idioma padrão')}
                  <span className="settings-field">
                    <Globe size={20} />
                    <select
                      name="language"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as 'en' | 'pt-BR')}
                    >
                      <option value="en">English</option>
                      <option value="pt-BR">Português</option>
                    </select>
                  </span>
                </label>
                <div className="settings-switches">
                  <label>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={logs}
                      onChange={(e) => setLogs(e.target.checked)}
                    />
                    <span className="settings-switch" />
                    <span>
                      <strong>{t('Manter registros de campanhas')}</strong>
                      <small>
                        {t('Salve as atividades de campanhas no histórico de operação.')}
                      </small>
                    </span>
                  </label>
                  <label title={t('O modo de envio é definido na configuração do servidor.')}>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={data.simulation}
                      disabled
                      readOnly
                    />
                    <span className="settings-switch" />
                    <span>
                      <strong>{t('Ativar modo de simulação')}</strong>
                      <small>
                        {t(
                          data.simulation
                            ? 'Ambiente de teste sem enviar mensagens reais.'
                            : 'Modo live configurado no servidor.',
                        )}
                      </small>
                      <em>{t('Gerenciado pelo servidor')}</em>
                    </span>
                  </label>
                </div>
                <footer>
                  <button className="settings-save" type="submit" disabled={busy}>
                    <Check size={20} />
                    {t('Salvar alterações')}
                  </button>
                </footer>
              </form>
            </>
          ) : tab === 'whatsapp' ? (
            <>
              {sectionHeading(
                'Conexão do WhatsApp',
                'Gerencie os números e as credenciais da sua operação.',
                MessageCircle,
              )}
              <div className="settings-info-block">
                <WhatsAppMark />
                <div>
                  <strong>
                    {data.accounts.length} {t('Contas WhatsApp')}
                  </strong>
                  <p>{t(data.simulation ? 'Ambiente de simulação' : 'Integração oficial Meta.')}</p>
                </div>
              </div>
              <button className="settings-save" onClick={() => onNavigate('Contas WhatsApp')}>
                {t('Gerenciar contas')}
                <ArrowRight size={17} />
              </button>
              <div className="settings-operational-notes">
                <h3>{t('Conexão e execução')}</h3>
                <p>
                  {t('Webhook público:')} <code>/api/webhook</code>
                </p>
                <p>{t('As credenciais e o modo de envio são configurados no servidor.')}</p>
                <p>{t('O worker precisa estar em execução para processar campanhas.')}</p>
              </div>
            </>
          ) : tab === 'automation' ? (
            <>
              {sectionHeading('Automação', 'Configure a resposta automática e o atendimento.', Bot)}
              <div className="settings-info-block">
                <Bot />
                <div>
                  <strong>
                    {t(
                      data.settings.botEnabled
                        ? 'Saudação automática ativa'
                        : 'Saudação automática desativada',
                    )}
                  </strong>
                  <p>{data.settings.greeting}</p>
                </div>
              </div>
              <button className="settings-save" onClick={() => onNavigate('Atendimento')}>
                {t('Configurar atendimento')}
                <ArrowRight size={17} />
              </button>
            </>
          ) : tab === 'templates' ? (
            <>
              {sectionHeading(
                'Modelos de mensagem',
                'Consulte os modelos aprovados das suas contas.',
                ClipboardList,
              )}
              <div className="settings-templates">
                {data.accounts.map((a) => (
                  <div key={a.id}>
                    <h3>{a.name}</h3>
                    {a.templates.length ? (
                      a.templates.map((template) => (
                        <p key={template.name + template.language}>
                          <FileText size={16} />
                          <span>
                            {template.name}
                            <small>{template.language}</small>
                          </span>
                          <b>{t(template.status)}</b>
                        </p>
                      ))
                    ) : (
                      <p>{t('Nenhum modelo sincronizado.')}</p>
                    )}
                  </div>
                ))}
              </div>
              <button className="settings-save" onClick={() => onNavigate('Contas WhatsApp')}>
                {t('Gerenciar contas')}
                <ArrowRight size={17} />
              </button>
            </>
          ) : tab === 'notifications' ? (
            <>
              {sectionHeading(
                'Notificações',
                'Escolha como acompanhar a atividade do espaço de trabalho.',
                Bell,
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
              >
                <div className="settings-switches">
                  <label>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={notifications}
                      onChange={(e) => setNotifications(e.target.checked)}
                    />
                    <span className="settings-switch" />
                    <span>
                      <strong>{t('Indicador de atividade')}</strong>
                      <small>
                        {t('Mostre o indicador no sino quando houver atividade recente.')}
                      </small>
                    </span>
                  </label>
                </div>
                <button className="settings-save" disabled={busy} type="submit">
                  <Check size={18} />
                  {t('Salvar alterações')}
                </button>
              </form>
            </>
          ) : tab === 'team' ? (
            <>
              {sectionHeading('Equipe', 'Acesso ao espaço de trabalho.', Users)}
              <div className="settings-info-block">
                <ShieldCheck />
                <div>
                  <strong>{t('Administrador')}</strong>
                  <p>
                    {t(
                      'Este espaço de trabalho usa uma conta de administrador. O gerenciamento de membros não está configurado.',
                    )}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              {sectionHeading('Faturamento', 'Informações da sua instalação.', CreditCard)}
              <div className="settings-info-block">
                <Building2 />
                <div>
                  <strong>{t('Instalação própria')}</strong>
                  <p>{t('Nenhuma assinatura ou cobrança está configurada neste aplicativo.')}</p>
                </div>
              </div>
            </>
          )}
        </section>
        <section className="settings-history-card">
          <header className="settings-history-heading">
            {sectionHeading(
              'Histórico de operação',
              'Ações recentes e registros do sistema.',
              Clock,
            )}
            <button onClick={() => history.current?.showModal()}>
              {t('Ver tudo')}
              <ArrowRight size={17} />
            </button>
          </header>
          <div className="settings-history-list">{entries()}</div>
        </section>
      </div>
      <DismissibleDialog
        ref={history}
        className="settings-history-dialog"
        aria-labelledby="settings-history-title"
      >
        <header>
          <h2 id="settings-history-title">{t('Histórico de operação')}</h2>
          <button aria-label={t('Fechar histórico')} onClick={() => history.current?.close()}>
            <X size={20} />
          </button>
        </header>
        <input
          aria-label={t('Buscar no histórico')}
          placeholder={t('Buscar no histórico')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div>{entries(true)}</div>
      </DismissibleDialog>
    </div>
  );
}

