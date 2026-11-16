import React from 'react';
import {legalDefaults,renderLegalDocument} from '../../legal/documents';
export function RegistrationTerms({accepted,onChange}:{accepted:boolean;onChange:(accepted:boolean)=>void}) {
 return <section className="border border-slate-200 rounded-xl p-3 space-y-3 text-slate-700">
  {['TERMOS_DE_USO','POLITICA_PRIVACIDADE_LGPD'].map(code=><details key={code}><summary className="font-semibold cursor-pointer py-2">{code==='TERMOS_DE_USO'?'Ler Termos de Uso':'Ler Política de Privacidade'}</summary><pre className="font-sans text-xs leading-6 whitespace-pre-wrap break-words max-h-64 overflow-y-auto border rounded-lg p-3" tabIndex={0}>{renderLegalDocument(code,legalDefaults(null)).content}</pre></details>)}
  <label className="flex items-start gap-2 text-xs"><input type="checkbox" required checked={accepted} onChange={event=>onChange(event.target.checked)} className="mt-1 shrink-0" />Li e aceito os Termos de Uso e a Política de Privacidade da plataforma.</label>
 </section>;
}
