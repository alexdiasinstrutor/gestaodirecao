import { supabase } from '../lib/supabaseClient';
import type { Student, User } from '../types';
import type { LegalContractVersion } from './contractStore';

export interface ContractAcceptanceReceipt {
 contract_version_id:string; signer_user_id:string; signer_role:string;
 content_sha256:string; accepted_general:boolean; accepted_clauses_4_5:boolean;
}
export function hasAcceptedCurrentContracts(student:Student,user:User,versions:LegalContractVersion[],receipts:ContractAcceptanceReceipt[]):boolean {
 const own=versions.filter(version=>version.student_id===student.id && version.student_user_id===user.id && version.instructor_user_id===student.instrutorId).sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));
 let consumed=Math.max(0,student.aulasCumpridas || 0);
 const active=(student.contratosPacotes || []).filter(contract=>{
  const quantity=Math.max(0,contract.quantidadeAulas || 0);
  if(consumed>=quantity){consumed-=quantity;return false;}consumed=0;return quantity>0;
 });
 const targets=active.length?active.map(contract=>own.find(version=>version.package_contract_id===contract.id)):[own[0]];
 return targets.length>0 && targets.every(version=>!!version && receipts.some(receipt=>receipt.contract_version_id===version.id && receipt.signer_user_id===user.id && receipt.signer_role==='ALUNO' && receipt.content_sha256===version.content_sha256 && receipt.accepted_general===true && receipt.accepted_clauses_4_5===true));
}
export async function readContractReminder(student:Student,user:User):Promise<{accepted:boolean;available:boolean}> {
 const versionResult=await supabase.from('legal_contract_versions').select('*').eq('template_code','CONTRATO_AULA_PRATICA').eq('student_id',student.id).eq('student_user_id',user.id).order('created_at',{ascending:false});
 if(versionResult.error)throw versionResult.error;
 const versions=(versionResult.data || []) as LegalContractVersion[];
 if(!versions.length)return {accepted:false,available:false};
 const receipts=await supabase.from('legal_acceptances').select('contract_version_id,signer_user_id,signer_role,content_sha256,accepted_general,accepted_clauses_4_5').eq('signer_user_id',user.id).eq('signer_role','ALUNO').in('contract_version_id',versions.map(version=>version.id));
 if(receipts.error)throw receipts.error;
 return {accepted:hasAcceptedCurrentContracts(student,user,versions,receipts.data || []),available:versions.some(version=>version.instructor_user_id===student.instrutorId)};
}
