import React, { useState } from 'react';
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  QrCode,
  DollarSign,
  Users,
  Award,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  X,
  FileCheck
} from 'lucide-react';
import { db } from '../../lib/storage';
import { formatCurrencyBRL } from '../../lib/validation';
import {
  Organization,
  User,
  PackageOffer,
  PackagePaymentType
} from '../../types';

interface PackagesManagerProps {
  currentOrg: Organization;
  currentUser: User;
}

export const PackagesManager: React.FC<PackagesManagerProps> = ({
  currentOrg,
  currentUser
}) => {
  const orgId = currentOrg.id;
  const packages = db.getPackages(orgId);
  const students = db.getStudents(orgId);

  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingPackage, setEditingPackage] = useState<PackageOffer | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string>('');

  const [form, setForm] = useState({
    nome: '',
    categoriaCnh: 'B' as 'A' | 'B' | 'AB' | 'C' | 'D' | 'E',
    totalAulas: 20,
    valorReais: '1800.00',
    formaPagamento: 'TODAS' as PackagePaymentType,
    maxParcelas: 12,
    descontoAvistaPercentual: 5,
    descricao: '',
    ativo: true
  });

  const handleOpenNew = () => {
    setEditingPackage(null);
    setForm({
      nome: '',
      categoriaCnh: 'B',
      totalAulas: 20,
      valorReais: '1800.00',
      formaPagamento: 'TODAS',
      maxParcelas: 12,
      descontoAvistaPercentual: 5,
      descricao: '',
      ativo: true
    });
    setShowModal(true);
  };

  const handleOpenEdit = (pkg: PackageOffer) => {
    setEditingPackage(pkg);
    setForm({
      nome: pkg.nome,
      categoriaCnh: pkg.categoriaCnh,
      totalAulas: pkg.totalAulas,
      valorReais: (pkg.valorCentavos / 100).toFixed(2),
      formaPagamento: pkg.formaPagamento,
      maxParcelas: pkg.maxParcelas || 12,
      descontoAvistaPercentual: pkg.descontoAvistaPercentual || 0,
      descricao: pkg.descricao || '',
      ativo: pkg.ativo
    });
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) return;

    const valorCentavos = Math.round(parseFloat(form.valorReais || '0') * 100);
    if (isNaN(valorCentavos) || valorCentavos <= 0) return;

    if (editingPackage) {
      const updated: PackageOffer = {
        ...editingPackage,
        nome: form.nome.trim(),
        categoriaCnh: form.categoriaCnh,
        totalAulas: Number(form.totalAulas) || 20,
        valorCentavos,
        formaPagamento: form.formaPagamento,
        maxParcelas: Number(form.maxParcelas) || 1,
        descontoAvistaPercentual: Number(form.descontoAvistaPercentual) || 0,
        descricao: form.descricao.trim(),
        ativo: form.ativo
      };
      db.updatePackage(updated, currentUser.id);
      setFeedbackMsg(`Pacote "${updated.nome}" atualizado com sucesso!`);
    } else {
      const newPkg: PackageOffer = {
        id: `pkg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        organizacaoId: orgId,
        instrutorId: currentUser.id,
        instrutorNome: currentUser.nome,
        nome: form.nome.trim(),
        categoriaCnh: form.categoriaCnh,
        totalAulas: Number(form.totalAulas) || 20,
        valorCentavos,
        formaPagamento: form.formaPagamento,
        maxParcelas: Number(form.maxParcelas) || 1,
        descontoAvistaPercentual: Number(form.descontoAvistaPercentual) || 0,
        descricao: form.descricao.trim(),
        ativo: form.ativo,
        criadoEm: new Date().toISOString().slice(0, 10)
      };
      db.createPackage(newPkg, currentUser.id);
      setFeedbackMsg(`Novo pacote "${newPkg.nome}" cadastrado e liberado para os alunos!`);
    }

    setShowModal(false);
    setTimeout(() => setFeedbackMsg(''), 3500);
  };

  const handleToggleStatus = (pkg: PackageOffer) => {
    db.togglePackageStatus(pkg.id, currentUser.id);
    setFeedbackMsg(`Status do pacote "${pkg.nome}" alterado para ${!pkg.ativo ? 'ATIVO' : 'PAUSADO'}.`);
    setTimeout(() => setFeedbackMsg(''), 3000);
  };

  const handleDelete = (pkg: PackageOffer) => {
    if (confirm(`Deseja realmente excluir o pacote "${pkg.nome}"?`)) {
      db.deletePackage(pkg.id, currentUser.id);
      setFeedbackMsg(`Pacote "${pkg.nome}" excluído.`);
      setTimeout(() => setFeedbackMsg(''), 3000);
    }
  };

  const getPaymentLabel = (type: PackagePaymentType) => {
    switch (type) {
      case 'A_VISTA':
        return { label: 'Somente À Vista (PIX / Dinheiro)', color: 'bg-emerald-100 text-emerald-800' };
      case 'PARCELADO_CARTAO':
        return { label: 'Parcelado no Cartão de Crédito', color: 'bg-blue-100 text-blue-800' };
      case 'NEGOCIADO':
        return { label: 'Condição Especial Negociada', color: 'bg-amber-100 text-amber-800' };
      case 'TODAS':
      default:
        return { label: 'À Vista, Cartão Parcelado ou Negociado', color: 'bg-purple-100 text-purple-800' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-600" />
            Gestão de Pacotes de Aulas Práticas
          </h2>
          <p className="text-xs text-slate-500">
            Monte quantos pacotes desejar (quantidade de aulas, valor e condições de pagamento: à vista, parcelado ou negociado) para escolha dos alunos.
          </p>
        </div>

        <button
          onClick={handleOpenNew}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer touch-target"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Novo Pacote</span>
        </button>
      </div>

      {feedbackMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Packages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {packages.map((pkg) => {
          const paymentInfo = getPaymentLabel(pkg.formaPagamento);
          const enrolledCount = students.filter((s) => s.pacoteId === pkg.id).length;
          const isMine = !pkg.instrutorId || pkg.instrutorId === currentUser.id;

          return (
            <div
              key={pkg.id}
              className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between transition-all ${
                pkg.ativo ? 'border-slate-200 hover:border-blue-300' : 'border-slate-200 bg-slate-50/60 opacity-80'
              }`}
            >
              <div className="space-y-3">
                {/* Top Badge Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 text-white font-mono text-xs font-extrabold">
                      CNH {pkg.categoriaCnh}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-bold text-[10px] border border-blue-200">
                      {pkg.totalAulas} Aulas Práticas
                    </span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      pkg.ativo
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {pkg.ativo ? 'LIBERADO' : 'PAUSADO'}
                  </span>
                </div>

                {/* Title and Instructor */}
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm leading-snug">{pkg.nome}</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Instrutor: <span className="font-semibold text-slate-700">{pkg.instrutorNome || 'Geral CFC'}</span>
                  </p>
                </div>

                {/* Price Display */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Valor Total</span>
                    <span className="text-lg font-black text-slate-900 font-mono">
                      {formatCurrencyBRL(pkg.valorCentavos)}
                    </span>
                  </div>

                  <div className="mt-1 pt-1 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Valor por aula:</span>
                    <span className="font-mono font-bold text-blue-700">
                      {formatCurrencyBRL(Math.round(pkg.valorCentavos / (pkg.totalAulas || 1)))}
                    </span>
                  </div>
                </div>

                {/* Payment Condition */}
                <div>
                  <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-semibold ${paymentInfo.color}`}>
                    {paymentInfo.label}
                  </span>
                  {pkg.formaPagamento === 'PARCELADO_CARTAO' && pkg.maxParcelas && (
                    <p className="text-[10px] text-slate-500 mt-1">
                      Em até {pkg.maxParcelas}x de {formatCurrencyBRL(Math.round(pkg.valorCentavos / pkg.maxParcelas))}
                    </p>
                  )}
                  {pkg.descontoAvistaPercentual && pkg.descontoAvistaPercentual > 0 ? (
                    <p className="text-[10px] text-emerald-600 font-bold mt-0.5">
                      {pkg.descontoAvistaPercentual}% de desconto no pagamento à vista
                    </p>
                  ) : null}
                </div>

                {/* Description */}
                {pkg.descricao && (
                  <p className="text-xs text-slate-600 leading-relaxed bg-white p-2 rounded-lg border border-slate-100">
                    {pkg.descricao}
                  </p>
                )}

                {/* Enrolled Students Counter */}
                <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-1">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>{enrolledCount} aluno(s) matriculado(s) neste pacote</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 mt-4 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleToggleStatus(pkg)}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                  title={pkg.ativo ? 'Pausar oferta do pacote' : 'Ativar oferta do pacote'}
                >
                  {pkg.ativo ? (
                    <>
                      <ToggleRight className="w-5 h-5 text-emerald-600" />
                      <span>Ativo</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-5 h-5 text-slate-400" />
                      <span>Pausado</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(pkg)}
                    className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Editar pacote"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(pkg)}
                    className="p-1.5 text-slate-500 hover:text-red-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Excluir pacote"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Package Creation/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh]">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    {editingPackage ? 'Editar Pacote de Aulas' : 'Cadastrar Novo Pacote de Aulas'}
                  </h3>
                  <p className="text-xs text-slate-300">
                    Defina aulas, valor e formas de pagamento liberadas
                  </p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">Nome do Pacote *</label>
                <input
                  type="text"
                  required
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Pacote Completo CNH B - 20 Aulas Práticas"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Categoria CNH *</label>
                  <select
                    value={form.categoriaCnh}
                    onChange={(e) => setForm({ ...form, categoriaCnh: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none bg-white font-semibold"
                  >
                    <option value="B">Categoria B (Carro)</option>
                    <option value="A">Categoria A (Moto)</option>
                    <option value="AB">Categoria AB (Carro e Moto)</option>
                    <option value="C">Categoria C (Caminhão)</option>
                    <option value="D">Categoria D (Ônibus/Micro)</option>
                    <option value="E">Categoria E (Carreta/Articulado)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Quantidade de Aulas *</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={form.totalAulas}
                    onChange={(e) => setForm({ ...form, totalAulas: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Valor Total (R$) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 font-bold text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      value={form.valorReais}
                      onChange={(e) => setForm({ ...form, valorReais: e.target.value })}
                      placeholder="1800.00"
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Forma de Pagamento Aceita *</label>
                  <select
                    value={form.formaPagamento}
                    onChange={(e) => setForm({ ...form, formaPagamento: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none bg-white font-semibold"
                  >
                    <option value="TODAS">Todas as Formas (À Vista, Cartão ou Negociado)</option>
                    <option value="A_VISTA">À Vista (PIX / Dinheiro / Transferência)</option>
                    <option value="PARCELADO_CARTAO">Parcelado no Cartão de Crédito</option>
                    <option value="NEGOCIADO">Negociado direto com o Instrutor</option>
                  </select>
                </div>
              </div>

              {/* Conditional options */}
              {(form.formaPagamento === 'PARCELADO_CARTAO' || form.formaPagamento === 'TODAS') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-blue-50/60 rounded-xl border border-blue-200">
                  <div>
                    <label className="block font-semibold text-blue-950 mb-1">Máx. de Parcelas no Cartão</label>
                    <select
                      value={form.maxParcelas}
                      onChange={(e) => setForm({ ...form, maxParcelas: parseInt(e.target.value, 10) || 1 })}
                      className="w-full px-3 py-1.5 border border-blue-300 rounded-lg focus:outline-none bg-white text-xs"
                    >
                      {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((num) => (
                        <option key={num} value={num}>{num}x sem juros</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-blue-950 mb-1">Desconto À Vista (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={form.descontoAvistaPercentual}
                      onChange={(e) => setForm({ ...form, descontoAvistaPercentual: parseInt(e.target.value, 10) || 0 })}
                      className="w-full px-3 py-1.5 border border-blue-300 rounded-lg focus:outline-none bg-white text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-800 mb-1">Descrição e Diferenciais do Pacote</label>
                <textarea
                  rows={2}
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Ex: Inclui simulado de exame no circuito oficial do Detran, suporte a baliza e veículo novo com ar-condicionado..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-ativo"
                  checked={form.ativo}
                  onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="chk-ativo" className="font-semibold text-slate-800 cursor-pointer">
                  Disponibilizar este pacote para novos cadastros de alunos imediatamente
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 flex flex-col-reverse sm:flex-row justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl font-semibold cursor-pointer w-full sm:w-auto"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-sm transition-colors cursor-pointer w-full sm:w-auto"
                >
                  Salvar Pacote
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
