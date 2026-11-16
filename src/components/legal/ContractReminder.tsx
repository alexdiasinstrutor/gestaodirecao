import React, {useEffect,useState} from 'react';
import {BellRing} from 'lucide-react';
import type {Student,User} from '../../types';
import {supabase} from '../../lib/supabaseClient';
import {readContractReminder} from '../../legal/contractReminder';
import {LegalDocumentsAccess} from './LegalDocumentsAccess';

export function ContractReminder({student,user}:{student:Student;user:User}) {
 const [result,setResult]=useState<{accepted:boolean;available:boolean}|null>(null);
 const [failed,setFailed]=useState(false);
 const key=JSON.stringify([student.id,student.instrutorId,student.aulasCumpridas,student.contratosPacotes?.map(contract=>[contract.id,contract.quantidadeAulas]),user.id]);
 useEffect(()=>{
  let active=true;let running=false;let queued=false;
  setResult(null);setFailed(false);
  const refresh=async()=>{
   if(!active)return;if(running){queued=true;return;}running=true;
   try{const next=await readContractReminder(student,user);if(active){setResult(next);setFailed(false);}}
   catch{if(active){setResult(null);setFailed(true);}}
   finally{running=false;if(active&&queued){queued=false;void refresh();}}
  };
  void refresh();
  const interval=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},15000);
  const {data}=supabase.auth.onAuthStateChange(()=>{setTimeout(()=>void refresh(),0);});
  window.addEventListener('agd:legal-contract-accepted',refresh);window.addEventListener('focus',refresh);
  return()=>{active=false;clearInterval(interval);data.subscription.unsubscribe();window.removeEventListener('agd:legal-contract-accepted',refresh);window.removeEventListener('focus',refresh);};
 },[key]);
 if(result?.accepted)return null;
 return <section aria-label="Contrato pendente de aceite" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:p-5 text-amber-950 shadow-sm">
  <div className="flex items-start gap-3"><BellRing className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true"/><div className="min-w-0 space-y-2"><h2 className="font-bold text-base">Leia e confirme o aceite do seu contrato</h2>
  <p className="text-sm">Este aviso permanecerá no portal até a confirmação do seu aceite no banco.</p>
  {failed && <p role="status" className="text-sm">Não foi possível confirmar a situação do contrato. Verifique seu acesso autenticado ou solicite ajuda ao instrutor.</p>}
  {result && !result.available && <p className="text-sm">Solicite ao instrutor a disponibilização da versão do contrato para aceite.</p>}
  <LegalDocumentsAccess buttonLabel="Ler e aceitar contrato" initialDocument="CONTRATO_AULA_PRATICA" />
  </div></div>
 </section>;
}
