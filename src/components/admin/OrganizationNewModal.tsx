import React, { useState } from 'react';
import {
  X,
  Building,
  Plus,
  Key,
  Calendar,
  Sparkles,
  UserCheck
} from 'lucide-react';
import { SAAS_PLANS, getPlanDetails } from '../../lib/saasPlans';
import { generateCPFFingerprint } from '../../lib/validation';
import type { Organization, OrganizationType, SaaSPlanType, User } from '../../types';

interface OrganizationNewModalProps {
  onClose: () => void;
  onCreate: (org: Organization, initialUser?: User) => void;
}

export const OrganizationNewModal: React.FC<OrganizationNewModalProps> = ({
  onClose,
  onCreate
}) => {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<OrganizationType>('INSTRUTOR_AUTONOMO');
  const [cnpjCpf, setCnpjCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('SP');
  const [plano, setPlano] = useState<SaaSPlanType>('BASICO');
  const [diasValidade, setDiasValidade] = useState<number>(30);

  // Instrutor/Gestor Inicial
  const [criarUsuarioInicial, setCriarUsuarioInicial] = useState(true);
  const [userNome, setUserNome] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userTelefone, setUserTelefone] = useState('');
  const [userCpf, setUserCpf] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const orgId = `org_${Date.now()}`;
    const planDef = getPlanDetails(plano);
    const randomHex = Math.floor(100000 + Math.random() * 900000);
    const chaveAcesso = `KEY-${tipo === 'AUTOESCOLA_CFC' ? 'CFC' : 'INST'}-${randomHex}`;
    const vencimento = new Date(Date.now() + diasValidade * 86400000).toISOString().slice(0, 10);

    const newOrg: Organization = {
      id: orgId,
      nome: nome.trim(),
      tipo,
      cnpjCpf: cnpjCpf.trim(),
      telefone: telefone.trim(),
      email: email.trim(),
      cidade: cidade.trim(),
      estado: estado.trim().toUpperCase(),
      status: 'ATIVO',
      plano,
      criadoEm: new Date().toISOString(),
      dataVencimentoPlano: vencimento,
      valorMensalidadeCentavos: planDef.precoSugeridoMensalCentavos,
      chaveAcesso,
      chaveAcessoGeradaEm: new Date().toISOString(),
      modulosCustomizados: [...planDef.modulosPermitidos]
    };

    let initialUser: User | undefined;
    if (criarUsuarioInicial && userNome && userEmail) {
      const cleanCpf = userCpf.replace(/\D/g, '') || '00000000000';
      initialUser = {
        id: `usr_${Date.now()}`,
        organizacaoId: orgId,
        nome: userNome.trim(),
        email: userEmail.trim().toLowerCase(),
        papel: tipo === 'AUTOESCOLA_CFC' ? 'ADMIN_ORG' : 'INSTRUTOR',
        telefone: userTelefone.trim() || telefone.trim(),
        cpfUltimos4: cleanCpf.slice(-4) || '0000',
        cpfFingerprint: generateCPFFingerprint(cleanCpf),
        cpfMascarado: '***.***.***-**',
        twoFactorAtivo: false,
        senhaTemporaria: `Auto@${Math.floor(100000 + Math.random() * 900000)}`,
        aprovadoPorMaster: true
      };
    }

    onCreate(newOrg, initialUser);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Cabeçalho */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-600 text-white rounded-xl">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Cadastrar Nova Instituição / CFC</h2>
              <p className="text-[11px] text-slate-400">Cadastre a empresa, defina o plano e gere a chave de acesso</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs flex-1">
          <div className="space-y-3">
            <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider block">
              1. Dados da Instituição ou Instrutor
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Nome Fantasia / Razão Social *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Autoescola Aliança ou Instrutor Roberto Silva"
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
                  <option value="AUTOESCOLA_CFC">Autoescola / CFC</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">CNPJ ou CPF *</label>
                <input
                  type="text"
                  required
                  placeholder="00.000.000/0001-00"
                  value={cnpjCpf}
                  onChange={(e) => setCnpjCpf(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Telefone / WhatsApp *</label>
                <input
                  type="text"
                  required
                  placeholder="(11) 98888-7777"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">E-mail Institucional *</label>
                <input
                  type="email"
                  required
                  placeholder="contato@autoescola.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cidade</label>
                <input
                  type="text"
                  placeholder="São Paulo"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Estado (UF)</label>
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

          {/* Plano e Vigência */}
          <div className="pt-3 border-t border-slate-200 space-y-3">
            <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider block">
              2. Definição do Pacote & Vigência
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Plano Inicial *</label>
                <select
                  value={plano}
                  onChange={(e) => setPlano(e.target.value as SaaSPlanType)}
                  className="w-full px-3 py-2 border border-purple-400 rounded-xl bg-purple-50 font-bold text-purple-900"
                >
                  <option value="DEMO">DEMO (Degustação Rápida)</option>
                  <option value="BASICO">BÁSICO (R$ 69,90/mês)</option>
                  <option value="AVANCADO">AVANÇADO (R$ 139,90/mês)</option>
                  <option value="MASTER">MASTER (Total R$ 249,90/mês)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Período de Validade Inicial</label>
                <select
                  value={diasValidade}
                  onChange={(e) => setDiasValidade(parseInt(e.target.value) || 30)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  <option value={7}>7 dias (Ideal para Demonstração)</option>
                  <option value={15}>15 dias</option>
                  <option value={30}>30 dias (Mensal)</option>
                  <option value={90}>90 dias (Trimestral)</option>
                  <option value={365}>365 dias (Anual)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Usuário Inicial */}
          <div className="pt-3 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
                3. Usuário Gestor / Instrutor Titular
              </span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={criarUsuarioInicial}
                  onChange={(e) => setCriarUsuarioInicial(e.target.checked)}
                  className="rounded text-purple-600"
                />
                <span className="text-[11px] font-semibold text-slate-600">Criar acesso de login</span>
              </label>
            </div>

            {criarUsuarioInicial && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nome do Responsável *</label>
                  <input
                    type="text"
                    required={criarUsuarioInicial}
                    placeholder="Nome completo do instrutor ou gestor"
                    value={userNome}
                    onChange={(e) => setUserNome(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">E-mail de Login *</label>
                  <input
                    type="email"
                    required={criarUsuarioInicial}
                    placeholder="email@autoescola.com"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">WhatsApp do Responsável</label>
                  <input
                    type="text"
                    placeholder="(11) 98888-7777"
                    value={userTelefone}
                    onChange={(e) => setUserTelefone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">CPF do Responsável</label>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    value={userCpf}
                    onChange={(e) => setUserCpf(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-mono"
                  />
                </div>
                <div className="sm:col-span-2 text-[11px] text-purple-700 bg-purple-50 p-2 rounded-xl">
                  💡 Uma <strong>senha temporária</strong> e a <strong>chave de acesso</strong> serão geradas automaticamente e exibidas na tela para você encaminhar ao cliente.
                </div>
              </div>
            )}
          </div>

          {/* Botões */}
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
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl cursor-pointer shadow-xs"
            >
              Criar Instituição & Gerar Chave
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
