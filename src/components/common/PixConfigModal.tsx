import React, { useState } from 'react';
import {
  X,
  QrCode,
  Save,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Building,
  User as UserIcon,
  Sparkles
} from 'lucide-react';
import { db } from '../../lib/storage';
import { generatePixCopiaECola, getPixQrCodeImageUrl } from '../../lib/whatsapp';
import type { Organization, User, PixKeyType } from '../../types';

interface PixConfigModalProps {
  currentOrg: Organization;
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (updatedOrg: Organization, updatedUser: User) => void;
}

export const PixConfigModal: React.FC<PixConfigModalProps> = ({
  currentOrg,
  currentUser,
  isOpen,
  onClose,
  onSaved
}) => {
  if (!isOpen) return null;

  // Determine current active PIX
  const effective = db.getEffectivePixConfig(currentOrg, currentUser);

  const [targetScope, setTargetScope] = useState<'INSTRUTOR' | 'ORGANIZACAO'>(
    currentUser.papel === 'SUPER_ADMIN' || currentUser.papel === 'ADMIN_ORG'
      ? 'ORGANIZACAO'
      : 'INSTRUTOR'
  );

  const [tipoChave, setTipoChave] = useState<PixKeyType>(
    (targetScope === 'INSTRUTOR' ? currentUser.tipoChavePix : currentOrg.tipoChavePix) ||
      (effective.tipoChavePix as PixKeyType) ||
      'EMAIL'
  );

  const [chavePix, setChavePix] = useState<string>(
    (targetScope === 'INSTRUTOR' ? currentUser.chavePix : currentOrg.chavePix) ||
      effective.chavePix ||
      ''
  );

  const [beneficiario, setBeneficiario] = useState<string>(
    (targetScope === 'INSTRUTOR' ? currentUser.beneficiarioPix : currentOrg.beneficiarioPix) ||
      effective.beneficiarioPix ||
      (targetScope === 'INSTRUTOR' ? currentUser.nome : currentOrg.nome)
  );

  const [cidade, setCidade] = useState<string>(
    (targetScope === 'INSTRUTOR' ? currentUser.cidadePix : currentOrg.cidadePix) ||
      effective.cidadePix ||
      currentOrg.cidade ||
      'SAO PAULO'
  );

  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [testCopied, setTestCopied] = useState<boolean>(false);

  // Switch between editing Instructor vs Organization
  const handleScopeChange = (scope: 'INSTRUTOR' | 'ORGANIZACAO') => {
    setTargetScope(scope);
    if (scope === 'INSTRUTOR') {
      setChavePix(currentUser.chavePix || '');
      setTipoChave(currentUser.tipoChavePix || 'EMAIL');
      setBeneficiario(currentUser.beneficiarioPix || currentUser.nome);
      setCidade(currentUser.cidadePix || currentOrg.cidade || 'SAO PAULO');
    } else {
      setChavePix(currentOrg.chavePix || '');
      setTipoChave(currentOrg.tipoChavePix || 'CNPJ');
      setBeneficiario(currentOrg.beneficiarioPix || currentOrg.nome);
      setCidade(currentOrg.cidadePix || currentOrg.cidade || 'SAO PAULO');
    }
  };

  // Generate test PIX payload for instant verification
  const testPayload = chavePix.trim()
    ? generatePixCopiaECola(chavePix.trim(), beneficiario.trim(), 100, 'TESTE', cidade.trim())
    : '';

  const testQrCodeUrl = testPayload ? getPixQrCodeImageUrl(testPayload, 200) : '';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!chavePix.trim()) {
      alert('Por favor, informe a Chave PIX.');
      return;
    }

    let updatedOrg = { ...currentOrg };
    let updatedUser = { ...currentUser };

    if (targetScope === 'INSTRUTOR') {
      updatedUser = {
        ...currentUser,
        chavePix: chavePix.trim(),
        tipoChavePix: tipoChave,
        beneficiarioPix: beneficiario.trim(),
        cidadePix: cidade.trim()
      };
      db.updateUser(updatedUser);
    } else {
      updatedOrg = {
        ...currentOrg,
        chavePix: chavePix.trim(),
        tipoChavePix: tipoChave,
        beneficiarioPix: beneficiario.trim(),
        cidadePix: cidade.trim()
      };
      db.updateOrganization(updatedOrg, currentUser.id);
    }

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      if (onSaved) onSaved(updatedOrg, updatedUser);
      onClose();
    }, 1200);
  };

  const handleCopyTestPix = () => {
    if (!testPayload) return;
    navigator.clipboard.writeText(testPayload);
    setTestCopied(true);
    setTimeout(() => setTestCopied(false), 2500);
  };

  const getPlaceholder = () => {
    switch (tipoChave) {
      case 'CPF':
        return '000.000.000-00';
      case 'CNPJ':
        return '00.000.000/0001-00';
      case 'EMAIL':
        return 'seuemail@exemplo.com.br';
      case 'TELEFONE':
        return '(11) 99999-9999';
      case 'ALEATORIA':
        return '123e4567-e89b-12d3-a456-426614174000';
      default:
        return 'Informe sua chave';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 text-left space-y-5 max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                Configurar Chave PIX para Recebimentos
              </h2>
              <p className="text-xs text-slate-500">
                Os alunos pagarão diretamente por essa chave com geração de QR Code e Copia e Cola.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scope Selector: Instrutor vs Organização */}
        {(currentUser.papel === 'SUPER_ADMIN' || currentUser.papel === 'ADMIN_ORG') && (
          <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-200 flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleScopeChange('INSTRUTOR')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                targetScope === 'INSTRUTOR'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Chave Pessoal do Instrutor ({currentUser.nome.split(' ')[0]})</span>
            </button>
            <button
              type="button"
              onClick={() => handleScopeChange('ORGANIZACAO')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                targetScope === 'ORGANIZACAO'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Chave Geral da Autoescola ({currentOrg.nome.slice(0, 15)}...)</span>
            </button>
          </div>
        )}

        {/* Success Alert */}
        {savedSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Chave PIX atualizada e salva com sucesso no sistema!</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Tipo de Chave */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tipo da Chave PIX *</label>
              <select
                value={tipoChave}
                onChange={(e) => setTipoChave(e.target.value as PixKeyType)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-emerald-600 cursor-pointer"
              >
                <option value="EMAIL">E-mail</option>
                <option value="TELEFONE">Telefone Celular</option>
                <option value="CPF">CPF</option>
                <option value="CNPJ">CNPJ</option>
                <option value="ALEATORIA">Chave Aleatória (EVP)</option>
              </select>
            </div>

            {/* Chave PIX */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Chave PIX Oficial *</label>
              <input
                type="text"
                required
                value={chavePix}
                onChange={(e) => setChavePix(e.target.value)}
                placeholder={getPlaceholder()}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Beneficiário / Titular */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nome do Titular / Beneficiário *
              </label>
              <input
                type="text"
                required
                maxLength={50}
                value={beneficiario}
                onChange={(e) => setBeneficiario(e.target.value)}
                placeholder="Ex: Alex Dias da Silva"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
              />
              <span className="text-[10px] text-slate-400">Nome que aparece no comprovante bancário (máx 50 carac.)</span>
            </div>

            {/* Cidade do Beneficiário */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Cidade do Titular *
              </label>
              <input
                type="text"
                required
                maxLength={15}
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="Ex: SAO PAULO"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
              />
              <span className="text-[10px] text-slate-400">Município da conta bancária (padrão BACEN, máx 15 carac.)</span>
            </div>
          </div>

          {/* Real-time Preview of QR Code & Copia e Cola */}
          {chavePix.trim() && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  Demonstração em Tempo Real do Código Gerado:
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  BR Code BACEN Ativo
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-lg border border-slate-200">
                {testQrCodeUrl && (
                  <img
                    src={testQrCodeUrl}
                    alt="QR Code de Demonstração"
                    className="w-24 h-24 rounded-lg border border-slate-200 p-1 shrink-0 bg-white"
                  />
                )}
                <div className="flex-1 min-w-0 space-y-1 w-full text-center sm:text-left">
                  <p className="text-[11px] font-semibold text-slate-700 truncate">
                    Beneficiário: <strong>{beneficiario}</strong> ({cidade})
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono truncate">
                    Chave: <strong className="text-emerald-700">{chavePix}</strong>
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyTestPix}
                    className="mt-1 py-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {testCopied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copiar Código Copia e Cola de Teste</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Configuração PIX</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

