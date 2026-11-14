'use client';
import DismissibleDialog from './dismissible-dialog';
import { useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  BarChart3,
  Bot,
  Eye,
  EyeOff,
  LoaderCircle,
  Send,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
  Zap,
} from 'lucide-react';
import { LanguageSelector, useLanguage } from '@/components/language';
import WhatsAppMark from '@/components/whatsapp-mark';

type Help = 'password' | 'contact';

export default function LoginForm() {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);
  const [help, setHelp] = useState<Help>('contact');
  const helpDialog = useRef<HTMLDialogElement>(null);
  function showHelp(kind: Help) {
    setHelp(kind);
    helpDialog.current?.showModal();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.get('username'),
          password: form.get('password'),
          remember: form.get('remember') === 'on',
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      window.location.replace('/');
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Não foi possível entrar. Tente novamente.',
      );
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-hero" aria-label={t('Plataforma de automação do WhatsApp')}>
        <div className="login-hero-art" aria-hidden="true" />
        <div className="login-hero-dots" aria-hidden="true" />
        <a href="/login" className="login-brand" aria-label="WhatsBot Pro">
          <WhatsAppMark variant="whatsapp" />
          <span>
            WhatsBot <strong>Pro</strong>
          </span>
        </a>
        <div className="login-hero-copy">
          <p className="login-platform-tag">{t('Plataforma de automação do WhatsApp')}</p>
          <h1>
            {t('Automatize, conecte')}
            <br />
            {t('e cresça no')}{' '}
            <span>
              WhatsApp
              <svg viewBox="0 0 220 16" preserveAspectRatio="none" aria-hidden="true">
                <path d="M2 13Q108-7 218 10Q111 3 2 13" fill="currentColor" />
              </svg>
            </span>
          </h1>
          <p className="login-hero-description">
            {t(
              'Envios em massa, respostas inteligentes, gestão de contatos e acompanhamento de campanhas — tudo em uma plataforma poderosa.',
            )}
          </p>
        </div>
        <div className="login-phone-mark" aria-hidden="true">
          <WhatsAppMark variant="whatsapp" />
        </div>
        <div className="login-art-labels" aria-hidden="true">
          <div className="login-float-card login-float-bulk">
            <Send />
            <span>{t('Envios em massa')}</span>
          </div>
          <div className="login-float-card login-float-bot">
            <Bot />
          </div>
          <div className="login-float-card login-float-reply">
            <Bot />
            <span>{t('Respostas automáticas')}</span>
          </div>
          <div className="login-float-card login-float-contacts">
            <UsersRound />
            <span>{t('Gestão de contatos')}</span>
          </div>
          <div className="login-float-card login-float-analytics">
            <BarChart3 />
            <span>{t('Análise de campanhas')}</span>
          </div>
        </div>
        <div className="login-benefits">
          <div>
            <Zap />
            <p>
              <strong>{t('Contato mais rápido')}</strong>
              <span>{t('Economize tempo, faça mais')}</span>
            </p>
          </div>
          <div>
            <ShieldCheck />
            <p>
              <strong>{t('Mais estabilidade')}</strong>
              <span>{t('Suporte à API oficial')}</span>
            </p>
          </div>
          <div>
            <BarChart3 />
            <p>
              <strong>{t('Resultados mensuráveis')}</strong>
              <span>{t('Acompanhe e otimize')}</span>
            </p>
          </div>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-topbar">
          <a href="/login" className="login-mobile-brand">
            <WhatsAppMark variant="whatsapp" />
            WhatsBot <strong>Pro</strong>
          </a>
          <LanguageSelector variant="login" />
        </div>
        <div className="login-card">
          <div className="login-app-icon">
            <WhatsAppMark variant="whatsapp" />
          </div>
          <h2>{t('Bem-vindo de volta')}</h2>
          <p className="login-card-subtitle">{t('Entre na sua conta WhatsBot Pro')}</p>
          <form onSubmit={submit} className="login-form">
            {error && (
              <p role="alert" className="login-error">
                {t(error)}
              </p>
            )}
            <div className="login-input-group">
              <label htmlFor="username">
                <UserRound />
                {t('Usuário')}
              </label>
              <input
                id="username"
                name="username"
                autoComplete="username"
                required
                maxLength={100}
                defaultValue="admin"
                disabled={busy}
              />
            </div>
            <div className="login-input-group">
              <label htmlFor="password">
                <UserRound />
                {t('Senha')}
              </label>
              <div className="login-password">
                <input
                  id="password"
                  name="password"
                  type={visible ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  maxLength={1024}
                  disabled={busy}
                />
                <button
                  type="button"
                  aria-label={t(visible ? 'Ocultar senha' : 'Mostrar senha')}
                  aria-pressed={visible}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>
            <div className="login-form-options">
              <label>
                <input type="checkbox" name="remember" defaultChecked disabled={busy} />
                <span>{t('Lembrar de mim')}</span>
              </label>
              <button type="button" onClick={() => showHelp('password')}>
                {t('Esqueceu a senha?')}
              </button>
            </div>
            <button className="login-submit" type="submit" disabled={busy}>
              {busy && <LoaderCircle className="animate-spin" size={19} />}
              <span>{t(busy ? 'Entrando…' : 'Entrar')}</span>
              {!busy && <ArrowRight size={20} />}
            </button>
          </form>
          <p className="login-contact">
            {t('Não tem uma conta?')}{' '}
            <button type="button" onClick={() => showHelp('contact')}>
              {t('Fale conosco')}
            </button>
          </p>
        </div>
      </section>
      <DismissibleDialog
        ref={helpDialog}
        className="login-help"
        aria-labelledby="login-help-title"
        aria-describedby="login-help-description"
      >
        <button
          type="button"
          className="login-help-close"
          aria-label={t('Fechar aviso')}
          onClick={() => helpDialog.current?.close()}
        >
          <X size={20} />
        </button>
        <div className="login-app-icon">
          <WhatsAppMark variant="whatsapp" />
        </div>
        <h2 id="login-help-title">
          {t(help === 'password' ? 'Recuperar acesso' : 'Solicitar uma conta')}
        </h2>
        <p id="login-help-description">
          {t(
            help === 'password'
              ? 'Para redefinir sua senha, entre em contato com o administrador responsável pela sua conta.'
              : 'Entre em contato com o administrador da sua organização para solicitar uma conta e receber suas credenciais.',
          )}
        </p>
        <button className="login-submit" type="button" onClick={() => helpDialog.current?.close()}>
          {t('Entendi')}
        </button>
      </DismissibleDialog>
    </main>
  );
}

