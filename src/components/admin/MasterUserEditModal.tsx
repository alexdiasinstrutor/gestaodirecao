import React, { useState, useEffect } from 'react';
import {
  X,
  UserCheck,
  UserPlus,
  Mail,
  Phone,
  CreditCard,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { db } from '../../lib/storage';
import { isValidCPF, maskCPF, maskPhoneInput, cleanPhoneDigits, isValidPhone, formatPhone } from '../../lib/validation';
import { User, AddressFields } from '../../types';
import { AddressCepFields } from '../common/AddressCepFields';

interface MasterUserEditModalProps {
  mode: 'NEW' | 'EDIT';
  userToEdit?: User | null;
  currentUser: User;
  onClose: () => void;
  onSuccess: (savedUser: User, isNew: boolean) => void;
}

export const MasterUserEditModal: React.FC<MasterUserEditModalProps> = ({
  mode,
  userToEdit,
  currentUser,
  onClose,
  onSuccess
}) => {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [address, setAddress] = useState<AddressFields>({
    estado: 'MG',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: ''
  });
  const [senha, setSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode === 'EDIT' && userToEdit) {
      setNome(userToEdit.nome || '');
      setEmail(userToEdit.email || '');
      setTelefone(userToEdit.telefone || '');
      setCpf(userToEdit.cpfCompleto || userToEdit.cpfMascarado || '');
      setAddress({
        estado: userToEdit.estado || 'MG',
        cep: userToEdit.cep || '',
        logradouro: userToEdit.logradouro || '',
        numero: userToEdit.numero || '',
        complemento: userToEdit.complemento || '',
        bairro: userToEdit.bairro || '',
        cidade: userToEdit.cidade || ''
      });
    } else {
      setNome('');
      setEmail('');
      setTelefone('');
      setCpf('');
      setAddress({
        estado: 'MG',
        cep: '',
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: ''
      });
      setSenha('');
      setConfirmSenha('');
    }
  }, [mode, userToEdit]);

  const handleCpfChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 11);
    let formatted = clean;
    if (clean.length > 9) {
      formatted = `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
    } else if (clean.length > 6) {
      formatted = `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
    } else if (clean.length > 3) {
      formatted = `${clean.slice(0, 3)}.${clean.slice(3)}`;
    }
    setCpf(formatted);
  };

  const handlePhoneChange = (val: string) => {
    setTelefone(maskPhoneInput(val));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!nome.trim() || nome.trim().length < 3) {
      setError('Por favor, informe o nome completo do Administrador Master (mínimo 3 letras).');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Informe um endereço de e-mail corporativo válido.');
      return;
    }

    const cleanCpfDigits = cpf.replace(/\D/g, '');
    if (cleanCpfDigits.length !== 11) {
      setError('O CPF deve possuir exatamente 11 dígitos numéricos.');
      return;
    }

    if (!isValidCPF(cleanCpfDigits)) {
      setError('O CPF informado é matematicamente inválido. Por favor, verifique os números.');
      return;
    }

    const phoneDigits = cleanPhoneDigits(telefone);
    if (!phoneDigits || phoneDigits.length < 10) {
      setError('Por favor, informe um telefone WhatsApp válido com DDD (mínimo 10 ou 11 dígitos).');
      return;
    }

    if (!isValidPhone(phoneDigits)) {
      setError('DDD ou formato inválido. Informe um telefone brasileiro com DDD entre 11 e 99.');
      return;
    }

    const cleanPhone = formatPhone(phoneDigits);

    if (mode === 'NEW') {
      if (!senha || senha.length < 6) {
        setError('A senha inicial do novo Administrador Master deve conter pelo menos 6 caracteres.');
        return;
      }
      if (senha !== confirmSenha) {
        setError('As senhas digitadas não coincidem.');
        return;
      }
    }

    setLoading(true);

    setTimeout(() => {
      if (mode === 'NEW') {
        const res = db.createMasterUser(
          {
            nome,
            email,
            telefone: cleanPhone,
            cpf: cleanCpfDigits,
            senha,
            cep: address.cep,
            estado: address.estado,
            cidade: address.cidade,
            bairro: address.bairro,
            logradouro: address.logradouro,
            numero: address.numero,
            complemento: address.complemento
          },
          currentUser.id
        );

        if (!res.success || !res.user) {
          setError(res.message || 'Erro ao cadastrar novo Administrador Master.');
          setLoading(false);
          return;
        }

        setLoading(false);
        onSuccess(res.user, true);
      } else if (mode === 'EDIT' && userToEdit) {
        const res = db.updateMasterUser(
          userToEdit.id,
          {
            nome,
            email,
            telefone: cleanPhone,
            cpf: cleanCpfDigits,
            cep: address.cep,
            estado: address.estado,
            cidade: address.cidade,
            bairro: address.bairro,
            logradouro: address.logradouro,
            numero: address.numero,
            complemento: address.complemento
          },
          currentUser.id
        );

        if (!res.success || !res.user) {
          setError(res.message || 'Erro ao atualizar dados do Administrador Master.');
          setLoading(false);
          return;
        }

        setLoading(false);
        onSuccess(res.user, false);
      }
    }, 350);
  };

  const isSelf = mode === 'EDIT' && userToEdit?.id === currentUser.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900 via-slate-900 to-purple-950 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/20 text-purple-300 rounded-xl border border-purple-400/30">
              {mode === 'NEW' ? (
                <UserPlus className="w-5 h-5 text-purple-300" />
              ) : (
                <UserCheck className="w-5 h-5 text-purple-300" />
              )}
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white">
                {mode === 'NEW'
                  ? 'Cadastrar Novo Administrador Master'
                  : isSelf
                  ? 'Editar Meus Dados Cadastrais (Master)'
                  : 'Editar Dados do Administrador Master'}
              </h2>
              <p className="text-xs text-purple-200/80">
                Acesso de Governança Global do Sistema Gestão AD
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 bg-purple-50/60 border border-purple-200/70 rounded-xl flex items-center gap-2 text-xs text-purple-900">
            <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
            <span>
              Usuários cadastrados com papel <strong>SUPER_ADMIN</strong> têm acesso irrestrito ao painel master, financeiro e configurações de todas as instituições.
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Nome Completo */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome Completo do Master *
              </label>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Cássio Costa"
                className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:border-purple-600 focus:outline-none bg-slate-50/50 focus:bg-white transition-colors"
              />
            </div>

            {/* Email de Acesso */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                E-mail Corporativo de Login *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@dominio.com.br"
                  className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:border-purple-600 focus:outline-none bg-slate-50/50 focus:bg-white transition-colors"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Utilizado para login e para o recebimento de códigos de recuperação de senha.
              </p>
            </div>

            {/* Linha dupla: Telefone e CPF */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Telefone / WhatsApp *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="tel"
                    required
                    value={telefone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="(11) 98765-4321"
                    className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:border-purple-600 focus:outline-none bg-slate-50/50 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  CPF do Titular *
                </label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={cpf}
                    onChange={(e) => handleCpfChange(e.target.value)}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:border-purple-600 focus:outline-none bg-slate-50/50 focus:bg-white font-mono transition-colors"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Exigido para validação LGPD na recuperação de senha.
                </p>
              </div>
            </div>

            {/* Endereço Completo do Administrador Master com Busca por CEP */}
            <AddressCepFields
              value={address}
              onChange={setAddress}
              required={false}
              title="Endereço Completo do Master (Validação por CEP)"
              accentColor="purple"
            />

            {/* Campos de Senha apenas para Novo Master */}
            {mode === 'NEW' && (
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Senha de Acesso Inicial *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full pl-9 pr-10 py-2.5 text-xs border border-slate-300 rounded-xl focus:border-purple-600 focus:outline-none bg-slate-50/50 focus:bg-white transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Confirmar Senha de Acesso *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmSenha}
                      onChange={(e) => setConfirmSenha(e.target.value)}
                      placeholder="Repita a senha inicial"
                      className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:border-purple-600 focus:outline-none bg-slate-50/50 focus:bg-white transition-colors"
                    />
                  </div>
                </div>
              </div>
            )}

            {mode === 'EDIT' && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-between">
                <span>
                  Para trocar a senha deste usuário Master, utilize a ação <strong>"Alterar Senha"</strong>.
                </span>
              </div>
            )}

            {/* Ações */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-medium cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-500/20 cursor-pointer flex items-center gap-1.5"
              >
                {loading ? (
                  <span>Processando...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{mode === 'NEW' ? 'Cadastrar Master' : 'Salvar Alterações'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

