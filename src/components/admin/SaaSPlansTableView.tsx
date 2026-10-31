import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Zap,
  Sparkles,
  Award,
  Users,
  DollarSign,
  Car,
  Clock,
  Info,
  Pencil,
  X,
  Save,
  CheckSquare,
  Square,
  RotateCcw
} from 'lucide-react';
import { ALL_SYSTEM_MODULES, getSaaSPlans, saveSaaSPlan, resetSaaSPlans, SaaSPlanDefinition } from '../../lib/saasPlans';
import { formatCurrencyBRL } from '../../lib/validation';

export const SaaSPlansTableView: React.FC = () => {
  const [plansMap, setPlansMap] = useState<Record<string, SaaSPlanDefinition>>(() => getSaaSPlans());
  const [editingPlan, setEditingPlan] = useState<SaaSPlanDefinition | null>(null);
  const [successMsg, setSuccessMsg] = useState<string>('');

  const refreshPlans = () => {
    setPlansMap(getSaaSPlans());
  };

  const handleOpenEdit = (plan: SaaSPlanDefinition) => {
    setEditingPlan({ ...plan });
  };

  const handleSavePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    saveSaaSPlan(editingPlan.id, editingPlan);
    refreshPlans();
    setEditingPlan(null);
    setSuccessMsg(`Plano "${editingPlan.nome}" atualizado com sucesso!`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleResetAll = () => {
    if (window.confirm('Deseja realmente restaurar os planos originais padrão do sistema?')) {
      resetSaaSPlans();
      refreshPlans();
      setSuccessMsg('Planos restaurados para o padrão original!');
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  const toggleEditModule = (modId: string) => {
    if (!editingPlan) return;
    if (editingPlan.modulosPermitidos.includes(modId)) {
      setEditingPlan({
        ...editingPlan,
        modulosPermitidos: editingPlan.modulosPermitidos.filter((m) => m !== modId)
      });
    } else {
      setEditingPlan({
        ...editingPlan,
        modulosPermitidos: [...editingPlan.modulosPermitidos, modId]
      });
    }
  };

  const plansList = ['DEMO', 'BASICO', 'AVANCADO', 'MASTER'].map((id) => plansMap[id]).filter(Boolean);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner Explicativo */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-md border border-purple-800/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full">
              Gestão de Planos & Assinaturas SaaS
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Tabela & Configuração de Planos do Sistema
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Como Administrador Master, você pode editar valores de mensalidade, limites de alunos/instrutores e quais módulos cada plano libera por padrão.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleResetAll}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer border border-white/20"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Padrão</span>
            </button>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs flex items-center gap-2 font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 4 CARDS DE APRESENTAÇÃO DOS PLANOS COM BOTÃO DE EDIÇÃO */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plansList.map((p) => {
          const isMaster = p.id === 'MASTER';
          const isAdv = p.id === 'AVANCADO';
          const isBasic = p.id === 'BASICO';
          const isDemo = p.id === 'DEMO';

          return (
            <div
              key={p.id}
              className={`rounded-2xl p-5 border flex flex-col justify-between space-y-4 transition-all shadow-xs relative ${
                isMaster
                  ? 'bg-gradient-to-b from-amber-500/10 via-white to-white border-amber-300 ring-2 ring-amber-400/30'
                  : isAdv
                  ? 'bg-gradient-to-b from-purple-500/10 via-white to-white border-purple-200'
                  : isBasic
                  ? 'bg-gradient-to-b from-blue-500/10 via-white to-white border-blue-200'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="absolute top-4 right-4">
                <button
                  onClick={() => handleOpenEdit(p)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold cursor-pointer shadow-xs transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Editar Plano</span>
                </button>
              </div>

              <div className="space-y-2 pr-16">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${p.corBadge}`}>
                  {p.id}
                </span>

                <h3 className="text-base font-bold text-slate-900">{p.nome}</h3>
                <p className="text-[11px] text-slate-500 min-h-[32px]">{p.tagline}</p>

                <div className="pt-2 border-t border-slate-100">
                  <span className="text-2xl font-black font-mono text-slate-900">
                    {p.precoSugeridoMensalCentavos === 0
                      ? 'Grátis'
                      : formatCurrencyBRL(p.precoSugeridoMensalCentavos)}
                  </span>
                  {p.precoSugeridoMensalCentavos > 0 && (
                    <span className="text-xs text-slate-500 font-medium"> / mês</span>
                  )}
                </div>

                <div className="text-[11px] space-y-1 pt-1 font-medium text-slate-600">
                  <div className="flex justify-between">
                    <span>Limite de Alunos:</span>
                    <strong className="text-slate-900">
                      {p.limiteAlunos === 0 ? 'Ilimitado' : `Até ${p.limiteAlunos}`}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Limite de Instrutores:</span>
                    <strong className="text-slate-900">
                      {p.limiteInstrutores === 0 ? 'Ilimitado' : `Até ${p.limiteInstrutores}`}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Validade Padrão:</span>
                    <strong className="text-slate-900">{p.diasValidadePadrao} dias</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Módulos Liberados: {p.modulosPermitidos.length} módulos
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <span className="text-[10px] text-slate-400 italic block">
                  Recomendado para: {p.recomendadoPara}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* TABELA MATRIZ COMPARATIVA DE TODOS OS MÓDULOS */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Matriz Comparativa de Recursos por Módulo
          </h3>
          <p className="text-xs text-slate-500">
            Visão detalhada de quais menus e ferramentas são liberados em cada pacote
          </p>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4 w-1/3">Módulo / Funcionalidade</th>
                <th className="py-3 px-3 text-center">Demo</th>
                <th className="py-3 px-3 text-center">Básico</th>
                <th className="py-3 px-3 text-center bg-purple-50/50">Avançado</th>
                <th className="py-3 px-3 text-center bg-amber-50/50">Master Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {ALL_SYSTEM_MODULES.map((mod) => {
                const inDemo = plansMap.DEMO?.modulosPermitidos.includes(mod.id);
                const inBasic = plansMap.BASICO?.modulosPermitidos.includes(mod.id);
                const inAdv = plansMap.AVANCADO?.modulosPermitidos.includes(mod.id);
                const inMaster = plansMap.MASTER?.modulosPermitidos.includes(mod.id);

                return (
                  <tr key={mod.id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{mod.nome}</span>
                        {mod.badge && (
                          <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 text-[9px] font-bold">
                            {mod.badge}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        {mod.descricao}
                      </span>
                    </td>

                    {/* Demo */}
                    <td className="py-2.5 px-3 text-center">
                      {inDemo ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300 mx-auto" />
                      )}
                    </td>

                    {/* Básico */}
                    <td className="py-2.5 px-3 text-center">
                      {inBasic ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300 mx-auto" />
                      )}
                    </td>

                    {/* Avançado */}
                    <td className="py-2.5 px-3 text-center bg-purple-50/20">
                      {inAdv ? (
                        <CheckCircle2 className="w-4 h-4 text-purple-600 mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300 mx-auto" />
                      )}
                    </td>

                    {/* Master */}
                    <td className="py-2.5 px-3 text-center bg-amber-50/20">
                      {inMaster ? (
                        <CheckCircle2 className="w-4 h-4 text-amber-600 mx-auto font-black" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300 mx-auto" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE EDIÇÃO DE PLANO */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-600 text-white rounded-xl">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Editar Plano: {editingPlan.id}</h2>
                  <p className="text-[11px] text-slate-400">Configure valor, limites e módulos liberados por este plano</p>
                </div>
              </div>
              <button onClick={() => setEditingPlan(null)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Nome do Plano *</label>
                  <input
                    type="text"
                    required
                    value={editingPlan.nome}
                    onChange={(e) => setEditingPlan({ ...editingPlan, nome: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Descrição / Tagline *</label>
                  <input
                    type="text"
                    required
                    value={editingPlan.tagline}
                    onChange={(e) => setEditingPlan({ ...editingPlan, tagline: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Preço Mensal (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={(editingPlan.precoSugeridoMensalCentavos / 100).toFixed(2)}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        precoSugeridoMensalCentavos: Math.round(parseFloat(e.target.value || '0') * 100)
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Validade Padrão (Dias) *</label>
                  <input
                    type="number"
                    required
                    value={editingPlan.diasValidadePadrao}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        diasValidadePadrao: parseInt(e.target.value) || 30
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Limite de Alunos (0 = Ilimitado) *</label>
                  <input
                    type="number"
                    required
                    value={editingPlan.limiteAlunos}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        limiteAlunos: parseInt(e.target.value) || 0
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Limite de Instrutores (0 = Ilimitado) *</label>
                  <input
                    type="number"
                    required
                    value={editingPlan.limiteInstrutores}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        limiteInstrutores: parseInt(e.target.value) || 0
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Recomendado Para</label>
                  <input
                    type="text"
                    value={editingPlan.recomendadoPara}
                    onChange={(e) => setEditingPlan({ ...editingPlan, recomendadoPara: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Módulos Liberados */}
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider block">
                  Módulos Liberados por este Plano ({editingPlan.modulosPermitidos.length} de {ALL_SYSTEM_MODULES.length})
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  {ALL_SYSTEM_MODULES.map((mod) => {
                    const isSelected = editingPlan.modulosPermitidos.includes(mod.id);
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => toggleEditModule(mod.id)}
                        className={`flex items-start gap-2 p-2 rounded-xl text-left transition-colors cursor-pointer border ${
                          isSelected
                            ? 'bg-white border-purple-300 shadow-2xs'
                            : 'bg-transparent border-transparent text-slate-400 hover:bg-white/60'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-purple-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </div>
                        <div>
                          <span className={`font-semibold block ${isSelected ? 'text-slate-900' : 'text-slate-500'}`}>
                            {mod.nome}
                          </span>
                          <span className="text-[10px] text-slate-400 line-clamp-1">{mod.descricao}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-semibold cursor-pointer hover:bg-slate-50 text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl cursor-pointer shadow-xs"
                >
                  <Save className="w-4 h-4" />
                  <span>Salvar Alterações do Plano</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
