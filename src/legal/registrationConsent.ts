import { supabase } from '../lib/supabaseClient';
import { legalDefaults, legalHash, renderLegalDocument } from './documents';
export interface RegistrationConsent {
  status: 'DECLARADO_NO_CADASTRO';
  acceptedAt: string;
  userAgent: string;
  documents: {code: string; version: string; content: string; sha256: string}[];
  packageOffer?: {id: string; instructorId: string; name: string; lessons: number; totalCents: number};
  packageOfferSha256?: string;
  acceptedPackage: boolean;
  acceptedClauses4And5: boolean;
}
export async function registrationConsent(terms: boolean, packageOffer?: RegistrationConsent['packageOffer'], acceptedPackage=false, acceptedClauses=false): Promise<RegistrationConsent> {
  if(!terms)throw new Error('Leia e aceite os termos e a política de privacidade.');
  if(packageOffer && (!acceptedPackage || !acceptedClauses))throw new Error('Aceite o pacote escolhido e as cláusulas de cancelamento e exame.');
  const storage = await supabase.from('users').select('id,registration_legal_consent').limit(0);
  if(storage.error)throw new Error('O armazenamento dos aceites precisa ser atualizado no banco antes de concluir o cadastro.');
  const documents=await Promise.all(['TERMOS_DE_USO','POLITICA_PRIVACIDADE_LGPD'].map(async code=>{
    const document=renderLegalDocument(code,legalDefaults(null));
    if(document.missing.length)throw new Error('Dados da provedora incompletos nos documentos.');
    return {code,version:document.definition.versao,content:document.content,sha256:await legalHash(document.content)};
  }));
  return {status:'DECLARADO_NO_CADASTRO',acceptedAt:new Date().toISOString(),userAgent:navigator.userAgent,documents,packageOffer,packageOfferSha256:packageOffer ? await legalHash(JSON.stringify(packageOffer)) : undefined,acceptedPackage,acceptedClauses4And5:acceptedClauses};
}
