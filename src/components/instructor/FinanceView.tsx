import React, { useState } from 'react';
import {
  DollarSign,
  Plus,
  CreditCard,
  QrCode,
  Calendar,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Fuel,
  Wrench,
  Shield,
  FileSpreadsheet,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  Printer,
  X,
  FileText,
  Download,
  Receipt,
  ShieldCheck,
  Users,
  Pencil,
  Trash2,
  HeartPulse
} from 'lucide-react';
import { db } from '../../lib/storage';
import { formatCurrencyBRL, formatDateBR } from '../../lib/validation';
import { generatePixCopiaECola } from '../../lib/whatsapp';
import { PackagesManager } from './PackagesManager';
import {
  buildIrpfReportData,
  downloadIrpfPdf,
  downloadIrpfCsv,
  IrpfReportData
} from '../../lib/irpfReportGenerator';
import { PaymentReceiptModal } from '../common/PaymentReceiptModal';
import type { PaymentReceiptData } from '../../lib/receiptPdfGenerator';
import type {
  Organization,
  User,
  AccountReceivable,
  PaymentRecord,
  Expense,
  Investment,
  PaymentMethod,
  ExpenseCategory,
  InvestmentCategory
} from '../../types';

interface FinanceViewProps {
  currentOrg: Organization;
  currentUser: User;
  onNavigateToFinancialHealth?: () => void;
}

