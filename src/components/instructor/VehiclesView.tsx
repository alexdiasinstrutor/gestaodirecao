import React, { useState, useEffect } from 'react';
import {
  Car,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Gauge,
  ShieldCheck,
  Award,
  X,
  Settings2,
  Sparkles,
  Check
} from 'lucide-react';
import { db } from '../../lib/storage';
import { Organization, User, Vehicle, CnhCategory, CNH_CATEGORIES } from '../../types';

interface VehiclesViewProps {
  currentOrg: Organization;
  currentUser: User;
}

const VEHICLE_TYPE_OPTIONS: {
  id: Vehicle['tipo'];
  label: string;
  defaultCnh: CnhCategory;
  badgeColor: string;
}[] = [
  { id: 'CARRO', label: 'Carro / Utilitário', defaultCnh: 'B', badgeColor: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'MOTO', label: 'Motocicleta', defaultCnh: 'A', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200' },
  { id: 'CAMINHAO', label: 'Caminhão / Carga', defaultCnh: 'C', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { id: 'ONIBUS', label: 'Ônibus / Micro-ônibus', defaultCnh: 'D', badgeColor: 'bg-purple-100 text-purple-800 border-purple-200' }
];

export const VehiclesView: React.FC<VehiclesViewProps> = ({ currentOrg, currentUser }) => {
  const orgId = currentOrg.id;
  const targetInstructorId = currentUser.papel !== 'SUPER_ADMIN' ? currentUser.id : undefined;

  const [, setSyncTick] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [form, setForm] = useState({
    modelo: '',
    placa: '',
    ano: new Date().getFullYear(),
    cor: 'Branco',
    tipo: 'CARRO' as Vehicle['tipo'],
    cambio: 'MANUAL' as 'MANUAL' | 'AUTOMATICO',
    categoriaCnh: 'B' as CnhCategory,
    duploComando: true,
    adaptadoPcd: false,
    kmAtual: 0,
    proximaRevisaoKm: 10000,
    status: 'DISPONIVEL' as Vehicle['status']
  });

  useEffect(() => {
    const onSync = () => setSyncTick((t) => t + 1);
    window.addEventListener('agd:data-synced', onSync);
    return () => window.removeEventListener('agd:data-synced', onSync);
  }, []);

  const vehicles = db.getVehicles(orgId, targetInstructorId);

  const formatPlate = (raw: string) => {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
    if (clean.length <= 3) return clean;
    return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  };

  const handleOpenNew = () => {
    setEditingVehicle(null);
    setErrorMsg('');
    setForm({
      modelo: '',
      placa: '',
      ano: new Date().getFullYear(),
      cor: 'Branco',
      tipo: 'CARRO',
      cambio: 'MANUAL',
      categoriaCnh: 'B',
      duploComando: true,
      adaptadoPcd: false,
      kmAtual: 0,
      proximaRevisaoKm: 10000,
      status: 'DISPONIVEL'
    });
    setShowModal(true);
  };

  const handleOpenEdit = (veh: Vehicle) => {
    setEditingVehicle(veh);
    setErrorMsg('');
    setForm({
      modelo: veh.modelo,
      placa: veh.placa,
      ano: veh.ano || new Date().getFullYear(),
      cor: veh.cor || 'Branco',
      tipo: veh.tipo || 'CARRO',
      cambio: veh.cambio || 'MANUAL',
      categoriaCnh: veh.categoriaCnh || (veh.tipo === 'MOTO' ? 'A' : veh.tipo === 'CAMINHAO' ? 'C' : veh.tipo === 'ONIBUS' ? 'D' : 'B'),
      duploComando: veh.duploComando ?? true,
      adaptadoPcd: veh.adaptadoPcd ?? false,
      kmAtual: veh.kmAtual || 0,
      proximaRevisaoKm: veh.proximaRevisaoKm || (veh.kmAtual || 0) + 10000,
      status: veh.status || 'DISPONIVEL'
    });
    setShowModal(true);
  };

  const syncCoverageFromVehicles = async () => {
    const currentVehicles = db.getVehicles(orgId, currentUser.id).filter((v) => v.status !== 'MANUTENCAO' || true);
    if (currentVehicles.length === 0) return;

    const existingCov = db.getInstructorCoverage(currentUser.id);
    if (existingCov) {
      const tiposVeiculos = Array.from(new Set(currentVehicles.map((v) => v.tipo)));
      const hasManual = currentVehicles.some((v) => (v.cambio || 'MANUAL') === 'MANUAL');
      const hasAuto = currentVehicles.some((v) => v.cambio === 'AUTOMATICO');
      const tipoCambio = hasManual && hasAuto ? 'AMBOS' : hasAuto ? 'AUTOMATICO' : 'MANUAL';
      const categoriasAtendidas = Array.from(
        new Set([
          ...(existingCov.categoriasAtendidas || []),
          ...currentVehicles.map((v) => v.categoriaCnh || 'B')
        ])
      ) as CnhCategory[];

      await db.saveInstructorCoverageAsync({
        ...existingCov,
        tiposVeiculos,
        tipoCambio,
        categoriasAtendidas
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanModel = form.modelo.trim();
    const cleanPlaca = form.placa.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (!cleanModel) {
      setErrorMsg('Informe a marca e o modelo do veículo (Ex: Chevrolet Onix 1.0 Plus).');
      return;
    }

    if (cleanPlaca.length < 7) {
      setErrorMsg('Informe uma placa válida com 7 caracteres (Padrão Mercosul ou Antigo).');
      return;
    }

    const formattedPlaca = `${cleanPlaca.slice(0, 3)}-${cleanPlaca.slice(3)}`;

    const vehicleData: Vehicle = {
      id: editingVehicle ? editingVehicle.id : `veh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      organizacaoId: editingVehicle?.organizacaoId || orgId,
      instrutorId: editingVehicle?.instrutorId || currentUser.id,
      instrutorNome: editingVehicle?.instrutorNome || currentUser.nome,
      modelo: cleanModel,
      placa: formattedPlaca,
      ano: Number(form.ano) || new Date().getFullYear(),
      cor: form.cor.trim() || 'Branco',
      tipo: form.tipo,
      cambio: form.cambio,
      categoriaCnh: form.categoriaCnh,
      duploComando: form.duploComando,
      adaptadoPcd: form.adaptadoPcd,
      kmAtual: Math.max(0, Number(form.kmAtual) || 0),
      proximaRevisaoKm: Math.max(Number(form.kmAtual) || 0, Number(form.proximaRevisaoKm) || 10000),
      status: form.status,
      atualizadoEm: new Date().toISOString()
    };

    await db.saveVehicleAsync(vehicleData, currentUser.id);
    await syncCoverageFromVehicles();

    setFeedbackMsg(
      editingVehicle
        ? `Veículo "${vehicleData.modelo}" (${vehicleData.placa}) atualizado e sincronizado com o banco!`
        : `Veículo "${vehicleData.modelo}" (${vehicleData.placa}) cadastrado com sucesso!`
    );
    setShowModal(false);
    setTimeout(() => setFeedbackMsg(''), 4000);
  };

  const handleToggleStatus = async (veh: Vehicle) => {
    const nextStatus: Vehicle['status'] =
      veh.status === 'DISPONIVEL' ? 'EM_AULA' : veh.status === 'EM_AULA' ? 'MANUTENCAO' : 'DISPONIVEL';
    await db.saveVehicleAsync({ ...veh, status: nextStatus }, currentUser.id);
    setFeedbackMsg(`Status do veículo "${veh.modelo}" alterado para ${nextStatus}.`);
    setTimeout(() => setFeedbackMsg(''), 3000);
  };

  const handleDelete = async (veh: Vehicle) => {
    if (confirm(`Deseja realmente remover o veículo "${veh.modelo}" (${veh.placa}) da sua frota?`)) {
      await db.deleteVehicleAsync(veh.id, currentUser.id);
      await syncCoverageFromVehicles();
      setFeedbackMsg(`Veículo "${veh.modelo}" removido com sucesso.`);
      setTimeout(() => setFeedbackMsg(''), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Car className="w-6 h-6 text-blue-600" />
            Meus Veículos e Frota de Instrução
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cadastre os carros, motos ou veículos que você utiliza nas aulas práticas (câmbio manual ou automático, duplo comando, placa e quilometragem).
          </p>
        </div>

        <button
          onClick={handleOpenNew}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer touch-target shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Meu Veículo</span>
        </button>
      </div>

      {feedbackMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 animate-in fade-in font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Summary Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase text-slate-400">Total Cadastrados</span>
          <p className="text-2xl font-black text-slate-900 mt-1">{vehicles.length}</p>
          <span className="text-[11px] text-slate-500">Veículos ativos na base</span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase text-slate-400">Câmbio Manual</span>
          <p className="text-2xl font-black text-blue-600 mt-1">
            {vehicles.filter((v) => (v.cambio || 'MANUAL') === 'MANUAL').length}
          </p>
          <span className="text-[11px] text-slate-500">Tradicional</span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase text-slate-400">Câmbio Automático</span>
          <p className="text-2xl font-black text-indigo-600 mt-1">
            {vehicles.filter((v) => v.cambio === 'AUTOMATICO').length}
          </p>
          <span className="text-[11px] text-slate-500">Conforto / PCD</span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase text-slate-400">Disponíveis Hoje</span>
          <p className="text-2xl font-black text-emerald-600 mt-1">
            {vehicles.filter((v) => v.status !== 'MANUTENCAO').length}
          </p>
          <span className="text-[11px] text-slate-500">Prontos para aulas</span>
        </div>
      </div>

      {/* Vehicles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vehicles.map((veh) => {
          const typeInfo =
            VEHICLE_TYPE_OPTIONS.find((t) => t.id === veh.tipo) || VEHICLE_TYPE_OPTIONS[0];
          const kmToMaintenance = (veh.proximaRevisaoKm || 10000) - (veh.kmAtual || 0);
          const needsMaintenanceSoon = kmToMaintenance <= 1000;

          return (
            <div
              key={veh.id}
              className="bg-white rounded-2xl border border-slate-200 hover:border-blue-300 p-5 shadow-xs flex flex-col justify-between transition-all"
            >
              <div className="space-y-3">
                {/* Badges Header */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 text-white font-mono text-xs font-extrabold">
                      CNH {veh.categoriaCnh || (veh.tipo === 'MOTO' ? 'A' : 'B')}
                    </span>
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${typeInfo.badgeColor}`}>
                      {typeInfo.label}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${
                        veh.cambio === 'AUTOMATICO'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {veh.cambio === 'AUTOMATICO' ? 'Automático' : 'Manual'}
                    </span>
                  </div>

                  <button
                    onClick={() => handleToggleStatus(veh)}
                    title="Clique para alternar o status do veículo"
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold cursor-pointer transition-all ${
                      veh.status === 'DISPONIVEL'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : veh.status === 'EM_AULA'
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {veh.status === 'DISPONIVEL'
                      ? 'DISPONÍVEL'
                      : veh.status === 'EM_AULA'
                      ? 'EM AULA'
                      : 'MANUTENÇÃO'}
                  </button>
                </div>

                {/* Model & Plate */}
                <div className="flex items-start justify-between gap-3 pt-1">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base leading-snug">{veh.modelo}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Ano {veh.ano} · Cor {veh.cor || 'Branco'} · Instrutor:{' '}
                      <span className="font-semibold text-slate-700">
                        {veh.instrutorNome || currentUser.nome}
                      </span>
                    </p>
                  </div>
                  <div className="px-3 py-1 bg-slate-100 border-2 border-slate-300 rounded-lg font-mono text-xs font-black text-slate-900 tracking-wider shrink-0">
                    {veh.placa}
                  </div>
                </div>

                {/* Features */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(veh.duploComando ?? true) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                      <ShieldCheck className="w-3 h-3" /> Duplo Comando Credenciado
                    </span>
                  )}
                  {veh.adaptadoPcd && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-semibold">
                      <Sparkles className="w-3 h-3" /> Adaptado PCD
                    </span>
                  )}
                </div>

                {/* Odometer & Maintenance */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <Gauge className="w-3.5 h-3.5 text-slate-400" /> Odômetro Atual:
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      {(veh.kmAtual || 0).toLocaleString('pt-BR')} km
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <Wrench className="w-3.5 h-3.5 text-slate-400" /> Próxima Revisão:
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        needsMaintenanceSoon ? 'text-amber-600' : 'text-slate-700'
                      }`}
                    >
                      {(veh.proximaRevisaoKm || 10000).toLocaleString('pt-BR')} km
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 mt-4 border-t border-slate-200/80 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500 font-medium">
                  Visível nos filtros do Mapa
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenEdit(veh)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => handleDelete(veh)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    title="Excluir veículo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {vehicles.length === 0 && (
          <div className="col-span-full bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-3">
            <Car className="w-10 h-10 text-blue-500 mx-auto" />
            <h3 className="text-base font-extrabold text-slate-800">
              Você ainda não cadastrou nenhum veículo de instrução
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Cadastre agora o seu carro ou moto de aula prática (informando se é câmbio manual ou automático). Seus veículos ficam sincronizados no banco e ajudam os alunos a encontrarem você no mapa!
            </p>
            <button
              onClick={handleOpenNew}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Meu Primeiro Veículo</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal Add / Edit Vehicle */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Car className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base">
                  {editingVehicle ? 'Editar Veículo de Instrução' : 'Cadastrar Novo Veículo'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Marca e Modelo do Veículo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Hyundai HB20 1.0 Sense / Fiat Mobi Like / Honda CG 160"
                  value={form.modelo}
                  onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Placa *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={8}
                    placeholder="ABC-1D23"
                    value={form.placa}
                    onChange={(e) => setForm({ ...form, placa: formatPlate(e.target.value) })}
                    className="w-full px-3.5 py-2.5 text-sm font-mono uppercase border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Ano *
                  </label>
                  <input
                    type="number"
                    required
                    min={1995}
                    max={new Date().getFullYear() + 1}
                    value={form.ano}
                    onChange={(e) => setForm({ ...form, ano: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Cor
                  </label>
                  <input
                    type="text"
                    placeholder="Branco, Prata..."
                    value={form.cor}
                    onChange={(e) => setForm({ ...form, cor: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Tipo de Veículo *
                  </label>
                  <select
                    value={form.tipo}
                    onChange={(e) => {
                      const novoTipo = e.target.value as Vehicle['tipo'];
                      const defaultCnh =
                        VEHICLE_TYPE_OPTIONS.find((t) => t.id === novoTipo)?.defaultCnh || 'B';
                      setForm({ ...form, tipo: novoTipo, categoriaCnh: defaultCnh });
                    }}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                  >
                    {VEHICLE_TYPE_OPTIONS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Tipo de Câmbio *
                  </label>
                  <select
                    value={form.cambio}
                    onChange={(e) =>
                      setForm({ ...form, cambio: e.target.value as 'MANUAL' | 'AUTOMATICO' })
                    }
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                  >
                    <option value="MANUAL">Câmbio Manual</option>
                    <option value="AUTOMATICO">Câmbio Automático</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Categoria CNH *
                  </label>
                  <select
                    value={form.categoriaCnh}
                    onChange={(e) => setForm({ ...form, categoriaCnh: e.target.value as CnhCategory })}
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                  >
                    {CNH_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        CNH {c.id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Quilometragem Atual (km)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.kmAtual}
                    onChange={(e) => setForm({ ...form, kmAtual: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Próxima Revisão (km)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.proximaRevisaoKm}
                    onChange={(e) => setForm({ ...form, proximaRevisaoKm: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.duploComando}
                    onChange={(e) => setForm({ ...form, duploComando: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-800">Possui Duplo Comando</span>
                    <span className="block text-[10px] text-slate-500">Pedais auxiliares credenciados</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.adaptadoPcd}
                    onChange={(e) => setForm({ ...form, adaptadoPcd: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-800">Adaptado para PCD</span>
                    <span className="block text-[10px] text-slate-500">Comandos especiais homologados</span>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Status Operacional
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as Vehicle['status'] })}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                >
                  <option value="DISPONIVEL">Disponível para Aulas Práticas</option>
                  <option value="EM_AULA">Em Aula no Momento</option>
                  <option value="MANUTENCAO">Em Revisão / Manutenção</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingVehicle ? 'Salvar Alterações' : 'Cadastrar Veículo'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
