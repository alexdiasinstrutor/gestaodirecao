import React, { useState, useMemo } from 'react';
import {
  X,
  Send,
  UserCheck,
  Award,
  MapPin,
  Car,
  CheckCircle2,
  Sparkles,
  Phone,
  MessageCircle,
  AlertCircle,
  Building,
  Search,
  Filter,
  Check,
  ArrowRight
} from 'lucide-react';
import {
  StudentLeadRequest,
  User as UserType,
  InstructorCoverageProfile,
  Vehicle,
  CnhCategory
} from '../../types';
import { db } from '../../lib/storage';
import { buildWhatsAppLink } from '../../lib/whatsapp';

interface DirectStudentLeadModalProps {
  lead: StudentLeadRequest;
  currentUser: UserType;
  onClose: () => void;
  onSuccess: (updatedLead: StudentLeadRequest, instructorNome: string) => void;
}

export const DirectStudentLeadModal: React.FC<DirectStudentLeadModalProps> = ({
  lead,
  currentUser,
  onClose,
  onSuccess
}) => {
  const allUsers = useMemo(() => db.getUsers(), []);
  const organizations = useMemo(() => db.getOrganizations(), []);
  const allCoverages = useMemo(() => db.getAllInstructorCoverages(), []);

  // Filtra instrutores e administradores de CFC
  const instructors = useMemo(() => {
    return allUsers.filter(
      (u) =>
        (u.papel === 'INSTRUTOR' || u.papel === 'ADMIN_ORG') &&
        u.email.toLowerCase() !== 'admin@sistema.com.br'
    );
  }, [allUsers]);

  const [selectedInstructorId, setSelectedInstructorId] = useState<string>('');
  const [createActiveStudent, setCreateActiveStudent] = useState<boolean>(true);
  const [observacoesDirecionamento, setObservacoesDirecionamento] = useState<string>('');
  const [filterOnlyCategoryMatch, setFilterOnlyCategoryMatch] = useState<boolean>(true);
  const [searchInstructor, setSearchInstructor] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successResult, setSuccessResult] = useState<{
    lead: StudentLeadRequest;
    instructor: UserType;
    studentCreated: boolean;
  } | null>(null);

  // Análise de Compatibilidade por Instrutor
  const evaluatedInstructors = useMemo(() => {
    const leadCat = lead.categoriaCnh;
    const leadCityNorm = (lead.cidade || '').trim().toLowerCase();
    const leadStateNorm = (lead.estado || '').trim().toUpperCase();

    return instructors.map((inst) => {
      const coverage = allCoverages.find((c) => c.instrutorId === inst.id);
      const org = organizations.find((o) => o.id === inst.organizacaoId);
      const vehicles = db.getVehicles(inst.organizacaoId).filter(
        (v) => v.instrutorId === inst.id || !v.instrutorId
      );

      // Compatibilidade de Categoria CNH
      const attendedCats = coverage?.categoriasAtendidas || [];
      let isCategoryMatch = false;

      if (attendedCats.includes(leadCat)) {
        isCategoryMatch = true;
      } else if (leadCat === 'B' && (attendedCats.includes('AB') || vehicles.some((v) => v.tipo === 'CARRO'))) {
        isCategoryMatch = true;
      } else if (leadCat === 'A' && (attendedCats.includes('AB') || vehicles.some((v) => v.tipo === 'MOTO'))) {
        isCategoryMatch = true;
      } else if (leadCat === 'AB' && attendedCats.includes('AB')) {
        isCategoryMatch = true;
      } else if (['C', 'D', 'E'].includes(leadCat) && (attendedCats.includes(leadCat) || attendedCats.includes('E'))) {
        isCategoryMatch = true;
      } else if (leadCat === 'PCD' && (attendedCats.includes('PCD') || vehicles.some((v) => v.adaptadoPcd))) {
        isCategoryMatch = true;
      }

      // Compatibilidade de Cidade e Região
      const attendedCities = (coverage?.cidadesAtendidas || []).map((c) => c.trim().toLowerCase());
      const baseCity = (coverage?.cidadeBase || inst.cidade || '').trim().toLowerCase();
      const baseState = (coverage?.estadoBase || inst.estado || '').trim().toUpperCase();

      const isCityMatch = attendedCities.includes(leadCityNorm) || baseCity === leadCityNorm;
      const isStateMatch = baseState === leadStateNorm;

      // Compatibilidade de Câmbio
      const vehicleTransmissions = vehicles.map((v) => v.cambio);
      const coverageTransmission = coverage?.tipoCambio || 'AMBOS';
      let isTransmissionMatch = true;
      if (lead.tipoCambio === 'AUTOMATICO') {
        isTransmissionMatch =
          coverageTransmission === 'AUTOMATICO' ||
          coverageTransmission === 'AMBOS' ||
          vehicleTransmissions.includes('AUTOMATICO');
      }

      // Pontuação de compatibilidade (Score para ordenação)
      let score = 0;
      if (isCategoryMatch) score += 10;
      if (isCityMatch) score += 8;
      if (isStateMatch) score += 3;
      if (isTransmissionMatch) score += 2;

      return {
        instructor: inst,
        org,
        coverage,
        vehicles,
        isCategoryMatch,
        isCityMatch,
        isStateMatch,
        isTransmissionMatch,
        score
      };
    }).sort((a, b) => b.score - a.score);
  }, [instructors, allCoverages, organizations, lead]);

  // Lista filtrada para exibição
  const filteredInstructors = useMemo(() => {
    return evaluatedInstructors.filter((item) => {
      if (filterOnlyCategoryMatch && !item.isCategoryMatch) {
        return false;
      }
      if (searchInstructor.trim()) {
        const query = searchInstructor.toLowerCase();
        const matchesName = item.instructor.nome.toLowerCase().includes(query);
        const matchesCity = (item.coverage?.cidadeBase || item.instructor.cidade || '').toLowerCase().includes(query);
        const matchesOrg = (item.org?.nome || '').toLowerCase().includes(query);
        if (!matchesName && !matchesCity && !matchesOrg) return false;
      }
      return true;
    });
  }, [evaluatedInstructors, filterOnlyCategoryMatch, searchInstructor]);

  const handleConfirmDirect = async () => {
    if (!selectedInstructorId) {
      setErrorMsg('Por favor, selecione um instrutor para direcionar o aluno.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const result = await db.directStudentLeadToInstructorAsync({
        leadId: lead.id,
        instructorId: selectedInstructorId,
        createActiveStudent,
        observacoesDirecionamento,
        actor: currentUser
      });

      if (result.success) {
        const targetInst = instructors.find((u) => u.id === selectedInstructorId);
        if (targetInst) {
          setSuccessResult({
            lead: result.lead,
            instructor: targetInst,
            studentCreated: !!result.student
          });
          onSuccess(result.lead, targetInst.nome);
        }
      } else {
        setErrorMsg(result.message || 'Falha ao direcionar aluno.');
      }
    } catch (err: any) {
      console.error('Erro ao direcionar aluno:', err);
      setErrorMsg(err?.message || 'Falha inesperada ao direcionar aluno.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Se já foi direcionado com sucesso, exibe o painel de confirmação e ações WhatsApp
  if (successResult) {
    const { lead: updatedLead, instructor: assignedInst, studentCreated } = successResult;

    const whatsInstrutorMsg = `Olá ${assignedInst.nome}! O Administrador Master direcionou um novo aluno para você na plataforma Gestão AD:
    
👤 Aluno: ${updatedLead.nome}
📱 Telefone: ${updatedLead.telefone}
📍 Local: ${updatedLead.cidade}/${updatedLead.estado} (Bairro: ${updatedLead.bairro || 'Centro'})
🚗 CNH Procurada: CNH ${updatedLead.categoriaCnh} (Veículo: ${updatedLead.tipoVeiculo} · Câmbio: ${updatedLead.tipoCambio})
${updatedLead.observacoes ? `📝 Observações: ${updatedLead.observacoes}` : ''}

Por favor, entre em contato com o aluno para apresentação e agendamento!`;

    const whatsAlunoMsg = `Olá ${updatedLead.nome}! Sua solicitação de aulas para CNH ${updatedLead.categoriaCnh} em ${updatedLead.cidade}/${updatedLead.estado} foi acolhida pelo nosso suporte.
    
Direcionamos você para o(a) instrutor(a) credenciado(a) ${assignedInst.nome}, especialista na categoria que você procura. Ele(a) entrará em contato com você em breve pelo WhatsApp para agendamento!`;

    const whatsLinkInstrutor = buildWhatsAppLink(assignedInst.telefone, whatsInstrutorMsg);
    const whatsLinkAluno = buildWhatsAppLink(updatedLead.telefone, whatsAlunoMsg);

    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto text-center p-6 space-y-5">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div>
            <h2 className="text-xl font-black text-slate-900">
              Aluno Direcionado com Sucesso!
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              <strong>{updatedLead.nome}</strong> agora está atribuído(a) ao instrutor{' '}
              <strong className="text-purple-700">{assignedInst.nome}</strong> para aulas de{' '}
              <span className="font-bold text-slate-900">CNH {updatedLead.categoriaCnh}</span>.
            </p>
          </div>

          {studentCreated && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 font-semibold flex items-center gap-2 justify-center">
              <Check className="w-4 h-4 text-purple-600 shrink-0" />
              <span>Matrícula criada automaticamente na base do instrutor!</span>
            </div>
          )}

          {/* Botões Rápidos de Ação WhatsApp */}
          <div className="space-y-2.5 pt-2">
            <a
              href={whatsLinkInstrutor || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Avisar Instrutor via WhatsApp ({assignedInst.nome})</span>
            </a>

            <a
              href={whatsLinkAluno || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Avisar Aluno via WhatsApp ({updatedLead.nome})</span>
            </a>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Concluir e Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-950 via-indigo-900 to-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
              <UserCheck className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white">
                Direcionar Aluno para Instrutor Credenciado
              </h2>
              <p className="text-xs text-purple-200">
                Encaminhe a solicitação de acordo com a CNH desejada e região de atendimento
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

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-300 text-red-800 text-xs rounded-xl font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Card Resumo do Aluno que procura */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-purple-950 text-white shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300">
                  Candidato Cadastrado em Busca de Aulas
                </span>
                <h3 className="text-base font-extrabold text-white mt-0.5">
                  {lead.nome}
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-300 mt-1 flex-wrap">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-purple-400" />
                    <strong>{lead.cidade}/{lead.estado}</strong> ({lead.bairro || 'Centro'})
                  </span>
                  <span>•</span>
                  <span>WhatsApp: {lead.telefone}</span>
                </div>
              </div>

              {/* Destaque Categoria CNH Procurada */}
              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center p-2.5 sm:p-3 bg-white/10 rounded-xl border border-white/15">
                <span className="text-[10px] font-bold text-purple-200 uppercase">
                  Categoria Procurada:
                </span>
                <span className="px-3 py-1 rounded-lg bg-purple-500 text-white font-mono font-black text-sm shadow-xs">
                  CNH {lead.categoriaCnh}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/10 text-xs">
              <span className="px-2 py-0.5 rounded-md bg-white/10 text-slate-200 text-[11px]">
                Veículo: <strong>{lead.tipoVeiculo}</strong>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white/10 text-slate-200 text-[11px]">
                Câmbio: <strong>{lead.tipoCambio}</strong>
              </span>
              {lead.observacoes && (
                <span className="text-[11px] text-slate-300 italic w-full">
                  “{lead.observacoes}”
                </span>
              )}
            </div>
          </div>

          {/* Filtros e Busca de Instrutores */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchInstructor}
                onChange={(e) => setSearchInstructor(e.target.value)}
                placeholder="Pesquisar instrutor por nome, cidade ou CFC..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none shrink-0 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
              <input
                type="checkbox"
                checked={filterOnlyCategoryMatch}
                onChange={(e) => setFilterOnlyCategoryMatch(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
              />
              <span>Apenas compatíveis com <strong>CNH {lead.categoriaCnh}</strong></span>
            </label>
          </div>

          {/* Lista de Instrutores Compatíveis */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                Instrutores Disponíveis ({filteredInstructors.length})
              </span>
              <span className="text-[11px] text-slate-500">
                Ordenados por relevância e compatibilidade
              </span>
            </div>

            {filteredInstructors.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-xs text-slate-500 space-y-2">
                <p className="font-semibold text-slate-700">
                  Nenhum instrutor encontrado com os filtros atuais.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setFilterOnlyCategoryMatch(false);
                    setSearchInstructor('');
                  }}
                  className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold rounded-lg cursor-pointer"
                >
                  Exibir todos os instrutores cadastrados
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {filteredInstructors.map((item) => {
                  const isSelected = selectedInstructorId === item.instructor.id;
                  const attendedCats = item.coverage?.categoriasAtendidas || [];
                  const isTopRecommended = item.isCategoryMatch && item.isCityMatch;

                  return (
                    <div
                      key={item.instructor.id}
                      onClick={() => setSelectedInstructorId(item.instructor.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-purple-50/90 border-purple-600 ring-2 ring-purple-600/20 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-purple-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* Radio selector */}
                          <div className="pt-0.5">
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                                isSelected
                                  ? 'border-purple-600 bg-purple-600'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-xs text-slate-900">
                                {item.instructor.nome}
                              </span>
                              {isTopRecommended && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold flex items-center gap-1">
                                  ⭐ Recomendação Máxima (Categoria + Cidade)
                                </span>
                              )}
                              {!isTopRecommended && item.isCategoryMatch && (
                                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold flex items-center gap-1">
                                  ✓ Atende CNH {lead.categoriaCnh}
                                </span>
                              )}
                              {item.isCityMatch && !isTopRecommended && (
                                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold">
                                  📍 Atende em {lead.cidade}
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-1.5 flex-wrap">
                              <span>{item.org?.nome || 'CFC Principal'}</span>
                              <span>•</span>
                              <span>
                                Base: <strong>{item.coverage?.cidadeBase || item.instructor.cidade || 'N/I'}/{item.coverage?.estadoBase || item.instructor.estado || 'MG'}</strong>
                              </span>
                              {item.coverage?.raioAtendimentoKm && (
                                <span>(Raio: {item.coverage.raioAtendimentoKm} km)</span>
                              )}
                            </p>

                            {/* Badges de Categorias Atendidas */}
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                              <span className="text-[10px] font-semibold text-slate-500">
                                Categorias:
                              </span>
                              {attendedCats.length > 0 ? (
                                attendedCats.map((cat) => {
                                  const isCurrentCat = cat === lead.categoriaCnh;
                                  return (
                                    <span
                                      key={cat}
                                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                        isCurrentCat
                                          ? 'bg-purple-600 text-white font-black ring-1 ring-purple-400'
                                          : 'bg-slate-100 text-slate-700'
                                      }`}
                                    >
                                      {cat}
                                    </span>
                                  );
                                })
                              ) : (
                                <span className="text-[10px] text-slate-400">Padrão B</span>
                              )}

                              {item.vehicles.length > 0 && (
                                <>
                                  <span className="text-[10px] font-semibold text-slate-500 ml-1">
                                    Frota:
                                  </span>
                                  <span className="text-[10px] text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded">
                                    {item.vehicles.length} veículo(s) ({item.vehicles.map((v) => v.modelo).join(', ')})
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Configurações Adicionais do Direcionamento */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={createActiveStudent}
                onChange={(e) => setCreateActiveStudent(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer mt-0.5"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Matricular este aluno imediatamente na base do instrutor
                </span>
                <span className="text-[11px] text-slate-600 block">
                  Cria automaticamente a ficha do aluno com CNH {lead.categoriaCnh}, 20 aulas contratadas padrão e status Em Andamento.
                </span>
              </div>
            </label>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Instrução do Administrador para o Instrutor (opcional)
              </label>
              <input
                type="text"
                value={observacoesDirecionamento}
                onChange={(e) => setObservacoesDirecionamento(e.target.value)}
                placeholder="Ex: Aluno entrou em contato com urgência para aulas noturnas..."
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirmDirect}
            disabled={isSubmitting || !selectedInstructorId}
            className="flex items-center gap-1.5 px-6 py-2.5 text-xs font-bold text-white bg-purple-700 hover:bg-purple-600 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{isSubmitting ? 'Direcionando...' : 'Confirmar Direcionamento'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
