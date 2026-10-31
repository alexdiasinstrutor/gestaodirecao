import React, { useState } from 'react';
import { X, UserPlus, Car, Shield, AlertCircle, CheckCircle2 } from 'lucide-react';
import { db } from '../../lib/storage';
import { isValidCPF, generateCPFFingerprint, getCPFLast4 } from '../../lib/validation';
import { User, Organization } from '../../types';

interface InstructorRegisterModalProps {
  onClose: () => void;
  onRegistered: (user: User) => void;
}

export const InstructorRegisterModal: React.FC<InstructorRegisterModalProps> = ({ onClose, onRegistered }) => {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    cpf: '',
    telefone: '',
    nomeAutoescola: '',
    tipo: 'INSTRUTOR_AUTONOMO' as 'INSTRUTOR_AUTONOMO' | 'AUTOESCOLA_CFC',
    cidade: 'São Paulo',
    estado: 'SP',
    senha: '',
    confirmarSenha: ''
  });

  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.nome.trim() || formData.nome.length < 3) {
      setError('Por favor, informe seu nome completo.');
      return;
    }

    if (!formData.email.trim() || !formData.email.includes('@')) {
      setError('Por favor, informe um endereço de e-mail válido.');
      return;
    }

    // CPF validation
    if (!isValidCPF(formData.cpf)) {
      setError('O CPF informado é inválido. Verifique os dígitos verificadores.');
      return;
    }

    if (!formData.telefone.trim()) {
      setError('Por favor, informe um número de telefone com DDD.');
      return;
    }

    if (!formData.senha || formData.senha.length < 6) {
      setError('A senha de acesso deve ter pelo menos 6 caracteres.');
      return;
    }

    if (formData.senha !== formData.confirmarSenha) {
      setError('A confirmação da senha não confere com a senha digitada.');
      return;
    }

    setLoading(true);

    try {
      const orgId = `org_${Date.now()}`;
      const newOrg: Organization = {
        id: orgId,
        nome: formData.nomeAutoescola.trim() || `${formData.nome.trim()} (Instrutor Autônomo)`,
        tipo: formData.tipo,
        cnpjCpf: formData.cpf,
        telefone: formData.telefone,
        email: formData.email,
        cidade: formData.cidade,
        estado: formData.estado,
        status: 'ATIVO',
        plano: 'PRO',
        criadoEm: new Date().toISOString()
      };

      const newUser: User = {
        id: `usr_${Date.now()}`,
        organizacaoId: orgId,
        nome: formData.nome.trim(),
        email: formData.email.trim().toLowerCase(),
        papel: 'ADMIN_ORG',
        telefone: formData.telefone,
        cpfUltimos4: getCPFLast4(formData.cpf),
        cpfFingerprint: generateCPFFingerprint(formData.cpf),
        twoFactorAtivo: true,
        ultimoAcesso: new Date().toISOString()
      };

      db.createOrganization(newOrg);
      db.createUser(newUser);

      // Create starter package for the new instructor
      db.createPackage(
        {
          id: `pkg_${Date.now()}_b20`,
          organizacaoId: orgId,
          instrutorId: newUser.id,
          instrutorNome: newUser.nome,
          nome: 'Pacote Completo CNH B (20 Aulas Práticas)',
          totalAulas: 20,
          categoriaCnh: 'B',
          valorCentavos: 180000,
          formaPagamento: 'TODAS',
          maxParcelas: 12,
          descontoAvistaPercentual: 5,
          descricao: 'Formação prática completa obrigatória para categoria Carro com simulados de exame.',
          ativo: true,
          criadoEm: new Date().toISOString().slice(0, 10)
        },
        newUser.id
      );

      onRegistered(newUser);
    } catch (err: any) {
      setError('Erro ao criar cadastro: ' + (err?.message || 'Tente novamente.'));
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Cadastro de Instrutor / Autoescola</h2>
              <p className="text-xs text-slate-300">Comece a gerenciar suas aulas e finanças</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-700 mb-1">Nome Completo do Instrutor *</label>
              <input
                type="text"
                required
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Carlos Eduardo Mendes"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">CPF (com validação estrita) *</label>
              <input
                type="text"
                required
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                placeholder="000.000.000-00"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Telefone WhatsApp *</label>
              <input
                type="text"
                required
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                placeholder="(11) 98765-4321"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-700 mb-1">E-mail Profissional *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="instrutor@autoescola.com.br"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Modalidade de Atuação</label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none bg-white"
              >
                <option value="INSTRUTOR_AUTONOMO">Instrutor Autônomo</option>
                <option value="AUTOESCOLA_CFC">Autoescola / CFC Credenciado</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Nome da Autoescola / Marca</label>
              <input
                type="text"
                value={formData.nomeAutoescola}
                onChange={(e) => setFormData({ ...formData, nomeAutoescola: e.target.value })}
                placeholder="Ex: Direção Segura CFC"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Cidade / Estado</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.cidade}
                  onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                  placeholder="Cidade"
                  className="w-3/4 px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none"
                />
                <input
                  type="text"
                  value={formData.estado}
                  maxLength={2}
                  onChange={(e) => setFormData({ ...formData, estado: e.target.value.toUpperCase() })}
                  placeholder="UF"
                  className="w-1/4 px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none text-center font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Senha de Acesso (Mín. 6 dígitos) *</label>
              <input
                type="password"
                required
                value={formData.senha}
                onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-700 mb-1">Confirmar Senha *</label>
              <input
                type="password"
                required
                value={formData.confirmarSenha}
                onChange={(e) => setFormData({ ...formData, confirmarSenha: e.target.value })}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-600 text-[11px] flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Ao criar a conta, você terá isolamento de dados por organização e autenticação 2FA ativada automaticamente.
            </span>
          </div>

          <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 font-semibold cursor-pointer w-full sm:w-auto"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-sm transition-colors cursor-pointer w-full sm:w-auto"
            >
              {loading ? 'Cadastrando...' : 'Concluir Cadastro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
