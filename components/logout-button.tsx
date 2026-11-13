"use client";
import { useState } from 'react';
import { LoaderCircle, LogOut } from 'lucide-react';
import { useLanguage } from '@/components/language';
export default function LogoutButton() {
  const {t}=useLanguage();const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function logout(){setBusy(true);setError('');try{const response=await fetch('/api/auth/logout',{method:'POST'});if(!response.ok)throw new Error();window.location.replace('/login');}catch{setError('Não foi possível sair. Tente novamente.');setBusy(false);}}
  return <div><button type="button" title={t('Sair')} aria-label={t('Sair')} disabled={busy} onClick={logout} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50">{busy?<LoaderCircle className="animate-spin" size={16}/>:<LogOut size={16}/>}<span className="hidden sm:inline">{t('Sair')}</span></button>{error&&<p role="alert" className="absolute right-5 top-20 rounded-lg bg-red-50 p-3 text-xs text-red-700">{t(error)}</p>}</div>;
}
