import type { Student, User } from '../types';
import { loadLegalAcceptances, loadLegalContracts, type LegalAcceptanceRecord, type LegalContractVersion } from './contractStore';

export interface ContractAcceptanceReceipt {
  contract_version_id: string;
  signer_user_id: string;
  signer_role: string;
  content_sha256: string;
  accepted_general: boolean;
  accepted_clauses_4_5: boolean;
}

export function hasAcceptedCurrentContracts(
  student: Student,
  user: User,
  versions: LegalContractVersion[],
  receipts: (ContractAcceptanceReceipt | LegalAcceptanceRecord)[]
): boolean {
  const validReceipts = receipts.filter(
    (r) =>
      r.signer_user_id === user.id &&
      r.accepted_general === true &&
      r.accepted_clauses_4_5 === true
  );
  if (validReceipts.length === 0) return false;

  // Verifica se existe aceite direto para este aluno e seus contratos ativos
  const activeContracts = (student.contratosPacotes || []).filter(
    (c) => (!c.status || c.status === 'ATIVO') && (c.quantidadeAulas || 0) > 0
  );
  const directAcceptance = validReceipts.some((r) => {
    const rec = r as LegalAcceptanceRecord;
    if (rec.student_id && rec.student_id !== student.id) return false;
    if (activeContracts.length > 0 && Array.isArray(rec.package_contract_ids) && rec.package_contract_ids.length > 0) {
      return activeContracts.every((c) => rec.package_contract_ids.includes(c.id));
    }
    return true;
  });
  if (directAcceptance) return true;

  // Fallback para versões legadas em legal_contract_versions
  const own = versions
    .filter((v) => v.student_id === student.id && v.student_user_id === user.id && v.instructor_user_id === student.instrutorId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));

  if (!own.length) return false;
  return own.some((v) =>
    validReceipts.some((r) => r.contract_version_id === v.id && r.content_sha256 === v.content_sha256)
  );
}

export async function readContractReminder(student: Student, user: User): Promise<{ accepted: boolean; available: boolean }> {
  const [versions, acceptances] = await Promise.all([
    loadLegalContracts(),
    loadLegalAcceptances(student.id, user.id)
  ]);

  const accepted = hasAcceptedCurrentContracts(student, user, versions, acceptances);
  return {
    accepted,
    available: true
  };
}
