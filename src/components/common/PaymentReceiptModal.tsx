import React, { useState } from 'react';
import {
  X,
  FileText,
  Download,
  Share2,
  Printer,
  CheckCircle2,
  Calendar,
  DollarSign,
  User,
  ShieldCheck,
  CreditCard,
  MessageCircle,
  Hash,
  Clock
} from 'lucide-react';
import {
  generateReceiptPdf,
  downloadReceiptPdf,
  generateWhatsAppReceiptMessage,
  numberToWordsBRL
} from '../../lib/receiptPdfGenerator';
import type { PaymentReceiptData } from '../../lib/receiptPdfGenerator';
import { formatCurrencyBRL, formatDateBR } from '../../lib/validation';
import type { PaymentMethod } from '../../types';

interface PaymentReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: PaymentReceiptData;
  onReceiptGenerated?: (data: PaymentReceiptData) => void;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onReceiptGenerated
}) => {
  if (!isOpen) return null;

  const [receiptData, setReceiptData] = useState<PaymentReceiptData>(initialData);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const valorExtenso = numberToWordsBRL(receiptData.valorCentavos);

  const handleDownload = () => {
    const success = downloadReceiptPdf(receiptData);
    if (success) {
      setDownloadSuccess(true);
      if (onReceiptGenerated) onReceiptGenerated(receiptData);
      setTimeout(() => setDownloadSuccess(false), 3000);
    }
  };

  const handleSendWhatsApp = () => {
    const rawPhone = (receiptData.aluno.telefone || '').replace(/\D/g, '');
    const phone = rawPhone.length <= 11 ? `55${rawPhone}` : rawPhone;
    const msg = generateWhatsAppReceiptMessage(receiptData);
    const url = `https://wa.me/${phone}?text=${msg}`;
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    try {
      const doc = generateReceiptPdf(receiptData);
      const blobUrl = doc.output('bloburl');
      const printWindow = window.open(blobUrl, '_blank');
      if (printWindow) {
        printWindow.focus();
      } else {
        // Fallback para download direto caso popup seja bloqueado
        doc.save(`Recibo_${receiptData.numeroRecibo}.pdf`);
      }
    } catch {
      downloadReceiptPdf(receiptData);
    }
  };

  const handleCopyText = () => {
    const rawMsg = decodeURIComponent(generateWhatsAppReceiptMessage(receiptData));
    navigator.clipboard.writeText(rawMsg);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[94vh] flex flex-col">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Recibo de Pagamento de Aulas
                </h2>
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold border border-blue-400/30 uppercase">
                  Via do Aluno
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Recibo Nº <strong className="text-white font-mono">{receiptData.numeroRecibo}</strong> · Autenticação: <span className="font-mono text-emerald-400">{receiptData.codigoAutenticacao}</span>
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

        {/* Modal Body: Editor and Preview */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-xs text-slate-700 flex-1">
          {downloadSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Arquivo PDF do recibo gerado e baixado com sucesso! (Recibo digital pronto para envio ao aluno).</span>
            </div>
          )}

          {/* Form Options to Adjust Receipt */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Dados do Recibo e Modalidade de Cobrança
              </span>
              <span className="text-[11px] text-slate-500">
                Ajuste os dados antes de gerar o PDF ou enviar
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Modalidade do Recibo
                </label>
                <select
                  value={receiptData.tipoRecibo}
                  onChange={(e) =>
                    setReceiptData({
                      ...receiptData,
                      tipoRecibo: e.target.value as any
                    })
                  }
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-medium"
                >
                  <option value="PARCELA">Por Parcela (Ex: Parcela 1 de 3)</option>
                  <option value="PERIODO">Por Período (Ex: Mês de Outubro/2026)</option>
                  <option value="QUITACAO_TOTAL">Quitação Integral do Pacote</option>
                  <option value="AVULSO">Aula Avulsa / Reforço</option>
                </select>
              </div>

              {receiptData.tipoRecibo === 'PARCELA' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Identificação da Parcela
                  </label>
                  <input
                    type="text"
                    value={receiptData.parcelaReferente || ''}
                    onChange={(e) =>
                      setReceiptData({
                        ...receiptData,
                        parcelaReferente: e.target.value
                      })
                    }
                    placeholder="Ex: Parcela 1 de 3"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              )}

              {receiptData.tipoRecibo === 'PERIODO' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Período Referente
                  </label>
                  <input
                    type="text"
                    value={receiptData.periodoReferente || ''}
                    onChange={(e) =>
                      setReceiptData({
                        ...receiptData,
                        periodoReferente: e.target.value
                      })
                    }
                    placeholder="Ex: 01/10/2026 a 31/10/2026"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Forma de Pagamento
                </label>
                <select
                  value={receiptData.metodo}
                  onChange={(e) =>
                    setReceiptData({
                      ...receiptData,
                      metodo: e.target.value as PaymentMethod
                    })
                  }
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-medium"
                >
                  <option value="PIX">PIX Instantâneo</option>
                  <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                  <option value="CARTAO_DEBITO">Cartão de Débito</option>
                  <option value="DINHEIRO">Dinheiro em Espécie</option>
                  <option value="BOLETO">Boleto Bancário</option>
                  <option value="TRANSFERENCIA">Transferência / TED</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Descrição do Serviço Prestado
                </label>
                <input
                  type="text"
                  value={receiptData.descricaoServico}
                  onChange={(e) =>
                    setReceiptData({
                      ...receiptData,
                      descricaoServico: e.target.value
                    })
                  }
                  placeholder="Ex: Pacote de 20 Aulas Práticas CNH B"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Observações no Recibo (Opcional)
                </label>
                <input
                  type="text"
                  value={receiptData.observacoes || ''}
                  onChange={(e) =>
                    setReceiptData({
                      ...receiptData,
                      observacoes: e.target.value
                    })
                  }
                  placeholder="Ex: Aluno realizou pagamento integral via Pix à vista"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>

          {/* DOCUMENT PREVIEW CARD (VISUAL 2 VIAS) */}
          <div className="border border-slate-300 rounded-2xl bg-white shadow-sm overflow-hidden">
            {/* Visual Header / Banner */}
            <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-slate-900 text-white p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-blue-200">
                  Visualização Prévia do Recibo
                </span>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <span>RECIBO DE PAGAMENTO Nº {receiptData.numeroRecibo}</span>
                </h3>
              </div>
              <div className="text-right sm:text-right">
                <span className="text-xs text-blue-200 block">Valor Quitado:</span>
                <span className="text-xl font-black font-mono text-emerald-300">
                  {formatCurrencyBRL(receiptData.valorCentavos)}
                </span>
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Box Valor por Extenso */}
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-emerald-950">
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">
                  Valor por Extenso:
                </span>
                <p className="font-semibold text-sm capitalize">
                  {valorExtenso}
                </p>
              </div>

              {/* Grid 2 Colunas: Aluno & Instrutor */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Aluno */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    Aluno / Pagador
                  </span>
                  <p className="text-sm font-bold text-slate-900">{receiptData.aluno.nome}</p>
                  <p className="text-[11px] text-slate-600">
                    <strong>CPF:</strong> <span className="font-mono font-bold text-slate-800">{receiptData.aluno.cpfMascarado}</span>
                  </p>
                  <p className="text-[11px] text-slate-600">
                    <strong>Categoria:</strong> CNH {receiptData.aluno.categoriaCnh} · <strong>Tel:</strong> {receiptData.aluno.telefone}
                  </p>
                </div>

                {/* Instrutor */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Instrutor Credenciado / Emissor
                  </span>
                  <p className="text-sm font-bold text-slate-900">{receiptData.instrutor.nome}</p>
                  <p className="text-[11px] text-slate-600">
                    <strong>Documento:</strong> {receiptData.instrutor.documento || 'Credencial Detran Ativa'}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    <strong>Local:</strong> {receiptData.instrutor.cidade || 'Brasil'} / {receiptData.instrutor.estado || 'BR'}
                  </p>
                </div>
              </div>

              {/* Detalhes de Pagamento */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Data Pagamento</span>
                  <span className="font-bold text-slate-900 font-mono">{formatDateBR(receiptData.dataPagamento)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Forma Pagto</span>
                  <span className="font-bold text-blue-700">{receiptData.metodo}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Modalidade</span>
                  <span className="font-bold text-slate-900">
                    {receiptData.tipoRecibo === 'PARCELA'
                      ? receiptData.parcelaReferente || 'Parcela'
                      : receiptData.tipoRecibo === 'PERIODO'
                      ? receiptData.periodoReferente || 'Período'
                      : 'Quitação Integral'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Autenticação</span>
                  <span className="font-mono font-bold text-emerald-700 text-[11px]">{receiptData.codigoAutenticacao}</span>
                </div>
              </div>

              {/* Confirmação do Recibo Digital */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900 text-[11px] space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Recibo digital pronto para envio direto ao aluno via WhatsApp ou download.</span>
                </p>
                <p className="text-blue-800">
                  Documento em página única com autenticação eletrônica para comprovação imediata de pagamento de aulas práticas.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer: Action Buttons */}
        <div className="bg-slate-50 border-t border-slate-200 p-3.5 sm:p-4 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs transition-colors cursor-pointer"
              title="Enviar mensagem formatada com dados do recibo para o WhatsApp do aluno"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Enviar no WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-medium text-xs transition-colors cursor-pointer"
              title="Copiar texto do comprovante"
            >
              {copiedLink ? 'Copiado!' : 'Copiar Texto'}
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-semibold transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Imprimir</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Recibo em PDF (.pdf)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
