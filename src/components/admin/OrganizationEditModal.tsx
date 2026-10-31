import React, { useState } from 'react';
import {
  X,
  Building,
  Save,
  CheckSquare,
  Square,
  Sparkles,
  Calendar,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { ALL_SYSTEM_MODULES, SAAS_PLANS, getPlanDetails } from '../../lib/saasPlans';
import type { Organization, OrganizationStatus, SaaSPlanType } from '../../types';

interface OrganizationEditModalProps {
  organization: Organization;
  onClose: () => void;
  onSave: (updated: Organization) => void;
}

export const OrganizationEditModal: React.FC<OrganizationEditModalProps> = ({
  organization,
  onClose,
  onSave
}) => {
  const [nome, setNome] = useState(organization.nome);
  const [tipo, setTipo] = useState(organization.tipo);
  const [cnpjCpf, setCnpjCpf] = useState(organization.cnpjCpf);
  const [telefone, setTelefone] = useState(organization.telefone || '');
  const [email, setEmail] = useState(organization.email || '');
  const [cidade, setCidade] = useState(organization.cidade || '');
  const [estado, setEstado] = useState(organization.estado || 'SP');
  const [status, setStatus] = useState<OrganizationStatus>(organization.status);
  const [plano, setPlano] = useState<SaaSPlanType>(organization.plano);
  const [dataVencimentoPlano, setDataVencimentoPlano] = useState(
    organization.dataVencimentoPlano || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  );
  const [valorMensalReais, setValorMensalReais] = useState(
    organization.valorMensalidadeCentavos
      ? (organization.valorMensalidadeCentavos / 100).toFixed(2)
      : (getPlanDetails(organization.plano).precoSugeridoMensalCentavos / 100).toFixed(2)
  );

  // Módulos liberados (se já tinha customizado usa eles, se não usa os padrões do plano)
  const [selectedModules, setSelectedModules] = useState<string[]>(() => {
    if (organization.modulosCustomizados && organization.modulosCustomizados.length > 0) {
      return [...organization.modulosCustomizados];
    }
    return [...getPlanDetails(organization.plano).modulosPermitidos];
  });

  // Ao mudar de plano no select, perguntar/sugerir se quer resetar os módulos para o padrão do novo plano
  const handlePlanChange = (newPlan: SaaSPlanType) => {
    setPlano(newPlan);
    const planDef = getPlanDetails(newPlan);
    setValorMensalReais((planDef.precoSugeridoMensalCentavos / 100).toFixed(2));
    setSelectedModules([...planDef.modulosPermitidos]);
  };

  const toggleModule = (modId: string) => {
    if (selectedModules.includes(modId)) {
      setSelectedModules(selectedModules.filter((m) => m !== modId));
    } else {
      setSelectedModules([...selectedModules, modId]);
    }
  };

  const handleResetToPlanDefault = () => {
    const planDef = getPlanDetails(plano);
    setSelectedModules([...planDef.modulosPermitidos]);
  };

  const handleSelectAll = () => {
    setSelectedModules(ALL_SYSTEM_MODULES.map((m) => m.id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const valorCentavos = Math.round(parseFloat(valorMensalReais || '0') * 100);

    const updated: Organization = {
      ...organization,
      nome: nome.trim(),
      tipo,
      cnpjCpf: cnpjCpf.trim(),
      telefone: telefone.trim(),
      email: email.trim(),
      cidade: cidade.trim(),
      estado: estado.trim().toUpperCase(),
      status,
      plano,
      dataVencimentoPlano,
      valorMensalidadeCentavos: valorCentavos,
      modulosCustomizados: selectedModules
    };

    onSave(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Cabeçalho */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-600/30 text-purple-300 rounded-xl">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Editar Instituição & Assinatura</h2>
              <p className="text-[11px] text-slate-400">Configure plano, vigência e permissões granulares de menus</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {/* Dados Gerais */}
          <div className="space-y-3">
            <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider block">
              1. Dados Cadastrais da Instituição
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome / Razão Social *</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Modalidade *</label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="INSTRUTOR_AUTONOMO">Instrutor Autônomo</option>
                  <option value="AUTOESCOLA_CFC">Autoescola / Centro de Formação (CFC)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">CNPJ ou CPF *</label>
                <input
                  type="text"
                  required
                  value={cnpjCpf}
                  onChange={(e) => setCnpjCpf(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Telefone / WhatsApp</label>
                <input
                  type="text"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">E-mail de Contato</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Cidade</label>
                  <input
                    type="text"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">UF</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={estado}
                    onChange={(e) => setEstado(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono uppercase text-center"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Plano e Vigência SaaS */}
          <div className="pt-3 border-t border-slate-200 space-y-3">
            <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider block">
              2. Plano SaaS & Gestão de Assinatura
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Plano Contratado *</label>
                <select
                  value={plano}
                  onChange={(e) => handlePlanChange(e.target.value as SaaSPlanType)}
                  className="w-full px-3 py-2 border border-purple-400 rounded-xl bg-purple-50/50 font-bold text-purple-900"
                >
                  <option value="DEMO">DEMO (Degustação 7 dias)</option>
                  <option value="BASICO">BÁSICO (R$ 69,90/mês)</option>
                  <option value="AVANCADO">AVANÇADO (R$ 139,90/mês)</option>
                  <option value="MASTER">MASTER (Total R$ 249,90/mês)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status da Conta *</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as OrganizationStatus)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold"
                >
                  <option value="ATIVO">🟢 ATIVO</option>
                  <option value="BLOQUEADO">🔴 BLOQUEADO</option>
                  <option value="PENDENTE_APROVACAO">🟡 PENDENTE APROVAÇÃO</option>
                  <option value="VENCIDO">🟠 VENCIDO</option>
                  <option value="TESTE">🔵 TESTE</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Vencimento da Assinatura</label>
                <input
                  type="date"
                  value={dataVencimentoPlano}
                  onChange={(e) => setDataVencimentoPlano(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Valor da Mensalidade (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={valorMensalReais}
                  onChange={(e) => setValorMensalReais(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold"
                />
              </div>
            </div>
          </div>

          {/* Permissões Granulares de Módulos (Feature Flags) */}
          <div className="pt-3 border-t border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider block">
                  3. Permissões de Módulos para esta Instituição ({selectedModules.length} de {ALL_SYSTEM_MODULES.length} ativos)
                </span>
                <p className="text-[11px] text-slate-500">
                  Você pode ligar ou desligar qualquer módulo individualmente para este cliente.
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleResetToPlanDefault}
                  className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Padrão do Plano</span>
                </button>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-[10px] font-semibold cursor-pointer"
                >
                  Liberar Todos
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              {ALL_SYSTEM_MODULES.map((mod) => {
                const isSelected = selectedModules.includes(mod.id);
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => toggleModule(mod.id)}
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

          {/* Botões do Rodapé */}
          <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl font-semibold cursor-pointer hover:bg-slate-50 text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center justify-center gap-1.5 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl cursor-pointer shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Alterações</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
