import React, { useState, useRef } from 'react';
import { MapPin, Search, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { ESTADOS_BRASIL, formatCEP, lookupAddressByCEP } from '../../lib/cepService';
import type { AddressFields } from '../../types';

interface AddressCepFieldsProps {
  value: AddressFields;
  onChange: (updated: AddressFields) => void;
  required?: boolean;
  title?: string;
  accentColor?: 'blue' | 'emerald' | 'purple';
}

export const AddressCepFields: React.FC<AddressCepFieldsProps> = ({
  value,
  onChange,
  required = true,
  title = 'Endereço Completo (Busca Automática por CEP)',
  accentColor = 'blue'
}) => {
  const [searchingCep, setSearchingCep] = useState(false);
  const [cepFeedback, setCepFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  const numeroInputRef = useRef<HTMLInputElement>(null);

  const ringClass =
    accentColor === 'purple'
      ? 'focus:border-purple-600'
      : accentColor === 'emerald'
      ? 'focus:border-emerald-600'
      : 'focus:border-blue-600';

  const btnClass =
    accentColor === 'purple'
      ? 'bg-purple-600 hover:bg-purple-700 text-white'
      : accentColor === 'emerald'
      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
      : 'bg-blue-600 hover:bg-blue-700 text-white';

  const triggerCepSearch = async (cepToSearch: string, currentUf?: string) => {
    const clean = (cepToSearch || '').replace(/\D/g, '');
    if (clean.length !== 8) {
      setCepFeedback({
        type: 'error',
        text: 'Digite os 8 números do CEP para localizar o endereço automaticamente.'
      });
      return;
    }

    setSearchingCep(true);
    setCepFeedback(null);

    const res = await lookupAddressByCEP(clean, currentUf || value.estado);
    setSearchingCep(false);

    if (res.success) {
      onChange({
        ...value,
        cep: res.cep,
        estado: res.estado || value.estado || 'SP',
        cidade: res.cidade || value.cidade || '',
        bairro: res.bairro || value.bairro || '',
        logradouro: res.logradouro || value.logradouro || ''
      });
      setCepFeedback({
        type: res.stateMismatch ? 'warning' : 'success',
        text: res.message || 'Endereço localizado com sucesso!'
      });
      // Foca automaticamente no campo Número para o usuário preencher
      setTimeout(() => {
        numeroInputRef.current?.focus();
      }, 80);
    } else {
      setCepFeedback({
        type: 'error',
        text: res.message || 'CEP não encontrado. Verifique os números ou preencha manualmente.'
      });
    }
  };

  const handleCepChange = (raw: string) => {
    const formatted = formatCEP(raw);
    const digits = formatted.replace(/\D/g, '');
    onChange({
      ...value,
      cep: formatted
    });

    if (digits.length === 8) {
      triggerCepSearch(formatted, value.estado);
    } else {
      setCepFeedback(null);
    }
  };

  return (
    <div className="p-3.5 bg-slate-50/90 border border-slate-200 rounded-2xl space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>{title}</span>
        </span>
        <span className="text-[10px] text-slate-500 font-medium">
          Selecione a UF e digite o CEP
        </span>
      </div>

      {/* Linha 1: Seleção do Estado (UF) + Digitação do CEP com Busca Automática */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
        <div className="sm:col-span-5">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            1º Estado (UF) {required && '*'}
          </label>
          <select
            required={required}
            value={value.estado || 'SP'}
            onChange={(e) =>
              onChange({
                ...value,
                estado: e.target.value
              })
            }
            className={`w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-medium ${ringClass} focus:outline-none`}
          >
            {ESTADOS_BRASIL.map((uf) => (
              <option key={uf.uf} value={uf.uf}>
                {uf.uf} - {uf.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-7">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            2º CEP (Preenchimento Automático) {required && '*'}
          </label>
          <div className="flex gap-1.5">
            <input
              type="text"
              required={required}
              value={value.cep || ''}
              onChange={(e) => handleCepChange(e.target.value)}
              placeholder="00000-000"
              maxLength={9}
              className={`w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-mono ${ringClass} focus:outline-none`}
            />
            <button
              type="button"
              onClick={() => triggerCepSearch(value.cep || '', value.estado)}
              disabled={searchingCep}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors shadow-xs ${btnClass}`}
              title="Consultar endereço pelo CEP"
            >
              {searchingCep ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              <span>{searchingCep ? 'Buscando...' : 'Buscar CEP'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Feedback de Validação do CEP */}
      {cepFeedback && (
        <div
          className={`p-2.5 rounded-xl border text-[11px] flex items-center gap-2 ${
            cepFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : cepFeedback.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {cepFeedback.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          <span className="font-medium">{cepFeedback.text}</span>
        </div>
      )}

      {/* Linha 2: Logradouro (Automático) + Número (Manual) */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
        <div className="sm:col-span-8">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Logradouro (Rua / Avenida / Praça) {required && '*'}
          </label>
          <input
            type="text"
            required={required}
            value={value.logradouro || ''}
            onChange={(e) =>
              onChange({
                ...value,
                logradouro: e.target.value
              })
            }
            placeholder="Preenchido automaticamente pelo CEP"
            className={`w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white ${ringClass} focus:outline-none`}
          />
        </div>

        <div className="sm:col-span-4">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Número {required && '*'}
          </label>
          <input
            ref={numeroInputRef}
            type="text"
            required={required}
            value={value.numero || ''}
            onChange={(e) =>
              onChange({
                ...value,
                numero: e.target.value
              })
            }
            placeholder="Ex: 120 ou S/N"
            className={`w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-semibold ${ringClass} focus:outline-none`}
          />
        </div>
      </div>

      {/* Linha 3: Complemento (Manual) + Bairro (Automático) + Cidade (Automático) */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
        <div className="sm:col-span-4">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Complemento <span className="text-slate-400 font-normal">(Opcional)</span>
          </label>
          <input
            type="text"
            value={value.complemento || ''}
            onChange={(e) =>
              onChange({
                ...value,
                complemento: e.target.value
              })
            }
            placeholder="Apto, Bloco, Sala, Casa..."
            className={`w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white ${ringClass} focus:outline-none`}
          />
        </div>

        <div className="sm:col-span-4">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Bairro {required && '*'}
          </label>
          <input
            type="text"
            required={required}
            value={value.bairro || ''}
            onChange={(e) =>
              onChange({
                ...value,
                bairro: e.target.value
              })
            }
            placeholder="Bairro"
            className={`w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white ${ringClass} focus:outline-none`}
          />
        </div>

        <div className="sm:col-span-4">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Cidade / Município {required && '*'}
          </label>
          <input
            type="text"
            required={required}
            value={value.cidade || ''}
            onChange={(e) =>
              onChange({
                ...value,
                cidade: e.target.value
              })
            }
            placeholder="Cidade"
            className={`w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white ${ringClass} focus:outline-none`}
          />
        </div>
      </div>
    </div>
  );
};

