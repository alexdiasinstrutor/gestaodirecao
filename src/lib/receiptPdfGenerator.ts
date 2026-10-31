import jsPDF from 'jspdf';
import { formatCurrencyBRL, formatDateBR } from './validation';
import type { PaymentMethod } from '../types';

export interface PaymentReceiptData {
  id: string;
  numeroRecibo: string;
  dataEmissao: string;
  dataPagamento: string;
  valorCentavos: number;
  metodo: PaymentMethod;
  tipoRecibo: 'PARCELA' | 'PERIODO' | 'QUITACAO_TOTAL' | 'AVULSO';
  parcelaReferente?: string;
  periodoReferente?: string;
  descricaoServico: string;
  aluno: {
    nome: string;
    cpfMascarado: string;
    telefone: string;
    email: string;
    categoriaCnh: string;
  };
  instrutor: {
    nome: string;
    documento?: string;
    telefone?: string;
    cidade?: string;
    estado?: string;
  };
  observacoes?: string;
  codigoAutenticacao: string;
}

/**
 * Converte valor em centavos para texto por extenso em português
 */
export function numberToWordsBRL(centavos: number): string {
  const reais = Math.floor((centavos || 0) / 100);
  const centavosResto = (centavos || 0) % 100;

  if (reais === 0 && centavosResto === 0) return 'zero reais';

  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const dezenasEspeciais: Record<number, string> = {
    10: 'dez', 11: 'onze', 12: 'doze', 13: 'treze', 14: 'quatorze',
    15: 'quinze', 16: 'dezesseis', 17: 'dezessete', 18: 'dezoito', 19: 'dezenove'
  };
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  function converterGrupo(n: number): string {
    if (n === 0) return '';
    if (n === 100) return 'cem';

    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;

    const partes: string[] = [];
    if (c > 0) partes.push(centenas[c]);

    const resto = n % 100;
    if (resto >= 10 && resto <= 19) {
      partes.push(dezenasEspeciais[resto]);
    } else {
      if (d > 0) partes.push(dezenas[d]);
      if (u > 0) partes.push(unidades[u]);
    }

    return partes.join(' e ');
  }

  const milhares = Math.floor(reais / 1000);
  const unidadesReais = reais % 1000;

  const partesReais: string[] = [];

  if (milhares > 0) {
    if (milhares === 1) {
      partesReais.push('mil');
    } else {
      partesReais.push(`${converterGrupo(milhares)} mil`);
    }
  }

  if (unidadesReais > 0) {
    partesReais.push(converterGrupo(unidadesReais));
  }

  let textoReais = partesReais.join(' e ');
  if (reais === 1) {
    textoReais += ' real';
  } else if (reais > 1) {
    textoReais += ' reais';
  }

  const partesCentavos: string[] = [];
  if (centavosResto > 0) {
    const textoCentavos = converterGrupo(centavosResto);
    partesCentavos.push(`${textoCentavos} ${centavosResto === 1 ? 'centavo' : 'centavos'}`);
  }

  if (textoReais && partesCentavos.length > 0) {
    return `${textoReais} e ${partesCentavos.join(' e ')}`;
  } else if (textoReais) {
    return textoReais;
  } else if (partesCentavos.length > 0) {
    return partesCentavos.join(' e ');
  }

  return 'zero reais';
}

/**
 * Gera documento PDF do Recibo de Pagamento Digital (Apenas Via do Aluno)
 */
