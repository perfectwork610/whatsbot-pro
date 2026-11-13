"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { resolveLocale, translate, type Locale } from '@/lib/i18n';
const LanguageContext = createContext<{locale:Locale;setLocale:(locale:Locale)=>void;t:(message:string)=>string}>({locale:'pt-BR',setLocale:()=>{},t:s=>s});
export function LanguageProvider({children}:{children:ReactNode}) {
  const [locale,setLocaleState] = useState<Locale>('pt-BR');
  useEffect(()=>{let saved:string|null=null;try{saved=localStorage.getItem('whatsbot.language');}catch{}setLocaleState(resolveLocale(saved,navigator.language));},[]);
  useEffect(()=>{document.documentElement.lang=locale;},[locale]);
  function setLocale(next:Locale){setLocaleState(next);try{localStorage.setItem('whatsbot.language',next);}catch{/* Language switching still works if storage is disabled. */}}
  return <LanguageContext.Provider value={{locale,setLocale,t:message=>translate(locale,message)}}>{children}</LanguageContext.Provider>;
}
export const useLanguage = () => useContext(LanguageContext);
export function LanguageSelector(){const {locale,setLocale}=useLanguage();return <select aria-label={locale==='en'?'Interface language':'Idioma da interface'} value={locale} onChange={e=>setLocale(e.target.value as Locale)} className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-emerald-600"><option value="en">English</option><option value="pt-BR">Português</option></select>;}
