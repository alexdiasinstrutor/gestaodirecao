import { supabase } from '../lib/supabaseClient';
import { supabaseAdapter } from '../lib/supabaseAdapter';
import { legalHash } from './documents';
import type { AuditLog, User } from '../types';

export interface LegalContractVersion {
  template_version?: string;
  template_code?: string;
  id: string;
  student_id: string;
  package_contract_id: string;
  package_contract_ids?: string[];
  content: string;
  content_sha256: string;
  instructor_user_id: string;
  student_user_id: string;
  created_at: string;
}

export interface LegalAcceptanceRecord {
  id: string;
  contract_version_id: string;
  student_id: string;
  organization_id: string;
  package_contract_ids: string[];
  signer_user_id: string;
  signer_role: 'INSTRUTOR' | 'ALUNO' | 'ADMIN_ORG' | 'SUPER_ADMIN';
  accepted_general: boolean;
  accepted_clauses_4_5: boolean;
  content_sha256: string;
  accepted_at: string;
  user_agent?: string;
}

const LOCAL_VERSIONS_KEY = 'agd_legal_contract_versions_v1';
const LOCAL_ACCEPTANCES_KEY = 'agd_legal_acceptances_v1';

function readLocalList<T>(key: string): T[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocalList<T>(key: string, items: T[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // ignore storage quota errors
  }
}

function mergeById<T extends { id: string }>(...lists: T[][]): T[] {
  const map = new Map<string, T>();
  for (const list of lists) {
    for (const item of list) {
      if (item && item.id) map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

export async function loadLegalContracts(): Promise<LegalContractVersion[]> {
  const local = readLocalList<LegalContractVersion>(LOCAL_VERSIONS_KEY);
  let remoteVersions: LegalContractVersion[] = [];
  let remoteAuditVersions: LegalContractVersion[] = [];

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session) {
      const { data } = await supabase
        .from('legal_contract_versions')
        .select('*')
        .order('created_at', { ascending: false });
      if (Array.isArray(data)) remoteVersions = data as LegalContractVersion[];
    }
  } catch {
    // fallback silencioso para audit_logs + localStorage
  }

  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entidade', 'LegalContractVersion')
      .order('timestamp', { ascending: false })
      .limit(200);
    if (!error && Array.isArray(data)) {
      remoteAuditVersions = data
        .map((row: any) => {
          try {
            return JSON.parse(row.detalhes) as LegalContractVersion;
          } catch {
            return null;
          }
        })
        .filter((item): item is LegalContractVersion => Boolean(item && item.id));
    }
  } catch {
    // offline fallback
  }

  const merged = mergeById(local, remoteAuditVersions, remoteVersions).sort((a, b) =>
    (b.created_at || '').localeCompare(a.created_at || '')
  );
  writeLocalList(LOCAL_VERSIONS_KEY, merged);
  return merged;
}

export async function loadLegalAcceptances(studentId?: string, signerUserId?: string): Promise<LegalAcceptanceRecord[]> {
  const local = readLocalList<LegalAcceptanceRecord>(LOCAL_ACCEPTANCES_KEY);
  let remoteAcceptances: LegalAcceptanceRecord[] = [];
  let remoteAuditAcceptances: LegalAcceptanceRecord[] = [];

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session) {
      let query = supabase
        .from('legal_acceptances')
        .select('id, contract_version_id, signer_user_id, signer_role, accepted_general, accepted_clauses_4_5, content_sha256, accepted_at');
      if (signerUserId) query = query.eq('signer_user_id', signerUserId);
      const { data } = await query;
      if (Array.isArray(data)) {
        remoteAcceptances = data.map((row: any) => ({
          ...row,
          student_id: studentId || '',
          organization_id: '',
          package_contract_ids: []
        })) as LegalAcceptanceRecord[];
      }
    }
  } catch {
    // fallback silencioso
  }

  try {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('entidade', 'LegalContractAcceptance')
      .order('timestamp', { ascending: false })
      .limit(200);
    if (studentId) {
      query = query.eq('entidade_id', studentId);
    }
    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      remoteAuditAcceptances = data
        .map((row: any) => {
          try {
            return JSON.parse(row.detalhes) as LegalAcceptanceRecord;
          } catch {
            return null;
          }
        })
        .filter((item): item is LegalAcceptanceRecord => Boolean(item && item.id));
    }
  } catch {
    // offline fallback
  }

  const merged = mergeById(local, remoteAuditAcceptances, remoteAcceptances).sort((a, b) =>
    (b.accepted_at || '').localeCompare(a.accepted_at || '')
  );
  writeLocalList(LOCAL_ACCEPTANCES_KEY, merged);

  return merged.filter((item) => {
    if (studentId && item.student_id && item.student_id !== studentId) return false;
    if (signerUserId && item.signer_user_id !== signerUserId) return false;
    return true;
  });
}