export function generateReceiptPdf(data: PaymentReceiptData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentWidth = pageWidth - (margin * 2);

  const primaryColor: [number, number, number] = [37, 99, 235]; // #2563eb
  const darkColor: [number, number, number] = [15, 23, 42]; // #0f172a
  const slateColor: [number, number, number] = [71, 85, 105]; // #475569
  const greenColor: [number, number, number] = [5, 150, 105]; // #059669
  const lightBg: [number, number, number] = [248, 250, 252]; // #f8fafc

  let y = margin;

  // Caixa Principal do Recibo Digital (Ocupa a metade superior com layout arejado e elegante)
  const cardHeight = 165;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(...lightBg);
  doc.roundedRect(margin, y, contentWidth, cardHeight, 4, 4, 'FD');

  // Faixa superior com identidade visual
  doc.setFillColor(...primaryColor);
  doc.roundedRect(margin, y, contentWidth, 10, 4, 4, 'F');
  doc.rect(margin, y + 5, contentWidth, 5, 'F'); // ajusta base reta

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('SISTEMA DE GESTÃO DE DIREÇÃO · COMPROVANTE DE PAGAMENTO DE AULAS', margin + 6, y + 6.8);
  doc.text('RECIBO DIGITAL · VIA DO ALUNO', margin + contentWidth - 6, y + 6.8, { align: 'right' });

  y += 18;

  // Linha 1: Título "RECIBO DE PAGAMENTO" + Valor em Destaque
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...darkColor);
  doc.text('RECIBO DE PAGAMENTO', margin + 6, y);

  // Card do Valor Pago
  const valorFormatado = formatCurrencyBRL(data.valorCentavos);
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(...greenColor);
  doc.roundedRect(margin + contentWidth - 52, y - 7, 46, 11, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...greenColor);
  doc.text(valorFormatado, margin + contentWidth - 29, y + 0.5, { align: 'center' });

  y += 6;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...slateColor);
  doc.text(`Nº do Recibo: ${data.numeroRecibo} · Data de Emissão: ${formatDateBR(data.dataEmissao)}`, margin + 6, y);

  y += 7;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin + 6, y, margin + contentWidth - 6, y);
  y += 7;

  // Linha 2: Texto Principal Declaratório
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...darkColor);

  const valorExtenso = numberToWordsBRL(data.valorCentavos);
  const textoDeclaracao = `Recebemos de ${data.aluno.nome.toUpperCase()}, inscrito(a) no CPF nº ${data.aluno.cpfMascarado}, a quantia de ${valorFormatado} (${valorExtenso}), referente à prestação de serviços de aulas práticas de direção veicular.`;

  const splitTexto = doc.splitTextToSize(textoDeclaracao, contentWidth - 12);
  doc.text(splitTexto, margin + 6, y);
  y += splitTexto.length * 5 + 3;

  // Caixa de Detalhes dos Serviços
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin + 6, y, contentWidth - 12, 34, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryColor);
  doc.text('DETALHAMENTO DO SERVIÇO CONTRATADO:', margin + 10, y + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...darkColor);
  doc.text(`• Serviço: ${data.descricaoServico}`, margin + 10, y + 13);

  let detalheModalidade = '';
  if (data.tipoRecibo === 'PARCELA') {
    detalheModalidade = `• Modalidade: Pagamento parcelado (${data.parcelaReferente || 'Parcela'})`;
  } else if (data.tipoRecibo === 'PERIODO') {
    detalheModalidade = `• Modalidade: Aulas correspondentes ao período (${data.periodoReferente || 'Período'})`;
  } else if (data.tipoRecibo === 'AVULSO') {
    detalheModalidade = '• Modalidade: Aula avulsa / Treinamento prático de reforço';
  } else {
    detalheModalidade = '• Modalidade: Quitação integral de pacote de aulas práticas';
  }
  doc.text(detalheModalidade, margin + 10, y + 19);

  const metodoLabel = data.metodo === 'PIX' ? 'PIX (Transferência Instantânea)' :
                     data.metodo === 'CARTAO_CREDITO' ? 'Cartão de Crédito' :
                     data.metodo === 'DINHEIRO' ? 'Dinheiro em Espécie' : 'Transferência Bancária';

  doc.text(`• Forma de Pagamento: ${metodoLabel} · Data do Pagamento: ${formatDateBR(data.dataPagamento)}`, margin + 10, y + 25);
  doc.text(`• Aluno: ${data.aluno.nome} · Categoria CNH: ${data.aluno.categoriaCnh} · Telefone: ${data.aluno.telefone}`, margin + 10, y + 30);

  y += 39;

  // Observações (se houver)
  if (data.observacoes) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...slateColor);
    doc.text(`Observações: ${data.observacoes}`, margin + 6, y);
    y += 6;
  }

  // Bloco Inferior: Dados do Instrutor e Linha de Assinatura
  const blocoAssinaturaY = y + 22;
  const metadeLargura = (contentWidth - 12) / 2;

  // Lado Esquerdo: Dados do Instrutor / Emissor
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...darkColor);
  doc.text('EMITIDO POR:', margin + 6, blocoAssinaturaY - 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateColor);
  doc.text(`Instrutor: ${data.instrutor.nome}`, margin + 6, blocoAssinaturaY - 6);
  if (data.instrutor.telefone) {
    doc.text(`Contato: ${data.instrutor.telefone}`, margin + 6, blocoAssinaturaY - 1.5);
  }
  doc.text(`Local: ${data.instrutor.cidade || 'Brasil'} - ${data.instrutor.estado || 'BR'}`, margin + 6, blocoAssinaturaY + 3);
  doc.text(`Data: ${formatDateBR(data.dataPagamento || data.dataEmissao)}`, margin + 6, blocoAssinaturaY + 7.5);

  // Lado Direito: Linha de Assinatura do Instrutor
  const signX = margin + metadeLargura + 10;
  doc.setDrawColor(...darkColor);
  doc.line(signX, blocoAssinaturaY - 2, margin + contentWidth - 6, blocoAssinaturaY - 2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...darkColor);
  doc.text(data.instrutor.nome, signX + (contentWidth - 12 - metadeLargura) / 2, blocoAssinaturaY + 3, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...slateColor);
  doc.text('Instrutor Credenciado de Trânsito', signX + (contentWidth - 12 - metadeLargura) / 2, blocoAssinaturaY + 7.5, { align: 'center' });

  // Rodapé do Recibo Digital: Autenticação Limpa
  const rodapeY = margin + cardHeight - 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Autenticação Digital: ${data.codigoAutenticacao} · Comprovante digital emitido via Sistema de Gestão de Direção`,
    pageWidth / 2,
    rodapeY,
    { align: 'center' }
  );

  return doc;
}

/**
 * Dispara o download direto do recibo digital em PDF
 */
export function downloadReceiptPdf(data: PaymentReceiptData): boolean {
  try {
    const doc = generateReceiptPdf(data);
    const fileName = `Recibo_${data.numeroRecibo.replace(/\s+/g, '_')}_${data.aluno.nome.replace(/\s+/g, '_').slice(0, 15)}.pdf`;
    doc.save(fileName);
    return true;
  } catch (err) {
    console.error('Erro ao gerar PDF do recibo:', err);
    return false;
  }
}

/**
 * Cria a mensagem de texto com link direto para WhatsApp
 */
export function generateWhatsAppReceiptMessage(data: PaymentReceiptData): string {
  const valorFormatado = formatCurrencyBRL(data.valorCentavos);
  const dataFormatada = formatDateBR(data.dataPagamento);
  
  let modalidade = '';
  if (data.tipoRecibo === 'PARCELA') {
    modalidade = `Parcela: *${data.parcelaReferente || 'Parcela'}*`;
  } else if (data.tipoRecibo === 'PERIODO') {
    modalidade = `Período: *${data.periodoReferente || 'Aulas'}*`;
  } else if (data.tipoRecibo === 'AVULSO') {
    modalidade = 'Modalidade: *Aula Avulsa / Reforço*';
  } else {
    modalidade = 'Modalidade: *Quitação Integral do Pacote*';
  }

  const msg = `*RECIBO DE PAGAMENTO DE AULAS PRÁTICAS* 🚗💨
---------------------------------------
Olá, *${data.aluno.nome}*!
Confirmamos o recebimento do seu pagamento com sucesso.

📄 *Recibo:* Nº ${data.numeroRecibo}
💰 *Valor Pago:* ${valorFormatado}
📅 *Data:* ${dataFormatada}
💳 *Forma de Pagamento:* ${data.metodo}
📌 *${modalidade}*
🏷️ *Serviço:* ${data.descricaoServico}
👨‍🏫 *Instrutor:* ${data.instrutor.nome}

🔐 *Autenticação Digital:* \`${data.codigoAutenticacao}\`

Agradecemos pela confiança e seguimos firmes na sua aprovação!`;

  return encodeURIComponent(msg);
}
