import React, { useState } from 'react';
import {
  X,
  GraduationCap,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  Package,
  Ticket,
  Search,
  Check
} from 'lucide-react';
import { db } from '../../lib/storage';
import { isValidCPF, generateCPFFingerprint, maskCPF, validateMinimumAge, formatCurrencyBRL } from '../../lib/validation';
import { isValidCEPFormat } from '../../lib/cepService';
import { normalizeCouponCode, CouponDiscountResult } from '../../lib/coupons';
import { Student, User, CnhCategory, CNH_CATEGORIES, AddressFields, DiscountCoupon } from '../../types';
import { AddressCepFields } from '../common/AddressCepFields';

interface StudentSelfRegisterModalProps {
  onClose: () => void;
  onRegistered: (student: Student, user: User) => void;
  defaultInstructorId?: string;
  defaultCouponCode?: string;
  defaultOrgId?: string;
}

export const StudentSelfRegisterModal: React.FC<StudentSelfRegisterModalProps> = ({
  onClose,
  onRegistered,
  defaultInstructorId,
  defaultCouponCode,
  defaultOrgId
}) => {
  const orgs = db.getOrganizations();
  const selectedOrgId = defaultOrgId || orgs[0]?.id || 'org_direcao_certa_01';
  const orgInstructors = db.getUsers(selectedOrgId).filter((u) => u.papel === 'ADMIN_ORG' || u.papel === 'INSTRUTOR');

  // Campo de busca/identificação por código do instrutor
  const initialInstructor = defaultInstructorId
    ? db.findInstructorByCode(defaultInstructorId) || orgInstructors.find((i) => i.id === defaultInstructorId)
    : orgInstructors[0];

  const [instructorCodeInput, setInstructorCodeInput] = useState<string>(
    initialInstructor ? initialInstructor.id.replace('usr_', '').toUpperCase() : ''
  );
  const [selectedInstructor, setSelectedInstructor] = useState<User | undefined>(initialInstructor);
  const [codeFeedback, setCodeFeedback] = useState<{ message: string; isError: boolean } | null>(null);

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    cpf: '',
    telefone: '',
    dataNascimento: '',
    categoriaCnh: 'B' as CnhCategory,
    instrutorId: initialInstructor?.id || 'usr_instrutor_carlos',
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

  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [ageCheck, setAgeCheck] = useState<{ valid: boolean; age: number; error?: string } | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Cupom de Desconto fornecido pelo Instrutor
  const [couponCodeInput, setCouponCodeInput] = useState<string>(defaultCouponCode || '');
  const [appliedCoupon, setAppliedCoupon] = useState<DiscountCoupon | null>(null);
  const [couponResult, setCouponResult] = useState<CouponDiscountResult | null>(null);
  const [couponError, setCouponError] = useState<string>('');
  const [couponSuccess, setCouponSuccess] = useState<string>('');

  // Packages released by selected instructor
  const availablePackages = db
    .getPackages(selectedOrgId, formData.instrutorId)
    .filter((p) => p.ativo);

  // Auto select first package when instructor packages change
  React.useEffect(() => {
    if (availablePackages.length > 0 && (!selectedPackageId || !availablePackages.some((p) => p.id === selectedPackageId))) {
      setSelectedPackageId(availablePackages[0].id);
    }
  }, [formData.instrutorId, availablePackages.length]);

  const chosenPackage = availablePackages.find((p) => p.id === selectedPackageId) || availablePackages[0] || db.getPackages(selectedOrgId)[0];

  // Aplicação de código de instrutor digitado manualmente
  const handleLookupInstructor = (codeToSearch?: string) => {
    const raw = codeToSearch !== undefined ? codeToSearch : instructorCodeInput;
    if (!raw.trim()) {
      setCodeFeedback({ message: 'Digite o código fornecido pelo seu instrutor.', isError: true });
      return;
    }
    const found = db.findInstructorByCode(raw);
    if (!found) {
      setCodeFeedback({ message: 'Instrutor não localizado para este código. Verifique com seu instrutor.', isError: true });
      return;
    }
    setSelectedInstructor(found);
    setFormData((prev) => ({ ...prev, instrutorId: found.id }));
    setCodeFeedback({ message: `Instrutor identificado: ${found.nome}`, isError: false });

    // Se tiver cupom aplicado, revalida para o novo instrutor
    if (appliedCoupon && appliedCoupon.instrutorId !== found.id) {
      setAppliedCoupon(null);
      setCouponResult(null);
      setCouponError('O cupom anterior não pertence a este instrutor.');
    }
  };

  // Se houver defaultCouponCode vindo da URL, tenta aplicar automaticamente
  React.useEffect(() => {
    if (defaultCouponCode && chosenPackage) {
      const clean = normalizeCouponCode(defaultCouponCode);
      const preview = db.previewCoupon(
        clean,
        {
          escopo: 'ALUNO',
          referenciaId: chosenPackage.id,
          instrutorId: formData.instrutorId,
          organizacaoId: selectedOrgId
        },
        chosenPackage.valorCentavos
      );
      if (preview.valid && preview.coupon && preview.result) {
        setAppliedCoupon(preview.coupon);
        setCouponResult(preview.result);
        setCouponSuccess(`Cupom "${preview.coupon.codigo}" aplicado automaticamente pelo link do instrutor!`);
      }
    }
  }, [defaultCouponCode, chosenPackage?.id]);

  const handleApplyCoupon = () => {
    setCouponError('');
    setCouponSuccess('');
    const clean = normalizeCouponCode(couponCodeInput);
    if (!clean) {
      setCouponError('Informe o código do cupom.');
      return;
    }
    const valCentavos = chosenPackage?.valorCentavos || 180000;
    const preview = db.previewCoupon(
      clean,
      {
        escopo: 'ALUNO',
        referenciaId: chosenPackage?.id,
        instrutorId: formData.instrutorId,
        organizacaoId: selectedOrgId
      },
      valCentavos
    );

    if (!preview.valid || !preview.coupon || !preview.result) {
      setCouponError(preview.error || 'Cupom inválido para este pacote.');
      setAppliedCoupon(null);
      setCouponResult(null);
      return;
    }

    setAppliedCoupon(preview.coupon);
    setCouponResult(preview.result);
    setCouponSuccess(`Cupom "${preview.coupon.codigo}" aplicado! Desconto de ${formatCurrencyBRL(preview.result.valorDescontoCentavos)}.`);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponResult(null);
    setCouponCodeInput('');
    setCouponError('');
    setCouponSuccess('');
  };

  const handleBirthDateChange = (val: string) => {
    setFormData({ ...formData, dataNascimento: val });
    if (val) {
      const check = validateMinimumAge(val);
      setAgeCheck(check);
      if (!check.valid && check.error) {
        setError(check.error);
      } else {
        setError('');
      }
    } else {
      setAgeCheck(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 1. Rigorous age check (CTB and Prompt requirement)
    const check = validateMinimumAge(formData.dataNascimento);
    if (!check.valid) {
      setError(check.error || 'Idade inválida para obtenção da CNH.');
      return;
    }

    if (!formData.nome.trim() || formData.nome.length < 3) {
      setError('Por favor, informe o nome completo do estudante.');
      return;
    }

    if (!isValidCPF(formData.cpf)) {
      setError('CPF inválido. Por favor, verifique os dígitos verificadores informados.');
      return;
    }

    // Strict Rule: Cada aluno (CPF) fica acondicionado a apenas 1 instrutor por vez
    const enrollmentCheck = db.checkStudentCPFEnrollment(selectedOrgId, formData.cpf);
    if (enrollmentCheck.alreadyRegistered) {
      setError(enrollmentCheck.message || 'Este CPF já está condicionado a outro instrutor.');
      return;
    }

    if (!formData.telefone.trim()) {
      setError('Por favor, informe um número de telefone celular com WhatsApp.');
      return;
    }

    if (!isValidCEPFormat(address.cep || '')) {
      setError('Por favor, informe um CEP válido com 8 dígitos para localizar o endereço do aluno.');
      return;
    }

    if (!address.logradouro?.trim() || !address.bairro?.trim() || !address.cidade?.trim() || !address.estado?.trim()) {
      setError('Preencha o CEP para carregar Logradouro, Bairro, Cidade e Estado (UF).');
      return;
    }

    if (!address.numero?.trim()) {
      setError('Por favor, informe o número da residência do aluno (ou digite S/N).');
      return;
    }

    if (!formData.senha || formData.senha.length < 6) {
      setError('A senha deve ter pelo menos 6 dígitos.');
      return;
    }

    if (formData.senha !== formData.confirmarSenha) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      const studentId = `stu_${Date.now()}`;
      const userId = `usr_${Date.now()}`;

      // Selected package
      const contractedLessons = chosenPackage ? chosenPackage.totalAulas : 20;

      const newStudent: Student = {
        id: studentId,
        organizacaoId: selectedOrgId,
        instrutorId: formData.instrutorId,
        nome: formData.nome.trim(),
        email: formData.email.trim().toLowerCase(),
        telefone: formData.telefone,
        cpfMascarado: maskCPF(formData.cpf),
        cpfFingerprint: generateCPFFingerprint(formData.cpf),
        dataNascimento: formData.dataNascimento,
        idade: check.age,
        categoriaCnh: formData.categoriaCnh,
        cep: address.cep?.trim(),
        estado: address.estado?.trim().toUpperCase(),
        cidade: address.cidade?.trim() || '',
        bairro: address.bairro?.trim(),
        logradouro: address.logradouro?.trim(),
        numero: address.numero?.trim(),
        complemento: address.complemento?.trim(),
        status: 'EM_ANDAMENTO',
        aulasCumpridas: 0,
        totalAulasContratadas: contractedLessons,
        pacoteId: chosenPackage?.id,
        pacoteNome: chosenPackage?.nome,
        habilidades: {
          baliza: 0,
          controleEmbreagem: 0,
          transitoPesado: 0,
          conversoesCruzamentos: 0,
          rodoviaVelocidade: 0,
          sinalizacaoPreferencia: 0,
          posturaDefensiva: 0,
          simuladoExame: 0
        },
        observacoesInstrutor: `Aluno matriculado no plano "${chosenPackage?.nome || 'Plano Padrão'}". Pronto para iniciar as aulas práticas de direção.`,
        dataCadastro: new Date().toISOString().slice(0, 10)
      };

      const newUser: User = {
        id: userId,
        organizacaoId: selectedOrgId,
        nome: formData.nome.trim(),
        email: formData.email.trim().toLowerCase(),
        papel: 'ALUNO',
        telefone: formData.telefone,
        cpfUltimos4: formData.cpf.replace(/\D/g, '').slice(-4),
        cpfFingerprint: generateCPFFingerprint(formData.cpf),
        cpfMascarado: maskCPF(formData.cpf),
        cpfCompleto: formData.cpf.trim(),
        cep: address.cep?.trim(),
        estado: address.estado?.trim().toUpperCase(),
        cidade: address.cidade?.trim() || '',
        bairro: address.bairro?.trim(),
        logradouro: address.logradouro?.trim(),
        numero: address.numero?.trim(),
        complemento: address.complemento?.trim(),
        senhaTemporaria: formData.senha,
        twoFactorAtivo: true,
        ultimoAcesso: new Date().toISOString()
      };

      // Create an initial package and accounts receivable for the student
      if (chosenPackage) {
        const accId = `rec_${Date.now()}`;
        const finalValCentavos = couponResult ? couponResult.valorFinalCentavos : chosenPackage.valorCentavos;
        const descTexto = appliedCoupon
          ? `Contrato de Matrícula - ${chosenPackage.nome} (Cupom ${appliedCoupon.codigo} aplicado: -${formatCurrencyBRL(couponResult?.valorDescontoCentavos || 0)})`
          : `Contrato de Matrícula - ${chosenPackage.nome}`;

        db.createAccountReceivable(
          {
            id: accId,
            organizacaoId: selectedOrgId,
            alunoId: studentId,
            pacoteId: chosenPackage.id,
            descricao: descTexto,
            valorTotalCentavos: finalValCentavos,
            valorPagoCentavos: 0,
            saldoDevedorCentavos: finalValCentavos,
            dataVencimento: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
            status: 'PENDENTE',
            pixPayload: `00020126580014BR.GOV.BCB.PIX0114financeiro@direcaosegura.com.br520400005303986540${(finalValCentavos / 100).toFixed(2)}5802BR5925AUTOESCOLA6009SAO PAULO62070503REC016304`,
            criadoEm: new Date().toISOString()
          },
          userId
        );

        if (appliedCoupon) {
          db.redeemCoupon(
            appliedCoupon.codigo,
            {
              escopo: 'ALUNO',
              referenciaId: chosenPackage.id,
              instrutorId: formData.instrutorId,
              organizacaoId: selectedOrgId
            },
            chosenPackage.valorCentavos,
            {
              organizacaoId: selectedOrgId,
              usuarioId: userId,
              alunoId: studentId
            },
            userId
          );
        }
      }

      db.saveStudent(newStudent, userId);
      db.createUser(newUser);

      onRegistered(newStudent, newUser);
    } catch (err: any) {
      setError('Erro ao concluir cadastro: ' + (err?.message || 'Tente novamente.'));
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Auto-Cadastro de Aluno</h2>
              <p className="text-xs text-slate-300">Habilitação de direção com instrutor credenciado</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Age Notice / Alert */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>Regra de Maioridade Rigorosa (Art. 140 CTB)</span>
            </div>
            <p className="text-xs text-amber-800">
              Não é permitido o cadastro de alunos menores que 18 anos. A data de nascimento será validada matematicamente.
            </p>
          </div>

          {/* Localização do Instrutor por Código ou Link */}
          <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="block font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-blue-600" />
                <span>Código de Indicação do Instrutor *</span>
              </label>
              {selectedInstructor && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" /> Reconhecido
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={instructorCodeInput}
                onChange={(e) => {
                  setInstructorCodeInput(e.target.value.toUpperCase());
                  setCodeFeedback(null);
                }}
                placeholder="Ex: INSTRUTOR_CARLOS ou código do link"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs uppercase focus:outline-none focus:border-blue-600 bg-white"
              />
              <button
                type="button"
                onClick={() => handleLookupInstructor()}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold cursor-pointer text-xs flex items-center gap-1 shrink-0"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Localizar</span>
              </button>
            </div>

            {codeFeedback && (
              <p className={`text-xs font-medium ${codeFeedback.isError ? 'text-red-600' : 'text-emerald-700'}`}>
                {codeFeedback.message}
              </p>
            )}

            {selectedInstructor ? (
              <div className="p-2.5 bg-white border border-blue-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase font-bold font-bold text-blue-600 block">Instrutor Responsável</span>
                  <span className="font-bold text-slate-900 text-xs">{selectedInstructor.nome}</span>
                  <span className="text-xs text-slate-500 block">{selectedInstructor.email}</span>
                </div>
                <span className="px-2 py-1 rounded bg-blue-100 font-mono text-blue-800 font-bold text-xs">
                  {selectedInstructor.id.replace('usr_', '').toUpperCase()}
                </span>
              </div>
            ) : (
              <div className="space-y-1">
                <select
                  value={formData.instrutorId}
                  onChange={(e) => {
                    const instId = e.target.value;
                    const found = orgInstructors.find((i) => i.id === instId);
                    setSelectedInstructor(found);
                    setFormData({ ...formData, instrutorId: instId });
                    setInstructorCodeInput(instId.replace('usr_', '').toUpperCase());
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none bg-white font-medium text-xs"
                >
                  {orgInstructors.map((ins) => (
                    <option key={ins.id} value={ins.id}>
                      {ins.nome} ({ins.email})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">
                  Ou selecione manualmente na lista acima caso não tenha o código em mãos.
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-700 mb-1">Nome Completo do Aluno *</label>
              <input
                type="text"
                required
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Pedro Henrique Silva"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Data de Nascimento * <span className="text-red-500 font-bold">(Mín. 18 anos)</span>
              </label>
              <input
                type="date"
                required
                value={formData.dataNascimento}
                onChange={(e) => handleBirthDateChange(e.target.value)}
                className={`w-full px-3 py-2 border rounded-xl focus:outline-none ${
                  ageCheck && !ageCheck.valid ? 'border-red-500 bg-red-50' : 'border-slate-300 focus:border-blue-600'
                }`}
              />
              {ageCheck && (
                <p className={`mt-1 text-xs font-semibold ${ageCheck.valid ? 'text-emerald-600' : 'text-red-600'}`}>
                  {ageCheck.valid ? `✓ Idade confirmada: ${ageCheck.age} anos (Maior de idade)` : `✗ Idade calculada: ${ageCheck.age} anos (Menor de 18 anos)`}
                </p>
              )}
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
              <label className="block font-medium text-slate-700 mb-1">WhatsApp Celular *</label>
              <input
                type="text"
                required
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                placeholder="(11) 98765-4321"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Categoria CNH Pretendida *</label>
              <select
                value={formData.categoriaCnh}
                onChange={(e) => setFormData({ ...formData, categoriaCnh: e.target.value as CnhCategory })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none bg-white font-medium"
              >
                {CNH_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Endereço Completo do Aluno com Validação por CEP */}
            <div className="sm:col-span-2">
              <AddressCepFields
                value={address}
                onChange={setAddress}
                required={true}
                title="Endereço Residencial do Aluno (Validação por CEP)"
                accentColor="emerald"
              />
            </div>

            {/* Package selector for chosen instructor */}
            <div className="sm:col-span-2 space-y-2">
              <label className="block font-bold text-slate-800">
                Escolha o Pacote de Aulas Liberado pelo Instrutor ({selectedInstructor?.nome || 'Instrutor'}) *
              </label>

              {availablePackages.length > 0 ? (
                <div className="space-y-2">
                  {availablePackages.map((pkg) => {
                    const isSelected = selectedPackageId === pkg.id;
                    return (
                      <div
                        key={pkg.id}
                        onClick={() => setSelectedPackageId(pkg.id)}
                        className={`p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col xs:flex-row xs:items-center justify-between gap-2.5 ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs">{pkg.nome}</span>
                            <span className="px-1.5 py-0.2 rounded bg-slate-900 text-white font-mono text-xs shrink-0">
                              CNH {pkg.categoriaCnh}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-snug">
                            {pkg.totalAulas} aulas práticas · {pkg.descricao || 'Curso prático'}
                          </p>
                          <span className="inline-block text-xs text-blue-700 font-semibold leading-tight">
                            {pkg.formaPagamento === 'A_VISTA'
                              ? 'Pagamento à vista (PIX / Dinheiro)'
                              : pkg.formaPagamento === 'PARCELADO_CARTAO'
                              ? `Até ${pkg.maxParcelas || 12}x no cartão de crédito`
                              : pkg.formaPagamento === 'NEGOCIADO'
                              ? 'Condição especial negociada'
                              : 'À vista, parcelado no cartão ou negociado'}
                          </span>
                        </div>

                        <div className="flex xs:flex-col items-center xs:items-end justify-between xs:justify-center border-t xs:border-t-0 pt-2 xs:pt-0 border-slate-100 shrink-0">
                          <span className="font-mono font-extrabold text-sm text-slate-900 block whitespace-nowrap">
                            {formatCurrencyBRL(pkg.valorCentavos)}
                          </span>
                          <span className={`text-xs font-bold ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>
                            {isSelected ? '✓ Selecionado' : 'Selecionar'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-xs">
                  Pacote Padrão de 20 Aulas Práticas (R$ 1.800,00) com flexibilidade total de pagamento.
                </div>
              )}

              {/* Área de Cupom de Desconto do Instrutor */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 mt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                    <Ticket className="w-3.5 h-3.5 text-blue-600" />
                    <span>Possui um cupom de desconto do seu instrutor?</span>
                  </div>
                  {appliedCoupon && (
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-xs text-red-600 hover:underline cursor-pointer"
                    >
                      Remover
                    </button>
                  )}
                </div>

                {!appliedCoupon ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCodeInput}
                      onChange={(e) => setCouponCodeInput(normalizeCouponCode(e.target.value))}
                      placeholder="Ex: CNH2026, ALUNO-PROMO..."
                      className="flex-1 px-3 py-1.5 border border-slate-300 rounded-xl font-mono text-xs uppercase focus:outline-none focus:border-blue-600 bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold cursor-pointer text-xs"
                    >
                      Aplicar Cupom
                    </button>
                  </div>
                ) : (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-emerald-900 text-xs block">
                        CUPOM ATIVO: {appliedCoupon.codigo}
                      </span>
                      <span className="text-xs text-emerald-700 font-medium">
                        {couponResult?.resumo} (Valor a pagar: {formatCurrencyBRL(couponResult?.valorFinalCentavos || 0)})
                      </span>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  </div>
                )}

                {couponError && <p className="text-xs text-red-600 font-medium">{couponError}</p>}
                {couponSuccess && !couponError && <p className="text-xs text-emerald-700 font-medium">{couponSuccess}</p>}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-700 mb-1">E-mail para Login *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="aluno@email.com.br"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none font-mono text-sm sm:text-xs"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Senha de Acesso (Mín. 6 dígitos) *</label>
              <input
                type="password"
                required
                value={formData.senha}
                onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none text-sm sm:text-xs"
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
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none text-sm sm:text-xs"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 font-semibold cursor-pointer w-full sm:w-auto"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || (ageCheck !== null && !ageCheck.valid)}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-semibold shadow-sm transition-colors cursor-pointer w-full sm:w-auto"
            >
              {loading ? 'Cadastrando...' : 'Finalizar Auto-Cadastro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
