import React, { useState } from 'react';
import {
  Users,
  Plus,
  Search,
  GraduationCap,
  Award,
  CheckCircle2,
  Calendar,
  DollarSign,
  Share2,
  Phone,
  Mail,
  ChevronRight,
  ShieldAlert,
  Save,
  ArrowRightLeft,
  Package,
  History,
  X,
  FileText,
  CreditCard,
  FileSpreadsheet,
  Download,
  Receipt,
  MessageCircle
} from 'lucide-react';
import { db } from '../../lib/storage';
import { formatDateBR, formatCurrencyBRL } from '../../lib/validation';
import type { Student, User, Organization, StudentSkills, PaymentRecord } from '../../types';
import { StudentTransferModal } from './StudentTransferModal';
import { PaymentReceiptModal } from '../common/PaymentReceiptModal';
import type { PaymentReceiptData } from '../../lib/receiptPdfGenerator';

interface StudentsViewProps {
  currentOrg: Organization;
  currentUser: User;
  onOpenNewStudent: () => void;
  onOpenInvite: () => void;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  currentOrg,
  currentUser,
  onOpenNewStudent,
  onOpenInvite
}) => {
  const orgId = currentOrg.id;
  const students = db.getStudents(orgId);
  const lessons = db.getLessons(orgId);
  const accounts = db.getAccountsReceivable(orgId);
  const payments = db.getPayments(orgId);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);

  // Edit skills state when viewing student
  const [editingSkills, setEditingSkills] = useState<StudentSkills | null>(null);
  const [instructorNotes, setInstructorNotes] = useState<string>('');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Transfer modal state
  const [transferStudentTarget, setTransferStudentTarget] = useState<Student | null>(null);
  const [transferToast, setTransferToast] = useState<string>('');

  // Payment Receipt Modal State
  const [receiptModalData, setReceiptModalData] = useState<PaymentReceiptData | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);

  // General Payments Report Modal State
  const [showGeneralPaymentModal, setShowGeneralPaymentModal] = useState<boolean>(false);
  const [generalPeriodFilter, setGeneralPeriodFilter] = useState<'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR'>('ALL');

  const filteredStudents = students.filter((s) => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      s.nome.toLowerCase().includes(term) ||
      s.cpfMascarado.includes(term) ||
      s.email.toLowerCase().includes(term) ||
      s.telefone.includes(term);

    const matchCategory = selectedCategory === 'ALL' || s.categoriaCnh === selectedCategory;

    return matchSearch && matchCategory;
  });

  const handleOpenStudentModal = (student: Student) => {
    setActiveStudent(student);
    setEditingSkills({ ...student.habilidades });
    setInstructorNotes(student.observacoesInstrutor || '');
    setSavedSuccess(false);
  };

  const handleSaveStudentProgress = () => {
    if (!activeStudent || !editingSkills) return;

    const updatedStudent: Student = {
      ...activeStudent,
      habilidades: editingSkills,
      observacoesInstrutor: instructorNotes
    };

    db.saveStudent(updatedStudent, currentUser.id);
    setActiveStudent(updatedStudent);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const calculateSkillsAverage = (skills: StudentSkills): number => {
    const values = Object.values(skills);
    if (values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    return Math.round((sum / values.length) * 10) / 10;
  };

  // Helper para abrir emissão de recibo para um pagamento específico
  const handleEmitReceiptForPayment = (payment: PaymentRecord, student: Student) => {
    const account = accounts.find((a) => a.id === payment.contaReceberId);
    const receipt: PaymentReceiptData = {
      id: `rec_${payment.id}`,
      numeroRecibo: payment.comprovanteNumero?.replace('AUT-', '') || `${Math.floor(100000 + Math.random() * 900000)}`,
      dataEmissao: new Date().toISOString().slice(0, 10),
      dataPagamento: payment.dataPagamento,
      valorCentavos: payment.valorCentavos,
      metodo: payment.metodo,
      tipoRecibo: payment.parcelas && payment.parcelas > 1 ? 'PARCELA' : 'QUITACAO_TOTAL',
      parcelaReferente: payment.parcelas && payment.parcelas > 1 ? `Parcela de ${payment.parcelas}x` : 'Pagamento de Aulas',
      descricaoServico: account?.descricao || student.pacoteNome || 'Aulas Práticas de Direção Veicular',
      aluno: {
        nome: student.nome,
        cpfMascarado: student.cpfMascarado,
        telefone: student.telefone,
        email: student.email,
        categoriaCnh: student.categoriaCnh
      },
      instrutor: {
        nome: currentUser.nome,
        documento: currentUser.cpfCompleto || currentUser.cpfMascarado || 'Credencial Detran Ativa',
        telefone: currentUser.telefone,
        cidade: currentOrg.nome,
        estado: 'BR'
      },
      observacoes: payment.observacao || 'Comprovante emitido com valor fiscal e registrado na gestão de direção.',
      codigoAutenticacao: payment.comprovanteNumero || `AUT-${Math.floor(100000 + Math.random() * 900000)}`
    };

    setReceiptModalData(receipt);
    setShowReceiptModal(true);
  };

  // Helper para abrir emissão de recibo avulso / novo para o aluno ativo
  const handleOpenCustomReceiptForStudent = (student: Student) => {
    const studentAccounts = accounts.filter((a) => a.alunoId === student.id);
    const defaultDesc = student.pacoteNome || 'Pacote de Aulas Práticas CNH B';
    const defaultValor =
      studentAccounts.find((a) => a.saldoDevedorCentavos > 0)?.saldoDevedorCentavos ||
      studentAccounts[0]?.valorTotalCentavos ||
      60000;

    const receipt: PaymentReceiptData = {
      id: `rec_new_${Date.now()}`,
      numeroRecibo: `${Math.floor(100000 + Math.random() * 900000)}`,
      dataEmissao: new Date().toISOString().slice(0, 10),
      dataPagamento: new Date().toISOString().slice(0, 10),
      valorCentavos: defaultValor,
      metodo: 'PIX',
      tipoRecibo: 'PARCELA',
      parcelaReferente: 'Parcela 1 de 2',
      periodoReferente: `Aulas de ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
      descricaoServico: defaultDesc,
      aluno: {
        nome: student.nome,
        cpfMascarado: student.cpfMascarado,
        telefone: student.telefone,
        email: student.email,
        categoriaCnh: student.categoriaCnh
      },
      instrutor: {
        nome: currentUser.nome,
        documento: currentUser.cpfCompleto || currentUser.cpfMascarado || 'Credencial Detran Ativa',
        telefone: currentUser.telefone,
        cidade: currentOrg.nome,
        estado: 'BR'
      },
      observacoes: 'Recibo referente à prestação de serviços de instrução prática de trânsito.',
      codigoAutenticacao: `AUT-${Math.floor(100000 + Math.random() * 900000)}`
    };

    setReceiptModalData(receipt);
    setShowReceiptModal(true);
  };

  // Filtragem dos pagamentos para o Relatório Geral
  const filteredGeneralPayments = payments.filter((p) => {
    if (generalPeriodFilter === 'ALL') return true;
    const pDate = new Date(p.dataPagamento);
    const now = new Date();

    if (generalPeriodFilter === 'THIS_MONTH') {
      return pDate.getFullYear() === now.getFullYear() && pDate.getMonth() === now.getMonth();
    }
    if (generalPeriodFilter === 'LAST_MONTH') {
      const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      return pDate.getFullYear() === lastMonthYear && pDate.getMonth() === lastMonth;
    }
    if (generalPeriodFilter === 'THIS_YEAR') {
      return pDate.getFullYear() === now.getFullYear();
    }
    return true;
  });

  const totalGeneralRecebidoCentavos = filteredGeneralPayments.reduce((acc, p) => acc + p.valorCentavos, 0);

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Gestão de Alunos & Progresso Prático
          </h1>
          <p className="text-xs text-slate-500">
            Acompanhe o cumprimento das 20 aulas do Detran, evolução de habilidades, histórico financeiro e emissão de recibos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGeneralPaymentModal(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-xs"
            title="Ver histórico de pagamentos e emitir relatórios ou recibos"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>Relatório de Pagamentos</span>
          </button>
          <button
            type="button"
            onClick={onOpenInvite}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-emerald-400" />
            <span>Convidar Aluno</span>
          </button>
          <button
            type="button"
            onClick={onOpenNewStudent}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Aluno (18+)</span>
          </button>
        </div>
      </div>

      {transferToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{transferToast}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone ou CPF..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none bg-white"
          />
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1 p-1 bg-slate-200/80 rounded-xl w-full sm:w-auto overflow-x-auto no-scrollbar">
          {['ALL', 'B', 'A', 'AB'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat === 'ALL' ? (
                <>
                  <span className="sm:hidden">Todas</span>
                  <span className="hidden sm:inline">Todas as Categorias</span>
                </>
              ) : (
                `Cat. ${cat}`
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Students Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStudents.map((student) => {
          const progressPercent = Math.min(
            100,
            Math.round((student.aulasCumpridas / student.totalAulasContratadas) * 100)
          );
          const avgSkill = calculateSkillsAverage(student.habilidades);

          // Contas do aluno
          const studentAccs = accounts.filter((a) => a.alunoId === student.id);
          const saldoDevedor = studentAccs.reduce((acc, a) => acc + a.saldoDevedorCentavos, 0);

          return (
            <div
              key={student.id}
              onClick={() => handleOpenStudentModal(student)}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 hover:border-blue-300"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-base shrink-0 border border-blue-100">
                    {student.nome.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 text-sm truncate flex items-center gap-1.5">
                      <span>{student.nome}</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      CPF: {student.cpfMascarado}
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[11px] font-bold shrink-0">
                  Cat. {student.categoriaCnh}
                </span>
              </div>

              {/* Course Progress */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    Aulas Detran
                  </span>
                  <span className="font-bold text-slate-800 font-mono">
                    {student.aulasCumpridas}/{student.totalAulasContratadas} ({progressPercent}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Financial Status Badge */}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                <span className="text-slate-500 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  Financeiro:
                </span>
                {saldoDevedor > 0 ? (
                  <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px]">
                    Pendente {formatCurrencyBRL(saldoDevedor)}
                  </span>
                ) : (
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Quitado
                  </span>
                )}
              </div>

              {/* Card Footer */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Award className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Média: <strong className="text-slate-900">{avgSkill.toFixed(1)}/10</strong></span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTransferStudentTarget(student);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                    title="Transferir aluno para outro instrutor"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Transferir</span>
                  </button>

                  <span className="text-blue-600 font-semibold flex items-center gap-1 text-[11px]">
                    Ver Ficha
                    <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* STUDENT DETAIL MODAL */}
      {activeStudent && editingSkills && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] sm:max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-base text-white shrink-0">
                  {activeStudent.nome.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 flex-wrap">
                    <span className="break-words">{activeStudent.nome}</span>
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-400/30 shrink-0">
                      CNH {activeStudent.categoriaCnh}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-300 break-words">
                    CPF: {activeStudent.cpfMascarado} · Nasc.: {formatDateBR(activeStudent.dataNascimento)} ({activeStudent.idade} anos)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <button
                  type="button"
                  onClick={() => handleOpenCustomReceiptForStudent(activeStudent)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Emitir Recibo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTransferStudentTarget(activeStudent)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-400/30 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>Transferir</span>
                </button>
                <button
                  onClick={() => setActiveStudent(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
              {savedSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Evolução do aluno e parecer pedagógico atualizados com sucesso!</span>
                </div>
              )}

              {/* Instructor & Package Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Instrutor Responsável:</span>
                  <span className="font-bold text-slate-900 text-xs break-words">
                    {db.getUsers(orgId).find((u) => u.id === activeStudent.instrutorId)?.nome || currentUser.nome}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Pacote Contratado:</span>
                  <span className="font-bold text-blue-700 text-xs flex items-center gap-1 mt-0.5 break-words">
                    <Package className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>{activeStudent.pacoteNome || 'Pacote Completo CNH B (20 Aulas Práticas)'}</span>
                  </span>
                </div>
              </div>

              {/* Contact info bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-mono">{activeStudent.telefone}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 min-w-0">
                  <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="break-all">{activeStudent.email}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Calendar className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>Cadastrado: {formatDateBR(activeStudent.dataCadastro)}</span>
                </div>
              </div>

              {/* SEÇÃO: FINANCEIRO & RECIBOS DO ALUNO */}
              {(() => {
                const studentAccounts = accounts.filter((a) => a.alunoId === activeStudent.id);
                const studentPayments = payments.filter((p) => p.alunoId === activeStudent.id);
                const totalContratado = studentAccounts.reduce((acc, a) => acc + a.valorTotalCentavos, 0);
                const totalPago = studentAccounts.reduce((acc, a) => acc + a.valorPagoCentavos, 0);
                const saldoDevedor = studentAccounts.reduce((acc, a) => acc + a.saldoDevedorCentavos, 0);

                return (
                  <div className="space-y-3 p-4 bg-emerald-50/40 border border-emerald-200 rounded-2xl">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-emerald-200/80 pb-2">
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-emerald-600" />
                          Financeiro, Histórico de Pagamentos & Recibos
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Gere e envie comprovantes de pagamento de aulas por parcela, por período ou quitação integral
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenCustomReceiptForStudent(activeStudent)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Novo Recibo</span>
                      </button>
                    </div>

                    {/* Cards de Resumo Financeiro do Aluno */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Contratado</span>
                        <span className="text-base font-extrabold text-slate-900 font-mono">
                          {formatCurrencyBRL(totalContratado || 180000)}
                        </span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Pago / Amortizado</span>
                        <span className="text-base font-extrabold text-emerald-700 font-mono">
                          {formatCurrencyBRL(totalPago || (totalContratado - saldoDevedor))}
                        </span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Saldo Devedor Restante</span>
                        <span className={`text-base font-extrabold font-mono ${saldoDevedor > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                          {formatCurrencyBRL(saldoDevedor)}
                        </span>
                      </div>
                    </div>

                    {/* Tabela de Pagamentos Efetuados pelo Aluno */}
                    <div className="space-y-2 pt-1">
                      <span className="font-bold text-slate-900 text-xs block">
                        Comprovantes & Pagamentos Registrados ({studentPayments.length}):
                      </span>

                      {studentPayments.length > 0 ? (
                        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[10px] uppercase">
                                <tr>
                                  <th className="py-2.5 px-3">Data</th>
                                  <th className="py-2.5 px-3">Forma</th>
                                  <th className="py-2.5 px-3">Valor</th>
                                  <th className="py-2.5 px-3">Autenticação</th>
                                  <th className="py-2.5 px-3 text-right">Recibo Oficial</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {studentPayments.map((pay) => (
                                  <tr key={pay.id} className="hover:bg-slate-50/70">
                                    <td className="py-2.5 px-3 font-mono font-medium text-slate-800">
                                      {formatDateBR(pay.dataPagamento)}
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-700 font-semibold">
                                      {pay.metodo}
                                    </td>
                                    <td className="py-2.5 px-3 font-bold text-emerald-700 font-mono">
                                      {formatCurrencyBRL(pay.valorCentavos)}
                                    </td>
                                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                                      {pay.comprovanteNumero || 'AUT-REG'}
                                    </td>
                                    <td className="py-2.5 px-3 text-right">
                                      <button
                                        type="button"
                                        onClick={() => handleEmitReceiptForPayment(pay, activeStudent)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer shadow-xs"
                                        title="Emitir e baixar recibo PDF em 2 vias para este pagamento"
                                      >
                                        <FileText className="w-3.5 h-3.5" />
                                        <span>Emitir Recibo</span>
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-white border border-slate-200 rounded-xl text-center text-slate-500 space-y-1">
                          <p>Nenhum pagamento registrado no sistema ainda para este aluno.</p>
                          <p className="text-[11px]">Você pode emitir um recibo avulso ou registrar o recebimento no menu Financeiro.</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Progress Bar of 20 classes */}
              <div className="space-y-2 p-4 bg-blue-50/50 border border-blue-200 rounded-xl">
                <div className="flex justify-between items-center text-xs font-semibold text-blue-950">
                  <span>Carga Horária Prática Obrigatória (Contran/Detran)</span>
                  <span className="font-mono text-sm">
                    {activeStudent.aulasCumpridas} de {activeStudent.totalAulasContratadas} Aulas Concluídas
                  </span>
                </div>
                <div className="w-full bg-blue-200/50 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (activeStudent.aulasCumpridas / activeStudent.totalAulasContratadas) * 100
                      )}%`
                    }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                  <span>Início do curso prático</span>
                  <span>
                    Faltam {Math.max(0, activeStudent.totalAulasContratadas - activeStudent.aulasCumpridas)} aula(s) para o Exame Prático
                  </span>
                </div>
              </div>

              {/* Detailed Skills Radar / Evaluation (8 CTB competencies) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-500" />
                    Avaliação das 8 Competências Práticas (Critérios de Exame Detran)
                  </h3>
                  <span className="text-xs font-semibold text-blue-700">
                    Média Geral: {calculateSkillsAverage(editingSkills).toFixed(1)} / 10
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  {[
                    { key: 'baliza', label: '1. Baliza / Estacionamento entre Balizadores' },
                    { key: 'controleEmbreagem', label: '2. Controle de Embreagem & Rampa (Aclive)' },
                    { key: 'transitoPesado', label: '3. Trânsito Pesado & Fluidez na Via' },
                    { key: 'conversoesCruzamentos', label: '4. Conversões, Cruzamentos e Rotatórias' },
                    { key: 'rodoviaVelocidade', label: '5. Rodovia / Troca de Marchas e Velocidade' },
                    { key: 'sinalizacaoPreferencia', label: '6. Sinalização, Retrovisores e Preferências' },
                    { key: 'posturaDefensiva', label: '7. Postura ao Volante e Direção Defensiva' },
                    { key: 'simuladoExame', label: '8. Simulado de Exame Prático Detran' }
                  ].map((comp) => {
                    const score = (editingSkills as any)[comp.key];
                    return (
                      <div key={comp.key} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-medium text-slate-800">{comp.label}</span>
                          <span className="font-bold font-mono text-blue-700">{score.toFixed(1)}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="0.5"
                          value={score}
                          onChange={(e) =>
                            setEditingSkills({
                              ...editingSkills,
                              [comp.key]: parseFloat(e.target.value)
                            })
                          }
                          className="w-full accent-blue-600 cursor-pointer"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Instructor Notes */}
              <div>
                <label className="block font-semibold text-slate-900 mb-1">
                  Parecer Técnico e Observações do Instrutor
                </label>
                <textarea
                  rows={3}
                  value={instructorNotes}
                  onChange={(e) => setInstructorNotes(e.target.value)}
                  placeholder="Ex: Aluno desenvolveu excelente noção de espaço na baliza. Recomendado reforçar parada obrigatória em aclive..."
                  className="w-full p-3 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none text-xs"
                />
              </div>

              {/* Recent Lessons */}
              <div>
                <h4 className="font-bold text-slate-900 mb-2">Histórico de Aulas Práticas</h4>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {lessons.filter((l) => l.alunoId === activeStudent.id).map((lsn) => (
                    <div
                      key={lsn.id}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-900">
                          {formatDateBR(lsn.data)} às {lsn.horaInicio} - {lsn.topico}
                        </span>
                        {lsn.observacaoInstrutor && (
                          <p className="text-[11px] text-slate-500">{lsn.observacaoInstrutor}</p>
                        )}
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold text-[10px]">
                        {lsn.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Transfer History Timeline */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <History className="w-4 h-4 text-blue-600" />
                  Histórico de Transferências de Instrutor & Auditoria
                </h4>
                {activeStudent.historicoTransferencias && activeStudent.historicoTransferencias.length > 0 ? (
                  <div className="space-y-1.5">
                    {activeStudent.historicoTransferencias.map((trf) => (
                      <div key={trf.id} className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-950 space-y-1">
                        <div className="flex justify-between items-center font-bold">
                          <span>De: {trf.instrutorAnteriorNome} → Para: {trf.instrutorNovoNome}</span>
                          <span className="font-mono text-[10px] text-amber-800">{formatDateBR(trf.dataTransferencia.slice(0, 10))}</span>
                        </div>
                        <p className="text-[11px] text-amber-900"><strong>Motivo:</strong> {trf.motivo}</p>
                        <p className="text-[10px] text-amber-800">
                          Aulas cumpridas até transferência: {trf.aulasCumpridasAteTransferencia} · Autorizado por: {trf.autorNome}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Vínculo original direto: Aluno matriculado com este instrutor (Sem histórico de transferências).</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 p-3.5 sm:p-4 flex flex-col-reverse sm:flex-row justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveStudent(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl font-semibold cursor-pointer w-full sm:w-auto"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleSaveStudentProgress}
                className="flex items-center justify-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-sm transition-colors cursor-pointer w-full sm:w-auto"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Evolução Pedagógica</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RELATÓRIO GERAL DE PAGAMENTOS MODAL */}
      {showGeneralPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">
                    Relatório Geral de Pagamentos de Alunos
                  </h2>
                  <p className="text-xs text-slate-400">
                    Histórico consolidado de recebimentos, datas, métodos e emissão de recibos oficiais
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGeneralPaymentModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs text-slate-700 flex-1">
              {/* Filtro de Período */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-slate-800">Filtrar por Período:</span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                  {[
                    { id: 'ALL', label: 'Todos os Períodos' },
                    { id: 'THIS_MONTH', label: 'Este Mês' },
                    { id: 'LAST_MONTH', label: 'Mês Passado' },
                    { id: 'THIS_YEAR', label: 'Este Ano' }
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setGeneralPeriodFilter(filter.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                        generalPeriodFilter === filter.id
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cards de Totais */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-emerald-950">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">Total Recebido</span>
                  <span className="text-xl font-black font-mono text-emerald-700">
                    {formatCurrencyBRL(totalGeneralRecebidoCentavos)}
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Quantidade de Pagamentos</span>
                  <span className="text-xl font-bold font-mono text-slate-900">
                    {filteredGeneralPayments.length} comprovantes
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Ticket Médio</span>
                  <span className="text-xl font-bold font-mono text-slate-900">
                    {filteredGeneralPayments.length > 0
                      ? formatCurrencyBRL(Math.round(totalGeneralRecebidoCentavos / filteredGeneralPayments.length))
                      : 'R$ 0,00'}
                  </span>
                </div>
              </div>

              {/* Tabela de Pagamentos */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[10px] uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Aluno</th>
                        <th className="py-2.5 px-3">CPF</th>
                        <th className="py-2.5 px-3">Data</th>
                        <th className="py-2.5 px-3">Forma</th>
                        <th className="py-2.5 px-3">Valor</th>
                        <th className="py-2.5 px-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredGeneralPayments.map((pay) => {
                        const student = students.find((s) => s.id === pay.alunoId);
                        return (
                          <tr key={pay.id} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              {student?.nome || 'Aluno'}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">
                              {student?.cpfMascarado || '***.***.***-**'}
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              {formatDateBR(pay.dataPagamento)}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-blue-700">
                              {pay.metodo}
                            </td>
                            <td className="py-2.5 px-3 font-extrabold text-emerald-700 font-mono">
                              {formatCurrencyBRL(pay.valorCentavos)}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {student && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleEmitReceiptForPayment(pay, student);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer shadow-xs"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>Recibo</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredGeneralPayments.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400">
                            Nenhum pagamento registrado no período selecionado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border-t border-slate-200 p-3 sm:p-4 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowGeneralPaymentModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Fechar Relatório
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL OFICIAL DE RECIBO DE PAGAMENTO EM 2 VIAS */}
      {showReceiptModal && receiptModalData && (
        <PaymentReceiptModal
          isOpen={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          initialData={receiptModalData}
        />
      )}

      {/* Transfer Student Modal */}
      {transferStudentTarget && (
        <StudentTransferModal
          student={transferStudentTarget}
          currentOrg={currentOrg}
          currentUser={currentUser}
          onClose={() => setTransferStudentTarget(null)}
          onSuccess={(updatedStudent) => {
            setTransferStudentTarget(null);
            if (activeStudent && activeStudent.id === updatedStudent.id) {
              setActiveStudent(updatedStudent);
            }
            setTransferToast(`Transferência de ${updatedStudent.nome} homologada com sucesso! Histórico gerado.`);
            setTimeout(() => setTransferToast(''), 4500);
          }}
        />
      )}
    </div>
  );
};
