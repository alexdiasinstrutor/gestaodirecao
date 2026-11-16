import React from 'react';
import type { PackageOffer } from '../../types';
type Conditions = NonNullable<PackageOffer['condicoesContratuais']>;
export function ContractConditionsFields({value,onChange}:{value:Conditions;onChange:(value:Conditions)=>void}) {
 const fields: {key:keyof Conditions;label:string;min:number;max?:number}[]=[
  {key:'duracaoAulaMinutos',label:'Duração de cada aula (minutos)',min:1},
  {key:'diasAvisoExame',label:'Aviso prévio do exame (dias)',min:0},
  {key:'prazoValidadeDias',label:'Validade do pacote (dias)',min:1},
  {key:'percentualMulta',label:'Multa sobre saldo cancelado (%)',min:0,max:100}];
 return <fieldset className="border border-slate-200 rounded-xl p-4"><legend className="font-semibold px-2">Condições do pacote</legend><div className="grid sm:grid-cols-2 gap-3">{fields.map(field=><label key={field.key} className="block text-xs font-semibold">{field.label}<input type="number" aria-label={field.label} min={field.min} max={field.max} step={field.key==='percentualMulta'?'0.01':'1'} value={value[field.key] ?? ''} onChange={event=>onChange({...value,[field.key]:event.target.value===''?undefined:Number(event.target.value)})} className="block w-full border rounded-lg p-3 mt-1" /></label>)}</div></fieldset>;
}
