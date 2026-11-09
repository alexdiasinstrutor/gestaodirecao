import React, { useState, useRef, useEffect } from 'react';
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
  Clock,
  Upload,
  Trash2,
  Save,
  FileSignature,
  ZoomIn,
  ZoomOut,
  Move,
  RotateCcw,
  Sliders,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { db } from '../../lib/storage';
import {
  generateReceiptPdf,
  downloadReceiptPdf,
  generateWhatsAppReceiptMessage,
  numberToWordsBRL
} from '../../lib/receiptPdfGenerator';
import type { PaymentReceiptData } from '../../lib/receiptPdfGenerator';
import { formatCurrencyBRL, formatDateBR } from '../../lib/validation';
import { buildWhatsAppLink } from '../../lib/whatsapp';
import type { PaymentMethod, SignatureConfig } from '../../types';

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

  // Assinatura digital do instrutor (PNG, JPG de no máximo 2MB)
  const signatureFileInputRef = useRef<HTMLInputElement | null>(null);
  const [signatureImage, setSignatureImage] = useState<string>(() => {
    return (
      receiptData.assinaturaUrl ||
      receiptData.instrutor?.assinaturaUrl ||
      db.getCurrentUser()?.assinaturaUrl ||
      ''
    );
  });

  // Configurações de posicionamento e tamanho da assinatura
  const [signatureConfig, setSignatureConfig] = useState<SignatureConfig>(() => {
    return (
      receiptData.assinaturaConfig ||
      receiptData.instrutor?.assinaturaConfig ||
      db.getCurrentUser()?.assinaturaConfig || {
        scale: 100,
        offsetY: 0,
        offsetX: 0
      }
    );
  });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initOffsetX: number; initOffsetY: number }>({
    startX: 0,
    startY: 0,
    initOffsetX: 0,
    initOffsetY: 0
  });

  const [signatureFileError, setSignatureFileError] = useState<string>('');
  const [signatureSavedToProfile, setSignatureSavedToProfile] = useState<boolean>(false);
  const [isSavingSignature, setIsSavingSignature] = useState<boolean>(false);

  // Sincroniza a assinatura e sua configuração no receiptData
  useEffect(() => {
    setReceiptData((prev) => ({
      ...prev,
      assinaturaUrl: signatureImage || undefined,
      assinaturaConfig: signatureConfig,
      instrutor: {
        ...prev.instrutor,
        assinaturaUrl: signatureImage || undefined,
        assinaturaConfig: signatureConfig
      }
    }));
  }, [signatureImage, signatureConfig]);

  // Listener global de drag para posicionar a assinatura arrastando com mouse ou touch
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      setSignatureConfig((prev) => ({
        ...prev,
        offsetX: Math.max(-80, Math.min(80, Math.round(dragStartRef.current.initOffsetX + dx))),
        offsetY: Math.max(-40, Math.min(40, Math.round(dragStartRef.current.initOffsetY + dy)))
      }));
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!e.touches[0]) return;
      const dx = e.touches[0].clientX - dragStartRef.current.startX;
      const dy = e.touches[0].clientY - dragStartRef.current.startY;
      setSignatureConfig((prev) => ({
        ...prev,
        offsetX: Math.max(-80, Math.min(80, Math.round(dragStartRef.current.initOffsetX + dx))),
        offsetY: Math.max(-40, Math.min(40, Math.round(dragStartRef.current.initOffsetY + dy)))
      }));
    };

    const handleDragEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleDragEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging]);

  const startDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      initOffsetX: signatureConfig.offsetX,
      initOffsetY: signatureConfig.offsetY
    };
    setIsDragging(true);
  };

  const handleResetPosition = () => {
    setSignatureConfig({ scale: 100, offsetY: 0, offsetX: 0 });
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_SIZE) {
      setSignatureFileError(
        `O arquivo de assinatura deve ter no máximo 2MB (o arquivo selecionado tem ${(file.size / (1024 * 1024)).toFixed(2)} MB).`
      );
      if (signatureFileInputRef.current) signatureFileInputRef.current.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      setSignatureFileError('Por favor selecione um arquivo de imagem válido (PNG ou JPG).');
      if (signatureFileInputRef.current) signatureFileInputRef.current.value = '';
      return;
    }

    setSignatureFileError('');
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSignatureImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSignatureToProfile = async () => {
    if (!signatureImage) return;
    setIsSavingSignature(true);
    try {
      const current = db.getCurrentUser();
      if (current) {
        await db.saveUserSignature(current.id, signatureImage, signatureConfig);
        setSignatureSavedToProfile(true);
        setTimeout(() => setSignatureSavedToProfile(false), 3500);
      }
    } catch (err) {
      console.error('Erro ao salvar assinatura no perfil:', err);
      alert('Não foi possível salvar a assinatura no perfil.');
    } finally {
      setIsSavingSignature(false);
    }
  };

  const handleRemoveSignature = async () => {
    setSignatureImage('');
    setSignatureFileError('');
    if (signatureFileInputRef.current) signatureFileInputRef.current.value = '';
    handleResetPosition();
    setReceiptData((prev) => ({
      ...prev,
      assinaturaUrl: undefined,
      assinaturaConfig: undefined,
      instrutor: { ...prev.instrutor, assinaturaUrl: undefined, assinaturaConfig: undefined }
    }));
  };

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
    const msg = generateWhatsAppReceiptMessage(receiptData);
    const url = buildWhatsAppLink(receiptData.aluno.telefone, msg);
    if (!url) {
      alert('Telefone do aluno não informado ou inválido para envio via WhatsApp.');
      return;
    }
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
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-400/30 uppercase">
                  Via do Aluno
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium">
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
              <span className="text-xs text-slate-500">
                Ajuste os dados antes de gerar o PDF ou enviar
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
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
                  <option value="PACOTE">📦 Por Pacote Contratado (Base, Adicional ou Personalizado)</option>
                  <option value="AULAS_MINISTRADAS">🎓 Por Total de Aulas Ministradas</option>
                  <option value="PARCELA">Por Parcela (Ex: Parcela 1 de 3)</option>
                  <option value="PERIODO">Por Período (Ex: Mês de Outubro/2026)</option>
                  <option value="QUITACAO_TOTAL">Quitação Integral do Pacote</option>
                  <option value="AVULSO">Aula Avulsa / Reforço</option>
                </select>
              </div>

              {receiptData.tipoRecibo === 'PACOTE' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Nome do Pacote Contratado
                    </label>
                    <input
                      type="text"
                      value={receiptData.pacoteReferente || receiptData.descricaoServico}
                      onChange={(e) =>
                        setReceiptData({
                          ...receiptData,
                          pacoteReferente: e.target.value,
                          descricaoServico: e.target.value
                        })
                      }
                      placeholder="Ex: Pacote 10 Aulas Práticas ou Pacote Personalizado"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Total de Aulas do Pacote
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={receiptData.totalAulasContratadas || ''}
                      onChange={(e) =>
                        setReceiptData({
                          ...receiptData,
                          totalAulasContratadas: parseInt(e.target.value, 10) || undefined
                        })
                      }
                      placeholder="Ex: 10 ou 20 aulas"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                </>
              )}

              {receiptData.tipoRecibo === 'AULAS_MINISTRADAS' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Total de Aulas Ministradas
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={receiptData.totalAulasMinistradas || ''}
                      onChange={(e) => {
                        const qtd = parseInt(e.target.value, 10) || 0;
                        setReceiptData({
                          ...receiptData,
                          totalAulasMinistradas: qtd,
                          descricaoServico: `${qtd} Aulas Práticas de Direção Veicular Ministradas - CNH ${receiptData.aluno.categoriaCnh}`
                        });
                      }}
                      placeholder="Ex: 5, 10, 15 aulas ministradas"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Período das Aulas Realizadas
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
                      placeholder="Ex: Aulas concluídas até a presente data"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </>
              )}

              {receiptData.tipoRecibo === 'PARCELA' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
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
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">
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

            {/* Campo e Painel para Anexar Assinatura Digital do Instrutor (PNG, JPG máx 2MB) */}
            <div className="pt-3 border-t border-slate-200 mt-2 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-3 rounded-xl border border-blue-200">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <FileSignature className="w-4 h-4 text-blue-600" />
                    Assinatura Digital do Instrutor
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Anexe uma foto ou imagem da sua assinatura (PNG ou JPG, máx 2MB) e ajuste tamanho e posição.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="file"
                    ref={signatureFileInputRef}
                    accept="image/png, image/jpeg, image/jpg, image/webp"
                    onChange={handleSignatureUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => signatureFileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{signatureImage ? 'Substituir Assinatura' : 'Anexar Assinatura (PNG/JPG)'}</span>
                  </button>

                  {signatureImage && (
                    <>
                      <button
                        type="button"
                        onClick={handleSaveSignatureToProfile}
                        disabled={isSavingSignature}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors disabled:opacity-50"
                        title="Salva esta assinatura e os ajustes de tamanho e posição permanentemente no seu perfil"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{isSavingSignature ? 'Salvando...' : 'Salvar no Meu Perfil'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveSignature}
                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                        title="Remover assinatura do recibo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Controles de Redimensionamento e Posicionamento da Assinatura */}
              {signatureImage && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Sliders className="w-4 h-4 text-blue-600" />
                      <span>Ajustes de Posicionamento e Tamanho da Assinatura</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetPosition}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer transition-colors"
                      title="Redefinir tamanho e posição para os padrões originais"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Redefinir Padrão</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    {/* 1. Redimensionar Tamanho / Escala */}
                    <div className="space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-700 flex items-center gap-1">
                          <ZoomIn className="w-3.5 h-3.5 text-blue-600" />
                          <span>Tamanho: {signatureConfig.scale}%</span>
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setSignatureConfig((prev) => ({
                                ...prev,
                                scale: Math.max(50, prev.scale - 10)
                              }))
                            }
                            className="w-6 h-6 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-bold text-xs"
                            title="Diminuir tamanho"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setSignatureConfig((prev) => ({
                                ...prev,
                                scale: Math.min(200, prev.scale + 10)
                              }))
                            }
                            className="w-6 h-6 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-bold text-xs"
                            title="Aumentar tamanho"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="200"
                        step="5"
                        value={signatureConfig.scale}
                        onChange={(e) =>
                          setSignatureConfig((prev) => ({
                            ...prev,
                            scale: Number(e.target.value)
                          }))
                        }
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                      <div className="flex justify-between gap-1 pt-1">
                        {[75, 100, 135, 175].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setSignatureConfig((prev) => ({ ...prev, scale: val }))}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                              signatureConfig.scale === val
                                ? 'bg-blue-600 text-white font-bold'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {val}%
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 2. Posição Vertical (Subir / Descer) */}
                    <div className="space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-700 flex items-center gap-1">
                          <Move className="w-3.5 h-3.5 text-blue-600" />
                          <span>
                            Vertical:{' '}
                            {signatureConfig.offsetY > 0
                              ? `+${signatureConfig.offsetY}px`
                              : `${signatureConfig.offsetY}px`}
                          </span>
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setSignatureConfig((prev) => ({
                                ...prev,
                                offsetY: Math.max(-35, prev.offsetY - 3)
                              }))
                            }
                            className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 text-[10px] flex items-center gap-0.5 font-medium"
                            title="Subir assinatura"
                          >
                            <ArrowUp className="w-3 h-3" /> Subir
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setSignatureConfig((prev) => ({
                                ...prev,
                                offsetY: Math.min(35, prev.offsetY + 3)
                              }))
                            }
                            className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 text-[10px] flex items-center gap-0.5 font-medium"
                            title="Descer assinatura"
                          >
                            <ArrowDown className="w-3 h-3" /> Descer
                          </button>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="-35"
                        max="35"
                        step="1"
                        value={signatureConfig.offsetY}
                        onChange={(e) =>
                          setSignatureConfig((prev) => ({
                            ...prev,
                            offsetY: Number(e.target.value)
                          }))
                        }
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Mais Alto (-35px)</span>
                        <button
                          type="button"
                          onClick={() => setSignatureConfig((prev) => ({ ...prev, offsetY: 0 }))}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          Nível Linha (0)
                        </button>
                        <span>Mais Baixo (+35px)</span>
                      </div>
                    </div>

                    {/* 3. Posição Horizontal (Esquerda / Direita) */}
                    <div className="space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-700 flex items-center gap-1">
                          <Move className="w-3.5 h-3.5 text-blue-600" />
                          <span>
                            Horizontal:{' '}
                            {signatureConfig.offsetX > 0
                              ? `+${signatureConfig.offsetX}px`
                              : `${signatureConfig.offsetX}px`}
                          </span>
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setSignatureConfig((prev) => ({
                                ...prev,
                                offsetX: Math.max(-60, prev.offsetX - 5)
                              }))
                            }
                            className="p-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700"
                            title="Mover para esquerda"
                          >
                            <ArrowLeft className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSignatureConfig((prev) => ({ ...prev, offsetX: 0 }))}
                            className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 text-[10px] font-semibold"
                            title="Centralizar horizontalmente"
                          >
                            Centro
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setSignatureConfig((prev) => ({
                                ...prev,
                                offsetX: Math.min(60, prev.offsetX + 5)
                              }))
                            }
                            className="p-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700"
                            title="Mover para direita"
                          >
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="-60"
                        max="60"
                        step="2"
                        value={signatureConfig.offsetX}
                        onChange={(e) =>
                          setSignatureConfig((prev) => ({
                            ...prev,
                            offsetX: Number(e.target.value)
                          }))
                        }
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Esquerda (-60px)</span>
                        <span>Centro (0)</span>
                        <span>Direita (+60px)</span>
                      </div>
                    </div>
                  </div>

                  {/* Dica interativa e ação de salvar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1 border-t border-slate-200">
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      <span>💡</span>
                      <span>
                        Dica: Você também pode <strong>clicar e arrastar a assinatura diretamente</strong> sobre a linha no comprovante abaixo!
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={handleSaveSignatureToProfile}
                      disabled={isSavingSignature}
                      className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isSavingSignature ? 'Salvando...' : 'Salvar Assinatura e Posição no Meu Perfil'}</span>
                    </button>
                  </div>
                </div>
              )}

              {signatureFileError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
                  <span>⚠️ {signatureFileError}</span>
                </div>
              )}

              {signatureSavedToProfile && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Assinatura, tamanho e posição salvos com sucesso no seu perfil de instrutor! Seus próximos recibos já a incluirão automaticamente ajustada.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* DOCUMENT PREVIEW CARD (VISUAL 2 VIAS) */}
          <div className="border border-slate-300 rounded-2xl bg-white shadow-sm overflow-hidden">
            {/* Visual Header / Banner */}
            <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-slate-900 text-white p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider font-bold text-blue-200">
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
                <span className="text-xs uppercase font-bold font-bold text-emerald-700 block">
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
                  <span className="text-xs uppercase font-bold font-bold text-slate-500 block flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    Aluno / Pagador
                  </span>
                  <p className="text-sm font-bold text-slate-900">{receiptData.aluno.nome}</p>
                  <p className="text-xs text-slate-600">
                    <strong>CPF:</strong> <span className="font-mono font-bold text-slate-800">{receiptData.aluno.cpfMascarado}</span>
                  </p>
                  <p className="text-xs text-slate-600">
                    <strong>Categoria:</strong> CNH {receiptData.aluno.categoriaCnh} · <strong>Tel:</strong> {receiptData.aluno.telefone}
                  </p>
                </div>

                {/* Instrutor */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <span className="text-xs uppercase font-bold font-bold text-slate-500 block flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Instrutor Credenciado / Emissor
                  </span>
                  <p className="text-sm font-bold text-slate-900">{receiptData.instrutor.nome}</p>
                  <p className="text-xs text-slate-600">
                    <strong>Documento:</strong> {receiptData.instrutor.documento || 'Credencial Detran Ativa'}
                  </p>
                  <p className="text-xs text-slate-600">
                    <strong>Local:</strong> {receiptData.instrutor.cidade || 'Brasil'} / {receiptData.instrutor.estado || 'BR'}
                  </p>
                </div>
              </div>

              {/* Detalhes de Pagamento */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-xs uppercase font-bold font-bold text-slate-500 block">Data Pagamento</span>
                  <span className="font-bold text-slate-900 font-mono">{formatDateBR(receiptData.dataPagamento)}</span>
                </div>
                <div>
                  <span className="text-xs uppercase font-bold font-bold text-slate-500 block">Forma Pagto</span>
                  <span className="font-bold text-blue-700">{receiptData.metodo}</span>
                </div>
                <div>
                  <span className="text-xs uppercase font-bold font-bold text-slate-500 block">Modalidade</span>
                  <span className="font-bold text-slate-900">
                    {receiptData.tipoRecibo === 'PARCELA'
                      ? receiptData.parcelaReferente || 'Parcela'
                      : receiptData.tipoRecibo === 'PERIODO'
                      ? receiptData.periodoReferente || 'Período'
                      : receiptData.tipoRecibo === 'PACOTE'
                      ? `Pacote: ${receiptData.pacoteReferente || receiptData.descricaoServico}${receiptData.totalAulasContratadas ? ` (${receiptData.totalAulasContratadas} aulas)` : ''}`
                      : receiptData.tipoRecibo === 'AULAS_MINISTRADAS'
                      ? `${receiptData.totalAulasMinistradas || 'Aulas'} Aulas Ministradas`
                      : receiptData.tipoRecibo === 'AVULSO'
                      ? 'Aula Avulsa / Reforço'
                      : 'Quitação Integral'}
                  </span>
                </div>
                <div>
                  <span className="text-xs uppercase font-bold font-bold text-slate-500 block">Autenticação</span>
                  <span className="font-mono font-bold text-emerald-700 text-xs">{receiptData.codigoAutenticacao}</span>
                </div>
              </div>

              {/* Bloco Oficial com Posicionamento Visual da Assinatura no Documento */}
              <div className="pt-4 border-t border-slate-200 mt-2 flex flex-col sm:flex-row justify-between items-end gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                <div className="space-y-1 text-slate-500 text-xs text-left w-full sm:w-auto">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                    Comprovante Oficial de Instrução
                  </span>
                  <p className="font-semibold text-slate-800 text-xs">
                    Auto Gestão de Direção · Recibo Válido
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Emitido em {formatDateBR(receiptData.dataEmissao)} · Quitado em {formatDateBR(receiptData.dataPagamento)}
                  </p>
                  <p className="text-[11px] font-mono font-bold text-emerald-700">
                    Autenticação: {receiptData.codigoAutenticacao}
                  </p>
                </div>

                {/* Área e Linha de Assinatura com Posicionamento Visual da Imagem */}
                <div className="w-full sm:w-72 flex flex-col items-center text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                    Assinatura do Instrutor
                  </span>

                  {/* Espaço reservado e posicionado sobre a linha com suporte a Arrastar (Drag & Drop) */}
                  <div className="h-24 w-full flex items-end justify-center relative mb-1 select-none overflow-visible">
                    {signatureImage ? (
                      <div
                        onMouseDown={startDrag}
                        onTouchStart={startDrag}
                        style={{
                          transform: `translate(${signatureConfig.offsetX}px, ${signatureConfig.offsetY}px) scale(${signatureConfig.scale / 100})`,
                          transformOrigin: 'center bottom',
                          cursor: isDragging ? 'grabbing' : 'grab',
                          touchAction: 'none'
                        }}
                        className={`relative group inline-flex items-center justify-center p-1 rounded-lg transition-shadow duration-100 ${
                          isDragging
                            ? 'ring-2 ring-blue-500 bg-blue-50/50 shadow-md'
                            : 'hover:ring-1 hover:ring-blue-300 hover:bg-slate-50/70'
                        }`}
                        title="Clique e arraste a assinatura para posicionar exatamente sobre a linha"
                      >
                        <img
                          src={signatureImage}
                          alt="Assinatura Digital do Instrutor"
                          draggable={false}
                          className="max-h-16 max-w-[220px] object-contain drop-shadow-xs pointer-events-none select-none"
                        />
                        {/* Tooltip ao passar o cursor sobre a assinatura */}
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/90 text-white text-[9px] px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap z-20">
                          🖱️ Arraste para posicionar
                        </span>
                      </div>
                    ) : (
                      <div className="border border-dashed border-slate-300 rounded-lg w-full h-12 flex items-center justify-center text-[11px] text-slate-400 bg-white">
                        (Nenhuma assinatura anexada)
                      </div>
                    )}
                  </div>

                  {/* Linha de Assinatura do Instrutor */}
                  <div className="w-full border-t-2 border-slate-800 pt-1.5">
                    <p className="text-xs font-bold text-slate-900">{receiptData.instrutor.nome}</p>
                    <p className="text-[10px] text-slate-500 font-medium">Instrutor Credenciado de Trânsito</p>
                    {receiptData.instrutor.documento && (
                      <p className="text-[10px] text-slate-400 font-mono">{receiptData.instrutor.documento}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Confirmação do Recibo Digital */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900 text-xs space-y-1">
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
