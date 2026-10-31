import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from './storage';
import { formatCurrencyBRL, formatDateBR } from './validation';
import type { PaymentRecord, Student, Expense, Investment, User, Organization } from '../types';

export interface IrpfStudentSummary {
  alunoId: string;
  nome: string;
  cpf: string;
  telefone: string;
  totalAnoCentavos: number;
  meses: { [mes: number]: number }; // 1 to 12 -> valorCentavos
  metodos: string[];
  totalPagamentos: number;
}

export interface IrpfMonthSummary {
  mesNumero: number;
  mesNome: string;
  receitaBrutaCentavos: number;
  despesasLivroCaixaCentavos: number;
  rendimentoLiquidoCentavos: number;
  totalAlunosPagantes: number;
}

export interface IrpfReportData {
  ano: number;
  dataGeracao: string;
  instrutor: {
    nome: string;
    email: string;
    cpfOuCnpj?: string;
    organizacaoNome: string;
  };
  totais: {
    receitaBrutaCentavos: number;
    despesasLivroCaixaCentavos: number;
    rendimentoLiquidoCentavos: number;
    totalInvestimentosCentavos: number;
    totalAlunosAtendidos: number;
  };
  meses: IrpfMonthSummary[];
  alunos: IrpfStudentSummary[];
  despesasPorCategoria: {
    categoria: string;
    totalCentavos: number;
    quantidade: number;
  }[];
  investimentos: {
    titulo: string;
    categoria: string;
    valorAcumuladoCentavos: number;
    valorMetaCentavos: number;
  }[];
}

const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function buildIrpfReportData(orgId: string, ano: number, instructorUser?: User): IrpfReportData {
  const allPayments = db.getPayments(orgId);
  const allStudents = db.getStudents(orgId);
  const allExpenses = db.getExpenses(orgId);
  const allInvestments = db.getInvestments(orgId);
  const org = db.getOrganization(orgId);

  // Filtra pagamentos do ano selecionado
  const pagamentosAno = allPayments.filter((p) => {
    if (!p.dataPagamento) return false;
    const paymentYear = new Date(p.dataPagamento).getFullYear();
    return paymentYear === ano;
  });

  // Filtra despesas do ano selecionado (apenas pagas entram no Livro-Caixa do IRPF)
  const despesasAno = allExpenses.filter((e) => {
    const dataRef = e.dataPagamento || e.dataVencimento;
    if (!dataRef) return false;
    const expYear = new Date(dataRef).getFullYear();
    return expYear === ano && e.status === 'PAGA';
  });

  // Agrupamento mês a mês (1 a 12)
  const mesesData: IrpfMonthSummary[] = MESES_NOMES.map((nome, index) => {
    const mesNum = index + 1;

    const pagamentosMes = pagamentosAno.filter((p) => {
      const m = new Date(p.dataPagamento).getMonth() + 1;
      return m === mesNum;
    });

    const despesasMes = despesasAno.filter((e) => {
      const dataRef = e.dataPagamento || e.dataVencimento;
      const m = new Date(dataRef).getMonth() + 1;
      return m === mesNum;
    });

    const receitaBruta = pagamentosMes.reduce((acc, p) => acc + p.valorCentavos, 0);
    const despesasTotal = despesasMes.reduce((acc, e) => acc + e.valorCentavos, 0);
    const alunosDistintos = new Set(pagamentosMes.map((p) => p.alunoId)).size;

    return {
      mesNumero: mesNum,
      mesNome: nome,
      receitaBrutaCentavos: receitaBruta,
      despesasLivroCaixaCentavos: despesasTotal,
      rendimentoLiquidoCentavos: Math.max(0, receitaBruta - despesasTotal),
      totalAlunosPagantes: alunosDistintos
    };
  });

  // Agrupamento por Aluno (Discriminação individual para o IRPF)
  const alunosMap: Record<string, IrpfStudentSummary> = {};

  pagamentosAno.forEach((p) => {
    const student = allStudents.find((s) => s.id === p.alunoId);
    const nome = student?.nome || 'Aluno Não Identificado';
    const cpf = student?.cpfMascarado || '***.***.***-**';
    const telefone = student?.telefone || '';
    const mesPagto = new Date(p.dataPagamento).getMonth() + 1;

    if (!alunosMap[p.alunoId]) {
      alunosMap[p.alunoId] = {
        alunoId: p.alunoId,
        nome,
        cpf,
        telefone,
        totalAnoCentavos: 0,
        meses: {},
        metodos: [],
        totalPagamentos: 0
      };
    }

    alunosMap[p.alunoId].totalAnoCentavos += p.valorCentavos;
    alunosMap[p.alunoId].meses[mesPagto] = (alunosMap[p.alunoId].meses[mesPagto] || 0) + p.valorCentavos;
    alunosMap[p.alunoId].totalPagamentos += 1;

    if (!alunosMap[p.alunoId].metodos.includes(p.metodo)) {
      alunosMap[p.alunoId].metodos.push(p.metodo);
    }
  });

  const alunosList = Object.values(alunosMap).sort((a, b) => b.totalAnoCentavos - a.totalAnoCentavos);

  // Despesas agrupadas por categoria
  const categoriasMap: Record<string, { totalCentavos: number; quantidade: number }> = {};
  despesasAno.forEach((e) => {
    if (!categoriasMap[e.categoria]) {
      categoriasMap[e.categoria] = { totalCentavos: 0, quantidade: 0 };
    }
    categoriasMap[e.categoria].totalCentavos += e.valorCentavos;
    categoriasMap[e.categoria].quantidade += 1;
  });

  const despesasPorCategoria = Object.entries(categoriasMap).map(([categoria, info]) => ({
    categoria,
    totalCentavos: info.totalCentavos,
    quantidade: info.quantidade
  })).sort((a, b) => b.totalCentavos - a.totalCentavos);

  const totalReceita = pagamentosAno.reduce((acc, p) => acc + p.valorCentavos, 0);
  const totalDespesas = despesasAno.reduce((acc, e) => acc + e.valorCentavos, 0);

  return {
    ano,
    dataGeracao: new Date().toISOString(),
    instrutor: {
      nome: instructorUser?.nome || 'Instrutor de Trânsito Credenciado',
      email: instructorUser?.email || 'cassiordcosta@gmail.com',
      cpfOuCnpj: instructorUser?.cpfMascarado || org?.cnpjCpf || '***.***.***-**',
      organizacaoNome: org?.nome || 'Centro de Formação de Condutores'
    },
    totais: {
      receitaBrutaCentavos: totalReceita,
      despesasLivroCaixaCentavos: totalDespesas,
      rendimentoLiquidoCentavos: Math.max(0, totalReceita - totalDespesas),
      totalInvestimentosCentavos: allInvestments.reduce((acc, i) => acc + i.valorAcumuladoCentavos, 0),
      totalAlunosAtendidos: alunosList.length
    },
    meses: mesesData,
    alunos: alunosList,
    despesasPorCategoria,
    investimentos: allInvestments.map((i) => ({
      titulo: i.titulo,
      categoria: i.categoria,
      valorAcumuladoCentavos: i.valorAcumuladoCentavos,
      valorMetaCentavos: i.valorMetaCentavos
    }))
  };
}

