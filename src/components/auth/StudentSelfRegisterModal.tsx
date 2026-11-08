import React, { useState, useEffect } from 'react';
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
  Check,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  User as UserIcon,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  Award,
  CreditCard
} from 'lucide-react';
import { db } from '../../lib/storage';
import { supabaseAdapter } from '../../lib/supabaseAdapter';
import { isValidCPF, generateCPFFingerprint, maskCPF, validateMinimumAge, formatCurrencyBRL } from '../../lib/validation';
import { isValidCEPFormat } from '../../lib/cepService';
import { normalizeCouponCode, CouponDiscountResult } from '../../lib/coupons';
import { Student, User, CnhCategory, CNH_CATEGORIES, AddressFields, DiscountCoupon, PackageOffer } from '../../types';
import { AddressCepFields } from '../common/AddressCepFields';

interface StudentSelfRegisterModalProps {
  onClose: () => void;
  onRegistered: (student: Student, user: User) => void;
  defaultInstructorId?: string;
  defaultCouponCode?: string;
  defaultOrgId?: string;
}

function maskCpfInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function maskPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export const StudentSelfRegisterModal: React.FC<StudentSelfRegisterModalProps> = ({
  onClose,
  onRegistered,
  defaultInstructorId,
  defaultCouponCode,
  defaultOrgId
}) => {
  // Controle de Etapas do Cadastro (3 Telas/Passos)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Lista de instrutores
  const [instructorsList, setInstructorsList] = useState<User[]>(() => db.getAllInstructors());
  const [loadingInstructors, setLoadingInstructors] = useState<boolean>(false);

  // Determina instrutor inicial
  const initialInstructor = React.useMemo(() => {
    if (defaultInstructorId) {
      return db.findInstructorByCode(defaultInstructorId) || instructorsList.find((i) => i.id === defaultInstructorId);
    }
    return instructorsList[0];
  }, [defaultInstructorId, instructorsList]);

  const [selectedInstructor, setSelectedInstructor] = useState<User | undefined>(initialInstructor);
  const [instructorCodeInput, setInstructorCodeInput] = useState<string>(
    initialInstructor ? initialInstructor.id.replace('usr_', '').toUpperCase() : ''
  );
  const [codeFeedback, setCodeFeedback] = useState<{ message: string; isError: boolean } | null>(null);

  // Organizações
  const orgs = db.getOrganizations();
  const targetOrgId = selectedInstructor?.organizacaoId || defaultOrgId || orgs[0]?.id || 'org_direcao_certa_01';

  // Dados do formulário
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    cpf: '',
    telefone: '',
    dataNascimento: '',
    categoriaCnh: 'B' as CnhCategory,
    instrutorId: initialInstructor?.id || '',
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
  const [packageCategoryFilter, setPackageCategoryFilter] = useState<string>('ALL');
  const [ageCheck, setAgeCheck] = useState<{ valid: boolean; age: number; error?: string } | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [termsAccepted, setTermsAccepted] = useState<boolean>(true);

  // Cupom de Desconto
  const [couponCodeInput, setCouponCodeInput] = useState<string>(defaultCouponCode || '');
  const [appliedCoupon, setAppliedCoupon] = useState<DiscountCoupon | null>(null);
  const [couponResult, setCouponResult] = useState<CouponDiscountResult | null>(null);
  const [couponError, setCouponError] = useState<string>('');
  const [couponSuccess, setCouponSuccess] = useState<string>('');

  // Sincroniza instrutores do Supabase
  useEffect(() => {
    let isMounted = true;
    async function loadRemoteInstructors() {
      if (supabaseAdapter.enabled) {
        setLoadingInstructors(true);
        try {
          const remoteUsers = await supabaseAdapter.getUsers();
          if (remoteUsers && remoteUsers.length > 0 && isMounted) {
            remoteUsers.forEach((u) => {
              if (u.papel === 'ADMIN_ORG' || u.papel === 'INSTRUTOR' || u.papel === 'SUPER_ADMIN') {
                db.saveUser(u);
              }
            });
            const fresh = db.getAllInstructors();
            setInstructorsList(fresh);
            if (!selectedInstructor && fresh.length > 0) {
              const matched = defaultInstructorId
                ? db.findInstructorByCode(defaultInstructorId) || fresh.find((i) => i.id === defaultInstructorId) || fresh[0]
                : fresh[0];
              setSelectedInstructor(matched);
              setFormData((prev) => ({ ...prev, instrutorId: matched.id }));
              setInstructorCodeInput(matched.id.replace('usr_', '').toUpperCase());
            }
          }

          // Carrega pacotes remotos
          const activeOrg = (selectedInstructor || instructorsList[0])?.organizacaoId;
          if (activeOrg) {
            const remotePkgs = await supabaseAdapter.getPackages(activeOrg);
            if (remotePkgs && remotePkgs.length > 0 && isMounted) {
              remotePkgs.forEach((pkg) => db.savePackage(pkg));
            }
          }
        } catch (e) {
          console.warn('[StudentRegister] Erro ao sincronizar instrutores remotos:', e);
        } finally {
          if (isMounted) setLoadingInstructors(false);
        }
      }
    }

    loadRemoteInstructors();
    return () => {
      isMounted = false;
    };
  }, [defaultInstructorId]);

  // Pacotes disponíveis estritamente cadastrados pelo instrutor/organização (o sistema nunca inventa outras categorias)
  const availablePackages = React.useMemo(() => {
    return db.getPackages(targetOrgId, selectedInstructor?.id).filter((p) => p.ativo);
  }, [targetOrgId, selectedInstructor?.id]);

  // Categorias de CNH estritamente oferecidas pelos planos criados pelo instrutor
  const instructorCategories = React.useMemo(() => {
    const catsInPackages = new Set(availablePackages.map((p) => p.categoriaCnh));
    return CNH_CATEGORIES.filter((c) => catsInPackages.has(c.value));
  }, [availablePackages]);

  // Filtro por categoria nos pacotes (somente entre as categorias que o instrutor oferece)
  const displayedPackages = React.useMemo(() => {
    if (packageCategoryFilter === 'ALL') return availablePackages;
    return availablePackages.filter((p) => p.categoriaCnh === packageCategoryFilter);
  }, [availablePackages, packageCategoryFilter]);

  // Sincroniza categoria pretendida e pacote selecionado estritamente com os planos criados pelo instrutor
  useEffect(() => {
    if (availablePackages.length > 0) {
      const validCats = new Set(availablePackages.map((p) => p.categoriaCnh));
      if (!validCats.has(formData.categoriaCnh)) {
        const firstCat = availablePackages[0].categoriaCnh;
        setFormData((prev) => ({ ...prev, categoriaCnh: firstCat }));
        setSelectedPackageId(availablePackages[0].id);
      } else if (!selectedPackageId || !availablePackages.some((p) => p.id === selectedPackageId)) {
        const match = availablePackages.find((p) => p.categoriaCnh === formData.categoriaCnh);
        setSelectedPackageId(match ? match.id : availablePackages[0].id);
      }
    } else {
      setSelectedPackageId('');
    }
  }, [selectedInstructor?.id, availablePackages, formData.categoriaCnh]);

  const chosenPackage = availablePackages.find((p) => p.id === selectedPackageId) || availablePackages[0];

  // Localização do instrutor por código ou digitação manual
  const handleLookupInstructor = (codeToSearch?: string) => {
    const raw = (codeToSearch !== undefined ? codeToSearch : instructorCodeInput).trim();
    if (!raw) {
      setCodeFeedback({ message: 'Digite o código fornecido pelo seu instrutor.', isError: true });
      return;
    }
    const cleanRaw = raw.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const found =
      db.findInstructorByCode(raw) ||
      instructorsList.find(
        (i) =>
          i.id.toLowerCase() === cleanRaw ||
          i.id.toLowerCase() === `usr_${cleanRaw}` ||
          i.id.toLowerCase().replace('usr_', '') === cleanRaw ||
          i.nome.toLowerCase().includes(cleanRaw) ||
          i.email.toLowerCase().includes(cleanRaw)
      );

    if (!found) {
      setCodeFeedback({ message: 'Instrutor não localizado para este código. Verifique com seu instrutor.', isError: true });
      return;
    }
    setSelectedInstructor(found);
    setFormData((prev) => ({ ...prev, instrutorId: found.id }));
    setInstructorCodeInput(found.id.replace('usr_', '').toUpperCase());
    setCodeFeedback({ message: `Instrutor identificado: ${found.nome}`, isError: false });

    // Se tiver cupom aplicado, revalida para o novo instrutor
    if (appliedCoupon && appliedCoupon.instrutorId !== found.id) {
      setAppliedCoupon(null);
      setCouponResult(null);
      setCouponError('O cupom anterior não pertence a este instrutor.');
    }
  };

  // Aplicação de cupom via URL
  useEffect(() => {
    if (defaultCouponCode && chosenPackage) {
      const clean = normalizeCouponCode(defaultCouponCode);
      const preview = db.previewCoupon(
        clean,
        {
          escopo: 'ALUNO',
          referenciaId: chosenPackage.id,
          instrutorId: formData.instrutorId,
          organizacaoId: targetOrgId
        },
        chosenPackage.valorCentavos
      );
      if (preview.valid && preview.coupon && preview.result) {
        setAppliedCoupon(preview.coupon);
        setCouponResult(preview.result);
        setCouponSuccess(`Cupom "${preview.coupon.codigo}" aplicado automaticamente pelo link do instrutor!`);
      }
    }
  }, [defaultCouponCode, chosenPackage?.id, targetOrgId]);

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
        organizacaoId: targetOrgId
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

  // Navegação entre etapas com validações específicas
  const handleGoToStep2 = () => {
    setError('');
    if (!selectedInstructor || !formData.instrutorId) {
      setError('Por favor, selecione ou localize o instrutor credenciado antes de prosseguir.');
      return;
    }
    if (!selectedPackageId || !chosenPackage) {
      setError('Por favor, selecione o pacote de aulas desejado antes de prosseguir.');
      return;
    }
    setCurrentStep(2);
  };

  const handleGoToStep3 = () => {
    setError('');
    if (!formData.nome.trim() || formData.nome.trim().length < 3) {
      setError('Informe o seu nome completo com no mínimo 3 caracteres.');
      return;
    }
    if (!formData.dataNascimento) {
      setError('Informe sua data de nascimento.');
      return;
    }
    const check = validateMinimumAge(formData.dataNascimento);
    if (!check.valid) {
      setError(check.error || 'Apenas maiores de 18 anos podem se cadastrar (Art. 140 CTB).');
      return;
    }
    if (!isValidCPF(formData.cpf)) {
      setError('CPF inválido. Verifique os dígitos informados.');
      return;
    }
    const enrollmentCheck = db.checkStudentCPFEnrollment(targetOrgId, formData.cpf);
    if (enrollmentCheck.alreadyRegistered) {
      setError(enrollmentCheck.message || 'Este CPF já está condicionado a outro instrutor.');
      return;
    }
    const phoneDigits = formData.telefone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      setError('Informe um WhatsApp válido com DDD (ex: 11 98765-4321).');
      return;
    }
    if (!address.cep || address.cep.replace(/\D/g, '').length !== 8) {
      setError('Informe um CEP válido com 8 dígitos.');
      return;
    }
    if (!address.logradouro?.trim() || !address.numero?.trim() || !address.bairro?.trim() || !address.cidade?.trim() || !address.estado?.trim()) {
      setError('Preencha os campos obrigatórios do endereço (Rua, Número, Bairro, Cidade e UF).');
      return;
    }
    setCurrentStep(3);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedInstructor) {
      setError('Selecione seu instrutor credenciado.');
      setCurrentStep(1);
      return;
    }

    if (!formData.email.trim() || !formData.email.includes('@')) {
      setError('Informe um endereço de e-mail válido para login.');
      return;
    }

    if (!formData.senha || formData.senha.length < 6) {
      setError('A senha de acesso deve possuir no mínimo 6 dígitos.');
      return;
    }

    if (formData.senha !== formData.confirmarSenha) {
      setError('A confirmação de senha não coincide com a senha digitada.');
      return;
    }

    if (!termsAccepted) {
      setError('É necessário concordar com os Termos de Uso e Política de Privacidade para prosseguir.');
      return;
    }

    const check = validateMinimumAge(formData.dataNascimento);
    if (!check.valid) {
      setError(check.error || 'Idade inválida para obtenção da CNH.');
      setCurrentStep(2);
      return;
    }

    setLoading(true);

    try {
      const studentId = `stu_${Date.now()}`;
      const userId = `usr_${Date.now()}`;
      const activeInstructorId = selectedInstructor.id;
      const contractedLessons = chosenPackage ? chosenPackage.totalAulas : 20;

      const newStudent: Student = {
        id: studentId,
        organizacaoId: targetOrgId,
        instrutorId: activeInstructorId,
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
        observacoesInstrutor: `Aluno matriculado com instrutor ${selectedInstructor.nome} no pacote "${chosenPackage?.nome}".`,
        dataCadastro: new Date().toISOString().slice(0, 10)
      };

      const newUser: User = {
        id: userId,
        organizacaoId: targetOrgId,
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

      if (chosenPackage) {
        const accId = `rec_${Date.now()}`;
        const finalValCentavos = couponResult ? couponResult.valorFinalCentavos : chosenPackage.valorCentavos;
        const descTexto = appliedCoupon
          ? `Matrícula - ${chosenPackage.nome} (Cupom ${appliedCoupon.codigo}: -${formatCurrencyBRL(couponResult?.valorDescontoCentavos || 0)})`
          : `Matrícula - ${chosenPackage.nome}`;

        db.createAccountReceivable(
          {
            id: accId,
            organizacaoId: targetOrgId,
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
              instrutorId: activeInstructorId,
              organizacaoId: targetOrgId
            },
            chosenPackage.valorCentavos,
            {
              organizacaoId: targetOrgId,
              usuarioId: userId,
              alunoId: studentId
            },
            userId
          );
        }
      }

      await db.saveStudentAsync(newStudent, userId);
      await db.createUserAsync(newUser);

      onRegistered(newStudent, newUser);
    } catch (err: any) {
      setError('Erro ao concluir cadastro: ' + (err?.message || 'Tente novamente.'));
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[90vh]">
        {/* Header Superior */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl">
              <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">Auto-Cadastro de Aluno</h2>
              <p className="text-xs text-slate-300">Habilitação de direção com instrutor credenciado</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Indicador de 3 Etapas (Step Wizard) */}
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex items-center justify-between max-w-md mx-auto">
            {/* Passo 1 */}
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="flex items-center gap-2 cursor-pointer focus:outline-none"
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  currentStep === 1
                    ? 'bg-blue-600 text-white ring-2 ring-blue-300 shadow-xs'
                    : currentStep > 1
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {currentStep > 1 ? <Check className="w-4 h-4" /> : '1'}
              </div>
              <div className="hidden xs:block text-left">
                <span className={`block text-[11px] font-bold ${currentStep === 1 ? 'text-blue-700' : 'text-slate-700'}`}>
                  Passo 1
                </span>
                <span className="block text-[10px] text-slate-500 font-medium leading-none">Instrutor & Pacote</span>
              </div>
            </button>

            <div className={`flex-1 h-0.5 mx-2 transition-colors ${currentStep > 1 ? 'bg-emerald-500' : 'bg-slate-200'}`} />

            {/* Passo 2 */}
            <button
              type="button"
              onClick={() => {
                if (selectedInstructor && selectedPackageId) setCurrentStep(2);
              }}
              className="flex items-center gap-2 cursor-pointer focus:outline-none"
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  currentStep === 2
                    ? 'bg-blue-600 text-white ring-2 ring-blue-300 shadow-xs'
                    : currentStep > 2
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {currentStep > 2 ? <Check className="w-4 h-4" /> : '2'}
              </div>
              <div className="hidden xs:block text-left">
                <span className={`block text-[11px] font-bold ${currentStep === 2 ? 'text-blue-700' : 'text-slate-700'}`}>
                  Passo 2
                </span>
                <span className="block text-[10px] text-slate-500 font-medium leading-none">Dados & Endereço</span>
              </div>
            </button>

            <div className={`flex-1 h-0.5 mx-2 transition-colors ${currentStep > 2 ? 'bg-emerald-500' : 'bg-slate-200'}`} />

            {/* Passo 3 */}
            <button
              type="button"
              onClick={() => {
                if (selectedInstructor && selectedPackageId && formData.nome && formData.cpf) setCurrentStep(3);
              }}
              className="flex items-center gap-2 cursor-pointer focus:outline-none"
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  currentStep === 3
                    ? 'bg-blue-600 text-white ring-2 ring-blue-300 shadow-xs'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                3
              </div>
              <div className="hidden xs:block text-left">
                <span className={`block text-[11px] font-bold ${currentStep === 3 ? 'text-blue-700' : 'text-slate-700'}`}>
                  Passo 3
                </span>
                <span className="block text-[10px] text-slate-500 font-medium leading-none">Acesso & Senha</span>
              </div>
            </button>
          </div>
        </div>

        {/* Corpo do Formulário */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* ========================================================= */}
          {/* TELA 1: INSTRUTOR & PACOTE DE AULAS */}
          {/* ========================================================= */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Seleção do Instrutor */}
              <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-blue-600" />
                    <span>1. Instrutor Credenciado Responsável *</span>
                  </label>
                  {loadingInstructors ? (
                    <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Sincronizando banco...
                    </span>
                  ) : selectedInstructor ? (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3" /> Reconhecido
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      Pendente Seleção
                    </span>
                  )}
                </div>

                {/* Código de Indicação */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={instructorCodeInput}
                    onChange={(e) => {
                      setInstructorCodeInput(e.target.value.toUpperCase());
                      setCodeFeedback(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleLookupInstructor();
                      }
                    }}
                    placeholder="Código do instrutor (Ex: ALEX ou cód. do link)"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs uppercase focus:outline-none focus:border-blue-600 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleLookupInstructor()}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold cursor-pointer text-xs flex items-center gap-1 shrink-0"
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

                {/* Dropdown de Instrutores Cadastrados */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Ou selecione na listagem de instrutores cadastrados:
                  </label>
                  <select
                    value={selectedInstructor?.id || formData.instrutorId || ''}
                    onChange={(e) => {
                      const instId = e.target.value;
                      const found = instructorsList.find((i) => i.id === instId);
                      if (found) {
                        setSelectedInstructor(found);
                        setFormData((prev) => ({ ...prev, instrutorId: found.id }));
                        setInstructorCodeInput(found.id.replace('usr_', '').toUpperCase());
                        setCodeFeedback({ message: `Instrutor selecionado: ${found.nome}`, isError: false });
                      } else {
                        setSelectedInstructor(undefined);
                        setFormData((prev) => ({ ...prev, instrutorId: '' }));
                        setCodeFeedback(null);
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none bg-white font-medium text-xs cursor-pointer"
                  >
                    <option value="">
                      {loadingInstructors
                        ? 'Carregando instrutores do banco de dados...'
                        : instructorsList.length === 0
                        ? '-- Nenhum instrutor localizado no banco --'
                        : `-- Selecione seu Instrutor (${instructorsList.length} cadastrados) --`}
                    </option>
                    {instructorsList.map((ins) => {
                      const org = db.getOrganization(ins.organizacaoId);
                      const orgName = org?.nome ? ` (${org.nome})` : '';
                      const roleLabel = ins.papel === 'SUPER_ADMIN' ? 'Diretor' : 'Instrutor';
                      const code = ins.id.replace('usr_', '').toUpperCase();
                      return (
                        <option key={ins.id} value={ins.id}>
                          {ins.nome} · {roleLabel}{orgName} — Cód: {code}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Card do Instrutor Ativo */}
                {selectedInstructor && (
                  <div className="p-3 bg-white border border-blue-200 rounded-xl flex items-center justify-between shadow-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-blue-600 block">Instrutor Selecionado</span>
                      <span className="font-bold text-slate-900 text-xs block">{selectedInstructor.nome}</span>
                      <span className="text-xs text-slate-600 block">
                        {selectedInstructor.email}
                        {db.getOrganization(selectedInstructor.organizacaoId)?.nome
                          ? ` · ${db.getOrganization(selectedInstructor.organizacaoId)?.nome}`
                          : ''}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-blue-100 font-mono text-blue-800 font-bold text-xs">
                      {selectedInstructor.id.replace('usr_', '').toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Categoria CNH Pretendida (Estritamente baseada nos planos criados pelo instrutor) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Categoria CNH Pretendida *
                </label>
                {instructorCategories.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                    O instrutor selecionado ainda não cadastrou planos/pacotes comerciais ativos.
                  </div>
                ) : instructorCategories.length === 1 ? (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 text-xs block">
                        CNH {instructorCategories[0].value} — {instructorCategories[0].label.split(' - ')[1] || instructorCategories[0].label}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Categoria cadastrada pelo instrutor para este treinamento.
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-bold">
                      CNH {instructorCategories[0].value}
                    </span>
                  </div>
                ) : (
                  <select
                    value={formData.categoriaCnh}
                    onChange={(e) => {
                      const newCat = e.target.value as CnhCategory;
                      setFormData({ ...formData, categoriaCnh: newCat });
                      const matchingPkg = availablePackages.find((p) => p.categoriaCnh === newCat);
                      if (matchingPkg) setSelectedPackageId(matchingPkg.id);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none bg-white font-medium text-xs cursor-pointer"
                  >
                    {instructorCategories.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Pacotes de Aulas Oferecidos pelo Instrutor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-emerald-600" />
                    <span>Escolha seu Pacote de Aulas ({availablePackages.length} plano(s) do instrutor) *</span>
                  </label>
                </div>

                {/* Filtro rápido por Categoria (somente se o instrutor tiver cadastrado mais de 1 categoria) */}
                {instructorCategories.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
                    <button
                      type="button"
                      onClick={() => setPackageCategoryFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer shrink-0 ${
                        packageCategoryFilter === 'ALL'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Todos ({availablePackages.length})
                    </button>
                    {instructorCategories.map((cat) => {
                      const count = availablePackages.filter((p) => p.categoriaCnh === cat.value).length;
                      return (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => setPackageCategoryFilter(cat.value)}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1 ${
                            packageCategoryFilter === cat.value
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <span>CNH {cat.value}</span>
                          <span className="text-[10px] opacity-80">({count})</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Lista de Cards de Pacotes */}
                <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                  {displayedPackages.length > 0 ? (
                    displayedPackages.map((pkg) => {
                      const isSelected = selectedPackageId === pkg.id;
                      return (
                        <div
                          key={pkg.id}
                          onClick={() => {
                            setSelectedPackageId(pkg.id);
                            setFormData((prev) => ({ ...prev, categoriaCnh: pkg.categoriaCnh }));
                          }}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20 shadow-xs'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs">{pkg.nome}</span>
                              <span className="px-1.5 py-0.2 rounded bg-slate-900 text-white font-mono text-[10px] shrink-0">
                                CNH {pkg.categoriaCnh}
                              </span>
                              <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-semibold text-[10px] shrink-0">
                                {pkg.totalAulas} aulas práticas
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-snug">
                              {pkg.descricao || 'Curso prático veicular com suporte instrucional.'}
                            </p>
                            <span className="inline-block text-[11px] text-blue-700 font-semibold leading-tight">
                              {pkg.formaPagamento === 'A_VISTA'
                                ? 'À vista (PIX / Dinheiro)'
                                : pkg.formaPagamento === 'PARCELADO_CARTAO'
                                ? `Até ${pkg.maxParcelas || 12}x no cartão de crédito`
                                : pkg.formaPagamento === 'NEGOCIADO'
                                ? 'Condição negociada'
                                : 'À vista, parcelado no cartão ou negociado'}
                            </span>
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 shrink-0">
                            <span className="font-mono font-extrabold text-sm text-slate-900 block whitespace-nowrap">
                              {formatCurrencyBRL(pkg.valorCentavos)}
                            </span>
                            <span className={`text-xs font-bold ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>
                              {isSelected ? '✓ Selecionado' : 'Selecionar'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-600 text-xs">
                      Nenhum pacote específico nesta categoria.
                      <button
                        type="button"
                        onClick={() => setPackageCategoryFilter('ALL')}
                        className="block mx-auto mt-1 text-blue-600 font-bold hover:underline cursor-pointer"
                      >
                        Ver todos os pacotes
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Cupom de Desconto */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                    <Ticket className="w-3.5 h-3.5 text-blue-600" />
                    <span>Possui um cupom de desconto do seu instrutor?</span>
                  </div>
                  {appliedCoupon && (
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-xs text-red-600 hover:underline cursor-pointer font-semibold"
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
                      placeholder="Ex: CNH2026, ALUNO-PROMO..."
                      className="flex-1 px-3 py-1.5 border border-slate-300 rounded-xl font-mono text-xs uppercase focus:outline-none focus:border-blue-600 bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold cursor-pointer text-xs shrink-0"
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

              {/* Botão Avançar Tela 1 -> Tela 2 */}
              <div className="pt-2 flex justify-between gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 font-semibold cursor-pointer text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGoToStep2}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition-colors cursor-pointer text-xs flex items-center gap-1.5"
                >
                  <span>Avançar para Dados Pessoais</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TELA 2: DADOS PESSOAIS & ENDEREÇO */}
          {/* ========================================================= */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Alerta de Maioridade Rigorosa (Art. 140 CTB) */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>Regra de Maioridade Rigorosa (Art. 140 CTB)</span>
                </div>
                <p className="text-xs text-amber-800">
                  Não é permitido o cadastro de alunos menores que 18 anos. A data de nascimento será validada matematicamente.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Nome Completo do Aluno *</label>
                  <input
                    type="text"
                    required
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Pedro Henrique Silva"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Data de Nascimento * <span className="text-red-600 font-bold">(Mín. 18 anos)</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.dataNascimento}
                    onChange={(e) => handleBirthDateChange(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-xl focus:outline-none text-xs ${
                      ageCheck && !ageCheck.valid ? 'border-red-500 bg-red-50' : 'border-slate-300 focus:border-blue-600'
                    }`}
                  />
                  {ageCheck && (
                    <p className={`mt-1 text-[11px] font-semibold ${ageCheck.valid ? 'text-emerald-600' : 'text-red-600'}`}>
                      {ageCheck.valid
                        ? `✓ Idade confirmada: ${ageCheck.age} anos (Maior de idade)`
                        : `✗ Idade calculada: ${ageCheck.age} anos (Menor de 18 anos)`}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">CPF (com validação estrita) *</label>
                  <input
                    type="text"
                    required
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: maskCpfInput(e.target.value) })}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none font-mono text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">WhatsApp Celular *</label>
                  <input
                    type="text"
                    required
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: maskPhoneInput(e.target.value) })}
                    placeholder="(11) 98765-4321"
                    maxLength={15}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none text-xs"
                  />
                </div>

                {/* Endereço Residencial com Busca Automática por CEP */}
                <div className="sm:col-span-2">
                  <AddressCepFields
                    value={address}
                    onChange={setAddress}
                    required={true}
                    title="Endereço Residencial do Aluno (Validação por CEP)"
                    accentColor="emerald"
                  />
                </div>
              </div>

              {/* Botões Navegação Tela 2 */}
              <div className="pt-2 flex justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 font-semibold cursor-pointer text-xs flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>
                <button
                  type="button"
                  onClick={handleGoToStep3}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition-colors cursor-pointer text-xs flex items-center gap-1.5"
                >
                  <span>Avançar para Acesso & Senha</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TELA 3: CRIAÇÃO DE ACESSO & CONFIRMAÇÃO */}
          {/* ========================================================= */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Resumo Visual da Matrícula */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>Resumo da Matrícula do Aluno</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-600 font-bold uppercase block">Instrutor</span>
                    <span className="font-bold text-slate-900 block">{selectedInstructor?.nome || 'Não definido'}</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-600 font-bold uppercase block">Categoria</span>
                    <span className="font-bold text-slate-900 block">CNH {formData.categoriaCnh}</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-600 font-bold uppercase block">Aluno</span>
                    <span className="font-bold text-slate-900 block">{formData.nome || 'Aluno'}</span>
                    <span className="text-[11px] text-slate-500 font-mono">{formData.cpf}</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-600 font-bold uppercase block">Pacote & Valor</span>
                    <span className="font-bold text-slate-900 block">{chosenPackage?.nome}</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="font-bold text-emerald-700 font-mono">
                        {formatCurrencyBRL(couponResult?.valorFinalCentavos || chosenPackage?.valorCentavos || 0)}
                      </span>
                      {appliedCoupon && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">
                          Cupom {appliedCoupon.codigo}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Credenciais de Acesso */}
              <div className="space-y-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    E-mail para Login na Plataforma *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="aluno@email.com.br"
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none font-mono text-xs"
                    />
                  </div>
                  <span className="text-[11px] text-slate-600 mt-0.5 block">
                    Este e-mail será seu usuário de login no sistema.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Senha de Acesso (Mín. 6 dígitos) *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={formData.senha}
                        onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-9 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Confirmar Senha *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={formData.confirmarSenha}
                        onChange={(e) => setFormData({ ...formData, confirmarSenha: e.target.value })}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Termos e LGPD */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="termsCheck"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="termsCheck" className="text-xs text-slate-600 cursor-pointer leading-snug">
                    Declaro que li e concordo com os <strong>Termos de Uso</strong> e <strong>Política de Privacidade</strong> em conformidade com a LGPD (Lei Geral de Proteção de Dados).
                  </label>
                </div>
              </div>

              {/* Botões Navegação Tela 3 / Finalizar */}
              <div className="pt-2 flex justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 font-semibold cursor-pointer text-xs flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-md transition-colors cursor-pointer text-xs flex items-center gap-1.5"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Cadastrando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Finalizar Auto-Cadastro</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};