export const FinanceView: React.FC<FinanceViewProps> = ({
  currentOrg,
  currentUser,
  onNavigateToFinancialHealth
}) => {
  const orgId = currentOrg.id;

  const [activeSubTab, setActiveSubTab] = useState<'RECEIVABLES' | 'EXPENSES' | 'INVESTMENTS' | 'PACKAGES' | 'DRE' | 'IRPF'>('RECEIVABLES');

  // IRPF & Receipt states
  const [irpfYear, setIrpfYear] = useState<number>(new Date().getFullYear());
  const [irpfFeedbackMsg, setIrpfFeedbackMsg] = useState<string>('');
  const [receiptModalData, setReceiptModalData] = useState<PaymentReceiptData | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);

  // Modals
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [selectedAccountForPayment, setSelectedAccountForPayment] = useState<AccountReceivable | null>(null);

  const [showNewExpenseModal, setShowNewExpenseModal] = useState<boolean>(false);
  const [showNewInvestmentModal, setShowNewInvestmentModal] = useState<boolean>(false);
  const [showEditInvestmentModal, setShowEditInvestmentModal] = useState<boolean>(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [showNewAccountModal, setShowNewAccountModal] = useState<boolean>(false);

  // Lists
  const accounts = db.getAccountsReceivable(orgId);
  const payments = db.getPayments(orgId);
  const expenses = db.getExpenses(orgId);
  const investments = db.getInvestments(orgId);
  const students = db.getStudents(orgId);
  const vehicles = db.getVehicles(orgId);

  // Totals
  const totalRecebidoCentavos = payments.reduce((acc, p) => acc + p.valorCentavos, 0);
  const totalTaxasCartaoCentavos = payments.reduce((acc, p) => acc + (p.taxaCentavos || 0), 0);
  const totalReceitaLiquidaCentavos = totalRecebidoCentavos - totalTaxasCartaoCentavos;

  const totalDespesasCentavos = expenses
    .filter((e) => e.status === 'PAGA')
    .reduce((acc, e) => acc + e.valorCentavos, 0);

  const lucroOperacionalCentavos = totalReceitaLiquidaCentavos - totalDespesasCentavos;

  const totalAportesInvestimentoCentavos = investments.reduce(
    (acc, i) => acc + i.valorAcumuladoCentavos,
    0
  );

  const saldoFinalCaixaCentavos = lucroOperacionalCentavos;

  // New Payment Form State
  const [paymentForm, setPaymentForm] = useState({
    valorReais: '',
    metodo: 'PIX' as PaymentMethod,
    parcelas: 1,
    observacao: ''
  });

  // New Expense Form State
  const [expenseForm, setExpenseForm] = useState({
    descricao: '',
    categoria: 'COMBUSTIVEL' as ExpenseCategory,
    veiculoId: '',
    valorReais: '',
    dataVencimento: new Date().toISOString().slice(0, 10),
    status: 'PAGA' as 'PENDENTE' | 'PAGA'
  });

  // New Investment Form State
  const [investmentForm, setInvestmentForm] = useState({
    titulo: '',
    categoria: 'RESERVA_EMERGENCIA' as InvestmentCategory,
    valorMetaReais: '',
    aporteMensalReais: '',
    valorAcumuladoReais: '0',
    dataPrevisao: '2027-12-31'
  });

  // New Account Receivable / Package Form State
  const [accountForm, setAccountForm] = useState({
    alunoId: students[0]?.id || '',
    descricao: 'Pacote de Aulas Práticas',
    valorTotalReais: '1800.00',
    dataVencimento: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)
  });

  const [paymentError, setPaymentError] = useState<string>('');

  const handleOpenPayment = (acc: AccountReceivable) => {
    setSelectedAccountForPayment(acc);
    setPaymentForm({
      valorReais: (acc.saldoDevedorCentavos / 100).toFixed(2),
      metodo: 'PIX',
      parcelas: 1,
      observacao: ''
    });
    setPaymentError('');
    setShowPaymentModal(true);
  };

  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountForPayment) return;

    const valorCentavos = Math.round(parseFloat(paymentForm.valorReais || '0') * 100);
    if (isNaN(valorCentavos) || valorCentavos <= 0) {
      setPaymentError('Informe um valor de pagamento válido.');
      return;
    }

    if (valorCentavos > selectedAccountForPayment.saldoDevedorCentavos) {
      setPaymentError(
        `O valor não pode ser maior que o saldo devedor restante (${formatCurrencyBRL(
          selectedAccountForPayment.saldoDevedorCentavos
        )}).`
      );
      return;
    }

    // Calculate simulated card fees if credit card
    let taxaCentavos = 0;
    if (paymentForm.metodo === 'CARTAO_CREDITO') {
      const taxaPercentual = paymentForm.parcelas === 1 ? 0.03 : 0.035 + (paymentForm.parcelas * 0.005);
      taxaCentavos = Math.round(valorCentavos * taxaPercentual);
    }

    const newPayment: PaymentRecord = {
      id: `pay_${Date.now()}`,
      organizacaoId: orgId,
      contaReceberId: selectedAccountForPayment.id,
      alunoId: selectedAccountForPayment.alunoId,
      valorCentavos,
      metodo: paymentForm.metodo,
      parcelas: paymentForm.metodo === 'CARTAO_CREDITO' ? paymentForm.parcelas : undefined,
      taxaCentavos,
      dataPagamento: new Date().toISOString().slice(0, 10),
      comprovanteNumero: `AUT-${Math.floor(100000 + Math.random() * 900000)}`,
      observacao: paymentForm.observacao || `Pagamento registrado via ${paymentForm.metodo}`
    };

    const res = db.recordPayment(newPayment, currentUser.id);
    if (!res.success) {
      setPaymentError(res.error || 'Erro ao registrar pagamento.');
      return;
    }

    setShowPaymentModal(false);
  };

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const valorCentavos = Math.round(parseFloat(expenseForm.valorReais || '0') * 100);
    if (isNaN(valorCentavos) || valorCentavos <= 0) return;

    const newExp: Expense = {
      id: `exp_${Date.now()}`,
      organizacaoId: orgId,
      descricao: expenseForm.descricao.trim(),
      categoria: expenseForm.categoria,
      veiculoId: expenseForm.veiculoId || undefined,
      valorCentavos,
      dataVencimento: expenseForm.dataVencimento,
      dataPagamento: expenseForm.status === 'PAGA' ? expenseForm.dataVencimento : undefined,
      status: expenseForm.status
    };

    db.createExpense(newExp, currentUser.id);
    setShowNewExpenseModal(false);
    setExpenseForm({
      descricao: '',
      categoria: 'COMBUSTIVEL',
      veiculoId: '',
      valorReais: '',
      dataVencimento: new Date().toISOString().slice(0, 10),
      status: 'PAGA'
    });
  };

  const handleCreateInvestment = (e: React.FormEvent) => {
    e.preventDefault();
    const metaCentavos = Math.round(parseFloat(investmentForm.valorMetaReais || '0') * 100);
    const aporteCentavos = Math.round(parseFloat(investmentForm.aporteMensalReais || '0') * 100);
    const acumuladoCentavos = Math.round(parseFloat(investmentForm.valorAcumuladoReais || '0') * 100);

    const newInv: Investment = {
      id: `inv_${Date.now()}`,
      organizacaoId: orgId,
      titulo: investmentForm.titulo.trim(),
      categoria: investmentForm.categoria,
      valorMetaCentavos: metaCentavos,
      valorAcumuladoCentavos: acumuladoCentavos,
      aporteMensalCentavos: aporteCentavos,
      dataInicio: new Date().toISOString().slice(0, 10),
      dataPrevisao: investmentForm.dataPrevisao
    };

    db.createInvestment(newInv, currentUser.id);
    setShowNewInvestmentModal(false);
  };

  const handleOpenEditInvestment = (inv: Investment) => {
    setEditingInvestment(inv);
    setInvestmentForm({
      titulo: inv.titulo,
      categoria: inv.categoria,
      valorMetaReais: (inv.valorMetaCentavos / 100).toFixed(2),
      aporteMensalReais: (inv.aporteMensalCentavos / 100).toFixed(2),
      valorAcumuladoReais: (inv.valorAcumuladoCentavos / 100).toFixed(2),
      dataPrevisao: inv.dataPrevisao || '2027-12-31'
    });
    setShowEditInvestmentModal(true);
  };

  const handleUpdateInvestment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvestment) return;
    const metaCentavos = Math.round(parseFloat(investmentForm.valorMetaReais || '0') * 100);
    const aporteCentavos = Math.round(parseFloat(investmentForm.aporteMensalReais || '0') * 100);
    const acumuladoCentavos = Math.round(parseFloat(investmentForm.valorAcumuladoReais || '0') * 100);

    const updatedInv: Investment = {
      ...editingInvestment,
      titulo: investmentForm.titulo.trim(),
      categoria: investmentForm.categoria,
      valorMetaCentavos: metaCentavos,
      valorAcumuladoCentavos: acumuladoCentavos,
      aporteMensalCentavos: aporteCentavos,
      dataPrevisao: investmentForm.dataPrevisao
    };

    db.updateInvestment(updatedInv, currentUser.id);
    setShowEditInvestmentModal(false);
    setEditingInvestment(null);
  };

  const handleDeleteInvestment = (inv: Investment) => {
    if (window.confirm(`Deseja realmente excluir o plano de investimento "${inv.titulo}"?`)) {
      db.deleteInvestment(inv.id, orgId, currentUser.id);
      setActiveSubTab('RECEIVABLES');
      setTimeout(() => setActiveSubTab('INVESTMENTS'), 10);
    }
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const valorCentavos = Math.round(parseFloat(accountForm.valorTotalReais || '0') * 100);
    if (isNaN(valorCentavos) || valorCentavos <= 0) return;

    const newAccount: AccountReceivable = {
      id: `rec_${Date.now()}`,
      organizacaoId: orgId,
      alunoId: accountForm.alunoId,
      descricao: accountForm.descricao.trim(),
      valorTotalCentavos: valorCentavos,
      valorPagoCentavos: 0,
      saldoDevedorCentavos: valorCentavos,
      dataVencimento: accountForm.dataVencimento,
      status: 'PENDENTE',
      pixPayload: generatePixCopiaECola('financeiro@direcaosegura.com.br', currentOrg.nome, valorCentavos, `REC${Date.now()}`),
      criadoEm: new Date().toISOString()
    };

    db.createAccountReceivable(newAccount, currentUser.id);
    setShowNewAccountModal(false);
  };

  const handleEmitReceipt = (payment: PaymentRecord) => {
    const student = students.find((s) => s.id === payment.alunoId);
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
      descricaoServico: account?.descricao || 'Aulas Práticas de Direção Veicular',
      aluno: {
        nome: student?.nome || 'Aluno',
        cpfMascarado: student?.cpfMascarado || '***.***.***-**',
        telefone: student?.telefone || '',
        email: student?.email || '',
        categoriaCnh: student?.categoriaCnh || 'B'
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

  const irpfReportData = buildIrpfReportData(orgId, irpfYear, currentUser);

  const handleDownloadIrpfPdf = () => {
    const success = downloadIrpfPdf(irpfReportData);
    if (success) {
      setIrpfFeedbackMsg('Relatório Fiscal IRPF em PDF gerado e baixado com sucesso!');
      setTimeout(() => setIrpfFeedbackMsg(''), 4000);
    }
  };

  const handleDownloadIrpfCsv = () => {
    downloadIrpfCsv(irpfReportData);
    setIrpfFeedbackMsg('Planilha CSV do Carnê-Leão gerada e baixada para o contador!');
    setTimeout(() => setIrpfFeedbackMsg(''), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header and Sub-tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Gestão Financeira & DRE
          </h1>
          <p className="text-xs text-slate-500">
            Controle de receitas, emissão de recibos, apuração para IRPF (Carnê-Leão), despesas e investimentos.
          </p>
        </div>

        {/* Actions & Sub-tab navigation */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => window.print()}
            className="no-print hidden sm:flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer touch-target shrink-0"
            title="Exportar relatório financeiro em PDF"
          >
            <Printer className="w-3.5 h-3.5 text-blue-400" />
            <span>Exportar PDF</span>
          </button>

          <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-xl overflow-x-auto no-scrollbar w-full sm:w-auto shrink-0">
            <button
              onClick={() => setActiveSubTab('RECEIVABLES')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                activeSubTab === 'RECEIVABLES'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              A Receber ({accounts.length})
            </button>
            <button
              onClick={() => setActiveSubTab('EXPENSES')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                activeSubTab === 'EXPENSES'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Despesas ({expenses.length})
            </button>
            <button
              onClick={() => setActiveSubTab('INVESTMENTS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                activeSubTab === 'INVESTMENTS'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Investimentos ({investments.length})
            </button>
            <button
              onClick={() => setActiveSubTab('PACKAGES')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                activeSubTab === 'PACKAGES'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Pacotes</span>
            </button>
            <button
              onClick={() => setActiveSubTab('DRE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                activeSubTab === 'DRE'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              DRE
            </button>
            <button
              onClick={() => setActiveSubTab('IRPF')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                activeSubTab === 'IRPF'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>IRPF / Carnê-Leão</span>
            </button>
          </div>
        </div>
      </div>

      {/* SUB-TAB: RECEIVABLES */}
      {activeSubTab === 'RECEIVABLES' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Cobranças & Contas a Receber</h2>
              <p className="text-xs text-slate-500">Acompanhe faturas, amortizações e pagamentos parciais</p>
            </div>
            <button
              onClick={() => setShowNewAccountModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Lançar Nova Cobrança
            </button>
          </div>

          {/* Mobile Card View (Cards stack for small screens to prevent clipping) */}
          <div className="md:hidden space-y-3">
            {accounts.map((acc) => {
              const student = students.find((s) => s.id === acc.alunoId);
              return (
                <div key={acc.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-slate-950 text-sm break-words">{student?.nome || 'Aluno'}</h3>
                      <p className="text-xs text-slate-500">{student?.telefone || 'Telefone não informado'}</p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                        acc.status === 'PAGO'
                          ? 'bg-emerald-100 text-emerald-800'
                          : acc.status === 'VENCIDO'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {acc.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 break-words">
                    {acc.descricao}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Vencimento</span>
                      <span className="font-mono text-slate-800 font-semibold">{formatDateBR(acc.dataVencimento)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Valor Total</span>
                      <span className="font-mono font-bold text-slate-900">{formatCurrencyBRL(acc.valorTotalCentavos)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Valor Pago</span>
                      <span className="font-mono font-semibold text-emerald-700">{formatCurrencyBRL(acc.valorPagoCentavos)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Saldo Devedor</span>
                      <span className="font-mono font-black text-rose-700">{formatCurrencyBRL(acc.saldoDevedorCentavos)}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                    {acc.saldoDevedorCentavos > 0 ? (
                      <button
                        onClick={() => handleOpenPayment(acc)}
                        className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs shadow-xs transition-colors cursor-pointer text-center"
                      >
                        Registrar Pagamento
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5 py-1">
                        <CheckCircle2 className="w-4 h-4" />
                        Título Quitado
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Aluno</th>
                    <th className="py-3 px-4">Descrição</th>
                    <th className="py-3 px-4">Vencimento</th>
                    <th className="py-3 px-4">Valor Total</th>
                    <th className="py-3 px-4">Pago</th>
                    <th className="py-3 px-4">Saldo Devedor</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {accounts.map((acc) => {
                    const student = students.find((s) => s.id === acc.alunoId);
                    return (
                      <tr key={acc.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                          {student?.nome || 'Aluno'}
                          <span className="block text-[11px] text-slate-400 font-normal">{student?.telefone}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{acc.descricao}</td>
                        <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap">
                          {formatDateBR(acc.dataVencimento)}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                          {formatCurrencyBRL(acc.valorTotalCentavos)}
                        </td>
                        <td className="py-3 px-4 text-emerald-700 font-medium font-mono">
                          {formatCurrencyBRL(acc.valorPagoCentavos)}
                        </td>
                        <td className="py-3 px-4 font-extrabold font-mono text-slate-900">
                          {formatCurrencyBRL(acc.saldoDevedorCentavos)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              acc.status === 'PAGO'
                                ? 'bg-emerald-100 text-emerald-800'
                                : acc.status === 'VENCIDO'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {acc.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {acc.saldoDevedorCentavos > 0 ? (
                            <button
                              onClick={() => handleOpenPayment(acc)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs shadow-xs transition-colors cursor-pointer"
                            >
                              Registrar Pagamento
                            </button>
                          ) : (
                            <span className="text-[11px] text-emerald-700 font-medium flex items-center justify-end gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Quitado
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Seção: Histórico de Recebimentos Realizados & Emissão de Recibos */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  Histórico de Recebimentos Realizados & Emissão de Recibos
                </h3>
                <p className="text-xs text-slate-500">
                  Emita recibos oficiais em 2 vias com autenticação fiscal para cada pagamento recebido
                </p>
              </div>
              <div className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                Total Recebido: <strong>{formatCurrencyBRL(totalRecebidoCentavos)}</strong> ({payments.length} pagamentos)
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Aluno / Pagador</th>
                      <th className="py-3 px-4">Data Pagamento</th>
                      <th className="py-3 px-4">Forma</th>
                      <th className="py-3 px-4">Valor Pago</th>
                      <th className="py-3 px-4">Autenticação</th>
                      <th className="py-3 px-4 text-right">Recibo Oficial</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {payments.map((pay) => {
                      const student = students.find((s) => s.id === pay.alunoId);
                      return (
                        <tr key={pay.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                            {student?.nome || 'Aluno'}
                            <span className="block text-[11px] text-slate-400 font-mono font-normal">
                              CPF: {student?.cpfMascarado || '***.***.***-**'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap">
                            {formatDateBR(pay.dataPagamento)}
                          </td>
                          <td className="py-3 px-4 font-semibold text-blue-700 whitespace-nowrap">
                            {pay.metodo}
                            {pay.parcelas && pay.parcelas > 1 ? ` (${pay.parcelas}x)` : ''}
                          </td>
                          <td className="py-3 px-4 font-black font-mono text-emerald-700 whitespace-nowrap">
                            {formatCurrencyBRL(pay.valorCentavos)}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                            {pay.comprovanteNumero || 'AUT-REG'}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleEmitReceipt(pay)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                              title="Emitir recibo em 2 vias em PDF ou enviar via WhatsApp"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Emitir Recibo</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {payments.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400">
                          Nenhum pagamento registrado ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: EXPENSES */}
      {activeSubTab === 'EXPENSES' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Despesas e Custos Operacionais</h2>
              <p className="text-xs text-slate-500">Controle de combustível, manutenção da frota, taxas do Detran e seguros</p>
            </div>
            <button
              onClick={() => setShowNewExpenseModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Lançar Despesa
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-medium">Combustível Total</span>
              <p className="text-lg font-bold text-slate-900 mt-1 font-mono">
                {formatCurrencyBRL(
                  expenses
                    .filter((e) => e.categoria === 'COMBUSTIVEL' && e.status === 'PAGA')
                    .reduce((a, b) => a + b.valorCentavos, 0)
                )}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-medium">Manutenção e Revisões</span>
              <p className="text-lg font-bold text-slate-900 mt-1 font-mono">
                {formatCurrencyBRL(
                  expenses
                    .filter((e) => e.categoria === 'MANUTENCAO_VEICULO' && e.status === 'PAGA')
                    .reduce((a, b) => a + b.valorCentavos, 0)
                )}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-medium">Taxas Detran / CFC</span>
              <p className="text-lg font-bold text-slate-900 mt-1 font-mono">
                {formatCurrencyBRL(
                  expenses
                    .filter((e) => e.categoria === 'TAXAS_DETRAN' && e.status === 'PAGA')
                    .reduce((a, b) => a + b.valorCentavos, 0)
                )}
              </p>
            </div>
          </div>

          {/* Mobile Card Stack for Expenses */}
          <div className="md:hidden space-y-3">
            {expenses.map((exp) => {
              const vehicle = vehicles.find((v) => v.id === exp.veiculoId);
              return (
                <div key={exp.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-slate-900 text-sm break-words">{exp.descricao}</h4>
                      <span className="inline-block px-2 py-0.5 mt-1 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                        {exp.categoria.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                        exp.status === 'PAGA'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {exp.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Veículo</span>
                      <span className="text-slate-700 font-medium break-words">
                        {vehicle ? `${vehicle.modelo.split(' ')[0]} (${vehicle.placa})` : 'Geral / Nenhum'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Vencimento</span>
                      <span className="font-mono text-slate-800 font-semibold">{formatDateBR(exp.dataVencimento)}</span>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">Valor Total</span>
                      <span className="font-mono font-black text-sm text-slate-900">
                        {formatCurrencyBRL(exp.valorCentavos)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Expenses Table */}
          <div className="hidden md:block border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Descrição</th>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4">Veículo Vinculado</th>
                    <th className="py-3 px-4">Vencimento</th>
                    <th className="py-3 px-4">Valor</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {expenses.map((exp) => {
                    const vehicle = vehicles.find((v) => v.id === exp.veiculoId);
                    return (
                      <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">{exp.descricao}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                            {exp.categoria.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {vehicle ? `${vehicle.modelo.split(' ')[0]} (${vehicle.placa})` : 'Geral'}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">{formatDateBR(exp.dataVencimento)}</td>
                        <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                          {formatCurrencyBRL(exp.valorCentavos)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              exp.status === 'PAGA'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {exp.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: INVESTMENTS */}
      {activeSubTab === 'INVESTMENTS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Investimentos & Planejamento Financeiro</h2>
              <p className="text-xs text-slate-500">Reserva de emergência, troca planejada de veículos e melhorias da autoescola</p>
            </div>
            <button
              onClick={() => setShowNewInvestmentModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Novo Plano de Investimento
            </button>
          </div>

          {/* BANNER EDUCATIVO DE SAÚDE FINANCEIRA */}
          {onNavigateToFinancialHealth && (
            <div className="bg-gradient-to-r from-indigo-900 to-purple-900 text-white p-4 sm:p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <HeartPulse className="w-5 h-5 text-pink-300" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    Novo Guia: Saúde Financeira & Metodologia dos 4 Potes
                  </h4>
                  <p className="text-[11px] sm:text-xs text-indigo-200">
                    Aprenda a provisionar a troca de veículos pelo DETRAN, calcular o custo real por aula e evitar imprevistos.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onNavigateToFinancialHealth}
                className="px-3.5 py-1.5 bg-white text-indigo-900 text-xs font-bold rounded-xl hover:bg-indigo-50 transition-colors shrink-0 cursor-pointer shadow-xs"
              >
                Abrir Saúde Financeira →
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {investments.map((inv) => {
              const progresso = Math.min(100, Math.round((inv.valorAcumuladoCentavos / inv.valorMetaCentavos) * 100));
              return (
                <div key={inv.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                        {inv.categoria.replace(/_/g, ' ')}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 mt-1">{inv.titulo}</h3>
                      {inv.notas && <p className="text-xs text-slate-500">{inv.notas}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditInvestment(inv)}
                        title="Editar planejamento"
                        className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteInvestment(inv)}
                        title="Excluir planejamento"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-600">Acumulado: {formatCurrencyBRL(inv.valorAcumuladoCentavos)}</span>
                      <span className="text-slate-900 font-bold">{progresso}% da Meta ({formatCurrencyBRL(inv.valorMetaCentavos)})</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-purple-600 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${progresso}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      Aporte Mensal: <strong>{formatCurrencyBRL(inv.aporteMensalCentavos)}</strong>
                    </span>
                    <button
                      onClick={() => {
                        db.makeInvestmentContribution(inv.id, inv.aporteMensalCentavos, currentUser.id);
                        // Trigger re-render
                        setActiveSubTab('INVESTMENTS');
                      }}
                      className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      + Aporte do Mês
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB: DRE */}
      {activeSubTab === 'DRE' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
              Demonstrativo de Resultado do Exercício
            </span>
            <h2 className="text-lg font-extrabold text-slate-900 mt-0.5">
              DRE Gerencial do Período · {currentOrg.nome}
            </h2>
            <p className="text-xs text-slate-500">
              Visão consolidada de receitas brutas, deduções de taxas bancárias/cartão, custos operacionais e margem líquida.
            </p>
          </div>

          <div className="divide-y divide-slate-200 text-xs sm:text-sm">
            {/* 1. Receita Bruta */}
            <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-bold text-slate-900">
              <span className="flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>(+) RECEITA BRUTA COM AULAS E PACOTES</span>
              </span>
              <span className="font-mono text-sm sm:text-base text-emerald-600 text-right">
                {formatCurrencyBRL(totalRecebidoCentavos)}
              </span>
            </div>

            {/* 2. Deduções / Taxas */}
            <div className="py-2 pl-3 sm:pl-6 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-600">
              <span>(-) Taxas de Intermediação & Cartão de Crédito</span>
              <span className="font-mono text-red-600 text-right">
                ({formatCurrencyBRL(totalTaxasCartaoCentavos)})
              </span>
            </div>

            {/* 3. Receita Líquida */}
            <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-bold text-slate-900 bg-slate-50 px-3 rounded-lg">
              <span>(=) RECEITA OPERACIONAL LÍQUIDA</span>
              <span className="font-mono text-sm sm:text-base text-right">{formatCurrencyBRL(totalReceitaLiquidaCentavos)}</span>
            </div>

            {/* 4. Custos e Despesas */}
            <div className="py-3 font-semibold text-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="flex items-center gap-2">
                  <ArrowDownRight className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>(-) DESPESAS OPERACIONAIS TOTAIS</span>
                </span>
                <span className="font-mono text-amber-700 font-bold text-right">
                  ({formatCurrencyBRL(totalDespesasCentavos)})
                </span>
              </div>
              <div className="pl-3 sm:pl-6 pt-2 space-y-1.5 text-slate-500 text-xs font-normal">
                <div className="flex justify-between items-center gap-2">
                  <span className="truncate">Combustível e Abastecimentos</span>
                  <span className="font-mono shrink-0">
                    {formatCurrencyBRL(
                      expenses.filter((e) => e.categoria === 'COMBUSTIVEL').reduce((a, b) => a + b.valorCentavos, 0)
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="truncate">Manutenção Preventiva e Corretiva da Frota</span>
                  <span className="font-mono shrink-0">
                    {formatCurrencyBRL(
                      expenses.filter((e) => e.categoria === 'MANUTENCAO_VEICULO').reduce((a, b) => a + b.valorCentavos, 0)
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="truncate">Taxas e Credenciamento Detran</span>
                  <span className="font-mono shrink-0">
                    {formatCurrencyBRL(
                      expenses.filter((e) => e.categoria === 'TAXAS_DETRAN').reduce((a, b) => a + b.valorCentavos, 0)
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="truncate">Seguro e Proteção Veicular</span>
                  <span className="font-mono shrink-0">
                    {formatCurrencyBRL(
                      expenses.filter((e) => e.categoria === 'SEGURO').reduce((a, b) => a + b.valorCentavos, 0)
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* 5. Lucro Líquido */}
            <div className="py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-extrabold text-sm sm:text-base bg-blue-50 px-3 sm:px-4 rounded-xl border border-blue-200 text-blue-950">
              <span className="leading-snug">(=) RESULTADO LÍQUIDO DO EXERCÍCIO</span>
              <span className={`font-mono text-base sm:text-lg text-right ${saldoFinalCaixaCentavos >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {formatCurrencyBRL(saldoFinalCaixaCentavos)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: PACKAGES */}
      {activeSubTab === 'PACKAGES' && (
        <PackagesManager currentOrg={currentOrg} currentUser={currentUser} />
      )}

      {/* SUB-TAB: IRPF / CARNÊ-LEÃO */}
      {activeSubTab === 'IRPF' && (
        <div className="space-y-6">
          {/* IRPF Header & Actions */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                    <ShieldCheck className="w-5 h-5 text-emerald-700" />
                  </div>
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                    Declaração Fiscal de Rendimentos IRPF / Carnê-Leão
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                    Autônomo (PF)
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                  Apuração de rendimentos não-assalariados recebidos de pessoas físicas (alunos com CPF), deduções operacionais do Livro-Caixa (combustível, manutenção e taxas) e investimentos.
                </p>
              </div>

              {/* Year Selector & Export Buttons */}
              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  {[2026, 2025, 2024].map((year) => (
                    <button
                      key={year}
                      type="button"
                      onClick={() => setIrpfYear(year)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        irpfYear === year
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {year}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleDownloadIrpfCsv}
                  className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
                  title="Exportar planilha formatada para envio à contabilidade"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>CSV p/ Contador</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadIrpfPdf}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm hover:shadow"
                  title="Baixar relatório fiscal oficial em formato PDF"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Relatório Fiscal PDF</span>
                </button>
              </div>
            </div>

            {irpfFeedbackMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{irpfFeedbackMsg}</span>
              </div>
            )}

            {/* Cards de Resumo Fiscal do Ano */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  1. Receita Bruta Anual (PF)
                </span>
                <p className="text-xl font-black text-slate-900 font-mono mt-1">
                  {formatCurrencyBRL(irpfReportData.totais.receitaBrutaCentavos)}
                </p>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Total de rendimentos pagos por alunos
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  2. Despesas Livro-Caixa
                </span>
                <p className="text-xl font-black text-rose-700 font-mono mt-1">
                  {formatCurrencyBRL(irpfReportData.totais.despesasLivroCaixaCentavos)}
                </p>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Deduções estritamente operacionais
                </span>
              </div>

              <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200">
                <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                  3. Rendimento Líquido Tributável
                </span>
                <p className="text-xl font-black text-emerald-700 font-mono mt-1">
                  {formatCurrencyBRL(irpfReportData.totais.rendimentoLiquidoCentavos)}
                </p>
                <span className="text-[10px] text-emerald-800 mt-0.5 block font-semibold">
                  Base de cálculo Carnê-Leão
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  4. Investimentos Acumulados
                </span>
                <p className="text-xl font-black text-purple-700 font-mono mt-1">
                  {formatCurrencyBRL(irpfReportData.totais.totalInvestimentosCentavos)}
                </p>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Reserva & renovação de frota
                </span>
              </div>
            </div>
          </div>

          {/* TABELA 1: APURAÇÃO MENSAL DO CARNÊ-LEÃO */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs space-y-3 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Apuração Mensal do Carnê-Leão (Ano-Calendário {irpfYear})
                </h3>
                <p className="text-xs text-slate-500">
                  Mês a mês para preenchimento da ficha de Rendimentos do Trabalho Não-Assalariado no Carnê-Leão Web
                </p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Mês</th>
                      <th className="py-2.5 px-3 text-right">Receita Bruta (R$)</th>
                      <th className="py-2.5 px-3 text-right">Livro-Caixa Dedutível (R$)</th>
                      <th className="py-2.5 px-3 text-right">Líquido Tributável (R$)</th>
                      <th className="py-2.5 px-3 text-center">Alunos Pagantes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                    {irpfReportData.meses.map((m) => (
                      <tr key={m.mesNumero} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-sans font-semibold text-slate-900">
                          {m.mesNome}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-800">
                          {formatCurrencyBRL(m.receitaBrutaCentavos)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-rose-700">
                          {formatCurrencyBRL(m.despesasLivroCaixaCentavos)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                          {formatCurrencyBRL(m.rendimentoLiquidoCentavos)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-sans text-slate-600">
                          {m.totalAlunosPagantes} alunos
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100/80 font-bold border-t-2 border-slate-300 text-slate-900">
                      <td className="py-3 px-3 font-sans">TOTAL ANUAL ({irpfYear})</td>
                      <td className="py-3 px-3 text-right text-slate-900">
                        {formatCurrencyBRL(irpfReportData.totais.receitaBrutaCentavos)}
                      </td>
                      <td className="py-3 px-3 text-right text-rose-700">
                        {formatCurrencyBRL(irpfReportData.totais.despesasLivroCaixaCentavos)}
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-800">
                        {formatCurrencyBRL(irpfReportData.totais.rendimentoLiquidoCentavos)}
                      </td>
                      <td className="py-3 px-3 text-center font-sans text-slate-900">
                        {irpfReportData.totais.totalAlunosAtendidos} atendidos
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* TABELA 2: DISCRIMINAÇÃO INDIVIDUAL POR ALUNO (FONTE PAGADORA COM CPF) */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs space-y-3 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  Discriminação Individual por Aluno (Fontes Pagadoras PF com CPF)
                </h3>
                <p className="text-xs text-slate-500">
                  Exigência da Receita Federal: lançamento dos rendimentos individualizados por CPF do pagador
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {irpfReportData.alunos.length} alunos pagantes cadastrados
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Nome do Aluno</th>
                      <th className="py-2.5 px-3">CPF (Obrigatório RFB)</th>
                      <th className="py-2.5 px-3">Telefone</th>
                      <th className="py-2.5 px-3 text-right">Total Pago no Ano</th>
                      <th className="py-2.5 px-3">Formas de Pagamento</th>
                      <th className="py-2.5 px-3 text-center">Comprovantes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {irpfReportData.alunos.map((aluno) => (
                      <tr key={aluno.alunoId} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                          {aluno.nome}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-blue-800 whitespace-nowrap">
                          {aluno.cpf}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap font-mono">
                          {aluno.telefone || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black font-mono text-emerald-700 whitespace-nowrap">
                          {formatCurrencyBRL(aluno.totalAnoCentavos)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                          {aluno.metodos.join(', ')}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                            {aluno.totalPagamentos} recibos
                          </span>
                        </td>
                      </tr>
                    ))}
                    {irpfReportData.alunos.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400">
                          Nenhum pagamento registrado no ano de {irpfYear}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* TABELA 3: DESPESAS LIVRO-CAIXA & INVESTIMENTOS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Livro-Caixa Despesas */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Fuel className="w-4 h-4 text-amber-600" />
                Despesas Dedutíveis do Livro-Caixa ({irpfYear})
              </h3>
              <p className="text-xs text-slate-500">
                Gastos diretamente relacionados à prestação de aulas práticas do autônomo
              </p>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[10px]">
                    <tr>
                      <th className="py-2 px-3">Categoria Operacional</th>
                      <th className="py-2 px-3 text-center">Lançamentos</th>
                      <th className="py-2 px-3 text-right">Total Dedutível</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {irpfReportData.despesasPorCategoria.map((cat) => (
                      <tr key={cat.categoria} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {cat.categoria.replace('_', ' ')}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                          {cat.quantidade}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold font-mono text-rose-700">
                          {formatCurrencyBRL(cat.totalCentavos)}
                        </td>
                      </tr>
                    ))}
                    {irpfReportData.despesasPorCategoria.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-slate-400">
                          Nenhuma despesa dedutível registrada em {irpfYear}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Investimentos & Reserva */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                Planejamento Patrimonial & Investimentos
              </h3>
              <p className="text-xs text-slate-500">
                Aportes realizados em reservas para manutenção e expansão de frotas
              </p>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[10px]">
                    <tr>
                      <th className="py-2 px-3">Plano de Investimento</th>
                      <th className="py-2 px-3 text-right">Acumulado</th>
                      <th className="py-2 px-3 text-right">Meta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {irpfReportData.investimentos.map((inv, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {inv.titulo}
                          <span className="block text-[10px] text-purple-700 uppercase font-mono">
                            {inv.categoria.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold font-mono text-purple-700">
                          {formatCurrencyBRL(inv.valorAcumuladoCentavos)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                          {formatCurrencyBRL(inv.valorMetaCentavos)}
                        </td>
                      </tr>
                    ))}
                    {irpfReportData.investimentos.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-slate-400">
                          Nenhum investimento registrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR PAGAMENTO */}
      {showPaymentModal && selectedAccountForPayment && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <h3 className="text-base font-bold text-slate-900">Registrar Pagamento / Amortização</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="mt-4 space-y-4 text-xs overflow-y-auto flex-1 pr-0.5">
              {paymentError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{paymentError}</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <p className="text-slate-500">Conta: <strong className="text-slate-900">{selectedAccountForPayment.descricao}</strong></p>
                <p className="text-slate-500">Saldo Devedor Atual: <strong className="text-blue-700 font-mono">{formatCurrencyBRL(selectedAccountForPayment.saldoDevedorCentavos)}</strong></p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Valor do Pagamento (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentForm.valorReais}
                  onChange={(e) => setPaymentForm({ ...paymentForm, valorReais: e.target.value })}
                  className="w-full px-3 py-2 text-sm font-bold font-mono border border-slate-300 rounded-xl focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Método de Pagamento *</label>
                <select
                  value={paymentForm.metodo}
                  onChange={(e) => setPaymentForm({ ...paymentForm, metodo: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-emerald-600 focus:outline-none bg-white font-medium"
                >
                  <option value="PIX">PIX (Instantâneo)</option>
                  <option value="CARTAO_CREDITO">Cartão de Crédito (Parcelado)</option>
                  <option value="DINHEIRO">Dinheiro em Espécie</option>
                  <option value="TRANSFERENCIA">Transferência / TED</option>
                </select>
              </div>

              {paymentForm.metodo === 'CARTAO_CREDITO' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                  <label className="block font-semibold text-blue-900">Número de Parcelas</label>
                  <select
                    value={paymentForm.parcelas}
                    onChange={(e) => setPaymentForm({ ...paymentForm, parcelas: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-1.5 border border-blue-300 rounded-lg bg-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => (
                      <option key={n} value={n}>
                        {n}x de {formatCurrencyBRL(Math.round(((parseFloat(paymentForm.valorReais || '0') * 100) / n)))}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-blue-700">
                    Taxa estimada da maquininha: ~{(paymentForm.parcelas === 1 ? 3.0 : 3.5 + paymentForm.parcelas * 0.5).toFixed(1)}% deduzida no DRE.
                  </p>
                </div>
              )}

              {paymentForm.metodo === 'PIX' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5" />
                    Chave PIX da Autoescola / Instrutor
                  </p>
                  <p className="font-mono font-bold">financeiro@direcaosegura.com.br</p>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Observações do Recibo</label>
                <input
                  type="text"
                  placeholder="Ex: Pago via comprovante enviado no WhatsApp"
                  value={paymentForm.observacao}
                  onChange={(e) => setPaymentForm({ ...paymentForm, observacao: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold cursor-pointer"
                >
                  Confirmar Recebimento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVA DESPESA */}
      {showNewExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <h3 className="text-base font-bold text-slate-900">Lançar Nova Despesa</h3>
              <button onClick={() => setShowNewExpenseModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="mt-4 space-y-3.5 text-xs overflow-y-auto flex-1 pr-0.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição do Gasto *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Abastecimento Gasolina Comum 45L"
                  value={expenseForm.descricao}
                  onChange={(e) => setExpenseForm({ ...expenseForm, descricao: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Categoria *</label>
                  <select
                    value={expenseForm.categoria}
                    onChange={(e) => setExpenseForm({ ...expenseForm, categoria: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="COMBUSTIVEL">Combustível</option>
                    <option value="MANUTENCAO_VEICULO">Manutenção Veículo</option>
                    <option value="TAXAS_DETRAN">Taxas Detran / CFC</option>
                    <option value="SEGURO">Seguro</option>
                    <option value="ALIMENTACAO">Alimentação</option>
                    <option value="MARKETING">Marketing & Anúncios</option>
                    <option value="OUTROS">Outros</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={expenseForm.valorReais}
                    onChange={(e) => setExpenseForm({ ...expenseForm, valorReais: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Veículo Relacionado</label>
                <select
                  value={expenseForm.veiculoId}
                  onChange={(e) => setExpenseForm({ ...expenseForm, veiculoId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="">Nenhum / Custo Geral</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.modelo} ({v.placa})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data Vencimento</label>
                  <input
                    type="date"
                    required
                    value={expenseForm.dataVencimento}
                    onChange={(e) => setExpenseForm({ ...expenseForm, dataVencimento: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={expenseForm.status}
                    onChange={(e) => setExpenseForm({ ...expenseForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="PAGA">Já Pago</option>
                    <option value="PENDENTE">A Pagar</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewExpenseModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-semibold cursor-pointer w-full sm:w-auto"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold cursor-pointer w-full sm:w-auto"
                >
                  Salvar Despesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVO INVESTIMENTO */}
      {showNewInvestmentModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <h3 className="text-base font-bold text-slate-900">Novo Plano de Investimento Mensal</h3>
              <button onClick={() => setShowNewInvestmentModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvestment} className="mt-4 space-y-3.5 text-xs overflow-y-auto flex-1 pr-0.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Título do Objetivo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Aquisição do 2º Onix Duplo Comando"
                  value={investmentForm.titulo}
                  onChange={(e) => setInvestmentForm({ ...investmentForm, titulo: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-purple-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Categoria de Investimento *</label>
                <select
                  value={investmentForm.categoria}
                  onChange={(e) => setInvestmentForm({ ...investmentForm, categoria: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="RESERVA_EMERGENCIA">Reserva de Emergência</option>
                  <option value="FROTA_NOVO_VEICULO">Renovação / Novo Veículo</option>
                  <option value="CURSOS_ESPECIALIZACAO">Cursos & Especialização</option>
                  <option value="EQUIPAMENTOS_SIMULADORES">Equipamentos & Simuladores</option>
                  <option value="INFRAESTRUTURA">Infraestrutura</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor Meta (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="50000.00"
                    value={investmentForm.valorMetaReais}
                    onChange={(e) => setInvestmentForm({ ...investmentForm, valorMetaReais: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Aporte Mensal (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="1500.00"
                    value={investmentForm.aporteMensalReais}
                    onChange={(e) => setInvestmentForm({ ...investmentForm, aporteMensalReais: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewInvestmentModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-semibold cursor-pointer w-full sm:w-auto"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold cursor-pointer w-full sm:w-auto"
                >
                  Criar Objetivo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR INVESTIMENTO */}
      {showEditInvestmentModal && editingInvestment && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900">Editar Plano de Investimento</h3>
                <p className="text-xs text-slate-500">Ajuste meta, categoria, valor acumulado ou aporte</p>
              </div>
              <button
                onClick={() => {
                  setShowEditInvestmentModal(false);
                  setEditingInvestment(null);
                }}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateInvestment} className="mt-4 space-y-3.5 text-xs overflow-y-auto flex-1 pr-0.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Título do Objetivo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Aquisição do 2º Onix Duplo Comando"
                  value={investmentForm.titulo}
                  onChange={(e) => setInvestmentForm({ ...investmentForm, titulo: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-purple-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Categoria de Investimento *</label>
                <select
                  value={investmentForm.categoria}
                  onChange={(e) => setInvestmentForm({ ...investmentForm, categoria: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="RESERVA_EMERGENCIA">Reserva de Emergência</option>
                  <option value="FROTA_NOVO_VEICULO">Renovação / Novo Veículo</option>
                  <option value="CURSOS_ESPECIALIZACAO">Cursos & Especialização</option>
                  <option value="EQUIPAMENTOS_SIMULADORES">Equipamentos & Simuladores</option>
                  <option value="INFRAESTRUTURA">Infraestrutura</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor Meta (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="50000.00"
                    value={investmentForm.valorMetaReais}
                    onChange={(e) => setInvestmentForm({ ...investmentForm, valorMetaReais: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor Já Acumulado (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="12000.00"
                    value={investmentForm.valorAcumuladoReais}
                    onChange={(e) => setInvestmentForm({ ...investmentForm, valorAcumuladoReais: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Aporte Mensal (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="1500.00"
                    value={investmentForm.aporteMensalReais}
                    onChange={(e) => setInvestmentForm({ ...investmentForm, aporteMensalReais: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data Previsão / Conclusão</label>
                  <input
                    type="date"
                    value={investmentForm.dataPrevisao}
                    onChange={(e) => setInvestmentForm({ ...investmentForm, dataPrevisao: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditInvestmentModal(false);
                    setEditingInvestment(null);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-semibold cursor-pointer w-full sm:w-auto text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold cursor-pointer w-full sm:w-auto"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVA COBRANÇA */}
      {showNewAccountModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <h3 className="text-base font-bold text-slate-900">Lançar Nova Cobrança para Aluno</h3>
              <button onClick={() => setShowNewAccountModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="mt-4 space-y-3.5 text-xs overflow-y-auto flex-1 pr-0.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Selecione o Aluno *</label>
                <select
                  value={accountForm.alunoId}
                  onChange={(e) => setAccountForm({ ...accountForm, alunoId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome} (CNH {s.categoriaCnh})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição do Pacote / Serviço *</label>
                <input
                  type="text"
                  required
                  value={accountForm.descricao}
                  onChange={(e) => setAccountForm({ ...accountForm, descricao: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor Total (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={accountForm.valorTotalReais}
                    onChange={(e) => setAccountForm({ ...accountForm, valorTotalReais: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data Vencimento *</label>
                  <input
                    type="date"
                    required
                    value={accountForm.dataVencimento}
                    onChange={(e) => setAccountForm({ ...accountForm, dataVencimento: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewAccountModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-semibold cursor-pointer w-full sm:w-auto"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold cursor-pointer w-full sm:w-auto"
                >
                  Gerar Cobrança
                </button>
              </div>
            </form>
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
    </div>
  );
};
