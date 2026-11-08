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

export function buildWhatsAppLink(phoneRaw: string | undefined | null, message: string): string {
  // Extrai estritamente os dígitos numéricos. NUNCA passa máscara ou caracteres não-dígitos.
  const cleanDigits = (phoneRaw || '').replace(/\D/g, '');
  if (!cleanDigits || cleanDigits.length < 10) {
    return '';
  }

  let finalNumber = cleanDigits;
  // Se possui 10 ou 11 dígitos (DDD + número), adiciona o DDI 55
  if (finalNumber.length === 10 || finalNumber.length === 11) {
    finalNumber = `55${finalNumber}`;
  } else if (!finalNumber.startsWith('55')) {
    finalNumber = `55${finalNumber}`;
  }

  return `https://api.whatsapp.com/send?phone=${finalNumber}&text=${encodeURIComponent(message)}`;
}

/**
 * Calcula CRC16 CCITT (polinômio 0x1021, valor inicial 0xFFFF) conforme padrão do Banco Central do Brasil
 */
function crc16CCITT(str: string): string {
  let crc = 0xffff;
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function emvField(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

function normalizeAscii(str: string, maxLen: number): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .slice(0, maxLen);
}

/**
 * Gera payload PIX Copia e Cola Oficial (BR Code / EMVCo) aceito por todos os bancos brasileiros
 */
export function generatePixCopiaECola(
  chavePix: string,
  nomeRecebedor: string,
  valorCentavos: number,
  txid: string = '***',
  cidade: string = 'SAO PAULO'
): string {
  let cleanKey = (chavePix || '').trim();
  const digitsOnly = cleanKey.replace(/\D/g, '');
  if (digitsOnly.length === 11 && (cleanKey.includes('.') || cleanKey.includes('-'))) {
    cleanKey = digitsOnly;
  } else if (digitsOnly.length === 14 && (cleanKey.includes('.') || cleanKey.includes('/') || cleanKey.includes('-'))) {
    cleanKey = digitsOnly;
  } else if ((cleanKey.includes('(') || cleanKey.includes(')') || cleanKey.includes('-')) && (digitsOnly.length === 10 || digitsOnly.length === 11)) {
    cleanKey = digitsOnly.startsWith('55') ? `+${digitsOnly}` : `+55${digitsOnly}`;
  }

  const cleanName = normalizeAscii(nomeRecebedor || 'RECEBEDOR', 25) || 'RECEBEDOR';
  const cleanCity = normalizeAscii(cidade || 'CIDADE', 15) || 'SAO PAULO';
  const cleanTxid = normalizeAscii((txid || 'PAGTO').replace(/[^a-zA-Z0-9]/g, ''), 25) || 'PAGTO';
  const valorStr = (valorCentavos / 100).toFixed(2);

  // Merchant Account Information (Tag 26)
  const maiGui = emvField('00', 'BR.GOV.BCB.PIX');
  const maiKey = emvField('01', cleanKey);
  const tag26 = emvField('26', maiGui + maiKey);

  // Campos principais
  const tag00 = emvField('00', '01');
  const tag52 = emvField('52', '0000');
  const tag53 = emvField('53', '986');
  const tag54 = valorCentavos > 0 ? emvField('54', valorStr) : '';
  const tag58 = emvField('58', 'BR');
  const tag59 = emvField('59', cleanName);
  const tag60 = emvField('60', cleanCity);
  const tag62 = emvField('62', emvField('05', cleanTxid));

  const payloadWithoutCRC = `${tag00}${tag26}${tag52}${tag53}${tag54}${tag58}${tag59}${tag60}${tag62}6304`;
  const checksum = crc16CCITT(payloadWithoutCRC);

  return `${payloadWithoutCRC}${checksum}`;
}

/**
 * Retorna URL da imagem de QR Code escaneável de alta resolução
 */
export function getPixQrCodeImageUrl(payload: string, size: number = 280): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(payload)}&margin=10`;
}
