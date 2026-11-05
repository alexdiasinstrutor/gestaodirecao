import React, { useState, useMemo } from 'react';
import {
  Ticket,
  Percent,
  DollarSign,
  X,
  CheckCircle2,
  AlertCircle,
  Tag,
  Sparkles
} from 'lucide-react';
import { db } from '../../lib/storage';
import { formatCurrencyBRL } from '../../lib/validation';
import type { AccountReceivable, Student, DiscountCoupon } from '../../types';
import type { CouponValidationContext } from '../../lib/coupons';

interface ApplyDiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: AccountReceivable | null;
  student?: Student | null;
  orgId: string;
  actorId: string;
  onDiscountApplied: () => void;
}

export const ApplyDiscountModal: React.FC<ApplyDiscountModalProps> = ({
  isOpen,
  onClose,
  account,
  student,
  orgId,
  actorId,
  onDiscountApplied
}) => {
  if (!isOpen || !account) return null;

  const [mode, setMode] = useState<'COUPON' | 'MANUAL'>('COUPON');
  const [selectedCouponCode, setSelectedCouponCode] = useState<string>('');
  const [customCouponInput, setCustomCouponInput] = useState<string>('');

  // Manual discount inputs
  const [manualType, setManualType] = useState<'PERCENT' | 'FIXED'>('FIXED');
  const [manualValue, setManualValue] = useState<string>('');
  const [manualReason, setManualReason] = useState<string>('Desconto promocional concedido pelo instrutor');

  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Available coupons created for students in this organization
  const availableCoupons = useMemo(() => {
    return db.getCoupons({ escopo: 'ALUNO', organizacaoId: orgId }).filter((c) => c.ativo);
  }, [orgId, isOpen]);

  // Code to evaluate
  const activeCode = (selectedCouponCode || customCouponInput).trim().toUpperCase();

  // Preview evaluation
  const preview = useMemo(() => {
    setErrorMsg('');
    if (mode === 'COUPON') {
      if (!activeCode) return null;
      const ctx: CouponValidationContext = {
        escopo: 'ALUNO',
        referenciaId: account.pacoteId,
        instrutorId: student?.instrutorId,
        organizacaoId: orgId
      };
      const res = db.previewCoupon(activeCode, ctx, account.saldoDevedorCentavos);
      if (!res.valid || !res.result) {
        return {
          valid: false,
          error: res.error || 'Cupom inválido para esta fatura.',
          descontoCentavos: 0,
          valorFinalCentavos: account.saldoDevedorCentavos,
          coupon: undefined
        };
      }
      return {
        valid: true,
        error: undefined,
        descontoCentavos: res.result.valorDescontoCentavos,
        valorFinalCentavos: res.result.valorFinalCentavos,
        coupon: res.coupon
      };
    } else {
      const num = parseFloat(manualValue.replace(',', '.'));
      if (isNaN(num) || num <= 0) return null;

      let descontoCentavos = 0;
      if (manualType === 'PERCENT') {
        const pct = Math.min(100, Math.max(0, num));
        descontoCentavos = Math.round((account.saldoDevedorCentavos * pct) / 100);
      } else {
        descontoCentavos = Math.round(num * 100);
      }

      descontoCentavos = Math.min(account.saldoDevedorCentavos, Math.max(0, descontoCentavos));
      const valorFinalCentavos = Math.max(0, account.saldoDevedorCentavos - descontoCentavos);

      return {
        valid: true,
        error: undefined,
        descontoCentavos,
        valorFinalCentavos,
        coupon: undefined
      };
    }
  }, [mode, activeCode, manualType, manualValue, account, student, orgId]);

  const handleApply = () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (mode === 'COUPON') {
      if (!preview || !preview.valid || !preview.coupon) {
        setErrorMsg(preview?.error || 'Selecione ou digite um cupom válido.');
        return;
      }

      setIsSubmitting(true);
      try {
        const ctx: CouponValidationContext = {
          escopo: 'ALUNO',
          referenciaId: account.pacoteId,
          instrutorId: student?.instrutorId,
          organizacaoId: orgId
        };

        const redeemRes = db.redeemCoupon(
          preview.coupon.codigo,
          ctx,
          account.saldoDevedorCentavos,
          {
            organizacaoId: orgId,
            alunoId: student?.id || account.alunoId
          },
          actorId
        );

        if (!redeemRes.valid || !redeemRes.result) {
          setErrorMsg(redeemRes.error || 'Não foi possível resgatar este cupom.');
          setIsSubmitting(false);
          return;
        }

        const novoSaldo = redeemRes.result.valorFinalCentavos;
        const descText = ` · Desc. Cupom [${preview.coupon.codigo}]: -${formatCurrencyBRL(redeemRes.result.valorDescontoCentavos)}`;
        const updatedAcc: AccountReceivable = {
          ...account,
          saldoDevedorCentavos: novoSaldo,
          descricao: `${account.descricao}${descText}`,
          status: novoSaldo <= 0 ? 'PAGO' : account.status
        };

        db.updateAccountReceivable(updatedAcc, actorId);
        setSuccessMsg(`Cupom ${preview.coupon.codigo} aplicado com sucesso! Desconto de ${formatCurrencyBRL(redeemRes.result.valorDescontoCentavos)}.`);
        setTimeout(() => {
          onDiscountApplied();
          onClose();
        }, 1200);
      } catch (err: any) {
        setErrorMsg(err.message || 'Erro ao aplicar cupom.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Manual discount
      if (!preview || !preview.valid || preview.descontoCentavos <= 0) {
        setErrorMsg('Informe um valor de desconto válido.');
        return;
      }

      setIsSubmitting(true);
      try {
        const novoSaldo = preview.valorFinalCentavos;
        const motivoInfo = manualReason.trim() ? ` (${manualReason.trim()})` : '';
        const descText = ` · Desconto Instrutor: -${formatCurrencyBRL(preview.descontoCentavos)}${motivoInfo}`;
        const updatedAcc: AccountReceivable = {
          ...account,
          saldoDevedorCentavos: novoSaldo,
          descricao: `${account.descricao}${descText}`,
          status: novoSaldo <= 0 ? 'PAGO' : account.status
        };

        db.updateAccountReceivable(updatedAcc, actorId);
        setSuccessMsg(`Desconto de ${formatCurrencyBRL(preview.descontoCentavos)} aplicado com sucesso!`);
        setTimeout(() => {
          onDiscountApplied();
          onClose();
        }, 1200);
      } catch (err: any) {
        setErrorMsg(err.message || 'Erro ao aplicar desconto.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 text-slate-800 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Aplicar Desconto / Cupom no Plano</h2>
              <p className="text-xs text-slate-500">Conceda desconto no saldo devedor da fatura do aluno</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Account Details Box */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Aluno:</span>
            <strong className="text-slate-900 font-semibold">{student?.nome || 'Aluno cadastrado'}</strong>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Fatura / Pacote:</span>
            <span className="text-slate-700 truncate max-w-[240px]">{account.descricao}</span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-slate-200">
            <span className="text-slate-600 font-medium">Saldo Devedor Atual:</span>
            <strong className="text-sm font-extrabold font-mono text-slate-900">
              {formatCurrencyBRL(account.saldoDevedorCentavos)}
            </strong>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setMode('COUPON');
              setErrorMsg('');
            }}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'COUPON'
                ? 'bg-white text-purple-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Ticket className="w-3.5 h-3.5" />
            <span>Usar Cupom de Desconto</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('MANUAL');
              setErrorMsg('');
            }}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'MANUAL'
                ? 'bg-white text-purple-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Desconto Direto (R$ ou %)</span>
          </button>
        </div>

        {/* Tab 1: Coupon Selection */}
        {mode === 'COUPON' && (
          <div className="space-y-3">
            {availableCoupons.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Selecione um cupom ativo do seu catálogo:
                </label>
                <select
                  value={selectedCouponCode}
                  onChange={(e) => {
                    setSelectedCouponCode(e.target.value);
                    if (e.target.value) setCustomCouponInput('');
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                >
                  <option value="">-- Escolha um cupom existente --</option>
                  {availableCoupons.map((c) => (
                    <option key={c.id} value={c.codigo}>
                      {c.codigo} · {c.tipoDesconto === 'PERCENTUAL' ? `${c.percentual}% OFF` : c.tipoDesconto === 'VALOR_FIXO' ? `${formatCurrencyBRL(c.valorCentavos || 0)} OFF` : `${c.mesesGratis || 0} meses grátis`}{c.validoAte ? ` (Válido até ${new Date(c.validoAte).toLocaleDateString('pt-BR')})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-purple-600" />
                <span>Ou digite o código do cupom:</span>
              </label>
              <input
                type="text"
                value={customCouponInput}
                onChange={(e) => {
                  setCustomCouponInput(e.target.value.toUpperCase());
                  if (e.target.value) setSelectedCouponCode('');
                }}
                placeholder="Ex: PROMO50, ALUNO20"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
              />
            </div>
          </div>
        )}

        {/* Tab 2: Manual Direct Discount */}
        {mode === 'MANUAL' && (
          <div className="space-y-3 text-xs">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setManualType('FIXED')}
                className={`flex-1 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                  manualType === 'FIXED'
                    ? 'bg-purple-50 border-purple-300 text-purple-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Valor Fixo (R$)
              </button>
              <button
                type="button"
                onClick={() => setManualType('PERCENT')}
                className={`flex-1 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                  manualType === 'PERCENT'
                    ? 'bg-purple-50 border-purple-300 text-purple-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Porcentagem (%)
              </button>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">
                {manualType === 'FIXED' ? 'Valor do Desconto em Reais (R$):' : 'Porcentagem de Desconto (%):'}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                placeholder={manualType === 'FIXED' ? 'Ex: 100.00' : 'Ex: 15'}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">Motivo / Justificativa (opcional):</label>
              <input
                type="text"
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
                placeholder="Ex: Desconto por indicação de amigo"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
              />
            </div>
          </div>
        )}

        {/* Live Calculation Preview */}
        {preview && preview.valid && (
          <div className="p-3.5 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl space-y-2">
            <div className="flex items-center gap-1.5 text-purple-900 font-bold text-xs">
              <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
              <span>Simulação do Desconto:</span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-purple-200/60">
              <span className="text-slate-600">Saldo Atual:</span>
              <span className="font-mono line-through text-slate-500">
                {formatCurrencyBRL(account.saldoDevedorCentavos)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-emerald-700 font-semibold">Desconto Aplicado:</span>
              <strong className="font-mono text-emerald-700 font-extrabold">
                - {formatCurrencyBRL(preview.descontoCentavos)}
              </strong>
            </div>

            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-purple-200 font-bold">
              <span className="text-slate-900">Novo Saldo Devedor:</span>
              <strong className="font-mono text-sm text-purple-900">
                {formatCurrencyBRL(preview.valorFinalCentavos)}
              </strong>
            </div>
          </div>
        )}

        {/* Status Messages */}
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!preview || !preview.valid || isSubmitting || preview.descontoCentavos <= 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSubmitting ? 'Aplicando...' : 'Confirmar e Aplicar Desconto'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
