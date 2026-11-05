import React, { useMemo, useState } from 'react';
import {
  Ticket,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Copy,
  X,
  Wand2,
  CheckCircle2,
  AlertCircle,
  History
} from 'lucide-react';
import { db } from '../../lib/storage';
import { getSaaSPlans } from '../../lib/saasPlans';
import { describeCoupon, FREE_PERIOD_PRESETS, generateCouponCode, normalizeCouponCode } from '../../lib/coupons';
import { formatCurrencyBRL, formatDateBR, formatDateTimeBR } from '../../lib/validation';
import { CouponDiscountType, CouponScope, DiscountCoupon, Organization, User } from '../../types';

interface CouponsManagerProps {
  scope: CouponScope;
  currentUser: User;
  currentOrg?: Organization;
}

interface CouponForm {
  codigo: string;
  descricao: string;
  tipoDesconto: CouponDiscountType;
  mesesGratis: number;
  percentual: string;
  valorReais: string;
  duracaoMeses: number;
  validoAte: string;
  limiteUsos: number;
  planosPermitidos: string[];
  ativo: boolean;
}

export const CouponsManager: React.FC<CouponsManagerProps> = ({ scope, currentUser, currentOrg }) => {
  const isPlatform = scope === 'PLATAFORMA';
  const accent = isPlatform ? 'purple' : 'blue';

  const [refreshKey, setRefreshKey] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DiscountCoupon | null>(null);
  const [formError, setFormError] = useState('');
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [historyCouponId, setHistoryCouponId] = useState<string | null>(null);

  const emptyForm = (): CouponForm => ({
    codigo: generateCouponCode(isPlatform ? 'GESTAOAD' : 'ALUNO'),
    descricao: '',
    tipoDesconto: isPlatform ? 'PERIODO_GRATIS' : 'PERCENTUAL',
    mesesGratis: 3,
    percentual: '10',
    valorReais: '50.00',
    duracaoMeses: 0,
    validoAte: '',
    limiteUsos: 0,
    planosPermitidos: [],
    ativo: true
  });
  const [form, setForm] = useState<CouponForm>(emptyForm);

  // Alvos possíveis: planos SaaS (Master) ou pacotes do instrutor
  const targets = useMemo(() => {
    if (isPlatform) {
      const plans = getSaaSPlans();
      return ['DEMO', 'BASICO', 'AVANCADO', 'MASTER']
        .map((id) => plans[id])
        .filter(Boolean)
        .map((p) => ({ id: String(p.id), label: p.nome, valor: p.precoSugeridoMensalCentavos }));
    }
    if (!currentOrg) return [];
    return db
      .getPackages(currentOrg.id, currentUser.id)
      .map((p) => ({ id: p.id, label: p.nome, valor: p.valorCentavos }));
  }, [isPlatform, currentOrg?.id, currentUser.id, refreshKey]);

  const coupons = useMemo(
    () =>
      isPlatform
        ? db.getCoupons({ escopo: 'PLATAFORMA' })
        : db.getCoupons({ escopo: 'ALUNO', instrutorId: currentUser.id }),
    [isPlatform, currentUser.id, refreshKey]
  );

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const refresh = () => setRefreshKey((k) => k + 1);

  const handleOpenNew = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormError('');
    setShowModal(true);
  };

  const handleOpenEdit = (c: DiscountCoupon) => {
    setEditing(c);
    setForm({
      codigo: c.codigo,
      descricao: c.descricao || '',
      tipoDesconto: c.tipoDesconto,
      mesesGratis: c.mesesGratis || 3,
      percentual: String(c.percentual ?? '10'),
      valorReais: ((c.valorCentavos || 0) / 100).toFixed(2),
      duracaoMeses: c.duracaoMeses || 0,
      validoAte: c.validoAte || '',
      limiteUsos: c.limiteUsos || 0,
      planosPermitidos: c.planosPermitidos || [],
      ativo: c.ativo
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const coupon: DiscountCoupon = {
      id: editing?.id || `cpn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      codigo: normalizeCouponCode(form.codigo),
      escopo: scope,
      tipoDesconto: form.tipoDesconto,
      mesesGratis: form.tipoDesconto === 'PERIODO_GRATIS' ? Number(form.mesesGratis) : undefined,
      percentual: form.tipoDesconto === 'PERCENTUAL' ? Number(String(form.percentual).replace(',', '.')) : undefined,
      valorCentavos:
        form.tipoDesconto === 'VALOR_FIXO'
          ? Math.round(parseFloat(String(form.valorReais).replace(',', '.') || '0') * 100)
          : undefined,
      duracaoMeses: isPlatform && form.tipoDesconto !== 'PERIODO_GRATIS' ? Number(form.duracaoMeses) || 0 : undefined,
      planosPermitidos: form.planosPermitidos,
      organizacaoId: isPlatform ? undefined : currentOrg?.id,
      instrutorId: isPlatform ? undefined : currentUser.id,
      criadoPorId: editing?.criadoPorId || currentUser.id,
      criadoPorNome: editing?.criadoPorNome || currentUser.nome,
      validoAte: form.validoAte || undefined,
      limiteUsos: Number(form.limiteUsos) || 0,
      usosRealizados: editing?.usosRealizados || 0,
      ativo: form.ativo,
      descricao: form.descricao.trim() || undefined,
      criadoEm: editing?.criadoEm || new Date().toISOString()
    };

    const res = db.saveCoupon(coupon, currentUser.id);
    if (!res.success) {
      setFormError(res.error || 'Não foi possível salvar o cupom.');
      return;
    }
    setShowModal(false);
    refresh();
    showFeedback(`Cupom ${res.coupon?.codigo} ${editing ? 'atualizado' : 'criado'} com sucesso!`);
  };

  const handleToggle = (c: DiscountCoupon) => {
    db.toggleCoupon(c.id, currentUser.id);
    refresh();
  };

  const handleDelete = (c: DiscountCoupon) => {
    if (!window.confirm(`Excluir o cupom ${c.codigo}?`)) return;
    const res = db.deleteCoupon(c.id, currentUser.id);
    if (!res.success) {
      showFeedback(res.error || 'Não foi possível excluir.', 'error');
      return;
    }
    refresh();
    showFeedback(`Cupom ${c.codigo} excluído.`);
  };

  const handleCopy = (code: string) => {
    try {
      navigator.clipboard?.writeText(code);
      showFeedback(`Código ${code} copiado!`);
    } catch {
      showFeedback(code);
    }
  };

  const togglePlanTarget = (id: string) => {
    setForm((f) => ({
      ...f,
      planosPermitidos: f.planosPermitidos.includes(id)
        ? f.planosPermitidos.filter((x) => x !== id)
        : [...f.planosPermitidos, id]
    }));
  };

  const targetLabel = (ids?: string[]) => {
    if (!ids || ids.length === 0) return isPlatform ? 'Todos os planos' : 'Todos os meus pacotes';
    return ids.map((id) => targets.find((t) => t.id === id)?.label || id).join(', ');
  };

  const today = new Date().toISOString().slice(0, 10);
  const historyRedemptions = historyCouponId ? db.getCouponRedemptions({ cupomId: historyCouponId }) : [];

  return (
    <div className="space-y-4 animate-in fade-in duration-200" data-testid={`coupons-manager-${scope}`}>
      {/* Header */}
      <div
        className={`rounded-2xl p-5 border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isPlatform
            ? 'bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white border-purple-800/40'
            : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-xl ${isPlatform ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-50 text-blue-600'}`}>
            <Ticket className="w-6 h-6" />
          </div>
          <div>
            <h3 className={`font-bold text-sm sm:text-base ${isPlatform ? 'text-white' : 'text-slate-900'}`}>
              {isPlatform ? 'Cupons da Plataforma (Assinatura dos Instrutores)' : 'Cupons de Desconto para Alunos'}
            </h3>
            <p className={`text-xs ${isPlatform ? 'text-purple-200' : 'text-slate-500'}`}>
              {isPlatform
                ? 'Gere períodos de teste grátis (3, 6, 12 meses…) ou desconto na mensalidade dos planos SaaS.'
                : 'Crie cupons de desconto no valor dos seus pacotes de aulas. O aluno informa o código no auto-cadastro.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleOpenNew}
          className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm cursor-pointer shrink-0 ${
            isPlatform ? 'bg-white text-purple-900 hover:bg-purple-50' : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          <Plus className="w-4 h-4" />
          Gerar Cupom
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {feedback.text}
        </div>
      )}

      {/* Lista */}
      {coupons.length === 0 ? (
        <div className="p-6 bg-white border border-dashed border-slate-300 rounded-2xl text-center text-xs text-slate-500">
          Nenhum cupom cadastrado ainda. Clique em <strong>Gerar Cupom</strong> para criar o primeiro.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {coupons.map((c) => {
            const expired = !!c.validoAte && today > c.validoAte;
            const exhausted = (c.limiteUsos || 0) > 0 && c.usosRealizados >= (c.limiteUsos || 0);
            const statusLabel = !c.ativo ? 'Inativo' : expired ? 'Expirado' : exhausted ? 'Esgotado' : 'Ativo';
            const statusClass =
              statusLabel === 'Ativo'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-600 border-slate-200';
            return (
              <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(c.codigo)}
                      title="Copiar código"
                      className={`font-mono font-extrabold text-sm tracking-wider px-2 py-1 rounded-lg border border-dashed cursor-pointer inline-flex items-center gap-1.5 ${
                        isPlatform ? 'border-purple-300 bg-purple-50 text-purple-900' : 'border-blue-300 bg-blue-50 text-blue-900'
                      }`}
                    >
                      {c.codigo}
                      <Copy className="w-3 h-3 opacity-60" />
                    </button>
                    <p className="font-bold text-slate-900 mt-1.5">{describeCoupon(c)}</p>
                    {c.descricao && <p className="text-slate-500 text-xs">{c.descricao}</p>}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full border text-xs font-bold shrink-0 ${statusClass}`}>{statusLabel}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>
                    <span className="block text-xs uppercase font-bold font-bold text-slate-400">Vale para</span>
                    {targetLabel(c.planosPermitidos)}
                  </div>
                  <div>
                    <span className="block text-xs uppercase font-bold font-bold text-slate-400">Validade</span>
                    {c.validoAte ? `Até ${formatDateBR(c.validoAte)}` : 'Sem data limite'}
                  </div>
                  <div>
                    <span className="block text-xs uppercase font-bold font-bold text-slate-400">Usos</span>
                    {c.usosRealizados} / {c.limiteUsos ? c.limiteUsos : '∞'}
                  </div>
                  <div>
                    <span className="block text-xs uppercase font-bold font-bold text-slate-400">Criado por</span>
                    {c.criadoPorNome}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleToggle(c)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 font-semibold cursor-pointer"
                  >
                    {c.ativo ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
                    {c.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(c)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 font-semibold cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryCouponId(historyCouponId === c.id ? null : c.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 font-semibold cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" /> Resgates
                  </button>
                  {c.usosRealizados === 0 && (
                    <button
                      type="button"
                      onClick={() => handleDelete(c)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-semibold cursor-pointer ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </button>
                  )}
                </div>

                {historyCouponId === c.id && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1.5">
                    {historyRedemptions.length === 0 ? (
                      <p className="text-xs text-slate-500">Nenhum resgate registrado.</p>
                    ) : (
                      historyRedemptions.slice(0, 10).map((r) => (
                        <div key={r.id} className="flex justify-between gap-2 text-xs">
                          <span className="text-slate-600">{formatDateTimeBR(r.resgatadoEm)}</span>
                          <span className="font-mono text-slate-900">
                            {r.mesesGratis ? `${r.mesesGratis} meses grátis` : `-${formatCurrencyBRL(r.valorDescontoCentavos)}`}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de criação/edição */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ticket className={`w-5 h-5 text-${accent}-400`} />
                <h3 className="font-bold text-sm">{editing ? 'Editar Cupom' : 'Gerar Novo Cupom'}</h3>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 mb-1">Código do Cupom *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={form.codigo}
                    onChange={(e) => setForm({ ...form, codigo: normalizeCouponCode(e.target.value) })}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold tracking-wider focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, codigo: generateCouponCode(isPlatform ? 'GESTAOAD' : 'ALUNO') })}
                    className="flex items-center gap-1 px-3 py-2 border border-slate-300 rounded-xl hover:bg-slate-50 font-semibold cursor-pointer"
                  >
                    <Wand2 className="w-3.5 h-3.5" /> Gerar
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Tipo de Desconto *</label>
                <div className={`grid gap-2 ${isPlatform ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {(isPlatform
                    ? (['PERIODO_GRATIS', 'PERCENTUAL', 'VALOR_FIXO'] as CouponDiscountType[])
                    : (['PERCENTUAL', 'VALOR_FIXO'] as CouponDiscountType[])
                  ).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, tipoDesconto: t })}
                      className={`px-2 py-2 rounded-xl border font-bold cursor-pointer text-xs ${
                        form.tipoDesconto === t ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {t === 'PERIODO_GRATIS' ? 'Período de Teste' : t === 'PERCENTUAL' ? '% de Desconto' : 'R$ de Desconto'}
                    </button>
                  ))}
                </div>
              </div>

              {form.tipoDesconto === 'PERIODO_GRATIS' && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Meses de teste grátis *</label>
                  <div className="flex flex-wrap gap-2 items-center">
                    {FREE_PERIOD_PRESETS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setForm({ ...form, mesesGratis: m })}
                        className={`px-3 py-2 rounded-xl border font-bold cursor-pointer ${
                          form.mesesGratis === m ? 'border-purple-600 bg-purple-50 text-purple-800' : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {m} meses
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      max={36}
                      value={form.mesesGratis}
                      onChange={(e) => setForm({ ...form, mesesGratis: Number(e.target.value) })}
                      className="w-20 px-2 py-2 border border-slate-300 rounded-xl"
                      aria-label="Meses personalizados"
                    />
                  </div>
                </div>
              )}

              {form.tipoDesconto === 'PERCENTUAL' && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Percentual de desconto {isPlatform ? 'na mensalidade' : 'no pacote'} (%) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    step="0.5"
                    required
                    value={form.percentual}
                    onChange={(e) => setForm({ ...form, percentual: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              )}

              {form.tipoDesconto === 'VALOR_FIXO' && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Valor do desconto {isPlatform ? 'na mensalidade' : 'no pacote'} (R$) *
                  </label>
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    required
                    value={form.valorReais}
                    onChange={(e) => setForm({ ...form, valorReais: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              )}

              {isPlatform && form.tipoDesconto !== 'PERIODO_GRATIS' && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Duração do desconto (meses, 0 = permanente)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.duracaoMeses}
                    onChange={(e) => setForm({ ...form, duracaoMeses: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Usar até (data)</label>
                  <input
                    type="date"
                    value={form.validoAte}
                    onChange={(e) => setForm({ ...form, validoAte: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Limite de usos (0 = ∞)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.limiteUsos}
                    onChange={(e) => setForm({ ...form, limiteUsos: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  {isPlatform ? 'Planos onde o cupom vale' : 'Pacotes onde o cupom vale'} (nenhum marcado = todos)
                </label>
                {targets.length === 0 ? (
                  <p className="text-xs text-slate-500">Nenhum pacote cadastrado — o cupom valerá para todos os pacotes futuros.</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {targets.map((t) => (
                      <label key={t.id} className="flex items-center justify-between gap-2 p-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                        <span className="flex items-center gap-2">
                          <input type="checkbox" checked={form.planosPermitidos.includes(t.id)} onChange={() => togglePlanTarget(t.id)} />
                          {t.label}
                        </span>
                        <span className="font-mono text-slate-500">
                          {formatCurrencyBRL(t.valor)}
                          {isPlatform ? '/mês' : ''}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Descrição interna (opcional)</label>
                <input
                  type="text"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder={isPlatform ? 'Ex: Campanha de lançamento' : 'Ex: Indicação de amigo'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
                Cupom ativo (pode ser utilizado)
              </label>

              <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold cursor-pointer">
                  {editing ? 'Salvar Alterações' : 'Gerar Cupom'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

