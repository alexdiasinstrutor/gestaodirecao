import React, { useState, useMemo } from 'react';
import {
  X,
  Package,
  Plus,
  Car,
  Settings,
  Calendar,
  DollarSign,
  FileText,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Receipt
} from 'lucide-react';
import { db } from '../../lib/storage';
import { formatCurrencyBRL } from '../../lib/validation';
import type {
  Student,
  User,
  Organization,
  PackageOffer,
  CnhCategory,
  StudentContractType,
  StudentPackageContract,
  AccountReceivable
} from '../../types';
import { CNH_CATEGORIES } from '../../types';

interface AddStudentPackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  currentUser: User;
  currentOrg?: Organization;
  initialTab?: ModalTab;
  onSuccess: (updatedStudent: Student, newContract: StudentPackageContract, newAccount?: AccountReceivable) => void;
  onRequestReceipt?: (contract: StudentPackageContract, student: Student) => void;
}

export type ModalTab = 'CATALOG_PACKAGE' | 'SINGLE_CLASSES' | 'CUSTOM_PACKAGE';

export const AddStudentPackageModal: React.FC<AddStudentPackageModalProps> = ({
  isOpen,
  onClose,
  student,
  currentUser,
  currentOrg,
  initialTab = 'CATALOG_PACKAGE',
  onSuccess,
  onRequestReceipt
}) => {
  if (!isOpen || !student) return null;

  const [activeTab, setActiveTab] = useState<ModalTab>(initialTab);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [createdResult, setCreatedResult] = useState<{
    contract: StudentPackageContract;
    student: Student;
    account?: AccountReceivable;
  } | null>(null);

  // ─── 1. Estado: Pacote do Catálogo ───────────────────────────────────────────
  const orgId = currentOrg?.id || currentUser?.organizacaoId || student?.organizacaoId || 'org_direcao_certa_01';

  const instructorPackages = useMemo<PackageOffer[]>(() => {
    try {
      const all = db.getPackageOffers(orgId);
      return (all || []).filter((pkg) => {
        const matchOwner =
          !pkg.instrutorId ||
          pkg.instrutorId === currentUser?.id ||
          pkg.instrutorId === student?.instrutorId;
        return matchOwner && pkg.ativo !== false;
      });
    } catch {
      return [];
    }
  }, [orgId, currentUser?.id, student?.instrutorId]);

  const studentCategory = student?.categoriaCnh || 'B';

  const [selectedCatalogPkgId, setSelectedCatalogPkgId] = useState<string>(() => {
    const defaultMatch = instructorPackages.find((p) => p.categoriaCnh === studentCategory);
    return defaultMatch?.id || instructorPackages[0]?.id || '';
  });

  const selectedCatalogPkg = useMemo(() => {
    return instructorPackages.find((p) => p.id === selectedCatalogPkgId);
  }, [instructorPackages, selectedCatalogPkgId]);

  // ─── 2. Estado: Aulas Avulsas ────────────────────────────────────────────────
  const [singleClassCount, setSingleClassCount] = useState<number>(2);
  const [singleClassPriceBRL, setSingleClassPriceBRL] = useState<number>(() => {
    if (selectedCatalogPkg && selectedCatalogPkg.totalAulas > 0 && selectedCatalogPkg.valorCentavos > 0) {
      const unit = Math.round(selectedCatalogPkg.valorCentavos / selectedCatalogPkg.totalAulas) / 100;
      return Number.isFinite(unit) && unit > 0 ? unit : 90;
    }
    return 90;
  });
  const [singleClassDesc, setSingleClassDesc] = useState<string>(
    'Aulas Práticas Avulsas de Reforço (Baliza, Rampa e Exame)'
  );

  // ─── 3. Estado: Pacote Personalizado ─────────────────────────────────────────
  const [customPkgName, setCustomPkgName] = useState<string>('Pacote Especial de Reforço & Treinamento');
  const [customPkgLessons, setCustomPkgLessons] = useState<number>(8);
  const [customPkgPriceBRL, setCustomPkgPriceBRL] = useState<number>(720);
  const [customPkgCategory, setCustomPkgCategory] = useState<CnhCategory>(studentCategory);
  const [customPkgObs, setCustomPkgObs] = useState<string>('Pacote personalizado sob medida para o aluno');

  // ─── 4. Dados Financeiros Comuns ──────────────────────────────────────────────
  const [dataVencimento, setDataVencimento] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [formaPagamento, setFormaPagamento] = useState<string>('PIX');
  const [gerarFatura, setGerarFatura] = useState<boolean>(true);

  // Cálculos dinâmicos de resumo
  const previewData = useMemo(() => {
    let tipo: StudentContractType = 'PACOTE_ADICIONAL';
    let nome = '';
    let qtdAulas = 0;
    let valorCentavos = 0;
    let categoria = student.categoriaCnh;
    let pacoteId: string | undefined = undefined;

    if (activeTab === 'CATALOG_PACKAGE') {
      tipo = 'PACOTE_ADICIONAL';
      nome = selectedCatalogPkg?.nome || 'Pacote Adicional';
      qtdAulas = selectedCatalogPkg?.totalAulas || 10;
      valorCentavos = selectedCatalogPkg?.valorCentavos || 80000;
      categoria = selectedCatalogPkg?.categoriaCnh || student.categoriaCnh;
      pacoteId = selectedCatalogPkg?.id;
    } else if (activeTab === 'SINGLE_CLASSES') {
      tipo = 'AULA_AVULSA';
      qtdAulas = Math.max(1, Number(singleClassCount) || 1);
      valorCentavos = Math.round(Math.max(0, Number(singleClassPriceBRL) || 0) * qtdAulas * 100);
      nome = `${qtdAulas} Aula(s) Prática(s) Avulsa(s) - CNH ${student.categoriaCnh}`;
      categoria = student.categoriaCnh;
    } else {
      tipo = 'PACOTE_PERSONALIZADO';
      qtdAulas = Math.max(1, Number(customPkgLessons) || 1);
      valorCentavos = Math.round(Math.max(0, Number(customPkgPriceBRL) || 0) * 100);
      nome = customPkgName.trim() || `Pacote Personalizado ${qtdAulas} Aulas - CNH ${customPkgCategory}`;
      categoria = customPkgCategory;
    }

    const aulasAtuais = Number(student?.totalAulasContratadas) || 20;
    const novoTotalAulas = aulasAtuais + qtdAulas;

    return {
      tipo,
      nome,
      qtdAulas,
      valorCentavos,
      categoria,
      pacoteId,
      aulasAtuais,
      novoTotalAulas
    };
  }, [
    activeTab,
    selectedCatalogPkg,
    singleClassCount,
    singleClassPriceBRL,
    customPkgName,
    customPkgLessons,
    customPkgPriceBRL,
    customPkgCategory,
    studentCategory,
    student?.categoriaCnh,
    student?.totalAulasContratadas
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (previewData.qtdAulas < 1) {
      setErrorMsg('A quantidade de aulas adicionais deve ser de no mínimo 1 aula.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await db.addStudentContractAsync({
        alunoId: student.id,
        contract: {
          tipo: previewData.tipo,
          pacoteId: previewData.pacoteId,
          nome: previewData.nome,
          categoriaCnh: previewData.categoria,
          quantidadeAulas: previewData.qtdAulas,
          valorCentavos: previewData.valorCentavos,
          formaPagamento,
          observacoes:
            activeTab === 'SINGLE_CLASSES'
              ? singleClassDesc
              : activeTab === 'CUSTOM_PACKAGE'
                ? customPkgObs
                : `Contratação adicional de pacote via catálogo do instrutor.`
        },
        actorId: currentUser.id,
        actorNome: currentUser.nome,
        createAccountReceivable: gerarFatura,
        dataVencimento: dataVencimento || undefined
      });

      setCreatedResult({
        contract: res.contract,
        student: res.student,
        account: res.account
      });

      onSuccess(res.student, res.contract, res.account);
    } catch (err: any) {
      console.error('Erro ao adicionar pacote/aulas:', err);
      setErrorMsg(err.message || 'Falha ao processar a contratação. Verifique os dados e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-sm">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Adicionar Pacote / Aulas Extras</span>
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-400/30">
                  CNH {student.categoriaCnh}
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Aluno(a): <strong className="text-white">{student.nome}</strong> · Aulas atuais:{' '}
                <span className="font-mono text-emerald-400">{student.aulasCumpridas}/{student.totalAulasContratadas}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Screen with Immediate Receipt Option */}
        {createdResult ? (
          <div className="p-6 space-y-6 text-center overflow-y-auto">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-slate-900">
                {createdResult.contract.tipo === 'AULA_AVULSA'
                  ? 'Aulas Avulsas Adicionadas com Sucesso!'
                  : createdResult.contract.tipo === 'PACOTE_PERSONALIZADO'
                    ? 'Pacote Personalizado Criado com Sucesso!'
                    : 'Pacote Adicional Vinculado com Sucesso!'}
              </h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                O aluno <strong>{student.nome}</strong> agora tem um total de{' '}
                <strong className="text-blue-700 font-mono font-bold">
                  {createdResult.student.totalAulasContratadas} aulas contratadas
                </strong>. O agendamento de novas aulas práticas já está totalmente liberado.
              </p>
            </div>

            {/* Resumo do Lançamento */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-left max-w-lg mx-auto space-y-2">
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-slate-500 font-semibold">Descrição:</span>
                <span className="font-bold text-slate-900">{createdResult.contract.nome}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-slate-500 font-semibold">Carga Adicionada:</span>
                <span className="font-bold text-emerald-700 font-mono">
                  +{createdResult.contract.quantidadeAulas} aula(s)
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-slate-500 font-semibold">Valor Contratado:</span>
                <span className="font-extrabold text-slate-900 font-mono text-sm">
                  {formatCurrencyBRL(createdResult.contract.valorCentavos)}
                </span>
              </div>
              {createdResult.account && (
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500 font-semibold">Fatura Financeira:</span>
                  <span className="text-blue-700 font-semibold">
                    Registrada com vencimento em {createdResult.account.dataVencimento}
                  </span>
                </div>
              )}
            </div>

            {/* Ações pós-contratação */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              {onRequestReceipt && (
                <button
                  type="button"
                  onClick={() => {
                    onRequestReceipt(createdResult.contract, createdResult.student);
                    onClose();
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Emitir Recibo Deste Pacote Agora</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Concluir e Fechar
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            {/* Abas Superiores */}
            <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-600 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('CATALOG_PACKAGE')}
                className={`py-3 px-2 flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${activeTab === 'CATALOG_PACKAGE'
                    ? 'border-blue-600 text-blue-700 bg-white'
                    : 'border-transparent hover:text-slate-900'
                  }`}
              >
                <Package className="w-4 h-4 shrink-0" />
                <span className="truncate">Pacote do Catálogo</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('SINGLE_CLASSES')}
                className={`py-3 px-2 flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${activeTab === 'SINGLE_CLASSES'
                    ? 'border-blue-600 text-blue-700 bg-white'
                    : 'border-transparent hover:text-slate-900'
                  }`}
              >
                <Car className="w-4 h-4 shrink-0" />
                <span className="truncate">Aulas Avulsas</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('CUSTOM_PACKAGE')}
                className={`py-3 px-2 flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${activeTab === 'CUSTOM_PACKAGE'
                    ? 'border-blue-600 text-blue-700 bg-white'
                    : 'border-transparent hover:text-slate-900'
                  }`}
              >
                <Settings className="w-4 h-4 shrink-0" />
                <span className="truncate">Pacote Personalizado</span>
              </button>
            </div>

            {/* Corpo do Formulário */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs text-slate-700 flex-1">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* ABA 1: PACOTE DO CATÁLOGO */}
              {activeTab === 'CATALOG_PACKAGE' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-900 mb-1">
                      Selecione o Pacote Adicional para o Aluno:
                    </label>
                    {instructorPackages.length > 0 ? (
                      <select
                        value={selectedCatalogPkgId}
                        onChange={(e) => setSelectedCatalogPkgId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:border-blue-600 cursor-pointer"
                      >
                        {instructorPackages.map((pkg) => (
                          <option key={pkg.id} value={pkg.id}>
                            {pkg.nome} — CNH {pkg.categoriaCnh} ({pkg.totalAulas} aulas ·{' '}
                            {formatCurrencyBRL(pkg.valorCentavos)})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs">
                        Nenhum pacote cadastrado no catálogo. Você pode usar a aba <strong>Pacote Personalizado</strong> ou <strong>Aulas Avulsas</strong> abaixo.
                      </div>
                    )}
                  </div>

                  {selectedCatalogPkg && (
                    <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs space-y-1">
                      <p className="font-bold text-blue-950">{selectedCatalogPkg.nome}</p>
                      <p className="text-slate-600">{selectedCatalogPkg.descricao || 'Pacote oficial de instrução veicular'}</p>
                      <div className="flex gap-4 pt-1 font-semibold text-slate-800">
                        <span>Aulas: <strong className="text-blue-700 font-mono font-bold">+{selectedCatalogPkg.totalAulas}</strong></span>
                        <span>Valor: <strong className="text-emerald-700 font-mono font-bold">{formatCurrencyBRL(selectedCatalogPkg.valorCentavos)}</strong></span>
                        <span>CNH: <strong className="text-slate-900 font-bold">{selectedCatalogPkg.categoriaCnh}</strong></span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ABA 2: AULAS AVULSAS */}
              {activeTab === 'SINGLE_CLASSES' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-900 mb-1">
                        Quantidade de Aulas Avulsas:
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={singleClassCount}
                        onChange={(e) => setSingleClassCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold font-mono focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-900 mb-1">
                        Valor Unitário por Aula (R$):
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="5"
                        value={singleClassPriceBRL}
                        onChange={(e) => setSingleClassPriceBRL(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold font-mono focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-900 mb-1">
                      Descrição / Finalidade das Aulas Avulsas:
                    </label>
                    <input
                      type="text"
                      value={singleClassDesc}
                      onChange={(e) => setSingleClassDesc(e.target.value)}
                      placeholder="Ex: Reforço de Baliza, Rampa ou Simulado Prático"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
              )}

              {/* ABA 3: PACOTE PERSONALIZADO */}
              {activeTab === 'CUSTOM_PACKAGE' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-900 mb-1">
                      Nome do Pacote Personalizado:
                    </label>
                    <input
                      type="text"
                      value={customPkgName}
                      onChange={(e) => setCustomPkgName(e.target.value)}
                      placeholder="Ex: Intensivo Baliza & Rodovia (10 Aulas)"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-900 mb-1">
                        Total de Aulas Extras:
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={customPkgLessons}
                        onChange={(e) => setCustomPkgLessons(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold font-mono focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-900 mb-1">
                        Valor Total (R$):
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="10"
                        value={customPkgPriceBRL}
                        onChange={(e) => setCustomPkgPriceBRL(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold font-mono focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-900 mb-1">
                        Categoria CNH:
                      </label>
                      <select
                        value={customPkgCategory}
                        onChange={(e) => setCustomPkgCategory(e.target.value as CnhCategory)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold bg-white focus:outline-none focus:border-blue-600 cursor-pointer"
                      >
                        {CNH_CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            CNH {c.value}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-900 mb-1">
                      Observações Pedagógicas:
                    </label>
                    <input
                      type="text"
                      value={customPkgObs}
                      onChange={(e) => setCustomPkgObs(e.target.value)}
                      placeholder="Ex: Treinamento focado em vencer o medo de rodovia e trânsito pesado"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
              )}

              {/* CONDIÇÕES FINANCEIRAS & FATURA */}
              <div className="pt-3 border-t border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Condições de Pagamento e Faturamento
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Forma de Pagamento Combinada:
                    </label>
                    <select
                      value={formaPagamento}
                      onChange={(e) => setFormaPagamento(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-medium"
                    >
                      <option value="PIX">PIX (À Vista / Chave Direta)</option>
                      <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                      <option value="DINHEIRO">Dinheiro em Espécie</option>
                      <option value="TRANSFERENCIA">Transferência Bancária</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Data de Vencimento da Fatura:
                    </label>
                    <input
                      type="date"
                      value={dataVencimento}
                      onChange={(e) => setDataVencimento(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={gerarFatura}
                    onChange={(e) => setGerarFatura(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 accent-blue-600 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-slate-700">
                    Gerar lançamento financeiro no contas a receber do aluno
                  </span>
                </label>
              </div>

              {/* CARD DE RESUMO DINÂMICO ANTES DE SALVAR */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between border-b border-emerald-200/80 pb-1.5">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    Resumo do Novo Contrato de Aulas
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-200/70 text-emerald-900 text-[10px] font-bold font-mono">
                    {previewData.tipo}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                  <div>
                    <span className="text-slate-500 text-[11px] block">Aulas Atuais</span>
                    <span className="font-bold font-mono text-slate-800">{previewData.aulasAtuais} aulas</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Aulas Adicionadas</span>
                    <span className="font-bold font-mono text-emerald-700">+{previewData.qtdAulas} aulas</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Novo Total Aluno</span>
                    <span className="font-extrabold font-mono text-blue-800 text-sm">
                      {previewData.novoTotalAulas} aulas
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Valor a Pagar</span>
                    <span className="font-extrabold font-mono text-slate-900 text-sm">
                      {formatCurrencyBRL(previewData.valorCentavos)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-slate-200 p-3.5 sm:p-4 flex flex-col-reverse sm:flex-row justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl font-semibold cursor-pointer w-full sm:w-auto text-xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center justify-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl font-bold shadow-sm transition-colors cursor-pointer w-full sm:w-auto text-xs"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'Adicionando Aulas...'
                    : `Confirmar e Adicionar (+${previewData.qtdAulas} Aulas)`}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
