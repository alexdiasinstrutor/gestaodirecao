import React, { useState } from 'react';
import {
  X,
  Car,
  Shield,
  AlertCircle,
  CheckCircle2,
  Ticket,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Building,
  UserCheck
} from 'lucide-react';
import { db } from '../../lib/storage';
import { isValidCPF, generateCPFFingerprint, getCPFLast4, maskCPF, formatCurrencyBRL } from '../../lib/validation';
import { isValidCEPFormat } from '../../lib/cepService';
import { User, Organization, AddressFields, SaaSPlanType } from '../../types';
import { AddressCepFields } from '../common/AddressCepFields';
import { getSaaSPlans, SaaSPlanDefinition } from '../../lib/saasPlans';
import { normalizeCouponCode, buildPlatformSubscription, CouponDiscountResult } from '../../lib/coupons';
import { signInWithGoogleOAuth } from '../../lib/supabaseClient';

interface InstructorRegisterModalProps {
  onClose: () => void;
  onRegistered: (user: User) => void;
}

export const InstructorRegisterModal: React.FC<InstructorRegisterModalProps> = ({ onClose, onRegistered }) => {
  // Passos: 1 = Escolha do Plano & Cupom SaaS, 2 = Dados Pessoais & Endereço, 3 = Criação da Senha & Conclusão
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Lista de planos
  const plansMap = getSaaSPlans();
  const availablePlans: SaaSPlanDefinition[] = ['BASICO', 'AVANCADO', 'MASTER']
    .map((id) => plansMap[id])
    .filter(Boolean);

  // Plano Selecionado (Default Básico ou Avançado)
  const [selectedPlanId, setSelectedPlanId] = useState<SaaSPlanType>('AVANCADO');

  // Cupom de Desconto / Período Grátis
  const [couponCodeInput, setCouponCodeInput] = useState<string>('');
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [couponResult, setCouponResult] = useState<CouponDiscountResult | null>(null);
  const [couponError, setCouponError] = useState<string>('');
  const [couponSuccess, setCouponSuccess] = useState<string>('');

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    cpf: '',
    telefone: '',
    nomeAutoescola: '',
    tipo: 'INSTRUTOR_AUTONOMO' as 'INSTRUTOR_AUTONOMO' | 'AUTOESCOLA_CFC',
    senha: '',
    confirmarSenha: ''
  });

  const [address, setAddress] = useState<AddressFields>({
    estado: 'MG',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: ''
  });

  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const selectedPlanDef = plansMap[selectedPlanId] || availablePlans[0];

  // Aplicação do Cupom
  const handleApplyCoupon = () => {
    setCouponError('');
    setCouponSuccess('');
    const clean = normalizeCouponCode(couponCodeInput);
    if (!clean) {
      setCouponError('Digite um código de cupom.');
      return;
    }

    const preview = db.previewCoupon(
      clean,
      {
        escopo: 'PLATAFORMA',
        referenciaId: selectedPlanId
      },
      selectedPlanDef.precoSugeridoMensalCentavos
    );

    if (!preview.valid || !preview.coupon || !preview.result) {
      setCouponError(preview.error || 'Cupom inválido para este plano.');
      setAppliedCoupon(null);
      setCouponResult(null);
      return;
    }

    setAppliedCoupon(preview.coupon);
    setCouponResult(preview.result);
    setCouponSuccess(`Cupom "${preview.coupon.codigo}" aplicado! ${preview.result.resumo}`);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponResult(null);
    setCouponCodeInput('');
    setCouponError('');
    setCouponSuccess('');
  };

  const handleNextStep1 = () => {
    setError('');
    // Se digitou cupom mas não clicou em aplicar, tenta aplicar automaticamente se preenchido
    if (couponCodeInput.trim() && !appliedCoupon) {
      const clean = normalizeCouponCode(couponCodeInput);
      const preview = db.previewCoupon(
        clean,
        { escopo: 'PLATAFORMA', referenciaId: selectedPlanId },
        selectedPlanDef.precoSugeridoMensalCentavos
      );
      if (preview.valid && preview.coupon && preview.result) {
        setAppliedCoupon(preview.coupon);
        setCouponResult(preview.result);
      }
    }
    setStep(2);
  };

  const handleNextStep2 = () => {
    setError('');
    if (!formData.nome.trim() || formData.nome.length < 3) {
      setError('Por favor, informe seu nome completo.');
      return;
    }

    if (!formData.email.trim() || !formData.email.includes('@')) {
      setError('Por favor, informe um endereço de e-mail válido.');
      return;
    }

    if (!isValidCPF(formData.cpf)) {
      setError('O CPF informado é inválido. Verifique os dígitos verificadores.');
      return;
    }

    if (!formData.telefone.trim()) {
      setError('Por favor, informe um número de telefone WhatsApp com DDD.');
      return;
    }

    if (!isValidCEPFormat(address.cep || '')) {
      setError('Por favor, informe um CEP válido com 8 dígitos para localizar o endereço.');
      return;
    }

    if (!address.logradouro?.trim() || !address.bairro?.trim() || !address.cidade?.trim() || !address.estado?.trim()) {
      setError('Preencha o CEP para carregar Logradouro, Bairro, Cidade e Estado (UF).');
      return;
    }

    if (!address.numero?.trim()) {
      setError('Por favor, informe o número do endereço (ou digite S/N).');
      return;
    }

    setStep(3);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

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
      const userId = `usr_${Date.now()}`;

      // Configuração de Assinatura a partir do plano e do cupom (se houver)
      const subResult = buildPlatformSubscription({
        planPriceCentavos: selectedPlanDef.precoSugeridoMensalCentavos,
        planDays: selectedPlanDef.diasValidadePadrao || 30,
        coupon: appliedCoupon
      });

      const newOrg: Organization = {
        id: orgId,
        nome: formData.nomeAutoescola.trim() || `${formData.nome.trim()} (Instrutor Autônomo)`,
        tipo: formData.tipo,
        cnpjCpf: formData.cpf,
        telefone: formData.telefone,
        email: formData.email,
        cep: address.cep?.trim(),
        logradouro: address.logradouro?.trim(),
        numero: address.numero?.trim(),
        complemento: address.complemento?.trim(),
        bairro: address.bairro?.trim(),
        cidade: (address.cidade || '').trim(),
        estado: (address.estado || 'MG').trim().toUpperCase(),
        status: subResult.status,
        plano: selectedPlanId,
        dataVencimentoPlano: subResult.dataVencimentoPlano,
        valorMensalidadeCentavos: subResult.valorMensalidadeCentavos,
        limiteAlunos: selectedPlanDef.limiteAlunos,
        limiteInstrutores: selectedPlanDef.limiteInstrutores,
        criadoEm: new Date().toISOString()
      };

      const newUser: User = {
        id: userId,
        organizacaoId: orgId,
        nome: formData.nome.trim(),
        email: formData.email.trim().toLowerCase(),
        papel: 'ADMIN_ORG',
        telefone: formData.telefone,
        cpfUltimos4: getCPFLast4(formData.cpf),
        cpfFingerprint: generateCPFFingerprint(formData.cpf),
        cpfMascarado: maskCPF(formData.cpf),
        cpfCompleto: formData.cpf.trim(),
        cep: address.cep?.trim(),
        estado: (address.estado || 'MG').trim().toUpperCase(),
        cidade: (address.cidade || '').trim(),
        bairro: address.bairro?.trim(),
        logradouro: address.logradouro?.trim(),
        numero: address.numero?.trim(),
        complemento: address.complemento?.trim(),
        senhaTemporaria: formData.senha,
        twoFactorAtivo: true,
        aprovadoPorMaster: true,
        ultimoAcesso: new Date().toISOString()
      };

      // Gravação assíncrona no Supabase respeitando Foreign Key (Organização salva e confirmada antes de Usuário)
      await db.createOrganizationAsync(newOrg);
      await db.createUserAsync(newUser);

      // Se utilizou cupom, registra o resgate oficial
      if (appliedCoupon) {
        db.redeemCoupon(
          appliedCoupon.codigo,
          {
            escopo: 'PLATAFORMA',
            referenciaId: selectedPlanId
          },
          selectedPlanDef.precoSugeridoMensalCentavos,
          {
            organizacaoId: orgId,
            usuarioId: userId
          },
          userId
        );
      }

      // Pacote padrão inicial de 20 aulas do instrutor
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
      <div className="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[92vh]">
        {/* Header com Stepper */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Cadastro de Instrutor / Autoescola</h2>
              <p className="text-xs text-slate-300">
                Passo {step} de 3:{' '}
                {step === 1 ? 'Escolha do Plano & Cupom' : step === 2 ? 'Dados Pessoais & Endereço' : 'Criação de Senha'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Visual */}
        <div className="bg-slate-100 px-6 py-2 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className={`flex items-center gap-1.5 font-bold ${step >= 1 ? 'text-blue-600' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-700'}`}>
              1
            </span>
            <span>Plano & Cupom</span>
          </div>
          <div className="h-0.5 w-10 bg-slate-300" />
          <div className={`flex items-center gap-1.5 font-bold ${step >= 2 ? 'text-blue-600' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-700'}`}>
              2
            </span>
            <span>Dados & Endereço</span>
          </div>
          <div className="h-0.5 w-10 bg-slate-300" />
          <div className={`flex items-center gap-1.5 font-bold ${step >= 3 ? 'text-blue-600' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-700'}`}>
              3
            </span>
            <span>Senha & Ativação</span>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* PASSO 1: ESCOLHA DO PLANO E CUPOM DE DESCONTO */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 text-blue-900">
                <p className="font-bold text-xs flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Selecione o plano ideal para sua atividade profissional
                </p>
                <p className="text-xs text-blue-800 mt-0.5">
                  Você pode usar um cupom de desconto promocional fornecido pela administração (período grátis ou desconto na mensalidade).
                </p>
              </div>

              {/* Cards de Planos */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {availablePlans.map((plan) => {
                  const isSelected = selectedPlanId === plan.id;
                  return (
                    <div
                      key={plan.id}
                      onClick={() => {
                        setSelectedPlanId(plan.id as SaaSPlanType);
                        if (appliedCoupon) {
                          // Revalida cupom para novo plano
                          const preview = db.previewCoupon(
                            appliedCoupon.codigo,
                            { escopo: 'PLATAFORMA', referenciaId: plan.id },
                            plan.precoSugeridoMensalCentavos
                          );
                          if (!preview.valid) {
                            setAppliedCoupon(null);
                            setCouponResult(null);
                            setCouponError('O cupom anterior não é válido para este novo plano.');
                          } else {
                            setCouponResult(preview.result || null);
                          }
                        }
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/30 shadow-md'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${plan.corBadge}`}>
                            {plan.nome.split(' ')[1] || plan.id}
                          </span>
                          {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{plan.nome}</h4>
                          <p className="text-xs text-slate-500 mt-0.5 leading-snug">{plan.tagline}</p>
                        </div>
                        <div className="pt-2 border-t border-slate-100">
                          <div className="font-mono font-black text-lg text-slate-900">
                            {formatCurrencyBRL(plan.precoSugeridoMensalCentavos)}
                            <span className="text-xs font-normal text-slate-500">/mês</span>
                          </div>
                        </div>
                        <ul className="space-y-1 text-xs text-slate-600 pt-1">
                          {plan.destaques.slice(0, 3).map((d, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span className="text-blue-600 font-bold">•</span>
                              <span>{d}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-100 text-center">
                        <span className={`text-xs font-bold ${isSelected ? 'text-blue-700' : 'text-slate-500'}`}>
                          {isSelected ? '✓ Plano Selecionado' : 'Selecionar'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Área de Cupom de Desconto */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Ticket className="w-4 h-4 text-purple-600" />
                    <span className="font-bold text-slate-800 text-xs">Tem um cupom de desconto ou período grátis?</span>
                  </div>
                  {appliedCoupon && (
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-xs text-red-600 hover:underline cursor-pointer"
                    >
                      Remover cupom
                    </button>
                  )}
                </div>

                {!appliedCoupon ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCodeInput}
                      onChange={(e) => setCouponCodeInput(normalizeCouponCode(e.target.value))}
                      placeholder="Ex: GESTAOAD-3MESES, TESTEGRATIS..."
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs uppercase tracking-wider focus:outline-none focus:border-purple-600 bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold cursor-pointer text-xs"
                    >
                      Aplicar
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-purple-900 text-xs block">
                        CUPOM ATIVO: {appliedCoupon.codigo}
                      </span>
                      <span className="text-xs text-purple-700 font-medium">{couponResult?.resumo}</span>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  </div>
                )}

                {couponError && <p className="text-xs text-red-600 font-medium">{couponError}</p>}
                {couponSuccess && !couponError && <p className="text-xs text-emerald-700 font-medium">{couponSuccess}</p>}
              </div>

              {/* Botão de Avançar */}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleNextStep1}
                  className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-sm cursor-pointer"
                >
                  <span>Continuar para Dados Cadastrais</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* PASSO 2: DADOS PESSOAIS & ENDEREÇO */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Botão de Agilidade: Conectar / Preencher com Google */}
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await signInWithGoogleOAuth();
                    if (res?.error) {
                      const emailInput = prompt('Informe o seu e-mail do Google (Gmail):');
                      if (emailInput && emailInput.includes('@')) {
                        setFormData((prev) => ({
                          ...prev,
                          email: emailInput.trim(),
                          nome: prev.nome || emailInput.split('@')[0].replace('.', ' ')
                        }));
                      }
                    }
                  } catch {
                    const emailInput = prompt('Informe o seu e-mail do Google (Gmail):');
                    if (emailInput && emailInput.includes('@')) {
                      setFormData((prev) => ({
                        ...prev,
                        email: emailInput.trim(),
                        nome: prev.nome || emailInput.split('@')[0].replace('.', ' ')
                      }));
                    }
                  }
                }}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 shadow-xs transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Preencher / Cadastrar com Conta Google</span>
              </button>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2.5 text-slate-400 font-bold tracking-wider text-xs">
                    ou digite os dados
                  </span>
                </div>
              </div>

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

                <div className="sm:col-span-2">
                  <AddressCepFields
                    value={address}
                    onChange={setAddress}
                    required={true}
                    title="Endereço do Instrutor / Autoescola (Validação por CEP)"
                    accentColor="blue"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>
                <button
                  type="button"
                  onClick={handleNextStep2}
                  className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-sm cursor-pointer"
                >
                  <span>Continuar para Senha</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* PASSO 3: CRIAÇÃO DE SENHA & ATIVAÇÃO */}
          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <h4 className="font-bold text-slate-900 text-xs">Resumo da sua Adesão:</h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-xs uppercase font-bold font-bold">Plano Contratado</span>
                    <strong>{selectedPlanDef.nome}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-xs uppercase font-bold font-bold">Condição de Acesso</span>
                    <strong className="text-purple-700">
                      {appliedCoupon ? couponResult?.resumo : `${formatCurrencyBRL(selectedPlanDef.precoSugeridoMensalCentavos)}/mês`}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-xs uppercase font-bold font-bold">Titular</span>
                    <span>{formData.nome}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-xs uppercase font-bold font-bold">Login de Acesso</span>
                    <span className="font-mono">{formData.email}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Crie sua Senha de Acesso (Mín. 6 dígitos) *</label>
                  <input
                    type="password"
                    required
                    value={formData.senha}
                    onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
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

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-600 text-xs flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  Ao concluir o cadastro, você terá acesso imediato com isolamento de dados por organização e autenticação 2FA ativada.
                </span>
              </div>

              <div className="pt-2 flex justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md transition-colors cursor-pointer"
                >
                  {loading ? 'Finalizando Cadastro...' : 'Concluir Cadastro & Iniciar'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
