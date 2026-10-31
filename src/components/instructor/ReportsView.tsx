import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Download,
  Award,
  TrendingUp,
  DollarSign,
  Users,
  CheckCircle2,
  Calendar,
  Car,
  FileCheck,
  HelpCircle,
  UserCheck,
  Check,
  GraduationCap,
  History,
  ArrowRightLeft,
  Package
} from 'lucide-react';
import { db } from '../../lib/storage';
import { formatCurrencyBRL, formatDateBR } from '../../lib/validation';
import { Organization, User, Student } from '../../types';

interface ReportsViewProps {
  currentOrg: Organization;
  currentUser: User;
}

type ReportType = 'PERFORMANCE' | 'BILLING' | 'STUDENT_CARD';

export const ReportsView: React.FC<ReportsViewProps> = ({ currentOrg, currentUser }) => {
  const orgId = currentOrg.id;
  const [reportType, setReportType] = useState<ReportType>('PERFORMANCE');

  const students = db.getStudents(orgId);
  const lessons = db.getLessons(orgId);
  const accounts = db.getAccountsReceivable(orgId);
  const payments = db.getPayments(orgId);
  const expenses = db.getExpenses(orgId);

  // Selected student for individual report
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || '');
  const selectedStudent = students.find((s) => s.id === selectedStudentId) || students[0];

  // Financial aggregates
  const totalRecebidoCentavos = payments.reduce((acc, p) => acc + p.valorCentavos, 0);
  const totalTaxasCartaoCentavos = payments.reduce((acc, p) => acc + (p.taxaCentavos || 0), 0);
  const receitaLiquidaCentavos = totalRecebidoCentavos - totalTaxasCartaoCentavos;

  const totalDespesasCentavos = expenses
    .filter((e) => e.status === 'PAGA')
    .reduce((acc, e) => acc + e.valorCentavos, 0);
  const saldoLiquidoCentavos = receitaLiquidaCentavos - totalDespesasCentavos;

  // Student metrics
  const totalAulasCumpridas = students.reduce((acc, s) => acc + s.aulasCumpridas, 0);
  const alunosAptosExame = students.filter((s) => s.aulasCumpridas >= 18);

  // Trigger browser print dialog for PDF export
  const handleExportPDF = () => {
    window.print();
  };

  const handleExportCSV = () => {
    let csvContent = '';

    if (reportType === 'PERFORMANCE') {
      csvContent = 'Nome;CPF;Idade;Categoria;Aulas Cumpridas;Total Aulas;Media Habilidades;Status\n';
      students.forEach((s) => {
        const skillsVals = Object.values(s.habilidades);
        const avg = (skillsVals.reduce((a, b) => a + b, 0) / skillsVals.length).toFixed(1);
        csvContent += `${s.nome};${s.cpfMascarado};${s.idade};${s.categoriaCnh};${s.aulasCumpridas};${s.totalAulasContratadas};${avg};${s.status}\n`;
      });
    } else if (reportType === 'BILLING') {
      csvContent = 'Data;Tipo;Descricao;Valor (R$);Metodo/Categoria;Status\n';
      payments.forEach((p) => {
        csvContent += `${p.dataPagamento};Receita;Recebimento de Mensalidade;${(p.valorCentavos / 100).toFixed(2)};${p.metodo};PAGO\n`;
      });
      expenses.forEach((e) => {
        csvContent += `${e.dataVencimento};Despesa;${e.descricao};${(e.valorCentavos / 100).toFixed(2)};${e.categoria};${e.status}\n`;
      });
    } else if (reportType === 'STUDENT_CARD' && selectedStudent) {
      csvContent = 'Aluno;Competencia;Nota (0 a 10)\n';
      Object.entries(selectedStudent.habilidades).forEach(([key, val]) => {
        csvContent += `${selectedStudent.nome};${key};${val}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio_${reportType.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Header (Hidden during PDF print) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            Exportação de Relatórios Oficiais em PDF
          </h1>
          <p className="text-xs text-slate-500">
            Gere relatórios formatados para PDF com diagramação A4, dados do CFC, demonstrativos e assinaturas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Exportar CSV / Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer touch-target"
            title="Abrir diálogo de impressão e salvar como PDF"
          >
            <Printer className="w-4 h-4" />
            <span>Exportar / Salvar como PDF</span>
          </button>
        </div>
      </div>

      {/* PDF Export Helper Callout (Hidden during PDF print) */}
      <div className="no-print p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-start gap-3 text-xs text-slate-700 shadow-xs">
        <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-bold text-blue-950">
            Dica para salvar em PDF no computador ou celular:
          </p>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            Ao clicar no botão <strong>"Exportar / Salvar como PDF"</strong>, a janela de impressão abrirá. No campo <em>"Destino"</em> ou <em>"Impressora"</em>, selecione <strong>"Salvar como PDF"</strong> (ou <em>"Save as PDF"</em>). O documento já está configurado com folha A4, margens ideais, remoção de menus desnecessários e bloco de autenticação.
          </p>
        </div>
      </div>

      {/* Report Switcher Tabs (Hidden during PDF print) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1.5 bg-slate-200/80 rounded-2xl">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto shrink-0 pb-1 sm:pb-0">
          <button
            onClick={() => setReportType('PERFORMANCE')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              reportType === 'PERFORMANCE'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="sm:hidden">1. Desempenho Alunos</span>
            <span className="hidden sm:inline">1. Desempenho Geral dos Alunos</span>
          </button>
          <button
            onClick={() => setReportType('BILLING')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              reportType === 'BILLING'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="sm:hidden">2. Faturamento & DRE</span>
            <span className="hidden sm:inline">2. Faturamento & DRE Contábil</span>
          </button>
          <button
            onClick={() => setReportType('STUDENT_CARD')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              reportType === 'STUDENT_CARD'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="sm:hidden">3. Boletim Detran</span>
            <span className="hidden sm:inline">3. Boletim Individual do Aluno (Ficha Detran)</span>
          </button>
        </div>

        {/* Student picker if individual report selected */}
        {reportType === 'STUDENT_CARD' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-slate-300 w-full sm:w-auto">
            <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">Aluno:</span>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="text-xs font-bold text-slate-900 bg-transparent focus:outline-none w-full"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome} (CNH {s.categoriaCnh})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* OFFICIAL REPORT DOCUMENT (PRINTABLE & EXPORTABLE TO PDF VIA CSS PRINT)  */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-10 shadow-xs space-y-6 print:p-0 print:border-none print:shadow-none">
        {/* Document Official Header */}
        <div className="border-b-2 border-slate-900 pb-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold print-border shrink-0">
                <Car className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">
                  {currentOrg.nome}
                </h2>
                <p className="text-xs text-slate-600 font-medium">
                  {currentOrg.tipo === 'AUTOESCOLA_CFC' ? 'Centro de Formação de Condutores Credenciado' : 'Instrutoria Autônoma Credenciada Detran'} · CNPJ/CPF: {currentOrg.cnpjCpf}
                </p>
                <p className="text-[11px] text-slate-500">
                  {currentOrg.cidade} - {currentOrg.estado} · Tel: {currentOrg.telefone} · E-mail: {currentOrg.email}
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right text-xs text-slate-600 space-y-0.5 border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto">
              <span className="inline-block px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] font-bold border border-slate-300">
                VIA OFICIAL · PDF
              </span>
              <p className="font-semibold text-slate-900 mt-1">Data: {new Date().toLocaleDateString('pt-BR')}</p>
              <p className="text-[10px] text-slate-500 font-mono">Autenticação: AGD-DOC-{orgId.slice(-6).toUpperCase()}</p>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* REPORT 1: DESEMPENHO GERAL DOS ALUNOS                         */}
        {/* ------------------------------------------------------------- */}
        {reportType === 'PERFORMANCE' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-wide">
                  Relatório Pedagógico Geral de Alunos & Carga Horária Detran
                </h3>
                <p className="text-xs text-slate-600">
                  Controle das 20 aulas práticas mínimas exigidas pelo CTB/Contran e médias nas 8 competências veiculares.
                </p>
              </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:gap-2">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 print-card">
                <span className="text-[11px] text-slate-600 font-semibold block">Total de Alunos</span>
                <p className="text-xl font-black text-slate-900 font-mono mt-0.5">{students.length}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 print-card">
                <span className="text-[11px] text-slate-600 font-semibold block">Aulas Cumpridas</span>
                <p className="text-xl font-black text-slate-900 font-mono mt-0.5">{totalAulasCumpridas}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 print-card">
                <span className="text-[11px] text-slate-600 font-semibold block">Aptos p/ Prova Prática</span>
                <p className="text-xl font-black text-emerald-800 font-mono mt-0.5">{alunosAptosExame.length}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 print-card">
                <span className="text-[11px] text-slate-600 font-semibold block">Taxa de Prontidão</span>
                <p className="text-xl font-black text-blue-900 font-mono mt-0.5">
                  {students.length > 0 ? Math.round((alunosAptosExame.length / students.length) * 100) : 0}%
                </p>
              </div>
            </div>

            {/* Table of Students */}
            <div className="border border-slate-300 rounded-xl overflow-x-auto print:overflow-visible print-break-inside shadow-2xs">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300 uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Nome do Aluno</th>
                    <th className="py-2.5 px-3">CPF</th>
                    <th className="py-2.5 px-3">Idade</th>
                    <th className="py-2.5 px-3">CNH</th>
                    <th className="py-2.5 px-3">Carga Horária</th>
                    <th className="py-2.5 px-3 text-center">Baliza</th>
                    <th className="py-2.5 px-3 text-center">Rampa</th>
                    <th className="py-2.5 px-3 text-center">Trânsito</th>
                    <th className="py-2.5 px-3 text-center">Simulado</th>
                    <th className="py-2.5 px-3 text-right">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {students.map((s) => (
                    <tr key={s.id}>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{s.nome}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">{s.cpfMascarado}</td>
                      <td className="py-2.5 px-3">{s.idade} anos</td>
                      <td className="py-2.5 px-3 font-bold text-blue-900">Cat. {s.categoriaCnh}</td>
                      <td className="py-2.5 px-3 font-mono font-semibold">
                        {s.aulasCumpridas} / {s.totalAulasContratadas} aulas
                      </td>
                      <td className="py-2.5 px-3 font-mono text-center font-medium">{s.habilidades.baliza.toFixed(1)}</td>
                      <td className="py-2.5 px-3 font-mono text-center font-medium">{s.habilidades.controleEmbreagem.toFixed(1)}</td>
                      <td className="py-2.5 px-3 font-mono text-center font-medium">{s.habilidades.transitoPesado.toFixed(1)}</td>
                      <td className="py-2.5 px-3 font-mono text-center font-bold text-blue-900">{s.habilidades.simuladoExame.toFixed(1)}</td>
                      <td className="py-2.5 px-3 text-right font-semibold">
                        {s.aulasCumpridas >= 18 ? (
                          <span className="text-emerald-800">✓ Apto p/ Exame</span>
                        ) : (
                          <span className="text-slate-600">Em Formação</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* REPORT 2: FATURAMENTO & DRE CONTÁBIL                          */}
        {/* ------------------------------------------------------------- */}
        {reportType === 'BILLING' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-wide">
                Demonstrativo Contábil de Resultado (DRE) & Faturamento Gerencial
              </h3>
              <p className="text-xs text-slate-600">
                Relatório consolidado de receitas com pacotes de aulas, deduções de taxas, custos operacionais e margem líquida.
              </p>
            </div>

            {/* DRE Structured Financial Statement */}
            <div className="border border-slate-300 rounded-xl p-5 bg-slate-50/50 print-card space-y-3 text-xs sm:text-sm">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-300 font-bold text-slate-900">
                <span>(+) RECEITA BRUTA OPERACIONAL (MENSALIDADES E PACOTES)</span>
                <span className="font-mono text-emerald-800 text-base">{formatCurrencyBRL(totalRecebidoCentavos)}</span>
              </div>

              <div className="flex justify-between items-center py-1 text-slate-700 pl-4">
                <span>(-) Deduções de Intermediação & Taxas de Cartão de Crédito</span>
                <span className="font-mono text-red-700">({formatCurrencyBRL(totalTaxasCartaoCentavos)})</span>
              </div>

              <div className="flex justify-between items-center py-1.5 border-y border-slate-300 font-extrabold text-slate-900 bg-white px-3 rounded-lg print-border">
                <span>(=) RECEITA OPERACIONAL LÍQUIDA</span>
                <span className="font-mono text-base">{formatCurrencyBRL(receitaLiquidaCentavos)}</span>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-center font-bold text-slate-900">
                  <span>(-) DESPESAS OPERACIONAIS TOTAIS (PAGAS)</span>
                  <span className="font-mono text-amber-900">({formatCurrencyBRL(totalDespesasCentavos)})</span>
                </div>
                <div className="pl-4 space-y-1 text-slate-600 text-xs">
                  <div className="flex justify-between">
                    <span>Combustível e Lubrificantes</span>
                    <span className="font-mono">
                      {formatCurrencyBRL(expenses.filter((e) => e.categoria === 'COMBUSTIVEL').reduce((a, b) => a + b.valorCentavos, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Manutenção Corretiva e Preventiva dos Veículos</span>
                    <span className="font-mono">
                      {formatCurrencyBRL(expenses.filter((e) => e.categoria === 'MANUTENCAO_VEICULO').reduce((a, b) => a + b.valorCentavos, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Taxas e Credenciamento Detran / CFC</span>
                    <span className="font-mono">
                      {formatCurrencyBRL(expenses.filter((e) => e.categoria === 'TAXAS_DETRAN').reduce((a, b) => a + b.valorCentavos, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Seguro da Frota de Instrução</span>
                    <span className="font-mono">
                      {formatCurrencyBRL(expenses.filter((e) => e.categoria === 'SEGURO').reduce((a, b) => a + b.valorCentavos, 0))}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center py-3 border-t-2 border-slate-900 font-black text-slate-950 text-base bg-white px-3 rounded-lg print-border">
                <span>(=) RESULTADO LÍQUIDO DO PERÍODO (LUCRO OPERACIONAL)</span>
                <span className="font-mono text-lg text-emerald-800">{formatCurrencyBRL(saldoLiquidoCentavos)}</span>
              </div>
            </div>

            {/* Receipts Audit Table */}
            <div className="space-y-2 print-break-inside">
              <h4 className="font-bold text-slate-900 text-xs uppercase">Recebimentos no Período</h4>
              <div className="border border-slate-300 rounded-xl overflow-x-auto print:overflow-visible shadow-2xs">
                <table className="w-full text-left text-xs min-w-[550px]">
                  <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300 uppercase text-[10px]">
                    <tr>
                      <th className="py-2 px-3">Data</th>
                      <th className="py-2 px-3">Aluno</th>
                      <th className="py-2 px-3">Forma de Pagamento</th>
                      <th className="py-2 px-3">Comprovante</th>
                      <th className="py-2 px-3 text-right">Valor Recebido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {payments.map((p) => {
                      const student = students.find((s) => s.id === p.alunoId);
                      return (
                        <tr key={p.id}>
                          <td className="py-2 px-3 font-mono text-[11px]">{formatDateBR(p.dataPagamento)}</td>
                          <td className="py-2 px-3 font-bold text-slate-900">{student?.nome}</td>
                          <td className="py-2 px-3">{p.metodo} {p.parcelas ? `(${p.parcelas}x)` : ''}</td>
                          <td className="py-2 px-3 font-mono text-slate-600 text-[11px]">{p.comprovanteNumero || 'AUT-PIX'}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatCurrencyBRL(p.valorCentavos)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* REPORT 3: BOLETIM INDIVIDUAL DO ALUNO (FICHA OFICIAL DETRAN)  */}
        {/* ------------------------------------------------------------- */}
        {reportType === 'STUDENT_CARD' && selectedStudent && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-wide">
                  Boletim Pedagógico Individual de Direção Veicular
                </h3>
                <p className="text-xs text-slate-600">
                  Ficha oficial de aptidão prática e avaliação de competências do aluno para exame Detran.
                </p>
              </div>
            </div>

            {/* Student Dossier Header */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border border-slate-300 rounded-xl p-4 bg-slate-50 print-card text-xs">
              <div>
                <span className="text-slate-500 font-semibold block">Nome Completo:</span>
                <span className="font-bold text-slate-900 text-sm break-words">{selectedStudent.nome}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block">CPF (Mascarado):</span>
                <span className="font-mono font-semibold text-slate-900">{selectedStudent.cpfMascarado}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block">Idade / Nasc.:</span>
                <span className="font-semibold text-slate-900">{selectedStudent.idade} anos ({formatDateBR(selectedStudent.dataNascimento)})</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block">Categoria Pretendida:</span>
                <span className="font-bold text-blue-900 text-sm">CNH Categoria {selectedStudent.categoriaCnh}</span>
              </div>

              <div className="sm:col-span-2 pt-2 border-t border-slate-200">
                <span className="text-slate-500 font-semibold block">Instrutor Responsável Homologado:</span>
                <span className="font-bold text-slate-900">
                  {db.getUsers(orgId).find((u) => u.id === selectedStudent.instrutorId)?.nome || 'Carlos Eduardo Mendes'}
                </span>
              </div>
              <div className="sm:col-span-2 pt-2 border-t border-slate-200">
                <span className="text-slate-500 font-semibold block">Pacote Contratado:</span>
                <span className="font-bold text-blue-900 flex items-center gap-1 flex-wrap">
                  <Package className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                  <span>{selectedStudent.pacoteNome || 'Pacote Completo CNH B (20 Aulas Práticas)'}</span>
                </span>
              </div>
            </div>

            {/* Hours progression */}
            <div className="p-4 border border-slate-300 rounded-xl bg-white print-card space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-bold text-slate-900 gap-1">
                <span>Carga Horária Obrigatória Prática:</span>
                <span className="font-mono">{selectedStudent.aulasCumpridas} de {selectedStudent.totalAulasContratadas} aulas concluídas</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-blue-600 h-3 rounded-full print-border"
                  style={{ width: `${Math.min(100, (selectedStudent.aulasCumpridas / selectedStudent.totalAulasContratadas) * 100)}%` }}
                />
              </div>
            </div>

            {/* 8 Practical Competencies */}
            <div className="space-y-2 print-break-inside">
              <h4 className="font-bold text-slate-900 text-xs uppercase">
                Avaliação Detalhada das 8 Competências Práticas (Critérios Oficiais Detran)
              </h4>
              <div className="border border-slate-300 rounded-xl overflow-x-auto print:overflow-visible shadow-2xs">
                <table className="w-full text-left text-xs min-w-[500px]">
                  <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300 uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Competência Avaliada</th>
                      <th className="py-2.5 px-3 text-center">Nota (0 a 10)</th>
                      <th className="py-2.5 px-3">Conceito Pedagógico</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {[
                      { key: 'baliza', label: '1. Baliza / Estacionamento entre Balizadores', score: selectedStudent.habilidades.baliza },
                      { key: 'controleEmbreagem', label: '2. Controle de Embreagem & Rampa em Aclive', score: selectedStudent.habilidades.controleEmbreagem },
                      { key: 'transitoPesado', label: '3. Trânsito Pesado & Fluidez na Via', score: selectedStudent.habilidades.transitoPesado },
                      { key: 'conversoesCruzamentos', label: '4. Conversões, Cruzamentos e Rotatórias', score: selectedStudent.habilidades.conversoesCruzamentos },
                      { key: 'rodoviaVelocidade', label: '5. Rodovia / Troca de Marchas e Velocidade', score: selectedStudent.habilidades.rodoviaVelocidade },
                      { key: 'sinalizacaoPreferencia', label: '6. Sinalização, Retrovisores e Preferências', score: selectedStudent.habilidades.sinalizacaoPreferencia },
                      { key: 'posturaDefensiva', label: '7. Postura ao Volante e Direção Defensiva', score: selectedStudent.habilidades.posturaDefensiva },
                      { key: 'simuladoExame', label: '8. Simulado de Exame Prático Oficial Detran', score: selectedStudent.habilidades.simuladoExame }
                    ].map((comp) => (
                      <tr key={comp.key}>
                        <td className="py-2 px-3 font-semibold text-slate-900">{comp.label}</td>
                        <td className="py-2 px-3 font-mono font-bold text-center text-sm">{comp.score.toFixed(1)}</td>
                        <td className="py-2 px-3 font-medium">
                          {comp.score >= 8.5 ? (
                            <span className="text-emerald-800">Excelente / Domínio Completo</span>
                          ) : comp.score >= 7.0 ? (
                            <span className="text-blue-800">Bom / Aprovado</span>
                          ) : (
                            <span className="text-amber-800">Necessita Prática Adicional</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Instructor Notes */}
            {selectedStudent.observacoesInstrutor && (
              <div className="p-3.5 border border-slate-300 rounded-xl bg-slate-50 print-card space-y-1 text-xs">
                <span className="font-bold text-slate-900 block uppercase tracking-wider text-[10px]">
                  Parecer Técnico e Observações do Instrutor de Trânsito:
                </span>
                <p className="text-slate-800 italic leading-relaxed">
                  "{selectedStudent.observacoesInstrutor}"
                </p>
              </div>
            )}

            {/* Transfer History Audit Log Table */}
            <div className="space-y-2 print-break-inside">
              <h4 className="font-bold text-slate-900 text-xs uppercase flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-blue-700" />
                Histórico Oficial de Transferências de Instrutor (Rastreabilidade & Auditoria)
              </h4>
              {selectedStudent.historicoTransferencias && selectedStudent.historicoTransferencias.length > 0 ? (
                <div className="border border-slate-300 rounded-xl overflow-x-auto print:overflow-visible shadow-2xs">
                  <table className="w-full text-left text-xs min-w-[550px]">
                    <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300 uppercase text-[10px]">
                      <tr>
                        <th className="py-2 px-3">Data</th>
                        <th className="py-2 px-3">Instrutor Anterior</th>
                        <th className="py-2 px-3">Novo Instrutor</th>
                        <th className="py-2 px-3">Aulas no Momento</th>
                        <th className="py-2 px-3">Motivo Registrado</th>
                        <th className="py-2 px-3 text-right">Homologado por</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {selectedStudent.historicoTransferencias.map((trf) => (
                        <tr key={trf.id}>
                          <td className="py-2 px-3 font-mono font-bold text-[11px]">{formatDateBR(trf.dataTransferencia.slice(0, 10))}</td>
                          <td className="py-2 px-3">{trf.instrutorAnteriorNome}</td>
                          <td className="py-2 px-3 font-bold text-blue-900">{trf.instrutorNovoNome}</td>
                          <td className="py-2 px-3 font-mono">{trf.aulasCumpridasAteTransferencia} aulas</td>
                          <td className="py-2 px-3">{trf.motivo}</td>
                          <td className="py-2 px-3 text-right font-medium text-slate-600">{trf.autorNome}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-[11px] text-slate-600 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Vínculo original direto com o instrutor atual. Sem transferências anteriores registradas.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* OFFICIAL SIGNATURE BLOCK FOR PRINTABLE PDF (ALWAYS PRINTED)   */}
        {/* ------------------------------------------------------------- */}
        <div className="pt-8 border-t-2 border-slate-300 print-avoid-break space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 text-center text-xs">
            <div className="space-y-1.5">
              <div className="border-b border-slate-900 w-3/4 mx-auto pb-1" />
              <p className="font-bold text-slate-900">{currentUser.nome}</p>
              <p className="text-[11px] text-slate-600">Instrutor de Trânsito Credenciado · Detran</p>
            </div>
            <div className="space-y-1.5">
              <div className="border-b border-slate-900 w-3/4 mx-auto pb-1" />
              <p className="font-bold text-slate-900">
                {reportType === 'STUDENT_CARD' && selectedStudent ? selectedStudent.nome : 'Diretoria de Ensino / CFC'}
              </p>
              <p className="text-[11px] text-slate-600">
                {reportType === 'STUDENT_CARD' ? 'Assinatura do Aluno Condutor' : 'Visto e Homologação da Instituição'}
              </p>
            </div>
          </div>

          <div className="text-center text-[10px] text-slate-500 space-y-0.5 pt-2">
            <p>
              Documento emitido eletronicamente pela plataforma <strong>Sistema de Administração de Gestão de Direção</strong> sob as diretrizes do CTB e Resoluções CONTRAN.
            </p>
            <p className="font-mono">
              Chave de Verificação: {orgId}-{new Date().getTime().toString(36).toUpperCase()} · Válido em todo o território nacional.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
