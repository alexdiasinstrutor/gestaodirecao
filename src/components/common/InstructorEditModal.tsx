import React, { useState, useEffect } from 'react';
import {
  X,
  UserCheck,
  Mail,
  Phone,
  CreditCard,
  Award,
  FileBadge,
  AlertCircle,
  CheckCircle2,
  Save
} from 'lucide-react';
import { db } from '../../lib/storage';
import { isValidCPF, maskCPF, generateCPFFingerprint, getCPFLast4 } from '../../lib/validation';
import { User, AddressFields } from '../../types';
import { AddressCepFields } from '../common/AddressCepFields';

interface InstructorEditModalProps {
  userToEdit: User;
  onClose: () => void;
  onSuccess: (updatedUser: User) => void;
}

export const InstructorEditModal: React.FC<InstructorEditModalProps> = ({
  userToEdit,
  onClose,
  onSuccess
}) => {
  const [nome, setNome] = useState(userToEdit.nome || '');
  const [email, setEmail] = useState(userToEdit.email || '');
  const [telefone, setTelefone] = useState(userToEdit.telefone || '');
  const [rg, setRg] = useState(userToEdit.rg || '');
  const [cpf, setCpf] = useState(userToEdit.cpfCompleto || userToEdit.cpfMascarado || '');
  const [registroDetran, setRegistroDetran] = useState(userToEdit.registroDetran || '');
  const [address, setAddress] = useState<AddressFields>({
    estado: userToEdit.estado || 'MG',
    cep: userToEdit.cep || '',
    logradouro: userToEdit.logradouro || '',
    numero: userToEdit.numero || '',
    complemento: userToEdit.complemento || '',
    bairro: userToEdit.bairro || '',
    cidade: userToEdit.cidade || ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setNome(userToEdit.nome || '');
    setEmail(userToEdit.email || '');
    setTelefone(userToEdit.telefone || '');
    setRg(userToEdit.rg || '');
    setCpf(userToEdit.cpfCompleto || userToEdit.cpfMascarado || '');
    setRegistroDetran(userToEdit.registroDetran || '');
    setAddress({
      estado: userToEdit.estado || 'MG',
      cep: userToEdit.cep || '',
      logradouro: userToEdit.logradouro || '',
      numero: userToEdit.numero || '',
      complemento: userToEdit.complemento || '',
      bairro: userToEdit.bairro || '',
      cidade: userToEdit.cidade || ''
    });
  }, [userToEdit]);

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
    const clean = val.replace(/\D/g, '').slice(0, 11);
    let formatted = clean;
    if (clean.length > 10) {
      formatted = `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
    } else if (clean.length > 6) {
      formatted = `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
    } else if (clean.length > 2) {
      formatted = `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
    }
    setTelefone(formatted);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!nome.trim() || nome.trim().length < 3) {
      setError('Por favor, informe o nome completo (mínimo 3 letras).');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Informe um endereço de e-mail válido.');
      return;
    }

    if (cleanEmail !== userToEdit.email.toLowerCase()) {
      const emailInUse = db.getUsers().some((u) => u.id !== userToEdit.id && u.email.toLowerCase() === cleanEmail);
      if (emailInUse) {
        setError(`O e-mail ${cleanEmail} já está cadastrado para outro usuário.`);
        return;
      }
    }

    const cleanCpfDigits = cpf.replace(/\D/g, '');
    const cpfChangedOrFull = cleanCpfDigits.length === 11 && !cpf.includes('*');
    if (cpfChangedOrFull && !isValidCPF(cleanCpfDigits)) {
      setError('O CPF informado é inválido. Verifique os dígitos verificadores.');
      return;
    }

    setLoading(true);

    const updatedUser: User = {
      ...userToEdit,
      nome: nome.trim(),
      email: cleanEmail,
      telefone: telefone.trim(),
      rg: rg.trim() || undefined,
      registroDetran: registroDetran.trim() || undefined,
      ...(cpfChangedOrFull
        ? {
            cpfCompleto: cpf.trim(),
            cpfMascarado: maskCPF(cleanCpfDigits),
            cpfUltimos4: getCPFLast4(cleanCpfDigits),
            cpfFingerprint: generateCPFFingerprint(cleanCpfDigits)
          }
        : {}),
      cep: address.cep?.trim() || undefined,
      estado: address.estado?.trim().toUpperCase() || undefined,
      cidade: address.cidade?.trim() || undefined,
      bairro: address.bairro?.trim() || undefined,
      logradouro: address.logradouro?.trim() || undefined,
      numero: address.numero?.trim() || undefined,
      complemento: address.complemento?.trim() || undefined
    };

    db.updateUser(updatedUser);
    setLoading(false);
    onSuccess(updatedUser);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 text-blue-300 rounded-xl border border-blue-400/30">
              <UserCheck className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white">
                Editar Dados do Instrutor & Registro DETRAN
              </h2>
              <p className="text-[11px] text-blue-200/80">
                Atualize credencial do DETRAN, contato, documentos e endereço completo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Credencial DETRAN em Destaque */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2">
            <label className="block text-xs font-bold text-blue-950 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Registro / Credencial do DETRAN</span>
            </label>
            <input
              type="text"
              value={registroDetran}
              onChange={(e) => setRegistroDetran(e.target.value)}
              placeholder="Ex: DETRAN-MG 12345/2026"
              className="w-full px-3 py-2.5 text-xs font-mono font-bold border border-blue-300 rounded-xl focus:border-blue-600 focus:outline-none bg-white"
            />
            <p className="text-[10px] text-blue-700">
              Utilizado em contratos de prestação de serviço, fichas pedagógicas e identificação profissional do instrutor.
            </p>
          </div>

          {/* Nome Completo */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome Completo *
            </label>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo do instrutor"
              className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none bg-slate-50/50 focus:bg-white transition-colors"
            />
          </div>

          {/* Email e Telefone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                E-mail de Acesso *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="instrutor@dominio.com"
                  className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none bg-slate-50/50 focus:bg-white transition-colors"
                />
              </div>
            </div>

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
                  placeholder="(31) 99999-9999"
                  className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none bg-slate-50/50 focus:bg-white transition-colors"
                />
              </div>
            </div>
          </div>

          {/* RG e CPF */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                RG (Identidade)
              </label>
              <div className="relative">
                <FileBadge className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={rg}
                  onChange={(e) => setRg(e.target.value)}
                  placeholder="Ex: MG-12.345.678"
                  className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none bg-slate-50/50 focus:bg-white transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                CPF do Instrutor
              </label>
              <div className="relative">
                <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => handleCpfChange(e.target.value)}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none bg-slate-50/50 focus:bg-white font-mono transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Endereço Completo com Busca por CEP */}
          <AddressCepFields
            value={address}
            onChange={setAddress}
            required={false}
            title="Endereço Completo do Instrutor (Validação por CEP)"
            accentColor="blue"
          />

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
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-1.5"
            >
              {loading ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar Dados do Instrutor</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