export async function prepareLegalContract(
  requestId: string,
  studentId: string,
  packageId: string,
  variables: Record<string, string>
): Promise<LegalContractVersion> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData?.session) {
    const { data, error } = await supabase.rpc('prepare_legal_contract', {
      p_request_id: requestId,
      p_student_id: studentId,
      p_package_contract_id: packageId,
      p_variables: variables
    });
    if (!error && data?.id) {
      return data as LegalContractVersion;
    }
  }
  throw new Error('Use registerAndAcceptLegalContract para registro direto.');
}

export async function acceptLegalContract(
  version: LegalContractVersion,
  general: boolean,
  clauses: boolean
) {
  if (!general || !clauses) throw new Error('Marque os dois aceites obrigatórios.');
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData?.session) {
    const { data, error } = await supabase.rpc('accept_legal_contract', {
      p_version_id: version.id,
      p_hash: version.content_sha256,
      p_general: general,
      p_clauses: clauses
    });
    if (!error && data?.id) {
      return data;
    }
  }
  throw new Error('Sessão Supabase Auth ausente. Utilize registerAndAcceptLegalContract.');
}

/**
 * Registra a versão do contrato e confirma o aceite eletrônico no banco (Local + Supabase),
 * funcionando tanto com sessão Supabase Auth quanto com login próprio da plataforma.
 */
export async function registerAndAcceptLegalContract(params: {
  actor: User;
  organizationId: string;
  studentId: string;
  instructorUserId: string;
  studentUserId: string;
  packageContractIds: string[];
  content: string;
  templateVersion?: string;
  generalAccepted: boolean;
  clausesAccepted: boolean;
}): Promise<{ version: LegalContractVersion; receipt: LegalAcceptanceRecord }> {
  if (!params.generalAccepted || !params.clausesAccepted) {
    throw new Error('É necessário marcar os dois termos de aceite antes de confirmar.');
  }

  const now = new Date().toISOString();
  const sha256 = await legalHash(params.content);
  const primaryPackageId = params.packageContractIds[0] || `cnt_${params.studentId}`;

  const version: LegalContractVersion = {
    id: `lcv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    template_code: 'CONTRATO_AULA_PRATICA',
    template_version: params.templateVersion || '1.0.1',
    student_id: params.studentId,
    package_contract_id: primaryPackageId,
    package_contract_ids: params.packageContractIds,
    content: params.content,
    content_sha256: sha256,
    instructor_user_id: params.instructorUserId,
    student_user_id: params.studentUserId,
    created_at: now
  };

  const signerRole: LegalAcceptanceRecord['signer_role'] =
    params.actor.papel === 'ALUNO'
      ? 'ALUNO'
      : params.actor.papel === 'INSTRUTOR' || params.actor.papel === 'ADMIN_ORG'
      ? 'INSTRUTOR'
      : 'SUPER_ADMIN';

  const receipt: LegalAcceptanceRecord = {
    id: `acc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    contract_version_id: version.id,
    student_id: params.studentId,
    organization_id: params.organizationId,
    package_contract_ids: params.packageContractIds,
    signer_user_id: params.actor.id,
    signer_role: signerRole,
    accepted_general: true,
    accepted_clauses_4_5: true,
    content_sha256: sha256,
    accepted_at: now,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : 'node-test'
  };

  // 1. Salva no localStorage
  const versions = readLocalList<LegalContractVersion>(LOCAL_VERSIONS_KEY);
  writeLocalList(LOCAL_VERSIONS_KEY, [version, ...versions]);

  const acceptances = readLocalList<LegalAcceptanceRecord>(LOCAL_ACCEPTANCES_KEY);
  writeLocalList(LOCAL_ACCEPTANCES_KEY, [receipt, ...acceptances]);

  // 2. Grava no Supabase (tabela audit_logs para acesso universal sem bloqueio de auth.uid)
  const versionLog: AuditLog = {
    id: version.id,
    organizacaoId: params.organizationId,
    usuarioId: params.actor.id,
    usuarioNome: params.actor.nome,
    acao: 'CONTRATO_VERSAO_REGISTRADA',
    entidade: 'LegalContractVersion',
    entidadeId: params.studentId,
    detalhes: JSON.stringify(version),
    timestamp: now
  };

  const acceptanceLog: AuditLog = {
    id: receipt.id,
    organizacaoId: params.organizationId,
    usuarioId: params.actor.id,
    usuarioNome: params.actor.nome,
    acao: 'ACEITE_CONTRATO_PRATICO',
    entidade: 'LegalContractAcceptance',
    entidadeId: params.studentId,
    detalhes: JSON.stringify(receipt),
    timestamp: now
  };

  if (supabaseAdapter.enabled) {
    await Promise.all([
      supabaseAdapter.addAuditLog(versionLog).catch(console.error),
      supabaseAdapter.addAuditLog(acceptanceLog).catch(console.error)
    ]);
  }

  return { version, receipt };
}
