import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  Send,
  Pencil,
  Trash2,
  Phone,
  MessageCircle,
  MapPin,
  Award,
  Car,
  Clock,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  RefreshCw,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { StudentLeadRequest, CnhCategory, User as UserType } from '../../types';
import { db } from '../../lib/storage';
import { formatDateBR } from '../../lib/validation';
import { buildWhatsAppLink } from '../../lib/whatsapp';
import { EditStudentLeadModal } from './EditStudentLeadModal';
import { DirectStudentLeadModal } from './DirectStudentLeadModal';

interface AdminStudentLeadsViewProps {
  currentUser: UserType;
  showFeedback: (text: string, type?: 'success' | 'error') => void;
}

const CNH_CATEGORIES: CnhCategory[] = ['A', 'B', 'AB', 'C', 'D', 'E', 'ACC', 'PCD'];

export const AdminStudentLeadsView: React.FC<AdminStudentLeadsViewProps> = ({
  currentUser,
  showFeedback
}) => {
  const [leads, setLeads] = useState<StudentLeadRequest[]>(() => db.getStudentLeads());
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  const [categoryFilter, setCategoryFilter] = useState<string>('TODOS');
  const [stateFilter, setStateFilter] = useState<string>('TODOS');

  // Modais
  const [selectedLeadToEdit, setSelectedLeadToEdit] = useState<StudentLeadRequest | null>(null);
  const [selectedLeadToDirect, setSelectedLeadToDirect] = useState<StudentLeadRequest | null>(null);
  const [leadToDelete, setLeadToDelete] = useState<StudentLeadRequest | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const refreshLeads = () => {
    setLeads(db.getStudentLeads());
  };

  // Estatísticas
  const stats = useMemo(() => {
    const total = leads.length;
    const aguardando = leads.filter((l) => l.status === 'AGUARDANDO_INSTRUTOR').length;
    const emContato = leads.filter((l) => l.status === 'EM_CONTATO').length;
    const direcionados = leads.filter(
      (l) => l.status === 'DIRECIONADO' || l.status === 'ATENDIDO' || !!l.atendidoPorInstrutorId
    ).length;

    return { total, aguardando, emContato, direcionados };
  }, [leads]);

  // Lista de estados disponíveis nos leads
  const availableStates = useMemo(() => {
    const states = new Set<string>();
    leads.forEach((l) => {
      if (l.estado) states.add(l.estado.toUpperCase());
    });
    return Array.from(states).sort();
  }, [leads]);

  // Filtros aplicados
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Busca textual
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = (lead.nome || '').toLowerCase().includes(query);
        const matchesPhone = (lead.telefone || '').includes(query);
        const matchesCity = (lead.cidade || '').toLowerCase().includes(query);
        const matchesEmail = (lead.email || '').toLowerCase().includes(query);
        const matchesObs = (lead.observacoes || '').toLowerCase().includes(query);
        const matchesInstructor = (lead.atendidoPorInstrutorNome || '').toLowerCase().includes(query);

        if (
          !matchesName &&
          !matchesPhone &&
          !matchesCity &&
          !matchesEmail &&
          !matchesObs &&
          !matchesInstructor
        ) {
          return false;
        }
      }

      // Filtro de Status
      if (statusFilter !== 'TODOS') {
        if (statusFilter === 'DIRECIONADO_OU_ATENDIDO') {
          if (lead.status !== 'DIRECIONADO' && lead.status !== 'ATENDIDO' && !lead.atendidoPorInstrutorId) {
            return false;
          }
        } else if (lead.status !== statusFilter) {
          return false;
        }
      }

      // Filtro de Categoria
      if (categoryFilter !== 'TODOS') {
        if (lead.categoriaCnh !== categoryFilter) return false;
      }

      // Filtro de Estado
      if (stateFilter !== 'TODOS') {
        if ((lead.estado || '').toUpperCase() !== stateFilter) return false;
      }

      return true;
    });
  }, [leads, searchTerm, statusFilter, categoryFilter, stateFilter]);

  // Confirmação e Execução de Exclusão
  const handleDeleteConfirm = async () => {
    if (!leadToDelete) return;
    setIsDeleting(true);
    try {
      await db.deleteStudentLeadAsync(leadToDelete.id, currentUser);
      showFeedback(`Solicitação de "${leadToDelete.nome}" excluída com sucesso!`);
      setLeadToDelete(null);
      refreshLeads();
    } catch (err: any) {
      console.error('Erro ao excluir solicitação:', err);
      showFeedback(err?.message || 'Falha ao excluir solicitação.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Informativo */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-purple-800/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300">
                <Users className="w-5 h-5" />
              </span>
              <span className="text-xs font-semibold text-purple-300 tracking-wider uppercase">
                Demanda Reversa · Alunos Procurando Instrutor
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
              Pessoas Cadastradas em Busca de Instrutor
            </h2>
            <p className="text-xs sm:text-sm text-purple-200 mt-1 max-w-2xl leading-relaxed">
              Consulte as solicitações de alunos que procuram atendimento. Edite seus dados, remova solicitações ou direcione o aluno diretamente a um instrutor credenciado conforme a categoria de CNH procurada.
            </p>
          </div>

          <button
            type="button"
            onClick={refreshLeads}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 transition-all cursor-pointer self-start md:self-auto"
            title="Recarregar lista de solicitações"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Atualizar Lista</span>
          </button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Total de Cadastros</span>
            <span className="text-2xl font-black text-slate-900 mt-0.5 block">{stats.total}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs flex items-center justify-between bg-amber-50/30">
          <div>
            <span className="text-xs font-bold text-amber-800 block">Aguardando Instrutor</span>
            <span className="text-2xl font-black text-amber-900 mt-0.5 block">{stats.aguardando}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-xs flex items-center justify-between bg-blue-50/30">
          <div>
            <span className="text-xs font-bold text-blue-800 block">Em Contato</span>
            <span className="text-2xl font-black text-blue-900 mt-0.5 block">{stats.emContato}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
            <MessageCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs flex items-center justify-between bg-emerald-50/30">
          <div>
            <span className="text-xs font-bold text-emerald-800 block">Direcionados / Atendidos</span>
            <span className="text-2xl font-black text-emerald-900 mt-0.5 block">{stats.direcionados}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Barra de Pesquisa e Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Campo de Busca */}
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, telefone, cidade, e-mail ou observações..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Filtro de Status */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium focus:outline-hidden focus:ring-2 focus:ring-purple-500"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="AGUARDANDO_INSTRUTOR">Aguardando Instrutor</option>
              <option value="EM_CONTATO">Em Contato</option>
              <option value="DIRECIONADO_OU_ATENDIDO">Direcionados / Atendidos</option>
            </select>
          </div>

          {/* Filtro de Categoria CNH */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium focus:outline-hidden focus:ring-2 focus:ring-purple-500"
            >
              <option value="TODOS">Todas as Categorias CNH</option>
              {CNH_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  CNH {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tags de Filtro Rápido por Estado (se houver mais de 1) */}
        {availableStates.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100 text-xs">
            <span className="text-[11px] font-semibold text-slate-500">Filtrar por Estado (UF):</span>
            <button
              type="button"
              onClick={() => setStateFilter('TODOS')}
              className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                stateFilter === 'TODOS'
                  ? 'bg-purple-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({leads.length})
            </button>
            {availableStates.map((uf) => {
              const count = leads.filter((l) => (l.estado || '').toUpperCase() === uf).length;
              return (
                <button
                  key={uf}
                  type="button"
                  onClick={() => setStateFilter(uf)}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    stateFilter === uf
                      ? 'bg-purple-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {uf} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Lista de Solicitações */}
      {filteredLeads.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            Nenhuma solicitação encontrada
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {leads.length === 0
              ? 'Nenhum aluno se cadastrou procurando instrutor até o momento.'
              : 'Nenhum resultado corresponde aos filtros selecionados. Tente ajustar os termos de busca.'}
          </p>
          {(searchTerm || statusFilter !== 'TODOS' || categoryFilter !== 'TODOS' || stateFilter !== 'TODOS') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('TODOS');
                setCategoryFilter('TODOS');
                setStateFilter('TODOS');
              }}
              className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-900 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Limpar Todos os Filtros
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredLeads.map((lead) => {
            const isAttended =
              lead.status === 'ATENDIDO' ||
              lead.status === 'DIRECIONADO' ||
              !!lead.atendidoPorInstrutorId;

            const whatsText = `Olá ${lead.nome}! Sou o Administrador da plataforma Gestão AD. Recebemos sua solicitação para aulas de CNH ${lead.categoriaCnh} em ${lead.cidade}/${lead.estado}. Como podemos ajudar você?`;
            const whatsLink = buildWhatsAppLink(lead.telefone, whatsText);

            return (
              <div
                key={lead.id}
                className={`bg-white rounded-2xl border transition-all shadow-xs p-4 sm:p-5 space-y-3.5 ${
                  lead.semInstrutorNaCidade && !isAttended
                    ? 'border-amber-300 bg-amber-50/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Linha 1: Dados do Aluno, Categoria e Status */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-extrabold text-slate-900">
                        {lead.nome}
                      </span>
                      {lead.semInstrutorNaCidade && !isAttended && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px]">
                          ⚠️ Cidade sem Instrutor Base
                        </span>
                      )}
                      <span className="text-[11px] text-slate-500">
                        {lead.criadoEm ? `Solicitado em ${formatDateBR(lead.criadoEm.split('T')[0])}` : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                      <span className="flex items-center gap-1 font-semibold text-slate-800">
                        <MapPin className="w-3.5 h-3.5 text-purple-600" />
                        {lead.cidade}/{lead.estado} {lead.bairro ? `(Bairro: ${lead.bairro})` : ''}
                      </span>
                      {lead.cep && <span>• CEP: {lead.cep}</span>}
                      <span>•</span>
                      <span className="font-mono">{lead.telefone}</span>
                      {lead.email && <span>• {lead.email}</span>}
                    </div>
                  </div>

                  {/* Badges de Categoria e Status */}
                  <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                    {/* Destaque Categoria */}
                    <span className="px-3 py-1 rounded-xl bg-purple-700 text-white font-mono font-black text-xs shadow-xs flex items-center gap-1">
                      <Award className="w-3.5 h-3.5" />
                      CNH {lead.categoriaCnh}
                    </span>

                    {/* Status Badge */}
                    <span
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
                        isAttended
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : lead.status === 'EM_CONTATO'
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}
                    >
                      {lead.status === 'DIRECIONADO'
                        ? 'Direcionado'
                        : lead.status === 'ATENDIDO'
                        ? 'Atendido'
                        : lead.status === 'EM_CONTATO'
                        ? 'Em Contato'
                        : 'Aguardando Instrutor'}
                    </span>
                  </div>
                </div>

                {/* Linha 2: Preferências de Veículo / Câmbio e Direcionamento */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold flex items-center gap-1">
                    <Car className="w-3 h-3 text-slate-500" />
                    Veículo: <strong>{lead.tipoVeiculo}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
                    Câmbio: <strong>{lead.tipoCambio}</strong>
                  </span>

                  {/* Se já foi direcionado para instrutor */}
                  {lead.atendidoPorInstrutorNome && (
                    <span className="px-2.5 py-0.5 rounded-md bg-purple-100 text-purple-900 border border-purple-300 text-[11px] font-bold flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-purple-700" />
                      Direcionado para: <strong>{lead.atendidoPorInstrutorNome}</strong>
                      {lead.direcionadoEm && (
                        <span className="text-[10px] text-purple-700 font-normal">
                          ({formatDateBR(lead.direcionadoEm.split('T')[0])})
                        </span>
                      )}
                    </span>
                  )}
                </div>

                {/* Observações do Aluno */}
                {lead.observacoes && (
                  <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 whitespace-pre-line leading-relaxed">
                    “{lead.observacoes}”
                  </p>
                )}

                {/* Linha 3: Barra de Ações (Direcionar, Editar, Excluir, WhatsApp) */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Botão Direcionar para Instrutor */}
                    <button
                      type="button"
                      onClick={() => setSelectedLeadToDirect(lead)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                      title="Direcionar este aluno para um instrutor credenciado conforme a categoria procurada"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isAttended ? 'Redirecionar Instrutor' : 'Direcionar para Instrutor'}</span>
                    </button>

                    {/* Botão Editar */}
                    <button
                      type="button"
                      onClick={() => setSelectedLeadToEdit(lead)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      title="Editar os dados do cadastro"
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-600" />
                      <span>Editar</span>
                    </button>

                    {/* Botão Excluir */}
                    <button
                      type="button"
                      onClick={() => setLeadToDelete(lead)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                      title="Excluir esta solicitação"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Excluir</span>
                    </button>
                  </div>

                  {/* Botão WhatsApp para o Aluno */}
                  {whatsLink && (
                    <a
                      href={whatsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer ml-auto"
                      title="Falar com o aluno diretamente via WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp Aluno</span>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: EDITAR ALUNO */}
      {selectedLeadToEdit && (
        <EditStudentLeadModal
          lead={selectedLeadToEdit}
          currentUser={currentUser}
          onClose={() => setSelectedLeadToEdit(null)}
          onSuccess={(updated) => {
            setSelectedLeadToEdit(null);
            refreshLeads();
            showFeedback(`Cadastro de "${updated.nome}" atualizado com sucesso!`);
          }}
        />
      )}

      {/* MODAL: DIRECIONAR PARA INSTRUTOR */}
      {selectedLeadToDirect && (
        <DirectStudentLeadModal
          lead={selectedLeadToDirect}
          currentUser={currentUser}
          onClose={() => setSelectedLeadToDirect(null)}
          onSuccess={(updated, instructorNome) => {
            refreshLeads();
            showFeedback(`Aluno "${updated.nome}" direcionado para o instrutor "${instructorNome}"!`);
          }}
        />
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {leadToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900">
                Confirmar Exclusão
              </h3>
              <p className="text-xs text-slate-600">
                Deseja realmente excluir a solicitação de{' '}
                <strong className="text-slate-900">{leadToDelete.nome}</strong> (CNH {leadToDelete.categoriaCnh} em {leadToDelete.cidade}/{leadToDelete.estado})?
              </p>
              <p className="text-[11px] text-red-600 font-semibold pt-1">
                Esta ação removerá a solicitação permanentemente da plataforma.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setLeadToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Excluindo...' : 'Sim, Excluir Cadastro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
