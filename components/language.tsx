"use client";
import { createContext, useContext, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { resolveLocale, translate, type Locale } from '@/lib/i18n';
import { Check, ChevronDown, Globe2 } from 'lucide-react';
const LanguageContext = createContext<{locale:Locale;setLocale:(locale:Locale)=>void;t:(message:string)=>string}>({locale:'pt-BR',setLocale:()=>{},t:s=>s});
export function LanguageProvider({children}:{children:ReactNode}) {
  const [locale,setLocaleState] = useState<Locale>('pt-BR');
  useEffect(()=>{let saved:string|null=null;try{saved=localStorage.getItem('whatsbot.language');}catch{}setLocaleState(resolveLocale(saved,navigator.language));},[]);
  useEffect(()=>{document.documentElement.lang=locale;},[locale]);
  function setLocale(next:Locale){setLocaleState(next);try{localStorage.setItem('whatsbot.language',next);}catch{/* Language switching still works if storage is disabled. */}}
  return <LanguageContext.Provider value={{locale,setLocale,t:message=>translate(locale,message)}}>{children}</LanguageContext.Provider>;
}
export const useLanguage = () => useContext(LanguageContext);
const languages: {value:Locale;label:string;code:string}[] = [{value:'en',label:'English',code:'EN'},{value:'pt-BR',label:'Português',code:'PT'}];
export function LanguageSelector({variant='default'}:{variant?:'default'|'login'}) {
  const {locale,setLocale}=useLanguage();
  const [open,setOpen]=useState(false);
  const id=useId();
  const root=useRef<HTMLDivElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const options=useRef<(HTMLButtonElement|null)[]>([]);
  const label=locale==='en'?'Interface language':'Idioma da interface';
  useEffect(()=>{
    if(!open)return;
    options.current[languages.findIndex(language=>language.value===locale)]?.focus();
    function outside(event:PointerEvent){if(!root.current?.contains(event.target as Node))setOpen(false);}
    document.addEventListener('pointerdown',outside);
    return ()=>document.removeEventListener('pointerdown',outside);
  },[open,locale]);
  function close(){setOpen(false);trigger.current?.focus();}
  function keydown(event:KeyboardEvent<HTMLDivElement>){
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}
    const current=options.current.findIndex(option=>option===document.activeElement);
    let next:number|undefined;
    if(event.key==='ArrowDown')next=(current+1)%languages.length;
    if(event.key==='ArrowUp')next=(current-1+languages.length)%languages.length;
    if(event.key==='Home')next=0;
    if(event.key==='End')next=languages.length-1;
    if(next!==undefined){event.preventDefault();options.current[next]?.focus();}
  }
  return <div ref={root} className={`language-picker language-picker--${variant}`} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}}>
    <button ref={trigger} id={`${id}-trigger`} className="language-picker-trigger" type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open?`${id}-menu`:undefined} onClick={()=>setOpen(!open)} onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setOpen(true);}if(event.key==='Escape')close();}}>
      <Globe2 size={17}/><span>{languages.find(language=>language.value===locale)?.label}</span><ChevronDown size={15} className={open?'is-open':''}/>
    </button>
    {open&&<div id={`${id}-menu`} role="menu" aria-labelledby={`${id}-trigger`} className="language-picker-menu" onKeyDown={keydown}>
      <p className="language-picker-heading">{locale==='en'?'Select language':'Selecionar idioma'}</p>
      {languages.map((language,index)=><button key={language.value} ref={element=>{options.current[index]=element;}} className="language-picker-option" type="button" role="menuitemradio" aria-checked={language.value===locale} tabIndex={-1} onClick={()=>{setLocale(language.value);close();}}>
        <span className="language-picker-code" aria-hidden="true">{language.code}</span><span lang={language.value}>{language.label}</span>{language.value===locale&&<Check size={17} className="language-picker-check"/>}
      </button>)}
    </div>}
  </div>;
}
