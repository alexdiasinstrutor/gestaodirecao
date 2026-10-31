import { formatCurrencyBRL, formatDateBR } from './validation';

export interface WhatsAppReminderParams {
  alunoNome: string;
  telefone: string;
  valorCentavos: number;
  dataVencimento: string;
  chavePix?: string;
  nomeInstrutorOuAutoescola: string;
  tipoMensagem?: 'GENTIL' | 'PADRAO' | 'URGENTE';
}

export function generateWhatsAppMessage(params: WhatsAppReminderParams): string {
  const {
    alunoNome,
    valorCentavos,
    dataVencimento,
    chavePix = 'financeiro@autogestaodirecao.com.br',
    nomeInstrutorOuAutoescola,
    tipoMensagem = 'PADRAO'
  } = params;

  const valorFormatado = formatCurrencyBRL(valorCentavos);
  const vencimentoFormatado = formatDateBR(dataVencimento);
  const primeiroNome = alunoNome.split(' ')[0];

  if (tipoMensagem === 'GENTIL') {
    return `Olá, ${primeiroNome}! Tudo bem? 🚗💨\n\nPassando para lembrar que sua mensalidade/parcela de aulas práticas no valor de *${valorFormatado}* venceu em *${vencimentoFormatado}*.\n\nPara facilitar o seu pagamento via PIX, segue a chave:\n🔑 Chave PIX: *${chavePix}*\n\nAssim que realizar o pagamento, você pode nos enviar o comprovante por aqui mesmo para liberarmos seus próximos agendamentos de aulas práticas.\n\nAtenciosamente,\n*${nomeInstrutorOuAutoescola}*`;
  }

  if (tipoMensagem === 'URGENTE') {
    return `⚠️ *Aviso Importante de Pagamento em Atraso*\n\nPrezado(a) ${alunoNome},\n\nIdentificamos uma pendência financeira referente às suas aulas práticas de direção veicular:\n\n📌 Valor: *${valorFormatado}*\n📅 Vencimento original: *${vencimentoFormatado}*\n\nPara evitar o bloqueio de novos agendamentos na agenda do instrutor e prosseguir com sua formação, solicitamos a regularização via PIX:\n🔑 Chave PIX: *${chavePix}*\n\nQualquer dúvida estamos à disposição.\n*${nomeInstrutorOuAutoescola}*`;
  }

  // Padrão
  return `Olá, ${primeiroNome}! Aqui é da *${nomeInstrutorOuAutoescola}*.\n\nConsta em nosso sistema uma fatura em aberto referente às suas aulas de direção no valor de *${valorFormatado}*, com vencimento em *${vencimentoFormatado}*.\n\nVocê pode pagar de forma rápida via PIX:\n🔑 Chave PIX: *${chavePix}*\n\nCaso já tenha efetuado o pagamento, por gentileza desconsidere este aviso ou nos envie o comprovante. Obrigado! 🚗✨`;
}

export function buildWhatsAppLink(phoneRaw: string, message: string): string {
  let cleanPhone = phoneRaw.replace(/\D/g, '');
  if (!cleanPhone.startsWith('55') && cleanPhone.length <= 11) {
    cleanPhone = `55${cleanPhone}`;
  }
  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
}

/**
 * Gera payload PIX Copia e Cola formatado para pagamentos no Brasil
 */
export function generatePixCopiaECola(chavePix: string, nomeRecebedor: string, valorCentavos: number, txid: string): string {
  const valor = (valorCentavos / 100).toFixed(2);
  // Simulação de payload padrão EMVCo BR Code
  return `00020126580014BR.GOV.BCB.PIX0114${chavePix}520400005303986540${valor.length}${valor}5802BR5913${nomeRecebedor.slice(0, 25)}6009SAO PAULO62070503${txid.slice(0, 10)}6304`;
}
