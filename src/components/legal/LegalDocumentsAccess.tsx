import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, Package, ShieldCheck, FileText } from 'lucide-react';
import { downloadLegalFile, legalDocumentPdf } from '../../legal/documentExport';
import { resolveStudentPackages } from '../../legal/legacyPackages';
import { resolveStudentIdentity } from '../../legal/studentIdentity';
import { supabaseAdapter } from '../../lib/supabaseAdapter';
import { db } from '../../lib/storage';
import { formatCurrencyBRL } from '../../lib/validation';
import type { Student, User, PackageOffer, StudentPackageContract } from '../../types';
import { LegalDocument } from './LegalDocument';
import {
  loadLegalAcceptances,
  registerAndAcceptLegalContract,
  type LegalAcceptanceRecord
} from '../../legal/contractStore';
import {
  legalDefaults,
  legalContractValuesMulti,
  legalDocuments,
  legalHash,
  renderLegalDocument
} from '../../legal/documents';

export function LegalDocumentsAccess({
  buttonLabel = 'Termos, privacidade e contratos',
  initialDocument = 'TERMOS_DE_USO'
}: {
  buttonLabel?: string;
  initialDocument?: string;
} = {}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(initialDocument);
  const [values, setValues] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [general, setGeneral] = useState(false);
  const [clauses, setClauses] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [acceptedReceipt, setAcceptedReceipt] = useState<LegalAcceptanceRecord | null>(null);

  const dialog = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  const currentUser = open ? db.getCurrentUser() : null;
  const students =
    currentUser && ['INSTRUTOR', 'ADMIN_ORG'].includes(currentUser.papel)
      ? db.getStudents(currentUser.organizacaoId, currentUser.id)
      : [];

  const [studentId, setStudentId] = useState('');
  const [source, setSource] = useState<{
    student: Student;
    instructor: User | null;
    studentUser?: User;
    contracts: StudentPackageContract[];
    packages: PackageOffer[];
  } | null>(null);

  const rendered = useMemo(() => renderLegalDocument(code, values), [code, values]);

  // Gerenciamento de foco e teclado (ESC / Tab) no modal
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key !== 'Tab') return;
      const controls = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>('button, input, select, [tabindex="0"]') || []
      );
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keydown);
      previous?.focus();
    };
  }, [open]);

  // Carrega dados de um aluno específico (para Instrutor/Admin)
  const loadForStudent = async (targetStudentId: string, actor: User) => {
    setBusy(true);
    setNotice('');
    setAcceptedReceipt(null);
    setGeneral(false);
    setClauses(false);

    try {
      const orgId = actor.organizacaoId;
      const [remoteUsers, remoteStudents, remotePackages, remoteAccounts] = supabaseAdapter.enabled
        ? await Promise.all([
          supabaseAdapter.getUsers().catch(() => []),
          supabaseAdapter.getStudents(orgId).catch(() => []),
          supabaseAdapter.getPackages(orgId).catch(() => []),
          supabaseAdapter.getAccountsReceivable(orgId).catch(() => [])
        ])
        : [[], [], [], []];

      const users = remoteUsers.length ? remoteUsers : db.getUsers();
      const allStudents = remoteStudents.length ? remoteStudents : db.getStudents(orgId);
      const packages = remotePackages.length ? remotePackages : db.getPackages(orgId);
      const accounts = remoteAccounts.length ? remoteAccounts : db.getAccountsReceivable(orgId);

      const candidate =
        allStudents.find((item) => item.id === targetStudentId) ||
        db.getStudents(orgId).find((item) => item.id === targetStudentId);

      if (!candidate) {
        throw new Error('Aluno não encontrado no cadastro.');
      }

      const resolved = resolveStudentPackages(candidate, packages, accounts);
      const activeContracts = resolved.contracts.filter((c) => !c.status || c.status === 'ATIVO');
      const studentWithContracts: Student = {
        ...candidate,
        contratosPacotes: resolved.contracts
      };

      const relatedUsers = users.filter((u) => u.organizacaoId === candidate.organizacaoId);
      const instructor = relatedUsers.find((u) => u.id === candidate.instrutorId) || actor;
      const studentUser = relatedUsers.find(
        (u) =>
          u.papel === 'ALUNO' &&
          ((!!candidate.cpfFingerprint && u.cpfFingerprint === candidate.cpfFingerprint) ||
            (!!candidate.email && u.email.toLowerCase() === candidate.email.toLowerCase()))
      );

      setSource({
        student: studentWithContracts,
        instructor,
        studentUser,
        contracts: activeContracts.length > 0 ? activeContracts : resolved.contracts,
        packages
      });

      const contractVals = legalContractValuesMulti(
        instructor,
        studentWithContracts,
        studentUser,
        resolved.contracts,
        packages
      );
      setValues(contractVals);

      const acceptances = await loadLegalAcceptances(studentWithContracts.id, actor.id);
      const existing = acceptances.find((a) => a.accepted_general && a.accepted_clauses_4_5) || null;
      setAcceptedReceipt(existing);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível carregar os dados do contrato.');
    } finally {
      setBusy(false);
    }
  };

  // Auto-carregamento ao abrir o modal no Contrato de Aulas Práticas
  useEffect(() => {
    if (!open || !currentUser) return;

    if (code !== 'CONTRATO_AULA_PRATICA') {
      setValues(legalDefaults(currentUser));
      setNotice('');
      return;
    }

    // Se for ALUNO: carrega automaticamente seus próprios dados e todos os seus planos
    if (currentUser.papel === 'ALUNO') {
      let active = true;
      setBusy(true);
      setNotice('');
      setSource(null);
      setAcceptedReceipt(null);
      setGeneral(false);
      setClauses(false);

      const loadStudentSelf = async () => {
        try {
          const orgId = currentUser.organizacaoId;
          const [remoteUsers, remoteStudents, remotePackages, remoteAccounts] = supabaseAdapter.enabled
            ? await Promise.all([
              supabaseAdapter.getUsers().catch(() => []),
              supabaseAdapter.getStudents(orgId).catch(() => []),
              supabaseAdapter.getPackages(orgId).catch(() => []),
              supabaseAdapter.getAccountsReceivable(orgId).catch(() => [])
            ])
            : [[], [], [], []];

          if (!active) return;

          const users = remoteUsers.length ? remoteUsers : db.getUsers();
          const allStudents = remoteStudents.length ? remoteStudents : db.getStudents(orgId);
          const packages = remotePackages.length ? remotePackages : db.getPackages(orgId);
          const accounts = remoteAccounts.length ? remoteAccounts : db.getAccountsReceivable(orgId);

          const matchedStudent =
            resolveStudentIdentity(allStudents, currentUser) ||
            allStudents.find((s) => s.email?.toLowerCase() === currentUser.email.toLowerCase());

          if (!matchedStudent) {
            throw new Error('Não foi possível localizar sua matrícula vinculada. Solicite ao instrutor a conferência do seu cadastro.');
          }

          const resolved = resolveStudentPackages(matchedStudent, packages, accounts);
          const activeContracts = resolved.contracts.filter((c) => !c.status || c.status === 'ATIVO');
          const studentWithContracts: Student = {
            ...matchedStudent,
            contratosPacotes: resolved.contracts
          };

          const relatedUsers = users.filter((u) => u.organizacaoId === orgId);
          const instructor = relatedUsers.find((u) => u.id === matchedStudent.instrutorId) || null;
          const account = relatedUsers.find((u) => u.id === currentUser.id) || currentUser;

          setStudentId(studentWithContracts.id);
          setSource({
            student: studentWithContracts,
            instructor,
            studentUser: account,
            contracts: activeContracts.length > 0 ? activeContracts : resolved.contracts,
            packages
          });

          setValues(
            legalContractValuesMulti(
              instructor,
              studentWithContracts,
              account,
              resolved.contracts,
              packages
            )
          );

          const acceptances = await loadLegalAcceptances(studentWithContracts.id, currentUser.id);
          if (!active) return;
          const existing = acceptances.find((a) => a.accepted_general && a.accepted_clauses_4_5) || null;
          setAcceptedReceipt(existing);
        } catch (error) {
          if (active) {
            setNotice(error instanceof Error ? error.message : 'Não foi possível carregar os dados do contrato.');
          }
        } finally {
          if (active) setBusy(false);
        }
      };

      void loadStudentSelf();
      return () => {
        active = false;
      };
    }

    // Se for INSTRUTOR / ADMIN_ORG: auto-seleciona o primeiro aluno caso nenhum esteja selecionado
    if (['INSTRUTOR', 'ADMIN_ORG'].includes(currentUser.papel) && students.length > 0) {
      const targetId = studentId && students.some((s) => s.id === studentId) ? studentId : students[0].id;
      setStudentId(targetId);
      void loadForStudent(targetId, currentUser);
    }
  }, [open, code, currentUser?.id, currentUser?.papel]);

  const show = () => {
    setValues(legalDefaults(null));
    setSource(null);
    setStudentId('');
    setAcceptedReceipt(null);
    setGeneral(false);
    setClauses(false);
    setNotice('');
    setCode(initialDocument);
    setOpen(true);
  };

  const handleConfirmAcceptance = async () => {
    if (!currentUser || !source?.student) return;
    if (!general || !clauses) {
      setNotice('Marque as duas caixas de concordância antes de confirmar o aceite.');
      return;
    }

    setBusy(true);
    setNotice('');
    try {
      const contractIds =
        source.contracts.length > 0
          ? source.contracts.map((c) => c.id)
          : [`cnt_${source.student.id}`];

      const { receipt } = await registerAndAcceptLegalContract({
        actor: currentUser,
        organizationId: source.student.organizacaoId,
        studentId: source.student.id,
        instructorUserId: source.student.instrutorId,
        studentUserId: source.studentUser?.id || currentUser.id,
        packageContractIds: contractIds,
        content: rendered.content,
        templateVersion: rendered.definition.versao,
        generalAccepted: general,
        clausesAccepted: clauses
      });

      setAcceptedReceipt(receipt);
      window.dispatchEvent(new Event('agd:legal-contract-accepted'));
      setNotice(
        `Aceite confirmado e registrado no banco em ${new Date(receipt.accepted_at).toLocaleString('pt-BR')}! Comprovante: ${receipt.id}`
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Erro ao registrar o aceite no banco.');
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = async () => {
    setExporting(true);
    try {
      downloadLegalFile(
        legalDocumentPdf(rendered.content, rendered.definition.versao, !!acceptedReceipt),
        `${code.toLowerCase()}-gestao-ad.pdf`
      );
      setNotice('Download do PDF iniciado. Confira os downloads do navegador.');
    } catch {
      setNotice('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setExporting(false);
    }
  };

  const downloadJson = async () => {
    try {
      const snapshot = {
        codigo: code,
        versao: rendered.definition.versao,
        status: acceptedReceipt ? 'ACEITO_E_REGISTRADO' : 'MINUTA_CONFERENCIA',
        comprovanteAceite: acceptedReceipt || null,
        geradoEm: new Date().toISOString(),
        pendenciasCadastro: rendered.missingLabels,
        conteudo: rendered.content,
        sha256: await legalHash(rendered.content)
      };
      downloadLegalFile(
        new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json;charset=utf-8' }),
        `${code.toLowerCase()}-gestao-ad.json`
      );
      setNotice('Documento exportado com conteúdo e hash SHA-256.');
    } catch {
      setNotice('Não foi possível exportar o arquivo JSON.');
    }
  };

  const canShowAcceptance =
    code === 'CONTRATO_AULA_PRATICA' && !!currentUser && !!source?.student;

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={show}
        className="min-h-11 rounded-lg px-3 py-2 text-xs font-semibold underline underline-offset-4 cursor-pointer"
      >
        {buttonLabel}
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[1100] bg-slate-950/70 p-2 sm:p-4 flex items-center justify-center">
            <div
              ref={dialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="bg-white text-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl grid grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden"
              style={{ height: 'min(840px, calc(100dvh - 20px))' }}
            >
              {/* Cabeçalho */}
              <header className="legal-reader-header p-4 border-b bg-slate-900 text-white flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-5 h-5 text-blue-400 shrink-0" />
                  <h2 id={titleId} className="text-base sm:text-lg font-bold">
                    Documentos Jurídicos & Contratos
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fechar documentos jurídicos"
                  className="min-h-10 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Fechar
                </button>
              </header>

              {/* Corpo Rolável */}
              <main className="legal-reader-body overflow-y-auto min-h-0 p-4 sm:p-5 space-y-4">
                {/* Seletor de Documento e (se Instrutor) Seletor de Aluno */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-xs font-bold text-slate-700">
                    Documento
                    <select
                      aria-label="Documento jurídico"
                      value={code}
                      onChange={(event) => {
                        setCode(event.target.value);
                        setAcceptedReceipt(null);
                        setGeneral(false);
                        setClauses(false);
                        setNotice('');
                      }}
                      className="block w-full border border-slate-300 rounded-xl p-2.5 mt-1 text-xs font-semibold bg-white"
                    >
                      <option value="TERMOS_DE_USO">Termos de uso</option>
                      <option value="POLITICA_PRIVACIDADE_LGPD">Política de privacidade</option>
                      <option value="CONTRATO_AULA_PRATICA">Contrato de aulas práticas</option>
                    </select>
                  </label>

                  {code === 'CONTRATO_AULA_PRATICA' && students.length > 0 && currentUser && (
                    <label className="block text-xs font-bold text-slate-700">
                      Aluno vinculado
                      <select
                        aria-label="Aluno do contrato"
                        disabled={busy}
                        value={studentId}
                        onChange={(event) => {
                          setStudentId(event.target.value);
                          void loadForStudent(event.target.value, currentUser);
                        }}
                        className="block w-full border border-slate-300 rounded-xl p-2.5 mt-1 text-xs font-semibold bg-white"
                      >
                        <option value="" disabled>
                          Selecione o aluno
                        </option>
                        {students.map((student) => (
                          <option key={student.id} value={student.id}>
                            {student.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>

                {/* Resumo dos Planos Contratados (1 ou múltiplos planos listados) */}
                {code === 'CONTRATO_AULA_PRATICA' && source?.student && (
                  <section className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>
                          {source.contracts.length > 1
                            ? `Planos Contratados Incluídos neste Contrato (${source.contracts.length})`
                            : 'Plano Contratado neste Contrato'}
                        </span>
                      </span>
                      <span className="text-[11px] font-mono text-blue-800 font-bold">
                        Total: {values.QTD_AULAS || 0} aula(s) · R$ {values.VALOR_TOTAL || '0,00'}
                      </span>
                    </div>

                    {source.contracts.length > 0 ? (
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {source.contracts.map((c, idx) => (
                          <li
                            key={c.id}
                            className="bg-white border border-blue-200 rounded-lg px-3 py-2 text-xs flex items-center justify-between gap-2"
                          >
                            <span className="font-semibold text-slate-900 truncate">
                              {idx + 1}. {c.nome} ({c.quantidadeAulas} aulas)
                            </span>
                            <span className="font-mono font-bold text-blue-700 shrink-0">
                              {formatCurrencyBRL(c.valorCentavos || 0)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-blue-900">
                        {source.student.pacoteNome || `Pacote CNH ${source.student.categoriaCnh}`} ·{' '}
                        {source.student.totalAulasContratadas} aula(s)
                      </p>
                    )}
                  </section>
                )}

                {/* Notificação NÃO-BLOQUEANTE de Dados Faltantes no Cadastro */}
                {rendered.missingLabels.length > 0 && (
                  <section
                    role="status"
                    className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950 space-y-1.5"
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">
                          Notificação de Cadastro Incompleto (não impede o aceite do contrato)
                        </p>
                        <p className="text-amber-900 mt-0.5">
                          Alguns dados cadastrais do aluno ou do instrutor ainda não foram preenchidos. Você pode
                          conferir e aceitar o contrato normalmente agora e completar o cadastro depois:
                        </p>
                      </div>
                    </div>
                    <ul className="list-disc pl-7 text-[11px] text-amber-900 grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                      {rendered.missingLabels.map((label) => (
                        <li key={label}>{label}</li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Documento Renderizado */}
                {busy && code === 'CONTRATO_AULA_PRATICA' && !source ? (
                  <p role="status" className="rounded-xl border bg-slate-50 p-6 text-center text-xs font-medium text-slate-600">
                    Carregando os dados do contrato e planos contratados...
                  </p>
                ) : (
                  <LegalDocument content={rendered.content} />
                )}

                {/* Bloco de Aceite Eletrônico — Sempre disponível para o contrato */}
                {canShowAcceptance && (
                  <section
                    aria-label="Confirmação de Aceite do Contrato"
                    className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/40 p-4 space-y-3"
                  >
                    {acceptedReceipt ? (
                      <div className="flex items-start gap-3 text-emerald-950">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="space-y-1 text-xs">
                          <h3 className="font-extrabold text-sm text-emerald-900 flex items-center gap-1.5">
                            <span>Aceite Eletrônico Confirmado e Gravado no Banco</span>
                          </h3>
                          <p>
                            Aceito em{' '}
                            <strong>{new Date(acceptedReceipt.accepted_at).toLocaleString('pt-BR')}</strong> ·
                            Comprovante: <code className="font-mono">{acceptedReceipt.id}</code>
                          </p>
                          <p className="text-[11px] text-emerald-800 font-mono break-all">
                            SHA-256: {acceptedReceipt.content_sha256}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                          <h3 className="text-sm font-extrabold text-slate-900">
                            Aceite Eletrônico do Contrato
                          </h3>
                        </div>

                        <label className="flex items-start gap-2.5 text-xs text-slate-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={general}
                            onChange={(event) => setGeneral(event.target.checked)}
                            className="mt-0.5 rounded text-emerald-600"
                          />
                          <span>
                            Li e concordo integralmente com os termos do Contrato de Prestação de Serviços acima.
                          </span>
                        </label>

                        <label className="flex items-start gap-2.5 text-xs text-amber-950 border border-amber-300 bg-amber-50 rounded-xl p-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={clauses}
                            onChange={(event) => setClauses(event.target.checked)}
                            className="mt-0.5 rounded text-amber-600"
                          />
                          <span>{legalDocuments[0].checkboxes_obrigatorios?.[1]}</span>
                        </label>

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                          <span className="text-[11px] text-slate-500">
                            O aceite será registrado no banco de dados com data, hora e hash SHA-256.
                          </span>
                          <button
                            type="button"
                            disabled={busy || !general || !clauses}
                            onClick={handleConfirmAcceptance}
                            className="min-h-11 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer transition-all flex items-center gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{busy ? 'Registrando aceite...' : 'Confirmar meu aceite'}</span>
                          </button>
                        </div>
                      </>
                    )}
                  </section>
                )}
              </main>

              {/* Rodapé */}
              <footer className="legal-reader-footer p-3 border-t bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <p role="status" className="text-xs text-slate-600 flex-1 min-w-0 font-medium">
                  {notice || 'Confira o contrato e confirme o aceite eletrônico acima.'}
                </p>
                <div className="legal-export-actions flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={downloadJson}
                    className="min-h-10 rounded-xl px-3 py-2 border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                  >
                    Exportar dados (JSON)
                  </button>
                  <button
                    type="button"
                    onClick={downloadPdf}
                    disabled={exporting}
                    className="min-h-10 rounded-xl px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                  >
                    {exporting ? 'Gerando PDF…' : 'Exportar minuta (PDF)'}
                  </button>
                </div>
              </footer>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
