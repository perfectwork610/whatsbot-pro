"use client";
import { useLanguage } from './language';
import { Button,Label } from './workspace-ui';
export default function AccountForm({simulation,busy,onSave}:{simulation:boolean;busy:boolean;onSave:(payload:object)=>void}){
  const {t}=useLanguage();const field='workspace-input mt-1.5 w-full';
  const idHint=t('ID numérico fornecido pela Meta. Não insira seu telefone neste campo.');
  return <form className="space-y-4" onSubmit={event=>{event.preventDefault();onSave({action:'account',...Object.fromEntries(new FormData(event.currentTarget)),testAccount:simulation});}}>
    <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-xs leading-6 text-emerald-800">{t(simulation?'Crie uma conta de teste sem IDs da Meta ou token. Nenhum WhatsApp será conectado e nenhuma mensagem real será enviada.':'Para conectar um número real, use os identificadores do painel da Meta. Seu telefone e o Phone Number ID são diferentes.')}</div>
    <Label>{t('Nome da conta')}<input name="name" required className={field} placeholder={t('Vendas principal')}/></Label>
    {simulation?<Label>{t('Telefone WhatsApp (opcional)')}<input name="displayPhone" type="tel" autoComplete="tel" placeholder="+55 11 99999-9999" className={field}/><span className="mt-2 block text-[10px] font-normal leading-5 text-slate-400">{t('Serve apenas como identificação da conta de teste. Não conecta este telefone.')}</span></Label>:<>
      <div className="grid grid-cols-2 gap-3">{[{name:'phoneId',label:'Phone Number ID'},{name:'wabaId',label:'WABA ID'}].map(item=><Label key={item.name}>{item.label}<input name={item.name} required inputMode="numeric" pattern="[0-9]+" placeholder="123456789012345" title={idHint} onInvalid={event=>event.currentTarget.setCustomValidity(event.currentTarget.validity.patternMismatch?idHint:t('Preencha o ID fornecido pela Meta.'))} onInput={event=>event.currentTarget.setCustomValidity('')} className={field}/></Label>)}</div>
      <p className="text-xs leading-6 text-slate-500">{t('Copie o Phone Number ID e o WhatsApp Business Account ID (WABA ID) em WhatsApp → Configuração da API no seu app Meta.')}</p>
      <Label>{t('Nome da variável do token')}<input name="tokenEnv" required pattern="WA_TOKEN_[A-Z0-9_]+" defaultValue="WA_TOKEN_PRIMARY" className={field}/></Label>
    </>}
    <Label>{t('Teto local de envios por 24h')}<input name="dailyLimit" type="number" required min={1} max={100000} defaultValue={250} className={field}/></Label>
    <p className="text-xs leading-5 text-slate-400">{t(simulation?'O modelo hello_world estará disponível automaticamente para testar sua primeira campanha.':'O teto local não concede capacidade de envio na Meta. Guarde o token somente no servidor, na variável indicada acima.')}</p>
    <Button disabled={busy} type="submit">{t(simulation?'Criar conta de teste':'Cadastrar conta')}</Button>
  </form>;
}
