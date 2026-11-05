import React, { useState } from 'react';
import {
  X,
  QrCode,
  Copy,
  Check,
  Share2,
  Send,
  AlertCircle,
  Building,
  User as UserIcon
} from 'lucide-react';
import { formatCurrencyBRL, formatDateBR } from '../../lib/validation';
import { generatePixCopiaECola, getPixQrCodeImageUrl, buildWhatsAppLink } from '../../lib/whatsapp';

interface PixQrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  alunoNome: string;
  alunoTelefone?: string;
  descricao: string;
  valorCentavos: number;
  dataVencimento?: string;
  chavePix: string;
  tipoChavePix?: string;
  beneficiario: string;
  cidade?: string;
  txid?: string;
}

export const PixQrCodeModal: React.FC<PixQrCodeModalProps> = ({
  isOpen,
  onClose,
  alunoNome,
  alunoTelefone,
  descricao,
  valorCentavos,
  dataVencimento,
  chavePix,
  tipoChavePix = 'CHAVE',
  beneficiario,
  cidade = 'SAO PAULO',
  txid = 'AULA'
}) => {
  if (!isOpen) return null;

  const [copiaColaCopied, setCopiaColaCopied] = useState(false);
  const [chaveCopied, setChaveCopied] = useState(false);

  // Generate standard BR Code payload
  const payload = generatePixCopiaECola(
    chavePix,
    beneficiario,
    valorCentavos,
    txid,
    cidade
  );

  const qrCodeUrl = getPixQrCodeImageUrl(payload, 280);

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(payload);
    setCopiaColaCopied(true);
    setTimeout(() => setCopiaColaCopied(false), 2500);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(chavePix);
    setChaveCopied(true);
    setTimeout(() => setChaveCopied(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const valorFmt = formatCurrencyBRL(valorCentavos);
    const msg = `Olá, ${alunoNome}!\n\nSegue o código PIX para pagamento de suas aulas práticas:\n\n📌 Descrição: *${descricao}*\n💰 Valor: *${valorFmt}*${dataVencimento ? `\n📅 Vencimento: *${formatDateBR(dataVencimento)}*` : ''}\n\n🔑 *Chave PIX:* ${chavePix}\n👤 *Titular:* ${beneficiario}\n\n📲 *Código PIX Copia e Cola:*\n\`\`\`${payload}\`\`\`\n\nAbra o aplicativo do seu banco, escolha a opção *PIX Copia e Cola*, cole o código acima e confirme o pagamento. Obrigado!`;
    const link = buildWhatsAppLink(alunoTelefone || '', msg);
    window.open(link, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 text-center space-y-4 max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-left">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
              <QrCode className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-slate-900">Pagamento Instantâneo PIX</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Student & Invoice Info */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-left space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Aluno / Pagador:</span>
            <span className="text-xs font-bold text-slate-900">{alunoNome}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Referência:</span>
            <span className="text-xs text-slate-700">{descricao}</span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-200">
            <span className="text-xs font-semibold text-slate-700">Valor a Pagar:</span>
            <span className="text-base font-extrabold font-mono text-emerald-700">
              {formatCurrencyBRL(valorCentavos)}
            </span>
          </div>
        </div>

        {/* Real Scannable QR Code */}
        <div className="p-3 bg-white border-2 border-emerald-500/30 rounded-2xl inline-block mx-auto shadow-sm">
          <img
            src={qrCodeUrl}
            alt="QR Code PIX Escaneável"
            className="w-48 h-48 sm:w-56 sm:h-56 mx-auto rounded-xl"
          />
          <p className="text-xs text-slate-600 font-medium mt-1 font-medium">
            Aponte a câmera no aplicativo do seu banco para pagar
          </p>
        </div>

        {/* Beneficiary & Key info */}
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-left text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-800 font-semibold">Beneficiário:</span>
            <span className="text-xs text-emerald-950 font-bold truncate max-w-[200px]">
              {beneficiario}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-800 font-semibold">Chave PIX:</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs text-emerald-950 font-extrabold truncate max-w-[170px]">
                {chavePix}
              </span>
              <button
                type="button"
                onClick={handleCopyKey}
                title="Copiar Chave PIX"
                className="p-1 rounded bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold cursor-pointer"
              >
                {chaveCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={handleCopyPayload}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            {copiaColaCopied ? (
              <>
                <Check className="w-4 h-4 text-emerald-200" />
                <span>Código Copiado com Sucesso!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copiar Código PIX (Copia e Cola)</span>
              </>
            )}
          </button>

          {alunoTelefone && (
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-emerald-600" />
              <span>Enviar via WhatsApp para o Aluno</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full py-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