/**
 * Gera documento PDF Oficial do Relatório IRPF / Carnê-Leão
 */
export function generateIrpfPdf(data: IrpfReportData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2);

  const primaryColor: [number, number, number] = [37, 99, 235]; // #2563eb
  const darkColor: [number, number, number] = [15, 23, 42]; // #0f172a
  const slateColor: [number, number, number] = [71, 85, 105]; // #475569
  const greenColor: [number, number, number] = [5, 150, 105]; // #059669
  const lightBg: [number, number, number] = [248, 250, 252]; // #f8fafc

  let y = margin;

  // --- CABEÇALHO DO DOCUMENTO FISCAL ---
  doc.setFillColor(...primaryColor);
  doc.rect(margin, y, contentWidth, 3, 'F');
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...primaryColor);
  doc.text('RECEITA FEDERAL DO BRASIL · CARNÊ-LEÃO / LIVRO-CAIXA DIGITAL', margin, y);
  doc.setFontSize(7.5);
  doc.setTextColor(...greenColor);
  doc.text(`ANO-CALENDÁRIO: ${data.ano}`, pageWidth - margin, y, { align: 'right' });
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...darkColor);
  doc.text('DEMONSTRATIVO FISCAL ANUAL PARA IRPF', margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...slateColor);
  doc.text('Relatório Oficial de Rendimentos de Trabalho Não-Assalariado (Instrutor Autônomo) e Livro-Caixa', margin, y);
  y += 6;

  // Bloco de Identificação do Contribuinte
  doc.setFillColor(...lightBg);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 20, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkColor);
  doc.text('Contribuinte / Instrutor:', margin + 4, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(data.instrutor.nome, margin + 40, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.text('E-mail / Login:', margin + 4, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.text(data.instrutor.email, margin + 40, y + 10);

  doc.setFont('helvetica', 'bold');
  doc.text('Centro de Formação / CFC:', margin + 4, y + 15);
  doc.setFont('helvetica', 'normal');
  doc.text(data.instrutor.organizacaoNome, margin + 40, y + 15);

  doc.setFont('helvetica', 'bold');
  doc.text('Ano-Base IRPF:', margin + 110, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(String(data.ano), margin + 140, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.text('Emissão do Relatório:', margin + 110, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDateBR(data.dataGeracao.slice(0, 10)), margin + 140, y + 10);

  doc.setFont('helvetica', 'bold');
  doc.text('Alunos Declarados:', margin + 110, y + 15);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.totais.totalAlunosAtendidos} alunos`, margin + 140, y + 15);

  y += 26;

  // Cards de Totais
  const cardW = (contentWidth - 6) / 3;

  // Card 1: Receita Bruta
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(margin, y, cardW, 16, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateColor);
  doc.text('Receita Bruta Total (Alunos)', margin + 4, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text(formatCurrencyBRL(data.totais.receitaBrutaCentavos), margin + 4, y + 12);

  // Card 2: Despesas Livro-Caixa
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(margin + cardW + 3, y, cardW, 16, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateColor);
  doc.text('Despesas Dedutíveis (Livro-Caixa)', margin + cardW + 7, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(225, 29, 72);
  doc.text(formatCurrencyBRL(data.totais.despesasLivroCaixaCentavos), margin + cardW + 7, y + 12);

  // Card 3: Rendimento Líquido Tributável
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(margin + (cardW * 2) + 6, y, cardW, 16, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateColor);
  doc.text('Rendimento Tributável Líquido', margin + (cardW * 2) + 10, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...greenColor);
  doc.text(formatCurrencyBRL(data.totais.rendimentoLiquidoCentavos), margin + (cardW * 2) + 10, y + 12);

  y += 22;

  // --- TABELA 1: CARNÊ-LEÃO MENSAL (JANEIRO A DEZEMBRO) ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  doc.text('1. APURAÇÃO MENSAL DO CARNÊ-LEÃO (LIVRO-CAIXA DIGITAL)', margin, y);
  y += 3;

  const mesesTableBody = data.meses.map((m) => [
    m.mesNome,
    formatCurrencyBRL(m.receitaBrutaCentavos),
    formatCurrencyBRL(m.despesasLivroCaixaCentavos),
    formatCurrencyBRL(m.rendimentoLiquidoCentavos),
    `${m.totalAlunosPagantes} aluno(s)`
  ]);

  // Linha de total anual
  mesesTableBody.push([
    'TOTAL ANUAL CONSOLIDADO',
    formatCurrencyBRL(data.totais.receitaBrutaCentavos),
    formatCurrencyBRL(data.totais.despesasLivroCaixaCentavos),
    formatCurrencyBRL(data.totais.rendimentoLiquidoCentavos),
    `${data.totais.totalAlunosAtendidos} alunos totais`
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: 1.8
    },
    bodyStyles: {
      textColor: darkColor,
      fontSize: 7,
      cellPadding: 1.6
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    head: [['Mês de Competência', 'Receita Bruta (Alunos)', 'Despesas Livro-Caixa', 'Rendimento Líquido', 'Alunos no Mês']],
    body: mesesTableBody
  });

  // Quebra de página para o detalhamento individual por aluno
  doc.addPage();
  y = margin + 5;

  // --- TABELA 2: DISCRIMINAÇÃO INDIVIDUAL POR ALUNO PARA O IRPF ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  doc.text('2. DISCRIMINAÇÃO INDIVIDUAL POR ALUNO (RENDIMENTOS DE PESSOA FÍSICA)', margin, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateColor);
  doc.text('Informações exigidas para lançamento no Carnê-Leão e declaração de ajuste anual do IRPF (Nome, CPF e Valores):', margin, y);
  y += 3;

  const alunosTableBody = data.alunos.map((a, idx) => {
    // Meses com pagamento
    const mesesPagos = Object.entries(a.meses)
      .map(([m, val]) => `${MESES_NOMES[parseInt(m) - 1].slice(0, 3)}: ${formatCurrencyBRL(val)}`)
      .join('; ');

    return [
      String(idx + 1),
      a.nome,
      a.cpf,
      mesesPagos || 'Nenhum',
      a.metodos.join(', '),
      formatCurrencyBRL(a.totalAnoCentavos)
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: darkColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: 1.8
    },
    bodyStyles: {
      textColor: darkColor,
      fontSize: 6.8,
      cellPadding: 1.5
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    head: [['#', 'Nome do Aluno (Fonte Pagadora)', 'CPF do Aluno', 'Discriminação por Mês de Pagamento', 'Forma(s)', 'Total no Ano']],
    body: alunosTableBody
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Se não couber as despesas na mesma página, adiciona outra
  if (y > pageHeight - 60) {
    doc.addPage();
    y = margin + 5;
  }

  // --- TABELA 3: DESPESAS DEDUTÍVEIS DO LIVRO-CAIXA ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  doc.text('3. DESPESAS OPERACIONAIS DEDUTÍVEIS (LIVRO-CAIXA DO AUTÔNOMO)', margin, y);
  y += 3;

  const despesasTableBody = data.despesasPorCategoria.map((d) => [
    d.categoria.replace('_', ' '),
    `${d.quantidade} lançamento(s)`,
    formatCurrencyBRL(d.totalCentavos),
    `${((d.totalCentavos / (data.totais.despesasLivroCaixaCentavos || 1)) * 100).toFixed(1)}%`
  ]);

  despesasTableBody.push([
    'TOTAL DAS DESPESAS DEDUTÍVEIS',
    `${data.despesasPorCategoria.reduce((acc, c) => acc + c.quantidade, 0)} total`,
    formatCurrencyBRL(data.totais.despesasLivroCaixaCentavos),
    '100.0%'
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: [225, 29, 72],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: 1.8
    },
    bodyStyles: {
      textColor: darkColor,
      fontSize: 7,
      cellPadding: 1.5
    },
    alternateRowStyles: {
      fillColor: [254, 242, 242]
    },
    head: [['Categoria de Despesa', 'Lançamentos', 'Total Pago no Ano', 'Percentual']],
    body: despesasTableBody
  });

  y = (doc as any).lastAutoTable.finalY + 14;

  // Bloco de Assinatura do Relatório Fiscal
  if (y > pageHeight - 40) {
    doc.addPage();
    y = margin + 15;
  }

  doc.setDrawColor(71, 85, 105);
  doc.line(margin + 20, y, pageWidth - margin - 20, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkColor);
  doc.text(data.instrutor.nome, pageWidth / 2, y + 4, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateColor);
  doc.text(`Instrutor de Trânsito Autônomo · Declaração Fiscal de Rendimentos e Livro-Caixa ${data.ano}`, pageWidth / 2, y + 8, { align: 'center' });
  doc.text(`Documento gerado em conformidade com as regras da Receita Federal do Brasil (Carnê-Leão)`, pageWidth / 2, y + 12, { align: 'center' });

  // Rodapés em todas as páginas
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...slateColor);
    doc.text(
      `Relatório Fiscal IRPF ${data.ano} · ${data.instrutor.nome} · Auto Gestão de Direção`,
      margin,
      pageHeight - 6
    );

    doc.setFont('helvetica', 'bold');
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  }

  return doc;
}

export function downloadIrpfPdf(data: IrpfReportData, filename?: string): boolean {
  try {
    const doc = generateIrpfPdf(data);
    const fname = filename || `RELATORIO_IRPF_${data.ano}_${data.instrutor.nome.replace(/\s+/g, '_')}.pdf`;
    doc.save(fname);
    return true;
  } catch (err) {
    console.error('Erro ao baixar PDF do IRPF:', err);
    return false;
  }
}

export function generateIrpfCsv(data: IrpfReportData): string {
  let csv = `RELATORIO FISCAL IRPF / CARNE-LEAO - ANO ${data.ano}\n`;
  csv += `Contribuinte:;${data.instrutor.nome}\n`;
  csv += `E-mail:;${data.instrutor.email}\n`;
  csv += `Emissao:;${formatDateBR(data.dataGeracao.slice(0, 10))}\n\n`;

  csv += `APURACAO MENSAL CARNE-LEAO (LIVRO-CAIXA)\n`;
  csv += `Mes;Receita Bruta (R$);Despesas Livro-Caixa (R$);Rendimento Liquido (R$);Alunos Pagantes\n`;
  data.meses.forEach((m) => {
    csv += `${m.mesNome};${(m.receitaBrutaCentavos / 100).toFixed(2)};${(m.despesasLivroCaixaCentavos / 100).toFixed(2)};${(m.rendimentoLiquidoCentavos / 100).toFixed(2)};${m.totalAlunosPagantes}\n`;
  });
  csv += `TOTAL ANUAL;${(data.totais.receitaBrutaCentavos / 100).toFixed(2)};${(data.totais.despesasLivroCaixaCentavos / 100).toFixed(2)};${(data.totais.rendimentoLiquidoCentavos / 100).toFixed(2)};${data.totais.totalAlunosAtendidos}\n\n`;

  csv += `DISCRIMINACAO INDIVIDUAL POR ALUNO (FONTE PAGADORA PF)\n`;
  csv += `Nome do Aluno;CPF;Total Anual (R$);Formas de Pagamento\n`;
  data.alunos.forEach((a) => {
    csv += `"${a.nome}";"${a.cpf}";${(a.totalAnoCentavos / 100).toFixed(2)};"${a.metodos.join(', ')}"\n`;
  });

  return csv;
}

export function downloadIrpfCsv(data: IrpfReportData): void {
  const csvContent = generateIrpfCsv(data);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `RELATORIO_IRPF_${data.ano}_LIVRO_CAIXA.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
