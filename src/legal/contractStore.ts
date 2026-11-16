import { supabase } from '../lib/supabaseClient';
export interface LegalContractVersion { id: string; student_id: string; package_contract_id: string; content: string; content_sha256: string; instructor_user_id: string; student_user_id: string; created_at: string; }
export async function loadLegalContracts(): Promise<LegalContractVersion[]> {
 const {data,error}=await supabase.from('legal_contract_versions').select('*').order('created_at',{ascending:false});
 if(error){if(error.code==='42501'||error.code==='PGRST301')throw new Error('A consulta de versões para aceite exige uma sessão Supabase Authentication vinculada ao seu cadastro. Entre pela conta autenticada ou solicite ao administrador a conferência do vínculo.');throw error;}return data || [];
}
export async function prepareLegalContract(requestId: string,studentId: string,packageId: string,variables: Record<string,string>): Promise<LegalContractVersion> {
 const {data,error}=await supabase.rpc('prepare_legal_contract',{p_request_id:requestId,p_student_id:studentId,p_package_contract_id:packageId,p_variables:variables});
 if(error)throw error;if(!data?.id)throw new Error('O banco não confirmou a versão do contrato.');return data;
}
export async function acceptLegalContract(version: LegalContractVersion,general: boolean,clauses: boolean) {
 if(!general||!clauses)throw new Error('Marque os dois aceites.');
 const {data,error}=await supabase.rpc('accept_legal_contract',{p_version_id:version.id,p_hash:version.content_sha256,p_general:general,p_clauses:clauses});
 if(error)throw error;if(!data?.id)throw new Error('O banco não confirmou o aceite.');return data;
}
