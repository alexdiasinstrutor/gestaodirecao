import React, { useState } from 'react';
import { X, Save, User, Phone, Mail, MapPin, Award, Car, Settings2, FileText, CheckCircle2 } from 'lucide-react';
import { StudentLeadRequest, CnhCategory, LocatorVehicleType, VehicleTransmissionType, User as UserType } from '../../types';
import { db } from '../../lib/storage';
import { cleanPhoneDigits } from '../../lib/validation';

interface EditStudentLeadModalProps {
  lead: StudentLeadRequest;
  currentUser: UserType;
  onClose: () => void;
  onSuccess: (updatedLead: StudentLeadRequest) => void;
}

const CNH_CATEGORIES: CnhCategory[] = ['A', 'B', 'AB', 'C', 'D', 'E', 'ACC', 'PCD'];

export const EditStudentLeadModal: React.FC<EditStudentLeadModalProps> = ({
  lead,
  currentUser,
  onClose,
  onSuccess
}) => {
  const [nome, setNome] = useState(lead.nome || '');
  const [telefone, setTelefone] = useState(lead.telefone || '');
  const [email, setEmail] = useState(lead.email || '');
  const [cidade, setCidade] = useState(lead.cidade || '');
  const [estado, setEstado] = useState(lead.estado || 'MG');
  const [bairro, setBairro] = useState(lead.bairro || '');
  const [cep, setCep] = useState(lead.cep || '');
  const [categoriaCnh, setCategoriaCnh] = useState<CnhCategory>(lead.categoriaCnh || 'B');
  const [tipoVeiculo, setTipoVeiculo] = useState<LocatorVehicleType>(lead.tipoVeiculo || 'CARRO');
  const [tipoCambio, setTipoCambio] = useState<VehicleTransmissionType>(lead.tipoCambio || 'AMBOS');
  const [status, setStatus] = useState<StudentLeadRequest['status']>(lead.status || 'AGUARDANDO_INSTRUTOR');
  const [observacoes, setObservacoes] = useState(lead.observacoes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setErrorMsg('O nome do candidato é obrigatório.');
      return;
    }
    if (!telefone.trim()) {
      setErrorMsg('O telefone de contato é obrigatório.');
      return;
    }
    if (!cidade.trim()) {
      setErrorMsg('A cidade é obrigatória.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const sanitizedPhone = cleanPhoneDigits(telefone);
      const updatedLead: StudentLeadRequest = {
        ...lead,
        nome: nome.trim(),
        telefone: sanitizedPhone.length >= 10 ? telefone.trim() : telefone.trim(),
        email: email.trim() || undefined,
        cidade: cidade.trim(),
        estado: estado.trim().toUpperCase(),
        bairro: bairro.trim() || undefined,
        cep: cep.trim() || undefined,
        categoriaCnh,
        tipoVeiculo,
        tipoCambio,
        status,
        observacoes: observacoes.trim() || undefined
      };

      await db.updateStudentLeadAsync(updatedLead, currentUser);
      onSuccess(updatedLead);
    } catch (err: any) {
      console.error('Erro ao salvar solicitação do aluno:', err);
      setErrorMsg(err?.message || 'Falha ao salvar as alterações.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
              <User className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white">
                Editar Cadastro · Demanda Reversa
              </h2>
              <p className="text-xs text-purple-200">
                Pessoa que se cadastrou em busca de instrutor na plataforma
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-purple-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-300 text-red-800 text-xs rounded-xl font-medium">
              {errorMsg}
            </div>
          )}

          {/* Dados Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nome Completo *
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                placeholder="Ex: João da Silva"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Telefone / WhatsApp *
              </label>
              <input
                type="text"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                placeholder="Ex: (31) 99999-9999"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                E-mail (opcional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                placeholder="aluno@email.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Status da Solicitação
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StudentLeadRequest['status'])}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-semibold"
              >
                <option value="AGUARDANDO_INSTRUTOR">Aguardando Instrutor (Pendente)</option>
                <option value="EM_CONTATO">Em Contato</option>
                <option value="DIRECIONADO">Direcionado para Instrutor</option>
                <option value="ATENDIDO">Atendido / Concluído</option>
              </select>
            </div>
          </div>

          {/* Localização */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-purple-600" />
              Localização Desejada para Aulas
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="col-span-2 sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  Cidade *
                </label>
                <input
                  type="text"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  required
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  placeholder="Ex: Betim"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  Estado (UF) *
                </label>
                <input
                  type="text"
                  maxLength={2}
                  value={estado}
                  onChange={(e) => setEstado(e.target.value.toUpperCase())}
                  required
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono uppercase text-center"
                  placeholder="MG"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  CEP
                </label>
                <input
                  type="text"
                  value={cep}
                  onChange={(e) => setCep(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  placeholder="32600-000"
                />
              </div>

              <div className="col-span-2 sm:col-span-4">
                <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  Bairro
                </label>
                <input
                  type="text"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  placeholder="Ex: Centro, Citrolândia, etc."
                />
              </div>
            </div>
          </div>

          {/* Preferências de Aula (Categoria, Veículo, Câmbio) */}
          <div className="p-3.5 bg-purple-50/50 rounded-xl border border-purple-200/80 space-y-3">
            <span className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-purple-700" />
              Categoria CNH Procurada & Preferências de Veículo
            </span>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                Categoria CNH que a pessoa procura:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CNH_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoriaCnh(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      categoriaCnh === cat
                        ? 'bg-purple-700 text-white shadow-xs scale-105'
                        : 'bg-white text-slate-700 border border-slate-300 hover:bg-purple-100'
                    }`}
                  >
                    CNH {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Tipo de Veículo
                </label>
                <select
                  value={tipoVeiculo}
                  onChange={(e) => setTipoVeiculo(e.target.value as LocatorVehicleType)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                >
                  <option value="CARRO">Carro / Utilitário</option>
                  <option value="MOTO">Motocicleta</option>
                  <option value="CAMINHAO">Caminhão</option>
                  <option value="ONIBUS">Ônibus</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Tipo de Câmbio
                </label>
                <select
                  value={tipoCambio}
                  onChange={(e) => setTipoCambio(e.target.value as VehicleTransmissionType)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                >
                  <option value="AMBOS">Manual ou Automático (Indiferente)</option>
                  <option value="MANUAL">Câmbio Manual</option>
                  <option value="AUTOMATICO">Câmbio Automático</option>
                </select>
              </div>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Observações / Detalhes da Solicitação
            </label>
            <textarea
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
              placeholder="Ex: Aluno quer fazer aulas aos sábados, já possui habilitação e quer perder o medo de dirigir..."
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-600 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Salvando...' : 'Salvar Alterações'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
