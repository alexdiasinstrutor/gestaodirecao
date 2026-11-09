import {
  Organization,
  User,
  Student,
  Vehicle,
  Lesson,
  AvailableSlot,
  AccountReceivable,
  PaymentRecord,
  Expense,
  Investment,
  PackageOffer,
  StudentTransferHistory,
  StudentPackageContract,
  AuditLog,
  WhatsAppReminderLog,
  SyncQueueItem,
  SaaSPlanType,
  DiscountCoupon,
  CouponRedemption,
  StudentNotification,
  InstructorCoverageProfile,
  StudentLeadRequest
} from '../types';
import { generateCPFFingerprint, maskCPF, formatDateBR } from './validation';
import {
  db as firestoreDb,
  auth,
  testConnection,
  handleFirestoreError,
  OperationType,
  firebaseConfig,
} from './firebase';
import { supabaseAdapter } from './supabaseAdapter';
import { couponStore, setCouponSyncHooks, CouponListFilter, CouponPreview } from './couponStore';
import type { CouponValidationContext } from './coupons';
import {
  collection,
  doc,
  writeBatch,
  getDocs,
  setDoc,
  getDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';

export interface MigrationCollectionProgress {
  collectionName: string;
  total: number;
  migrated: number;
  status: 'PENDENTE' | 'MIGRANDO' | 'SUCESSO' | 'ERRO';
  error?: string;
}

export interface MigrationProgress {
  totalItems: number;
  processedItems: number;
  percent: number;
  currentCollection: string;
  collections: Record<string, MigrationCollectionProgress>;
  status: 'IDLE' | 'EM_PROGRESSO' | 'CONCLUIDO' | 'ERRO';
  error?: string;
}

export interface MigrationResult {
  success: boolean;
  totalMigrated: number;
  details: Record<string, number>;
  errors: string[];
  migratedAt: string;
}

export interface CadastrosIntegrityReport {
  timestamp: string;
  totalInstructors: number;
  totalStudents: number;
  totalLessons: number;
  totalAccounts: number;
  totalPayments: number;
  orphanStudents: Student[];
  orphanLessons: Lesson[];
  orphanAccounts: AccountReceivable[];
  duplicateStudentCPFs: { cpfFingerprint: string; count: number; studentIds: string[] }[];
  scheduleConflicts: { instructorId: string; date: string; time: string; lessonIds: string[] }[];
  instructorRelations: {
    instructor: User;
    studentsCount: number;
    students: Student[];
    activeLessonsCount: number;
    totalRevenueCentavos: number;
    pendingRevenueCentavos: number;
  }[];
  isAllConsistent: boolean;
  score: number;
}

const STORAGE_KEYS = {
  ORGANIZATIONS: 'agd_organizations',
  USERS: 'agd_users',
  STUDENTS: 'agd_students',
  VEHICLES: 'agd_vehicles',
  LESSONS: 'agd_lessons',
  SLOTS: 'agd_slots',
  ACCOUNTS: 'agd_accounts',
  PAYMENTS: 'agd_payments',
  EXPENSES: 'agd_expenses',
  INVESTMENTS: 'agd_investments',
  PACKAGES: 'agd_packages',
  AUDIT: 'agd_audit',
  WHATSAPP_LOGS: 'agd_whatsapp_logs',
  SYNC_QUEUE: 'agd_sync_queue',
  CURRENT_USER: 'agd_current_user',
  SESSION_EXPIRY: 'agd_session_expiry',
  DELETED_SLOTS: 'agd_deleted_slots',
  PENDING_NEW_SLOTS: 'agd_pending_new_slots',
  PACKAGES_BACKUP: 'agd_packages_backup',
  DELETED_PACKAGES: 'agd_deleted_packages',
  PENDING_PACKAGES: 'agd_pending_packages',
  VEHICLES_BACKUP: 'agd_vehicles_backup',
  DELETED_VEHICLES: 'agd_deleted_vehicles',
  PENDING_VEHICLES: 'agd_pending_vehicles',
  STUDENT_NOTIFICATIONS: 'agd_student_notifications',
  INSTRUCTOR_COVERAGE: 'agd_instructor_coverage',
  STUDENT_LEADS: 'agd_student_leads',
  SEEDED: 'agd_seeded_v5'
};

function notifyDataChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('agd:data-synced'));
  }
}

// Duração padrão da sessão ativa do usuário (60 minutos)
export const SESSION_DURATION_MS = 60 * 60 * 1000;

// Seed dataset de demonstração (opcional para testes)
export function seedDemoData() {
  const orgId = 'org_direcao_certa_01';

  const defaultOrg: Organization = {
    id: orgId,
    nome: 'Gestão AD (Auto Direção)',
    tipo: 'INSTRUTOR_AUTONOMO',
    cnpjCpf: '32.194.852/0001-44',
    telefone: '(11) 98765-4321',
    email: 'contato@direcaosegura.com.br',
    cidade: 'Belo Horizonte',
    estado: 'MG',
    status: 'ATIVO',
    plano: 'MASTER',
    criadoEm: '2026-01-10T08:00:00Z'
  };

  const users: User[] = [
    {
      id: 'usr_admin_cassio',
      organizacaoId: orgId,
      nome: 'Cássio Costa (Administrador Master)',
      email: 'cassiordcosta@gmail.com',
      papel: 'SUPER_ADMIN',
      telefone: '(11) 98765-4321',
      cpfUltimos4: '3300',
      cpfFingerprint: generateCPFFingerprint('11122233300'),
      cpfMascarado: '***.***.333-00',
      cpfCompleto: '111.222.333-00',
      twoFactorAtivo: true,
      ultimoAcesso: new Date().toISOString()
    },
    {
      id: 'usr_admin_master',
      organizacaoId: orgId,
      nome: 'Administrador do Sistema',
      email: 'admin@sistema.com.br',
      papel: 'SUPER_ADMIN',
      telefone: '(11) 99999-0000',
      cpfUltimos4: '0001',
      cpfFingerprint: generateCPFFingerprint('00000000001'),
      cpfMascarado: '***.***.000-01',
      cpfCompleto: '000.000.000-01',
      twoFactorAtivo: true,
      ultimoAcesso: new Date().toISOString()
    },
    {
      id: 'usr_instrutor_carlos',
      organizacaoId: orgId,
      nome: 'Carlos Eduardo Mendes (Instrutor Credenciado Detran)',
      email: 'instrutor@autoescola.com',
      papel: 'ADMIN_ORG',
      telefone: '(11) 98452-1199',
      cpfUltimos4: '8901',
      cpfFingerprint: generateCPFFingerprint('12345678901'),
      cpfMascarado: '***.***.789-01',
      cpfCompleto: '123.456.789-01',
      twoFactorAtivo: true,
      ultimoAcesso: new Date().toISOString()
    },
    {
      id: 'usr_instrutor_roberto',
      organizacaoId: orgId,
      nome: 'Roberto Carlos Vasconcelos (Instrutor Credenciado Detran)',
      email: 'roberto@autoescola.com',
      papel: 'INSTRUTOR',
      telefone: '(11) 97766-5544',
      cpfUltimos4: '3322',
      cpfFingerprint: generateCPFFingerprint('55544433322'),
      cpfMascarado: '***.***.333-22',
      cpfCompleto: '555.444.333-22',
      twoFactorAtivo: true,
      ultimoAcesso: new Date().toISOString()
    },
    {
      id: 'usr_aluno_pedro',
      organizacaoId: orgId,
      nome: 'Pedro Henrique Silva (Aluno)',
      email: 'aluno@teste.com.br',
      papel: 'ALUNO',
      telefone: '(11) 97123-4567',
      cpfUltimos4: '2100',
      cpfFingerprint: generateCPFFingerprint('98765432100'),
      cpfMascarado: '***.***.321-00',
      cpfCompleto: '987.654.321-00',
      twoFactorAtivo: true,
      ultimoAcesso: new Date().toISOString()
    }
  ];

  const students: Student[] = [
    {
      id: 'stu_pedro_silva',
      organizacaoId: orgId,
      instrutorId: 'usr_instrutor_carlos',
      nome: 'Pedro Henrique Silva',
      email: 'aluno@teste.com.br',
      telefone: '(11) 97123-4567',
      cpfMascarado: '***.***.834-22',
      cpfFingerprint: generateCPFFingerprint('98765432100'),
      dataNascimento: '2003-05-14', // 22 anos - maior de 18
      idade: 22,
      categoriaCnh: 'B',
      status: 'EM_ANDAMENTO',
      aulasCumpridas: 8,
      totalAulasContratadas: 20,
      habilidades: {
        baliza: 8.5,
        controleEmbreagem: 7.0,
        transitoPesado: 6.5,
        conversoesCruzamentos: 8.0,
        rodoviaVelocidade: 7.5,
        sinalizacaoPreferencia: 9.0,
        posturaDefensiva: 8.5,
        simuladoExame: 7.8
      },
      observacoesInstrutor: 'Excelente noção espacial na baliza. Precisa treinar mais o ponto de embreagem em ladeira íngreme sem afogar.',
      dataCadastro: '2026-02-01'
    },
    {
      id: 'stu_mariana_costa',
      organizacaoId: orgId,
      instrutorId: 'usr_instrutor_carlos',
      nome: 'Mariana Costa Nogueira',
      email: 'mariana.costa@email.com',
      telefone: '(11) 98834-9912',
      cpfMascarado: '***.***.551-90',
      cpfFingerprint: generateCPFFingerprint('23456789012'),
      dataNascimento: '2001-11-20', // 24 anos
      idade: 24,
      categoriaCnh: 'B',
      status: 'EM_ANDAMENTO',
      aulasCumpridas: 14,
      totalAulasContratadas: 20,
      habilidades: {
        baliza: 9.5,
        controleEmbreagem: 9.0,
        transitoPesado: 8.5,
        conversoesCruzamentos: 9.0,
        rodoviaVelocidade: 9.0,
        sinalizacaoPreferencia: 10.0,
        posturaDefensiva: 9.5,
        simuladoExame: 9.2
      },
      observacoesInstrutor: 'Aluna muito segura e atenta aos retrovisores e faixas de pedestre. Pronta para agendar simulado final.',
      dataCadastro: '2026-01-15'
    },
    {
      id: 'stu_lucas_almeida',
      organizacaoId: orgId,
      instrutorId: 'usr_instrutor_carlos',
      nome: 'Lucas Almeida Santos',
      email: 'lucas.almeida@email.com',
      telefone: '(11) 96541-2389',
      cpfMascarado: '***.***.918-44',
      cpfFingerprint: generateCPFFingerprint('34567890123'),
      dataNascimento: '2005-03-08', // 21 anos
      idade: 21,
      categoriaCnh: 'A',
      status: 'EM_ANDAMENTO',
      aulasCumpridas: 4,
      totalAulasContratadas: 20,
      habilidades: {
        baliza: 6.0,
        controleEmbreagem: 5.5,
        transitoPesado: 5.0,
        conversoesCruzamentos: 6.5,
        rodoviaVelocidade: 6.0,
        sinalizacaoPreferencia: 7.0,
        posturaDefensiva: 7.0,
        simuladoExame: 5.8
      },
      observacoesInstrutor: 'Iniciando circuito de cones e prancha de equilíbrio. Mostrou boa evolução no equilíbrio em baixa velocidade.',
      dataCadastro: '2026-03-01'
    },
    {
      id: 'stu_beatriz_ferreira',
      organizacaoId: orgId,
      instrutorId: 'usr_instrutor_carlos',
      nome: 'Beatriz Ferreira Lima',
      email: 'beatriz.ferreira@email.com',
      telefone: '(11) 97412-8855',
      cpfMascarado: '***.***.302-19',
      cpfFingerprint: generateCPFFingerprint('45678901234'),
      dataNascimento: '2007-01-12', // 19 anos
      idade: 19,
      categoriaCnh: 'AB',
      status: 'EM_ANDAMENTO',
      aulasCumpridas: 18,
      totalAulasContratadas: 20,
      habilidades: {
        baliza: 8.8,
        controleEmbreagem: 8.5,
        transitoPesado: 8.0,
        conversoesCruzamentos: 8.5,
        rodoviaVelocidade: 8.5,
        sinalizacaoPreferencia: 9.0,
        posturaDefensiva: 8.5,
        simuladoExame: 8.7
      },
      observacoesInstrutor: 'Faltam 2 aulas para conclusão do pacote B. Aprovada com nota 8.7 no simulado oficial do Detran.',
      dataCadastro: '2026-01-05'
    }
  ];

  const vehicles: Vehicle[] = [
    {
      id: 'veh_onix_01',
      organizacaoId: orgId,
      modelo: 'Chevrolet Onix 1.0 Flex Manual (Duplo Comando)',
      placa: 'BRA-2A19',
      ano: 2024,
      tipo: 'CARRO',
      status: 'DISPONIVEL',
      proximaRevisaoKm: 20000,
      kmAtual: 14850
    },
    {
      id: 'veh_mobi_02',
      organizacaoId: orgId,
      modelo: 'Fiat Mobi Like 1.0 Fire (Duplo Comando)',
      placa: 'SPX-4F20',
      ano: 2023,
      tipo: 'CARRO',
      status: 'DISPONIVEL',
      proximaRevisaoKm: 30000,
      kmAtual: 28400
    },
    {
      id: 'veh_cg_moto',
      organizacaoId: orgId,
      modelo: 'Honda CG 160 Fan ESDI',
      placa: 'MTO-8B77',
      ano: 2024,
      tipo: 'MOTO',
      status: 'DISPONIVEL',
      proximaRevisaoKm: 8000,
      kmAtual: 4200
    }
  ];

  // Datas relativas
  const today = new Date();
  const formatYMD = (d: Date) => d.toISOString().split('T')[0];

  const todayStr = formatYMD(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = formatYMD(tomorrow);

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = formatYMD(yesterday);

  const slots: AvailableSlot[] = [
    // Hoje (Turnos: Manhã 06h-12h, Tarde 13h-18h e Noite 19h-00h)
    { id: 'slt_00', organizacaoId: orgId, instrutorId: 'usr_instrutor_carlos', data: todayStr, horaInicio: '06:00', horaFim: '06:50', bloqueado: false },
    { id: 'slt_01', organizacaoId: orgId, instrutorId: 'usr_instrutor_carlos', data: todayStr, horaInicio: '08:00', horaFim: '08:50', bloqueado: false },
    { id: 'slt_02', organizacaoId: orgId, instrutorId: 'usr_instrutor_carlos', data: todayStr, horaInicio: '09:00', horaFim: '09:50', bloqueado: false },
    { id: 'slt_03', organizacaoId: orgId, instrutorId: 'usr_instrutor_carlos', data: todayStr, horaInicio: '10:00', horaFim: '10:50', bloqueado: false },
    { id: 'slt_04', organizacaoId: orgId, instrutorId: 'usr_instrutor_carlos', data: todayStr, horaInicio: '11:00', horaFim: '11:50', bloqueado: false },
    { id: 'slt_05', organizacaoId: orgId, instrutorId: 'usr_instrutor_carlos', data: todayStr, horaInicio: '12:00', horaFim: '13:00', bloqueado: true, motivoBloqueio: 'Horário de Almoço' },
    { id: 'slt_06', organizacaoId: orgId, instrutorId: 'usr_instrutor_carlos', data: todayStr, horaInicio: '14:00', horaFim: '14:50', bloqueado: false },
    { id: 'slt_07', organizacaoId: orgId, instrutorId: 'usr_instrutor_carlos', data: todayStr, horaInicio: '15:00', horaFim: '15:50', bloqueado: false },
    { id: 'slt_08', organizacaoId: orgId, instrutorId: 'usr_instrutor_carlos', data: todayStr, horaInicio: '16:00', horaFim: '16:50', bloqueado: false },
    { id: 'slt_19', organizacaoId: orgId, instrutorId: 'usr_instrutor_carlos', data: todayStr, horaInicio: '19:00', horaFim: '19:50', bloqueado: false },
    { id: 'slt_20', organizacaoId: orgId, instrutorId: 'usr_instrutor_carlos', data: todayStr, horaInicio: '20:00', horaFim: '20:50', bloqueado: false },
    { id: 'slt_21', organizacaoId: orgId, instrutorId: 'usr_instrutor_carlos', data: todayStr, horaInicio: '21:00', horaFim: '21:50', bloqueado: false },
    { id: 'slt_22', organizacaoId: orgId, instrutorId: 'usr_instrutor_carlos', data: todayStr, horaInicio: '22:00', horaFim: '22:50', bloqueado: false },
    { id: 'slt_23', organizacaoId: orgId, instrutorId: 'usr_instrutor_carlos', data: todayStr, horaInicio: '23:00', horaFim: '23:50', bloqueado: false },
    // Amanhã
    { id: 'slt_09', organizacaoId: orgId, instrutorId: 'usr_instrutor_carlos', data: tomorrowStr, horaInicio: '06:00', horaFim: '06:50', bloqueado: false },
    { id: 'slt_10', organizacaoId: orgId, instrutorId: 'usr_instrutor_carlos', data: tomorrowStr, horaInicio: '08:00', horaFim: '08:50', bloqueado: false },
    { id: 'slt_11', organizacaoId: orgId, instrutorId: 'usr_instrutor_carlos', data: tomorrowStr, horaInicio: '09:00', horaFim: '09:50', bloqueado: false },
    { id: 'slt_12', organizacaoId: orgId, instrutorId: 'usr_instrutor_carlos', data: tomorrowStr, horaInicio: '10:00', horaFim: '10:50', bloqueado: false },
    { id: 'slt_13', organizacaoId: orgId, instrutorId: 'usr_instrutor_carlos', data: tomorrowStr, horaInicio: '14:00', horaFim: '14:50', bloqueado: false },
    { id: 'slt_14', organizacaoId: orgId, instrutorId: 'usr_instrutor_carlos', data: tomorrowStr, horaInicio: '19:00', horaFim: '19:50', bloqueado: false },
    { id: 'slt_15', organizacaoId: orgId, instrutorId: 'usr_instrutor_carlos', data: tomorrowStr, horaInicio: '20:00', horaFim: '20:50', bloqueado: false }
  ];

  const lessons: Lesson[] = [
    {
      id: 'lsn_01',
      organizacaoId: orgId,
      alunoId: 'stu_pedro_silva',
      instrutorId: 'usr_instrutor_carlos',
      veiculoId: 'veh_onix_01',
      data: yesterdayStr,
      horaInicio: '09:00',
      horaFim: '09:50',
      topico: 'Baliza entre cones e estacionamento a 45°',
      status: 'CONCLUIDA',
      observacaoInstrutor: 'Acertou o alinhamento de retrovisor na primeira tentativa.',
      notaAula: 9,
      competenciasTrabalhadas: ['Baliza', 'Sinalização', 'Uso dos Retrovisores'],
      criadoEm: '2026-03-01T10:00:00Z'
    },
    {
      id: 'lsn_02',
      organizacaoId: orgId,
      alunoId: 'stu_pedro_silva',
      instrutorId: 'usr_instrutor_carlos',
      veiculoId: 'veh_onix_01',
      data: todayStr,
      horaInicio: '14:00',
      horaFim: '14:50',
      topico: 'Controle de embreagem em aclive (Rampa) e cruzamentos',
      status: 'AGENDADA',
      criadoEm: '2026-03-02T11:00:00Z'
    },
    {
      id: 'lsn_03',
      organizacaoId: orgId,
      alunoId: 'stu_mariana_costa',
      instrutorId: 'usr_instrutor_carlos',
      veiculoId: 'veh_onix_01',
      data: todayStr,
      horaInicio: '10:00',
      horaFim: '10:50',
      topico: 'Trânsito pesado na avenida principal e conversão à esquerda',
      status: 'CONCLUIDA',
      observacaoInstrutor: 'Executou trocas de marcha suaves sem tranco.',
      notaAula: 9.5,
      competenciasTrabalhadas: ['Trânsito Pesado', 'Conversões', 'Postura Defensiva'],
      criadoEm: '2026-03-02T12:00:00Z'
    },
    {
      id: 'lsn_04',
      organizacaoId: orgId,
      alunoId: 'stu_beatriz_ferreira',
      instrutorId: 'usr_instrutor_carlos',
      veiculoId: 'veh_mobi_02',
      data: tomorrowStr,
      horaInicio: '09:00',
      horaFim: '09:50',
      topico: 'Simulado de exame prático de direção no percurso do Detran',
      status: 'AGENDADA',
      criadoEm: '2026-03-03T14:00:00Z'
    }
  ];

  const packages: PackageOffer[] = [
    {
      id: 'pkg_cnh_b_20',
      organizacaoId: orgId,
      instrutorId: 'usr_instrutor_carlos',
      instrutorNome: 'Carlos Eduardo Mendes',
      nome: 'Pacote Completo CNH B (20 Aulas Práticas)',
      totalAulas: 20,
      categoriaCnh: 'B',
      valorCentavos: 180000, // R$ 1.800,00
      formaPagamento: 'TODAS',
      maxParcelas: 12,
      descontoAvistaPercentual: 5,
      descricao: 'Curso prático completo obrigatório para categoria Carro com simulados e suporte a exame.',
      ativo: true,
      criadoEm: '2026-02-01'
    },
    {
      id: 'pkg_cnh_a_20',
      organizacaoId: orgId,
      instrutorId: 'usr_instrutor_carlos',
      instrutorNome: 'Carlos Eduardo Mendes',
      nome: 'Pacote CNH Moto A (20 Aulas)',
      totalAulas: 20,
      categoriaCnh: 'A',
      valorCentavos: 140000, // R$ 1.400,00
      formaPagamento: 'PARCELADO_CARTAO',
      maxParcelas: 10,
      descontoAvistaPercentual: 3,
      descricao: 'Treinamento completo na pista de moto com cones, prancha e frenagem de emergência.',
      ativo: true,
      criadoEm: '2026-02-01'
    },
    {
      id: 'pkg_revisao_05',
      organizacaoId: orgId,
      instrutorId: 'usr_instrutor_carlos',
      instrutorNome: 'Carlos Eduardo Mendes',
      nome: 'Módulo Intensivo de Baliza & Rampa (5 Aulas)',
      totalAulas: 5,
      categoriaCnh: 'B',
      valorCentavos: 48000, // R$ 480,00
      formaPagamento: 'A_VISTA',
      maxParcelas: 1,
      descontoAvistaPercentual: 10,
      descricao: 'Aulas adicionais focadas exclusivamente nos pontos mais difíceis da prova prática.',
      ativo: true,
      criadoEm: '2026-02-15'
    },
    {
      id: 'pkg_negociado_flex',
      organizacaoId: orgId,
      instrutorId: 'usr_instrutor_carlos',
      instrutorNome: 'Carlos Eduardo Mendes',
      nome: 'Plano Negociado Flex (Entrada + Parcelas PIX)',
      totalAulas: 20,
      categoriaCnh: 'B',
      valorCentavos: 195000, // R$ 1.950,00
      formaPagamento: 'NEGOCIADO',
      maxParcelas: 6,
      descricao: 'Condições personalizadas com entrada de R$ 500 e restante parcelado direto com o instrutor.',
      ativo: true,
      criadoEm: '2026-03-01'
    }
  ];

  // Contas a receber (uma vencida para testar o lembrete de WhatsApp!)
  const overdueDate = new Date(today);
  overdueDate.setDate(today.getDate() - 4); // 4 dias em atraso
  const overdueDateStr = formatYMD(overdueDate);

  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + 15);
  const futureDateStr = formatYMD(futureDate);

  const accounts: AccountReceivable[] = [
    {
      id: 'rec_pedro_parc_01',
      organizacaoId: orgId,
      alunoId: 'stu_pedro_silva',
      pacoteId: 'pkg_cnh_b_20',
      descricao: 'Pacote CNH B 20 Aulas - Parcela 1/2',
      valorTotalCentavos: 90000,
      valorPagoCentavos: 90000,
      saldoDevedorCentavos: 0,
      dataVencimento: yesterdayStr,
      status: 'PAGO',
      criadoEm: '2026-02-01T10:00:00Z'
    },
    {
      id: 'rec_pedro_parc_02',
      organizacaoId: orgId,
      alunoId: 'stu_pedro_silva',
      pacoteId: 'pkg_cnh_b_20',
      descricao: 'Pacote CNH B 20 Aulas - Parcela 2/2 (Atrasada)',
      valorTotalCentavos: 90000,
      valorPagoCentavos: 0,
      saldoDevedorCentavos: 90000,
      dataVencimento: overdueDateStr,
      status: 'VENCIDO',
      pixPayload: '00020126580014BR.GOV.BCB.PIX0114financeiro@direcaosegura.com.br5204000053039865406900.005802BR5925DIRECAO SEGURA LTDA6009SAO PAULO62070503PDR026304',
      criadoEm: '2026-02-01T10:00:00Z'
    },
    {
      id: 'rec_mariana_total',
      organizacaoId: orgId,
      alunoId: 'stu_mariana_costa',
      pacoteId: 'pkg_cnh_b_20',
      descricao: 'Pacote CNH B 20 Aulas - Pagamento À Vista PIX',
      valorTotalCentavos: 180000,
      valorPagoCentavos: 180000,
      saldoDevedorCentavos: 0,
      dataVencimento: '2026-01-20',
      status: 'PAGO',
      criadoEm: '2026-01-15T14:00:00Z'
    },
    {
      id: 'rec_lucas_parc_01',
      organizacaoId: orgId,
      alunoId: 'stu_lucas_almeida',
      pacoteId: 'pkg_cnh_a_20',
      descricao: 'Pacote CNH Moto A - Parcela 1/3 (Em Aberto)',
      valorTotalCentavos: 47000,
      valorPagoCentavos: 0,
      saldoDevedorCentavos: 47000,
      dataVencimento: futureDateStr,
      status: 'PENDENTE',
      pixPayload: '00020126580014BR.GOV.BCB.PIX0114financeiro@direcaosegura.com.br5204000053039865406470.005802BR5925DIRECAO SEGURA LTDA6009SAO PAULO62070503LCS016304',
      criadoEm: '2026-03-01T09:00:00Z'
    }
  ];

  const payments: PaymentRecord[] = [
    {
      id: 'pay_01',
      organizacaoId: orgId,
      contaReceberId: 'rec_pedro_parc_01',
      alunoId: 'stu_pedro_silva',
      valorCentavos: 90000,
      metodo: 'PIX',
      dataPagamento: yesterdayStr,
      comprovanteNumero: 'PIX-E8729312893',
      observacao: 'Pagamento recebido instantâneo via chave PIX'
    },
    {
      id: 'pay_02',
      organizacaoId: orgId,
      contaReceberId: 'rec_mariana_total',
      alunoId: 'stu_mariana_costa',
      valorCentavos: 180000,
      metodo: 'CARTAO_CREDITO',
      parcelas: 6,
      taxaCentavos: 8900,
      dataPagamento: '2026-01-20',
      comprovanteNumero: 'CART-AUT-9921',
      observacao: 'Cartão de Crédito Visa em 6x com split de taxas'
    }
  ];

  const expenses: Expense[] = [
    {
      id: 'exp_01',
      organizacaoId: orgId,
      descricao: 'Combustível - Abastecimento Gasolina Onix (Placa BRA-2A19)',
      categoria: 'COMBUSTIVEL',
      veiculoId: 'veh_onix_01',
      valorCentavos: 24500, // R$ 245,00
      dataVencimento: todayStr,
      dataPagamento: todayStr,
      status: 'PAGA'
    },
    {
      id: 'exp_02',
      organizacaoId: orgId,
      descricao: 'Troca de Óleo e Filtros - Mobi Like (Placa SPX-4F20)',
      categoria: 'MANUTENCAO_VEICULO',
      veiculoId: 'veh_mobi_02',
      valorCentavos: 38000, // R$ 380,00
      dataVencimento: yesterdayStr,
      dataPagamento: yesterdayStr,
      status: 'PAGA'
    },
    {
      id: 'exp_03',
      organizacaoId: orgId,
      descricao: 'Seguro Frota Cobertura Completa Duplo Comando',
      categoria: 'SEGURO',
      valorCentavos: 52000, // R$ 520,00
      dataVencimento: futureDateStr,
      status: 'PENDENTE'
    },
    {
      id: 'exp_04',
      organizacaoId: orgId,
      descricao: 'Taxa Anual de Credenciamento Instrutor Detran',
      categoria: 'TAXAS_DETRAN',
      valorCentavos: 18000, // R$ 180,00
      dataVencimento: todayStr,
      dataPagamento: todayStr,
      status: 'PAGA'
    }
  ];

  const investments: Investment[] = [
    {
      id: 'inv_reserva_01',
      organizacaoId: orgId,
      titulo: 'Reserva de Emergência & Reparos Mecânicos',
      categoria: 'RESERVA_EMERGENCIA',
      valorMetaCentavos: 1500000, // R$ 15.000,00
      valorAcumuladoCentavos: 850000, // R$ 8.500,00
      aporteMensalCentavos: 100000, // R$ 1.000,00/mês
      dataInicio: '2025-08-01',
      dataPrevisao: '2026-12-31',
      notas: 'Garante 3 meses de custos operacionais e franquia de seguro.'
    },
    {
      id: 'inv_frota_02',
      organizacaoId: orgId,
      titulo: 'Fundo para Aquisição de 2º Veículo Automático',
      categoria: 'FROTA_NOVO_VEICULO',
      valorMetaCentavos: 6000000, // R$ 60.000,00
      valorAcumuladoCentavos: 2800000, // R$ 28.000,00
      aporteMensalCentavos: 250000, // R$ 2.500,00/mês
      dataInicio: '2025-01-01',
      dataPrevisao: '2027-06-30',
      notas: 'Atender à crescente demanda por CNH em carro automático (PcD e nova lei).'
    }
  ];

  const auditLogs: AuditLog[] = [
    {
      id: 'aud_01',
      organizacaoId: orgId,
      usuarioId: 'usr_instrutor_carlos',
      usuarioNome: 'Carlos Eduardo Mendes',
      acao: 'CRIACAO_PACOTE',
      entidade: 'Pacote',
      entidadeId: 'pkg_cnh_b_20',
      detalhes: 'Criado pacote de 20 aulas CNH B no valor de R$ 1.800,00',
      timestamp: '2026-02-01T10:00:00Z'
    },
    {
      id: 'aud_02',
      organizacaoId: orgId,
      usuarioId: 'usr_instrutor_carlos',
      usuarioNome: 'Carlos Eduardo Mendes',
      acao: 'REGISTRO_PAGAMENTO',
      entidade: 'Pagamento',
      entidadeId: 'pay_01',
      detalhes: 'Registrado pagamento PIX de R$ 900,00 para Pedro Henrique Silva',
      timestamp: yesterdayStr + 'T14:30:00Z'
    }
  ];

  localStorage.setItem(STORAGE_KEYS.ORGANIZATIONS, JSON.stringify([defaultOrg]));
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));
  localStorage.setItem(STORAGE_KEYS.SLOTS, JSON.stringify(slots));
  localStorage.setItem(STORAGE_KEYS.LESSONS, JSON.stringify(lessons));
  localStorage.setItem(STORAGE_KEYS.PACKAGES, JSON.stringify(packages));
  localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
  localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
  localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
  localStorage.setItem(STORAGE_KEYS.INVESTMENTS, JSON.stringify(investments));
  localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(auditLogs));
  localStorage.setItem(STORAGE_KEYS.WHATSAPP_LOGS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.SEEDED, 'true');
}

// Inicializa o banco de dados limpo e oficial para produção (Sem dados fictícios)
export function seedCleanProductionData(): { org: Organization; user: User } {
  const orgId = 'org_direcao_certa_01';

  const defaultOrg: Organization = {
    id: orgId,
    nome: 'Gestão AD (Auto Direção)',
    tipo: 'INSTRUTOR_AUTONOMO',
    cnpjCpf: '32.194.852/0001-44',
    telefone: '(11) 98765-4321',
    email: 'cassiordcosta@gmail.com',
    cidade: 'Belo Horizonte',
    estado: 'MG',
    status: 'ATIVO',
    plano: 'MASTER',
    criadoEm: new Date().toISOString()
  };

  const masterUser: User = {
    id: 'usr_admin_cassio',
    organizacaoId: orgId,
    nome: 'Cássio Costa (Administrador Master)',
    email: 'cassiordcosta@gmail.com',
    papel: 'SUPER_ADMIN',
    telefone: '(11) 98765-4321',
    cpfUltimos4: '3300',
    cpfFingerprint: generateCPFFingerprint('11122233300'),
    cpfMascarado: '***.***.333-00',
    cpfCompleto: '111.222.333-00',
    twoFactorAtivo: false,
    ultimoAcesso: new Date().toISOString(),
    aprovadoPorMaster: true
  };

  const existingOrgs = readList<Organization>(STORAGE_KEYS.ORGANIZATIONS).filter(
    (o) => o.id !== orgId
  );
  const existingUsers = readList<User>(STORAGE_KEYS.USERS).filter(
    (u) =>
      u.id !== masterUser.id &&
      u.id !== 'usr_carlos_01' &&
      u.id !== 'usr_roberto_02' &&
      u.id !== 'usr_aluno_pedro'
  );
  const existingStudents = readList<Student>(STORAGE_KEYS.STUDENTS).filter(
    (s) =>
      s.id !== 'stu_pedro_silva' &&
      s.id !== 'stu_mariana_souza' &&
      s.id !== 'stu_lucas_almeida' &&
      s.id !== 'stu_juliana_costa' &&
      s.nome !== 'Pedro Henrique Silva'
  );
  const existingVehicles = readList<Vehicle>(STORAGE_KEYS.VEHICLES).filter(
    (v) => v.id !== 'veh_onix_01' && v.id !== 'veh_mobi_02' && v.id !== 'veh_cg_moto'
  );
  const existingBackupVehicles = readList<Vehicle>(STORAGE_KEYS.VEHICLES_BACKUP).filter(
    (v) => v.id !== 'veh_onix_01' && v.id !== 'veh_mobi_02' && v.id !== 'veh_cg_moto'
  );
  const mergedVehiclesMap = new Map<string, Vehicle>();
  existingBackupVehicles.forEach((v) => mergedVehiclesMap.set(v.id, v));
  existingVehicles.forEach((v) => mergedVehiclesMap.set(v.id, v));

  const existingPackages = readList<PackageOffer>(STORAGE_KEYS.PACKAGES).filter(
    (p) =>
      p.id !== 'pkg_cnh_b_20' &&
      p.id !== 'pkg_cnh_a_20' &&
      p.id !== 'pkg_cnh_ab_40' &&
      p.id !== 'pkg_reforco_05'
  );
  const existingBackupPackages = readList<PackageOffer>(STORAGE_KEYS.PACKAGES_BACKUP).filter(
    (p) =>
      p.id !== 'pkg_cnh_b_20' &&
      p.id !== 'pkg_cnh_a_20' &&
      p.id !== 'pkg_cnh_ab_40' &&
      p.id !== 'pkg_reforco_05'
  );
  const mergedPackagesMap = new Map<string, PackageOffer>();
  existingBackupPackages.forEach((p) => mergedPackagesMap.set(p.id, p));
  existingPackages.forEach((p) => mergedPackagesMap.set(p.id, p));

  writeList(STORAGE_KEYS.ORGANIZATIONS, [defaultOrg, ...existingOrgs]);
  writeList(STORAGE_KEYS.USERS, [masterUser, ...existingUsers]);
  writeList(STORAGE_KEYS.STUDENTS, existingStudents);
  writeList(STORAGE_KEYS.VEHICLES, Array.from(mergedVehiclesMap.values()));
  writeList(STORAGE_KEYS.VEHICLES_BACKUP, Array.from(mergedVehiclesMap.values()));
  writeList(STORAGE_KEYS.SLOTS, readList<AvailableSlot>(STORAGE_KEYS.SLOTS));
  writeList(STORAGE_KEYS.LESSONS, readList<Lesson>(STORAGE_KEYS.LESSONS));
  writeList(STORAGE_KEYS.PACKAGES, Array.from(mergedPackagesMap.values()));
  writeList(STORAGE_KEYS.PACKAGES_BACKUP, Array.from(mergedPackagesMap.values()));
  writeList(STORAGE_KEYS.ACCOUNTS, readList<AccountReceivable>(STORAGE_KEYS.ACCOUNTS));
  writeList(STORAGE_KEYS.PAYMENTS, readList<PaymentRecord>(STORAGE_KEYS.PAYMENTS));
  writeList(STORAGE_KEYS.EXPENSES, readList<Expense>(STORAGE_KEYS.EXPENSES));
  writeList(STORAGE_KEYS.INVESTMENTS, readList<Investment>(STORAGE_KEYS.INVESTMENTS));
  writeList(STORAGE_KEYS.AUDIT, readList<AuditLog>(STORAGE_KEYS.AUDIT));
  writeList(STORAGE_KEYS.WHATSAPP_LOGS, readList<WhatsAppReminderLog>(STORAGE_KEYS.WHATSAPP_LOGS));
  writeList(STORAGE_KEYS.SYNC_QUEUE, readList<SyncQueueItem>(STORAGE_KEYS.SYNC_QUEUE));
  localStorage.setItem(STORAGE_KEYS.SEEDED, 'true');

  // Nunca auto-loga em nenhum usuário (incluindo Master): exige login manual com e-mail e senha
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  localStorage.removeItem(STORAGE_KEYS.SESSION_EXPIRY);

  // Persiste no Supabase caso esteja conectado
  if (supabaseAdapter.enabled) {
    supabaseAdapter.saveOrganization(defaultOrg).catch(console.error);
    supabaseAdapter.saveUser(masterUser).catch(console.error);
  }

  return { org: defaultOrg, user: masterUser };
}

// Sincronização inicial com o Supabase (Hydration & Safe Merge)
export async function syncFromSupabase(): Promise<{ synced: boolean; source: 'supabase' | 'clean' }> {
  if (!supabaseAdapter.enabled) return { synced: false, source: 'clean' };

  try {
    const [remoteOrgs, remoteUsers] = await Promise.all([
      supabaseAdapter.getOrganizations(),
      supabaseAdapter.getUsers()
    ]);

    // Se o Supabase estiver completamente sem registros, sincroniza a base local inicial com o Supabase
    if (remoteOrgs.length === 0 && remoteUsers.length === 0) {
      const localOrgs = readList<Organization>(STORAGE_KEYS.ORGANIZATIONS);
      const localUsers = readList<User>(STORAGE_KEYS.USERS);
      if (localOrgs.length > 0 && localUsers.length > 0) {
        for (const o of localOrgs) {
          await supabaseAdapter.saveOrganization(o).catch(console.error);
        }
        for (const u of localUsers) {
          await supabaseAdapter.saveUser(u).catch(console.error);
        }
      } else {
        seedCleanProductionData();
      }
      return { synced: true, source: 'clean' };
    }

    // Merge seguro com precedência no Supabase (garante que instrutores cadastrados no banco apareçam localmente)
    const localOrgs = readList<Organization>(STORAGE_KEYS.ORGANIZATIONS);
    const mergedOrgsMap = new Map<string, Organization>();
    localOrgs.forEach((o) => mergedOrgsMap.set(o.id, o));
    remoteOrgs.forEach((o) => mergedOrgsMap.set(o.id, o));
    writeList(STORAGE_KEYS.ORGANIZATIONS, Array.from(mergedOrgsMap.values()));

    const localUsers = readList<User>(STORAGE_KEYS.USERS);
    const mergedUsersMap = new Map<string, User>();
    localUsers.forEach((u) => mergedUsersMap.set(u.id, u));
    remoteUsers.forEach((u) => {
      const existing = mergedUsersMap.get(u.id);
      mergedUsersMap.set(u.id, {
        ...u,
        assinaturaUrl: u.assinaturaUrl || existing?.assinaturaUrl,
        assinaturaConfig: u.assinaturaConfig || existing?.assinaturaConfig
      });
    });
    writeList(STORAGE_KEYS.USERS, Array.from(mergedUsersMap.values()));

    // Carrega todos os registros remotos do Supabase de todas as organizações
    const [
      students,
      vehicles,
      lessons,
      slots,
      accounts,
      payments,
      expenses,
      investments,
      packages,
      notificationLogs,
      coverageLogs,
      studentLeadLogs,
      packageMetaLogs,
      studentMetaLogs,
      signatureMetaLogs
    ] = await Promise.all([
      supabaseAdapter.getStudents(),
      supabaseAdapter.getVehicles(),
      supabaseAdapter.getLessons(),
      supabaseAdapter.getSlots(),
      supabaseAdapter.getAccountsReceivable(),
      supabaseAdapter.getPayments(),
      supabaseAdapter.getExpenses(),
      supabaseAdapter.getInvestments(),
      supabaseAdapter.getPackages(),
      supabaseAdapter.getNotificationAuditLogs(),
      supabaseAdapter.getCoverageAuditLogs(),
      supabaseAdapter.getStudentLeadAuditLogs(),
      supabaseAdapter.getPackageMetaAuditLogs(),
      supabaseAdapter.getStudentMetaAuditLogs(),
      supabaseAdapter.getSignatureMetaAuditLogs()
    ]);

    // Aplica backup de assinaturas digitais recuperadas do cofre de auditoria
    if (signatureMetaLogs && signatureMetaLogs.length > 0) {
      const sortedSig = [...signatureMetaLogs].sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
      for (const log of sortedSig) {
        if (log.detalhes) {
          try {
            const parsed = JSON.parse(log.detalhes);
            if (parsed && parsed.userId && parsed.signatureUrl) {
              const u = mergedUsersMap.get(parsed.userId);
              if (u) {
                if (!u.assinaturaUrl) u.assinaturaUrl = parsed.signatureUrl;
                if (!u.assinaturaConfig && parsed.signatureConfig) u.assinaturaConfig = parsed.signatureConfig;
              }
            }
          } catch {
            // ignore
          }
        }
      }
      writeList(STORAGE_KEYS.USERS, Array.from(mergedUsersMap.values()));
    }

    const studentMetaMap = new Map<string, Student>();
    if (studentMetaLogs && studentMetaLogs.length > 0) {
      // Ordenado do mais antigo para o mais recente para que o mais recente prevaleça
      const sortedMeta = [...studentMetaLogs].sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
      for (const log of sortedMeta) {
        if (log.detalhes) {
          try {
            const parsed = JSON.parse(log.detalhes) as Student;
            if (parsed && parsed.id) {
              studentMetaMap.set(parsed.id, parsed);
            }
          } catch {
            // ignore
          }
        }
      }
    }

    // Merge seguro de alunos: combina tabela students, metadados de ficha (StudentFichaMeta) e dados locais
    {
      const localStudents = readList<Student>(STORAGE_KEYS.STUDENTS);
      const remoteStudentIds = new Set((students || []).map((s) => s.id));
      const mergedStudentsMap = new Map<string, Student>();
      localStudents.forEach((st) => mergedStudentsMap.set(st.id, st));
      if (students && students.length > 0) {
        students.forEach((st) => {
          const localExisting = mergedStudentsMap.get(st.id);
          const metaExisting = studentMetaMap.get(st.id);
          mergedStudentsMap.set(st.id, {
            ...localExisting,
            ...st,
            ...(metaExisting
              ? {
                  categoriaCnh: metaExisting.categoriaCnh || st.categoriaCnh,
                  pacoteId: metaExisting.pacoteId ?? st.pacoteId ?? localExisting?.pacoteId,
                  pacoteNome: metaExisting.pacoteNome ?? st.pacoteNome ?? localExisting?.pacoteNome,
                  totalAulasContratadas: metaExisting.totalAulasContratadas || st.totalAulasContratadas,
                  aulasCumpridas: Math.max(st.aulasCumpridas || 0, metaExisting.aulasCumpridas || 0),
                  habilidades: metaExisting.habilidades || st.habilidades || localExisting?.habilidades,
                  observacoesInstrutor:
                    metaExisting.observacoesInstrutor ?? st.observacoesInstrutor ?? localExisting?.observacoesInstrutor,
                  cep: metaExisting.cep || st.cep || localExisting?.cep,
                  estado: metaExisting.estado || st.estado || localExisting?.estado,
                  cidade: metaExisting.cidade || st.cidade || localExisting?.cidade,
                  bairro: metaExisting.bairro || st.bairro || localExisting?.bairro,
                  logradouro: metaExisting.logradouro || st.logradouro || localExisting?.logradouro,
                  numero: metaExisting.numero || st.numero || localExisting?.numero,
                  complemento: metaExisting.complemento || st.complemento || localExisting?.complemento,
                  instrutorId: metaExisting.instrutorId || st.instrutorId || localExisting?.instrutorId || '',
                  historicoTransferencias:
                    metaExisting.historicoTransferencias && metaExisting.historicoTransferencias.length > 0
                      ? metaExisting.historicoTransferencias
                      : st.historicoTransferencias && st.historicoTransferencias.length > 0
                      ? st.historicoTransferencias
                      : localExisting?.historicoTransferencias || [],
                  contratosPacotes:
                    Array.isArray(metaExisting?.contratosPacotes) && metaExisting.contratosPacotes.length > 0
                      ? metaExisting.contratosPacotes
                      : Array.isArray(st.contratosPacotes) && st.contratosPacotes.length > 0
                      ? st.contratosPacotes
                      : Array.isArray(localExisting?.contratosPacotes)
                      ? localExisting.contratosPacotes
                      : []
                }
              : {
                  pacoteId: st.pacoteId || localExisting?.pacoteId,
                  pacoteNome: st.pacoteNome || localExisting?.pacoteNome,
                  cep: st.cep || localExisting?.cep,
                  estado: st.estado || localExisting?.estado,
                  cidade: st.cidade || localExisting?.cidade,
                  bairro: st.bairro || localExisting?.bairro,
                  logradouro: st.logradouro || localExisting?.logradouro,
                  numero: st.numero || localExisting?.numero,
                  complemento: st.complemento || localExisting?.complemento,
                  contratosPacotes:
                    Array.isArray(st.contratosPacotes) && st.contratosPacotes.length > 0
                      ? st.contratosPacotes
                      : Array.isArray(localExisting?.contratosPacotes)
                      ? localExisting.contratosPacotes
                      : []
                })
          });
        });
      }
      studentMetaMap.forEach((metaSt, stId) => {
        if (!mergedStudentsMap.has(stId)) {
          mergedStudentsMap.set(stId, metaSt);
        }
      });

      // Reconstrução automática de alunos a partir de usuários com papel ALUNO caso a ficha ainda não conste em students
      const allKnownUsers = Array.from(mergedUsersMap.values());
      const alunoUsers = allKnownUsers.filter((u) => u.papel === 'ALUNO');
      for (const alu of alunoUsers) {
        const alreadyInStudents = Array.from(mergedStudentsMap.values()).some(
          (s) =>
            (s.email && alu.email && s.email.toLowerCase() === alu.email.toLowerCase()) ||
            (s.cpfFingerprint && alu.cpfFingerprint && s.cpfFingerprint === alu.cpfFingerprint)
        );
        if (!alreadyInStudents) {
          const orgInstructor = allKnownUsers.find(
            (u) => u.organizacaoId === alu.organizacaoId && (u.papel === 'ADMIN_ORG' || u.papel === 'INSTRUTOR')
          );
          const reconstructedStudent: Student = {
            id: alu.id.replace(/^usr_/, 'stu_'),
            organizacaoId: alu.organizacaoId,
            instrutorId: orgInstructor?.id || '',
            nome: alu.nome,
            email: alu.email,
            telefone: alu.telefone,
            cpfMascarado: alu.cpfMascarado || '***.***.000-00',
            cpfFingerprint: alu.cpfFingerprint,
            dataNascimento: '1990-01-01',
            idade: 30,
            categoriaCnh: 'B',
            cep: alu.cep,
            estado: alu.estado,
            cidade: alu.cidade || 'Betim',
            bairro: alu.bairro,
            logradouro: alu.logradouro,
            numero: alu.numero,
            complemento: alu.complemento,
            status: 'EM_ANDAMENTO',
            aulasCumpridas: 0,
            totalAulasContratadas: 20,
            pacoteId: `pkg_cnh_b_20_${alu.organizacaoId}`,
            pacoteNome: 'Pacote CNH B (20 Aulas Práticas)',
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
            observacoesInstrutor: `Aluno matriculado com instrutor ${orgInstructor?.nome || 'Credenciado'}.`,
            dataCadastro: (alu.ultimoAcesso || new Date().toISOString()).slice(0, 10)
          };
          mergedStudentsMap.set(reconstructedStudent.id, reconstructedStudent);
        }
      }

      const finalStudents = Array.from(mergedStudentsMap.values());
      writeList(STORAGE_KEYS.STUDENTS, finalStudents);

      // Envia para a nuvem quaisquer alunos locais/reconstruídos que ainda não estavam no banco remoto
      for (const st of finalStudents) {
        if (!remoteStudentIds.has(st.id)) {
          supabaseAdapter.saveStudent(st).catch(() => {});
        }
      }
    }

    // Sincronização bidirecional e protegida de veículos dos instrutores (Sem perda de cadastros locais e respeito estrito a exclusões)
    {
      const localDeleted = readList<string>(STORAGE_KEYS.DELETED_VEHICLES);
      let remoteDeleted: string[] = [];
      try {
        remoteDeleted = await supabaseAdapter.getDeletedVehicleIds();
      } catch {
        // ignore
      }
      const deletedVehicleIds = new Set([...localDeleted, ...remoteDeleted]);
      writeList(STORAGE_KEYS.DELETED_VEHICLES, Array.from(deletedVehicleIds));

      if (deletedVehicleIds.size > 0) {
        supabaseAdapter.deleteVehiclesBatch(Array.from(deletedVehicleIds)).catch(() => {});
      }
      const pendingVehicleIds = new Set(readList<string>(STORAGE_KEYS.PENDING_VEHICLES));
      const localVehicles = readList<Vehicle>(STORAGE_KEYS.VEHICLES);
      const backupVehicles = readList<Vehicle>(STORAGE_KEYS.VEHICLES_BACKUP);
      const demoVehIds = new Set(['veh_onix_01', 'veh_mobi_02', 'veh_cg_moto']);

      const mergedVehiclesMap = new Map<string, Vehicle>();
      backupVehicles.forEach((v) => {
        if (!deletedVehicleIds.has(v.id) && !demoVehIds.has(v.id)) {
          mergedVehiclesMap.set(v.id, v);
        }
      });
      localVehicles.forEach((v) => {
        if (!deletedVehicleIds.has(v.id) && !demoVehIds.has(v.id)) {
          mergedVehiclesMap.set(v.id, v);
        }
      });

      const remoteVehicleIds = new Set((vehicles || []).map((v) => v.id));
      if (vehicles && vehicles.length > 0) {
        vehicles.forEach((rv) => {
          if (deletedVehicleIds.has(rv.id) || demoVehIds.has(rv.id)) return;
          const localExisting = mergedVehiclesMap.get(rv.id);
          if (localExisting) {
            const localNewer =
              pendingVehicleIds.has(rv.id) ||
              (localExisting.atualizadoEm &&
                (!rv.atualizadoEm || localExisting.atualizadoEm >= rv.atualizadoEm));
            if (localNewer) {
              mergedVehiclesMap.set(rv.id, {
                ...rv,
                ...localExisting
              });
            } else {
              mergedVehiclesMap.set(rv.id, {
                ...localExisting,
                ...rv,
                instrutorId: rv.instrutorId || localExisting.instrutorId,
                instrutorNome: rv.instrutorNome || localExisting.instrutorNome,
                cambio: rv.cambio || localExisting.cambio,
                categoriaCnh: rv.categoriaCnh || localExisting.categoriaCnh,
                duploComando: rv.duploComando ?? localExisting.duploComando,
                adaptadoPcd: rv.adaptadoPcd ?? localExisting.adaptadoPcd,
                cor: rv.cor || localExisting.cor
              });
            }
          } else {
            mergedVehiclesMap.set(rv.id, rv);
          }
        });
      }

      const finalVehicles = Array.from(mergedVehiclesMap.values());
      writeList(STORAGE_KEYS.VEHICLES, finalVehicles);
      writeList(STORAGE_KEYS.VEHICLES_BACKUP, finalVehicles);

      // Envia para o Supabase quaisquer veículos locais ou pendentes que ainda não estavam sincronizados
      const vehiclesToPush = finalVehicles.filter(
        (v) => !remoteVehicleIds.has(v.id) || pendingVehicleIds.has(v.id)
      );
      if (vehiclesToPush.length > 0) {
        supabaseAdapter
          .saveVehiclesBatch(vehiclesToPush)
          .then(() => {
            writeList(STORAGE_KEYS.PENDING_VEHICLES, []);
          })
          .catch(() => {});
      }
    }

    if (lessons && lessons.length > 0) writeList(STORAGE_KEYS.LESSONS, lessons);

    // Gestão segura e bidirecional de slots (agenda de horários disponíveis)
    const deletedSlotIds = new Set(readList<string>(STORAGE_KEYS.DELETED_SLOTS));
    if (deletedSlotIds.size > 0) {
      supabaseAdapter.deleteSlotsBatch(Array.from(deletedSlotIds)).catch(() => {});
    }

    if (slots) {
      const localSlots = readList<AvailableSlot>(STORAGE_KEYS.SLOTS);
      const pendingNewIds = new Set(readList<string>(STORAGE_KEYS.PENDING_NEW_SLOTS));
      const cleanRemote = slots.filter((s) => !deletedSlotIds.has(s.id));

      // Se o Supabase já possui slots (ou se não há slots pendentes de criação), o Supabase é a fonte da verdade
      // (para garantir que horários removidos pelo instrutor desapareçam imediatamente da tela de todos os alunos).
      const mergedSlotsMap = new Map<string, AvailableSlot>();
      if (cleanRemote.length === 0 && deletedSlotIds.size === 0 && localSlots.length > 0) {
        // Caso o banco remoto ainda não tenha recebido a carga inicial de slots
        localSlots.forEach((s) => mergedSlotsMap.set(s.id, s));
        supabaseAdapter.saveSlotsBatch(localSlots).catch(console.error);
      } else {
        // Preserva apenas slots recém-criados localmente que ainda estão em trânsito (PENDING_NEW_SLOTS)
        localSlots
          .filter((s) => pendingNewIds.has(s.id) && !deletedSlotIds.has(s.id))
          .forEach((s) => mergedSlotsMap.set(s.id, s));
        // Aplica todos os slots ativos do Supabase
        cleanRemote.forEach((s) => mergedSlotsMap.set(s.id, s));
      }

      const mergedSlots = Array.from(mergedSlotsMap.values());
      writeList(STORAGE_KEYS.SLOTS, mergedSlots);

      // Limpa DELETED_SLOTS que já não constam mais no Supabase
      const remoteRawIds = new Set(slots.map((s) => s.id));
      const remainingDeleted = Array.from(deletedSlotIds).filter((id) => remoteRawIds.has(id));
      writeList(STORAGE_KEYS.DELETED_SLOTS, remainingDeleted);
    }

    // Sincroniza notificações de aulas desmarcadas para os alunos
    const localNotifs = readList<StudentNotification>(STORAGE_KEYS.STUDENT_NOTIFICATIONS);
    const notifMap = new Map<string, StudentNotification>();
    localNotifs.forEach((n) => notifMap.set(n.id, n));

    if (notificationLogs && notificationLogs.length > 0) {
      for (const log of notificationLogs) {
        if (log.detalhes) {
          try {
            const parsed = JSON.parse(log.detalhes) as StudentNotification;
            if (parsed && parsed.id && parsed.alunoId) {
              const existing = notifMap.get(parsed.id);
              notifMap.set(parsed.id, {
                ...parsed,
                lida: Boolean(existing?.lida || parsed.lida)
              });
            }
          } catch {
            // Ignora log que não seja JSON de StudentNotification
          }
        }
      }
    }

    // Fallback adicional a partir de aulas canceladas pelo instrutor com marcador de notificação
    const activeLessonsList = lessons && lessons.length > 0 ? lessons : readList<Lesson>(STORAGE_KEYS.LESSONS);
    const allUsersList = readList<User>(STORAGE_KEYS.USERS);
    for (const lsn of activeLessonsList) {
      if (lsn.status === 'CANCELADA' && lsn.observacaoInstrutor?.includes('[DESMARCADA_PELO_INSTRUTOR]')) {
        const notifId = `notif_lsn_${lsn.id}`;
        if (!notifMap.has(notifId)) {
          const inst = allUsersList.find((u) => u.id === lsn.instrutorId);
          const instrutorNome = inst?.nome || 'Instrutor';
          notifMap.set(notifId, {
            id: notifId,
            organizacaoId: lsn.organizacaoId,
            alunoId: lsn.alunoId,
            instrutorId: lsn.instrutorId,
            instrutorNome,
            aulaId: lsn.id,
            dataAula: lsn.data,
            horaAula: lsn.horaInicio,
            tipo: 'AULA_DESMARCADA',
            titulo: 'Horário de Aula Desmarcado pelo Instrutor',
            mensagem: `O horário das ${lsn.horaInicio} da data ${formatDateBR(lsn.data)} foi desmarcado pelo instrutor ${instrutorNome}. Por favor, remarque sua aula para uma data e horário disponível na agenda.`,
            lida: false,
            criadoEm: lsn.criadoEm || new Date().toISOString()
          });
        }
      }
    }

    writeList(
      STORAGE_KEYS.STUDENT_NOTIFICATIONS,
      Array.from(notifMap.values()).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
    );

    if (accounts && accounts.length > 0) {
      const localAccounts = readList<AccountReceivable>(STORAGE_KEYS.ACCOUNTS);
      const mergedAccountsMap = new Map<string, AccountReceivable>();
      localAccounts.forEach((a) => mergedAccountsMap.set(a.id, a));
      accounts.forEach((a) => mergedAccountsMap.set(a.id, a));
      writeList(STORAGE_KEYS.ACCOUNTS, Array.from(mergedAccountsMap.values()));
    }
    if (payments && payments.length > 0) writeList(STORAGE_KEYS.PAYMENTS, payments);
    if (expenses && expenses.length > 0) writeList(STORAGE_KEYS.EXPENSES, expenses);
    if (investments && investments.length > 0) writeList(STORAGE_KEYS.INVESTMENTS, investments);
    // Sincronização bidirecional e protegida de pacotes e planos dos instrutores (PROIBIDO apagar ou inventar pacotes)
    {
      const deletedPkgIds = new Set(readList<string>(STORAGE_KEYS.DELETED_PACKAGES));
      if (deletedPkgIds.size > 0) {
        supabaseAdapter.deletePackagesBatch(Array.from(deletedPkgIds)).catch(() => {});
      }
      const pendingPkgIds = new Set(readList<string>(STORAGE_KEYS.PENDING_PACKAGES));
      const localPkgs = readList<PackageOffer>(STORAGE_KEYS.PACKAGES);
      const backupPkgs = readList<PackageOffer>(STORAGE_KEYS.PACKAGES_BACKUP);
      const remotePkgIds = new Set((packages || []).map((p) => p.id));

      const pkgMetaMap = new Map<string, PackageOffer>();
      if (packageMetaLogs && packageMetaLogs.length > 0) {
        const sortedPkgMeta = [...packageMetaLogs].sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
        for (const log of sortedPkgMeta) {
          if (log.detalhes) {
            try {
              const parsed = JSON.parse(log.detalhes) as PackageOffer;
              if (parsed && parsed.id && !deletedPkgIds.has(parsed.id)) {
                pkgMetaMap.set(parsed.id, parsed);
              }
            } catch {
              // ignore
            }
          }
        }
      }

      const isGenericSeedPackage = (p: PackageOffer) =>
        p.nome === 'Pacote CNH B (20 Aulas Práticas)' &&
        p.totalAulas === 20 &&
        p.valorCentavos === 180000;

      const mergedPkgsMap = new Map<string, PackageOffer>();
      // 1. Primeiro restaura do cofre local de backup e da lista local
      backupPkgs.forEach((bp) => {
        if (!deletedPkgIds.has(bp.id)) mergedPkgsMap.set(bp.id, bp);
      });
      localPkgs.forEach((lp) => {
        if (!deletedPkgIds.has(lp.id)) mergedPkgsMap.set(lp.id, lp);
      });

      // 2. Mescla pacotes remotos sem jamais sobrescrever edições locais mais recentes ou customizadas pelo instrutor
      if (packages && packages.length > 0) {
        packages.forEach((rp) => {
          if (deletedPkgIds.has(rp.id)) return;
          const localExisting = mergedPkgsMap.get(rp.id);
          const metaExisting = pkgMetaMap.get(rp.id);

          // Escolhe entre rp e metaExisting qual versão remota é mais atualizada ou customizada
          const bestRemote: PackageOffer =
            metaExisting &&
            ((metaExisting.atualizadoEm && (!rp.atualizadoEm || metaExisting.atualizadoEm >= rp.atualizadoEm)) ||
              (isGenericSeedPackage(rp) && !isGenericSeedPackage(metaExisting)))
              ? { ...rp, ...metaExisting }
              : {
                  ...metaExisting,
                  ...rp,
                  instrutorId: rp.instrutorId || metaExisting?.instrutorId,
                  instrutorNome: rp.instrutorNome || metaExisting?.instrutorNome,
                  atualizadoEm: rp.atualizadoEm || metaExisting?.atualizadoEm
                };

          if (localExisting) {
            const localIsProtected =
              pendingPkgIds.has(rp.id) ||
              (localExisting.atualizadoEm &&
                (!bestRemote.atualizadoEm || localExisting.atualizadoEm >= bestRemote.atualizadoEm)) ||
              (isGenericSeedPackage(bestRemote) && !isGenericSeedPackage(localExisting));

            if (localIsProtected) {
              mergedPkgsMap.set(rp.id, {
                ...bestRemote,
                ...localExisting,
                instrutorId: localExisting.instrutorId || bestRemote.instrutorId,
                instrutorNome: localExisting.instrutorNome || bestRemote.instrutorNome
              });
            } else {
              mergedPkgsMap.set(rp.id, {
                ...localExisting,
                ...bestRemote,
                instrutorId: bestRemote.instrutorId || localExisting.instrutorId,
                instrutorNome: bestRemote.instrutorNome || localExisting.instrutorNome
              });
            }
          } else {
            mergedPkgsMap.set(rp.id, bestRemote);
          }
        });
      }

      // 3. Restaura pacotes que estavam nos logs de metadados da nuvem e ainda não constavam no map
      pkgMetaMap.forEach((metaPkg, pkgId) => {
        if (!deletedPkgIds.has(pkgId) && !mergedPkgsMap.has(pkgId)) {
          mergedPkgsMap.set(pkgId, metaPkg);
        }
      });

      const finalPackages = Array.from(mergedPkgsMap.values());
      writeList(STORAGE_KEYS.PACKAGES, finalPackages);
      writeList(STORAGE_KEYS.PACKAGES_BACKUP, finalPackages);
      db.sanitizePackages();

      // 4. Envia para o Supabase todos os pacotes locais, customizados ou pendentes para blindar contra perda
      const sanitizedPackages = readList<PackageOffer>(STORAGE_KEYS.PACKAGES);
      writeList(STORAGE_KEYS.PACKAGES_BACKUP, sanitizedPackages);
      const pkgsToPush = sanitizedPackages.filter(
        (pk) => !remotePkgIds.has(pk.id) || pendingPkgIds.has(pk.id) || !isGenericSeedPackage(pk)
      );
      if (pkgsToPush.length > 0) {
        supabaseAdapter
          .savePackagesBatch(pkgsToPush)
          .then(() => {
            writeList(STORAGE_KEYS.PENDING_PACKAGES, []);
          })
          .catch(() => {});
      }

      const remainingDeletedPkgs = Array.from(deletedPkgIds).filter((id) => remotePkgIds.has(id));
      writeList(STORAGE_KEYS.DELETED_PACKAGES, remainingDeletedPkgs);
    }

    // Sincroniza perfis de cobertura geográfica dos instrutores (Raio 5-40km, Cidades Atendidas, Câmbio e Veículos)
    if (coverageLogs && coverageLogs.length > 0) {
      const localCoverages = readList<InstructorCoverageProfile>(STORAGE_KEYS.INSTRUCTOR_COVERAGE);
      const covMap = new Map<string, InstructorCoverageProfile>();
      localCoverages.forEach((c) => covMap.set(c.instrutorId, c));
      for (const log of coverageLogs) {
        if (log.detalhes) {
          try {
            const parsed = JSON.parse(log.detalhes) as InstructorCoverageProfile;
            if (parsed && parsed.instrutorId) {
              const existing = covMap.get(parsed.instrutorId);
              if (!existing || (parsed.atualizadoEm && parsed.atualizadoEm >= existing.atualizadoEm)) {
                covMap.set(parsed.instrutorId, parsed);
              }
            }
          } catch {
            // ignore
          }
        }
      }
      writeList(STORAGE_KEYS.INSTRUCTOR_COVERAGE, Array.from(covMap.values()));
    }

    // Sincroniza solicitações de alunos à procura de instrutor (Demanda Reversa)
    if (studentLeadLogs && studentLeadLogs.length > 0) {
      const localLeads = readList<StudentLeadRequest>(STORAGE_KEYS.STUDENT_LEADS);
      const leadsMap = new Map<string, StudentLeadRequest>();
      localLeads.forEach((l) => leadsMap.set(l.id, l));
      for (const log of studentLeadLogs) {
        if (log.detalhes) {
          try {
            const parsed = JSON.parse(log.detalhes) as StudentLeadRequest;
            if (parsed && parsed.id) {
              leadsMap.set(parsed.id, parsed);
            }
          } catch {
            // ignore
          }
        }
      }
      writeList(
        STORAGE_KEYS.STUDENT_LEADS,
        Array.from(leadsMap.values()).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
      );
    }

    // Cupons de desconto: só sobrescreve a base local se a tabela remota existir e tiver dados
    try {
      const [remoteCoupons, remoteRedemptions] = await Promise.all([
        supabaseAdapter.getCoupons(),
        supabaseAdapter.getCouponRedemptions()
      ]);
      if (remoteCoupons.length > 0) {
        couponStore.replaceAll(remoteCoupons, remoteRedemptions.length > 0 ? remoteRedemptions : undefined);
      }
    } catch (couponErr) {
      console.warn('[Cupons] Hidratação a partir do Supabase ignorada:', couponErr);
    }

    notifyDataChange();
    return { synced: true, source: 'supabase' };
  } catch (err) {
    console.error('Erro na sincronização com Supabase:', err);
    return { synced: false, source: 'clean' };
  }
}

// Initialize seed if not already done
export function initDatabase() {
  const seeded = localStorage.getItem(STORAGE_KEYS.SEEDED);
  const students = readList<Student>(STORAGE_KEYS.STUDENTS);
  const isLegacyDemo = students.some(
    (s) => s.id === 'stu_pedro_silva' || s.id === 'stu_mariana_souza' || s.nome === 'Pedro Henrique Silva'
  );

  // Se nunca foi iniciado ou se ainda tem resquício dos alunos fictícios antigos (Pedro Henrique, Mariana, etc.):
  if (!seeded || isLegacyDemo) {
    seedCleanProductionData();
    return;
  } else {
    // Migration: update existing organization name if it still has the old name
    try {
      const orgsRaw = localStorage.getItem(STORAGE_KEYS.ORGANIZATIONS);
      if (orgsRaw) {
        const orgs: Organization[] = JSON.parse(orgsRaw);
        let changed = false;
        orgs.forEach((o) => {
          if (
            o.nome === 'Autoescola & Instrutoria Direção Segura' ||
            o.nome.includes('Direção Segura') ||
            o.nome === 'Sistema de Administração de Gestão de Direção'
          ) {
            o.nome = 'Gestão AD (Auto Direção)';
            changed = true;
          }
        });
        if (changed) {
          localStorage.setItem(STORAGE_KEYS.ORGANIZATIONS, JSON.stringify(orgs));
        }
      }
    } catch (e) {
      console.error('Erro na migração de organização:', e);
    }

    // Migration: ensure cassiordcosta@gmail.com is present as SUPER_ADMIN
    try {
      const usersRaw = localStorage.getItem(STORAGE_KEYS.USERS);
      if (usersRaw) {
        const users: User[] = JSON.parse(usersRaw);
        const cassioIndex = users.findIndex((u) => u.email.toLowerCase() === 'cassiordcosta@gmail.com');
        if (cassioIndex === -1) {
          const orgs = readList<Organization>(STORAGE_KEYS.ORGANIZATIONS);
          const orgId = orgs[0]?.id || 'org_direcao_certa_01';
          users.unshift({
            id: 'usr_admin_cassio',
            organizacaoId: orgId,
            nome: 'Cássio Costa (Administrador Master)',
            email: 'cassiordcosta@gmail.com',
            papel: 'SUPER_ADMIN',
            telefone: '(11) 98765-4321',
            cpfUltimos4: '3300',
            cpfFingerprint: generateCPFFingerprint('11122233300'),
            cpfMascarado: '***.***.333-00',
            cpfCompleto: '111.222.333-00',
            twoFactorAtivo: true,
            ultimoAcesso: new Date().toISOString()
          });
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        } else {
          // Ensure papel is SUPER_ADMIN and CPF is set
          if (users[cassioIndex].papel !== 'SUPER_ADMIN' || !users[cassioIndex].cpfCompleto) {
            users[cassioIndex].papel = 'SUPER_ADMIN';
            users[cassioIndex].cpfCompleto = '111.222.333-00';
            users[cassioIndex].cpfMascarado = '***.***.333-00';
            users[cassioIndex].cpfFingerprint = generateCPFFingerprint('11122233300');
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
          }
        }
      }
    } catch (e) {
      console.error('Erro ao verificar usuário admin master:', e);
    }
  }

  // Higieniza a base para garantir que nenhum pacote de categoria aleatória seja mantido
  db.sanitizePackages();
}

// Helpers for generic read/write
function readList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error(`Erro ao ler do storage [${key}]:`, err);
    return [];
  }
}

function writeList<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (err) {
    console.error(`Erro ao gravar no storage [${key}]:`, err);
  }
}

// Dual-write dos cupons para o Supabase (tabelas discount_coupons e coupon_redemptions)
setCouponSyncHooks({
  saveCoupon: (c) => supabaseAdapter.saveCoupon(c),
  deleteCoupon: (id) => supabaseAdapter.deleteCoupon(id),
  saveRedemption: (r) => supabaseAdapter.saveCouponRedemption(r)
});

/**
 * Pacotes oficiais padrão do sistema para novas organizações e instrutores
 */
export function getDefaultOfficialPackages(orgId: string, instrutorId?: string): PackageOffer[] {
  return [
    {
      id: `pkg_cnh_b_20_${orgId}`,
      organizacaoId: orgId,
      instrutorId,
      nome: 'Pacote CNH B (20 Aulas Práticas)',
      categoriaCnh: 'B',
      totalAulas: 20,
      valorCentavos: 180000,
      formaPagamento: 'TODAS',
      maxParcelas: 12,
      descontoAvistaPercentual: 5,
      descricao: 'Treinamento prático veicular completo com suporte e simulados de exame.',
      ativo: true,
      criadoEm: new Date().toISOString()
    },
    {
      id: `pkg_cnh_a_20_${orgId}`,
      organizacaoId: orgId,
      instrutorId,
      nome: 'Pacote CNH Moto A (20 Aulas Práticas)',
      categoriaCnh: 'A',
      totalAulas: 20,
      valorCentavos: 140000,
      formaPagamento: 'TODAS',
      maxParcelas: 12,
      descontoAvistaPercentual: 5,
      descricao: 'Treinamento completo em pista de motocicleta, equilíbrio e circuitos oficiais do Detran.',
      ativo: true,
      criadoEm: new Date().toISOString()
    },
    {
      id: `pkg_cnh_ab_40_${orgId}`,
      organizacaoId: orgId,
      instrutorId,
      nome: 'Pacote Combinado CNH A+B (40 Aulas Práticas)',
      categoriaCnh: 'AB',
      totalAulas: 40,
      valorCentavos: 290000,
      formaPagamento: 'TODAS',
      maxParcelas: 12,
      descontoAvistaPercentual: 7,
      descricao: 'Formação completa dupla: 20 aulas de carro (B) + 20 aulas de moto (A) com valor promocional.',
      ativo: true,
      criadoEm: new Date().toISOString()
    },
    {
      id: `pkg_reforco_05_${orgId}`,
      organizacaoId: orgId,
      instrutorId,
      nome: 'Pacote Reforço Pré-Exame (5 Aulas Práticas)',
      categoriaCnh: 'B',
      totalAulas: 5,
      valorCentavos: 45000,
      formaPagamento: 'TODAS',
      maxParcelas: 6,
      descontoAvistaPercentual: 5,
      descricao: 'Aulas práticas de refinamento para baliza, controle de embreagem e percurso de exame.',
      ativo: true,
      criadoEm: new Date().toISOString()
    },
    {
      id: `pkg_habilitados_10_${orgId}`,
      organizacaoId: orgId,
      instrutorId,
      nome: 'Treinamento para Habilitados / Perda do Medo (10 Aulas)',
      categoriaCnh: 'B',
      totalAulas: 10,
      valorCentavos: 85000,
      formaPagamento: 'TODAS',
      maxParcelas: 10,
      descontoAvistaPercentual: 5,
      descricao: 'Aulas especializadas para quem já tem CNH mas precisa perder o medo de dirigir no trânsito real.',
      ativo: true,
      criadoEm: new Date().toISOString()
    },
    {
      id: `pkg_cnh_d_20_${orgId}`,
      organizacaoId: orgId,
      instrutorId,
      nome: 'Pacote CNH D - Passageiros / Van / Ônibus (20 Aulas)',
      categoriaCnh: 'D',
      totalAulas: 20,
      valorCentavos: 240000,
      formaPagamento: 'TODAS',
      maxParcelas: 12,
      descontoAvistaPercentual: 5,
      descricao: 'Capacitação prática profissional para transporte de passageiros em micro-ônibus e van.',
      ativo: true,
      criadoEm: new Date().toISOString()
    }
  ];
}

export const db = {
  // Current Session User (Sessão persistente por no mínimo 60 minutos)
  getCurrentUser(): User | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (!raw) return null;

      const expiryRaw = localStorage.getItem(STORAGE_KEYS.SESSION_EXPIRY);
      if (expiryRaw) {
        const expiry = parseInt(expiryRaw, 10);
        if (Number.isFinite(expiry) && Date.now() > expiry) {
          // Sessão expirou após 60min de inatividade
          localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
          localStorage.removeItem(STORAGE_KEYS.SESSION_EXPIRY);
          return null;
        }
      } else {
        // Se já existia um usuário logado sem timestamp de expiração, define 60 minutos
        localStorage.setItem(STORAGE_KEYS.SESSION_EXPIRY, (Date.now() + SESSION_DURATION_MS).toString());
      }

      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  setCurrentUser(user: User | null): void {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      localStorage.setItem(STORAGE_KEYS.SESSION_EXPIRY, (Date.now() + SESSION_DURATION_MS).toString());
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      localStorage.removeItem(STORAGE_KEYS.SESSION_EXPIRY);
    }
  },

  refreshSession(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (raw) {
        localStorage.setItem(STORAGE_KEYS.SESSION_EXPIRY, (Date.now() + SESSION_DURATION_MS).toString());
      }
    } catch (e) {
      console.warn('Erro ao renovar timestamp da sessão:', e);
    }
  },

  getSessionRemainingSeconds(): number {
    try {
      const expiryRaw = localStorage.getItem(STORAGE_KEYS.SESSION_EXPIRY);
      if (!expiryRaw) return 0;
      const expiry = parseInt(expiryRaw, 10);
      const remainingMs = expiry - Date.now();
      return remainingMs > 0 ? Math.floor(remainingMs / 1000) : 0;
    } catch {
      return 0;
    }
  },

  // Organizations
  getOrganizations(): Organization[] {
    return readList<Organization>(STORAGE_KEYS.ORGANIZATIONS);
  },

  getOrganization(orgId: string): Organization | undefined {
    return this.getOrganizations().find((o) => o.id === orgId);
  },

  createOrganization(org: Organization): void {
    const list = this.getOrganizations();
    list.push(org);
    writeList(STORAGE_KEYS.ORGANIZATIONS, list);
    supabaseAdapter.saveOrganization(org).catch(console.error);
    this.addAuditLog(org.id, 'SISTEMA', 'CRIACAO_ORGANIZACAO', 'Organizacao', org.id, `Criada organização ${org.nome}`);
  },

  async createOrganizationAsync(org: Organization): Promise<void> {
    const list = this.getOrganizations();
    const index = list.findIndex((o) => o.id === org.id);
    if (index >= 0) {
      list[index] = org;
    } else {
      list.push(org);
    }
    writeList(STORAGE_KEYS.ORGANIZATIONS, list);
    await supabaseAdapter.saveOrganization(org);
    this.addAuditLog(org.id, 'SISTEMA', 'CRIACAO_ORGANIZACAO', 'Organizacao', org.id, `Criada organização ${org.nome}`);
  },

  saveOrganization(org: Organization): void {
    const list = this.getOrganizations();
    const index = list.findIndex((o) => o.id === org.id);
    if (index >= 0) {
      list[index] = org;
    } else {
      list.push(org);
    }
    writeList(STORAGE_KEYS.ORGANIZATIONS, list);
    supabaseAdapter.saveOrganization(org).catch(console.error);
  },

  async saveOrganizationAsync(org: Organization): Promise<void> {
    const list = this.getOrganizations();
    const index = list.findIndex((o) => o.id === org.id);
    if (index >= 0) {
      list[index] = org;
    } else {
      list.push(org);
    }
    writeList(STORAGE_KEYS.ORGANIZATIONS, list);
    await supabaseAdapter.saveOrganization(org);
  },

  updateOrganization(org: Organization, actorId: string): void {
    const list = this.getOrganizations();
    const index = list.findIndex((o) => o.id === org.id);
    if (index >= 0) {
      list[index] = org;
      writeList(STORAGE_KEYS.ORGANIZATIONS, list);
      supabaseAdapter.saveOrganization(org).catch(console.error);
      this.addAuditLog(
        org.id,
        actorId,
        'ATUALIZACAO_ORGANIZACAO',
        'Organizacao',
        org.id,
        `Atualizada organização ${org.nome} (Plano: ${org.plano}, Status: ${org.status})`
      );
    }
  },

  deleteOrganization(orgId: string, actorId: string): { success: boolean; error?: string } {
    const list = this.getOrganizations();
    const org = list.find((o) => o.id === orgId);
    if (!org) return { success: false, error: 'Organização não encontrada.' };

    if (list.length <= 1) {
      return { success: false, error: 'Não é permitido excluir a única organização do sistema.' };
    }

    const filtered = list.filter((o) => o.id !== orgId);
    writeList(STORAGE_KEYS.ORGANIZATIONS, filtered);
    this.addAuditLog(
      orgId,
      actorId,
      'EXCLUSAO_ORGANIZACAO',
      'Organizacao',
      orgId,
      `Excluída organização ${org.nome} (${org.cnpjCpf})`
    );
    return { success: true };
  },

  generateOrganizationAccessKey(orgId: string, actorId: string): { key: string; date: string } {
    const list = this.getOrganizations();
    const org = list.find((o) => o.id === orgId);
    const randomHex = Math.floor(100000 + Math.random() * 900000);
    const key = `KEY-${org?.tipo === 'AUTOESCOLA_CFC' ? 'CFC' : 'INST'}-${randomHex}`;
    const date = new Date().toISOString();

    if (org) {
      org.chaveAcesso = key;
      org.chaveAcessoGeradaEm = date;
      writeList(STORAGE_KEYS.ORGANIZATIONS, list);
      this.addAuditLog(
        orgId,
        actorId,
        'GERAR_CHAVE_ACESSO',
        'Organizacao',
        orgId,
        `Gerada nova chave de acesso: ${key}`
      );
    }
    return { key, date };
  },

  approveOrganizationRegistration(params: {
    orgId: string;
    plano: SaaSPlanType;
    diasValidade: number;
    actorId: string;
  }): { success: boolean; key: string } {
    const list = this.getOrganizations();
    const org = list.find((o) => o.id === params.orgId);
    if (!org) return { success: false, key: '' };

    const randomHex = Math.floor(100000 + Math.random() * 900000);
    const key = `KEY-${org.tipo === 'AUTOESCOLA_CFC' ? 'CFC' : 'INST'}-${randomHex}`;
    const vencimento = new Date(Date.now() + params.diasValidade * 86400000).toISOString().slice(0, 10);

    org.status = 'ATIVO';
    org.plano = params.plano;
    org.chaveAcesso = key;
    org.chaveAcessoGeradaEm = new Date().toISOString();
    org.dataVencimentoPlano = vencimento;

    writeList(STORAGE_KEYS.ORGANIZATIONS, list);
    supabaseAdapter.saveOrganization(org).catch(console.error);

    const users = readList<User>(STORAGE_KEYS.USERS);
    users.forEach((u) => {
      if (u.organizacaoId === params.orgId) {
        u.aprovadoPorMaster = true;
        supabaseAdapter.saveUser(u).catch(console.error);
      }
    });
    writeList(STORAGE_KEYS.USERS, users);

    this.addAuditLog(
      params.orgId,
      params.actorId,
      'APROVACAO_CADASTRO',
      'Organizacao',
      params.orgId,
      `Cadastro aprovado pelo Master. Plano: ${params.plano}, Validade: ${vencimento}, Chave: ${key}`
    );

    return { success: true, key };
  },

  resetUserPasswordByMaster(
    userId: string,
    actorId: string
  ): { success: boolean; newTempPass: string; userName: string; userEmail: string } {
    const users = readList<User>(STORAGE_KEYS.USERS);
    const user = users.find((u) => u.id === userId);
    if (!user) {
      return { success: false, newTempPass: '', userName: '', userEmail: '' };
    }

    const tempPass = `Temp@${Math.floor(100000 + Math.random() * 900000)}`;
    user.senhaTemporaria = tempPass;
    writeList(STORAGE_KEYS.USERS, users);
    supabaseAdapter.saveUser(user).catch(console.error);

    this.addAuditLog(
      user.organizacaoId,
      actorId,
      'RESET_SENHA_MASTER',
      'Usuario',
      user.id,
      `Master resetou a senha do usuário ${user.nome} (${user.email}). Senha temporária gerada.`
    );

    return {
      success: true,
      newTempPass: tempPass,
      userName: user.nome,
      userEmail: user.email
    };
  },

  // Users
  getUsers(orgId?: string): User[] {
    const all = readList<User>(STORAGE_KEYS.USERS);
    if (!orgId) return all;
    return all.filter((u) => u.organizacaoId === orgId);
  },

  getUserByEmail(email: string): User | undefined {
    const clean = email.trim().toLowerCase();
    return readList<User>(STORAGE_KEYS.USERS).find((u) => u.email.toLowerCase() === clean);
  },

  getUserById(userId: string): User | undefined {
    if (!userId) return undefined;
    return readList<User>(STORAGE_KEYS.USERS).find((u) => u.id === userId);
  },

  /**
   * Localiza um instrutor credenciado a partir do ID completo ou código de indicação (ex: 'INSTRUTOR_CARLOS' ou 'usr_instrutor_carlos')
   */
  findInstructorByCode(code: string): User | undefined {
    if (!code) return undefined;
    const clean = code.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const users = readList<User>(STORAGE_KEYS.USERS).filter(
      (u) => u.papel === 'ADMIN_ORG' || u.papel === 'INSTRUTOR' || u.papel === 'SUPER_ADMIN'
    );

    // 1. Match exato pelo ID completo (ex: usr_instrutor_carlos)
    const exactId = users.find((u) => u.id.toLowerCase() === clean);
    if (exactId) return exactId;

    // 2. Match pelo código sem o prefixo usr_ (ex: instrutor_carlos)
    const strippedId = users.find((u) => u.id.toLowerCase().replace('usr_', '') === clean);
    if (strippedId) return strippedId;

    // 3. Match por sufixo ou parte do ID
    const partialId = users.find((u) => u.id.toLowerCase().includes(clean) || clean.includes(u.id.toLowerCase().replace('usr_', '')));
    if (partialId) return partialId;

    // 4. Match por e-mail ou nome aproximado
    return users.find((u) => u.email.toLowerCase().includes(clean) || u.nome.toLowerCase().includes(clean));
  },

  getAllInstructors(): User[] {
    const candidates = readList<User>(STORAGE_KEYS.USERS).filter(
      (u) =>
        (u.papel === 'ADMIN_ORG' || u.papel === 'INSTRUTOR') &&
        u.email.toLowerCase() !== 'cassiordcosta@gmail.com' &&
        u.email.toLowerCase() !== 'admin@sistema.com.br'
    );
    const hasRealInstructors = candidates.some(
      (u) =>
        u.email.toLowerCase() !== 'instrutor@teste.com' &&
        u.email.toLowerCase() !== 'instrutor@autoescola.com' &&
        u.email.toLowerCase() !== 'roberto@autoescola.com'
    );
    if (hasRealInstructors) {
      return candidates.filter((u) => u.email.toLowerCase() !== 'instrutor@teste.com');
    }
    return candidates;
  },

  async syncRemoteInstructors(): Promise<User[]> {
    try {
      const [remoteUsers, remoteOrgs] = await Promise.all([
        supabaseAdapter.getUsers(),
        supabaseAdapter.getOrganizations()
      ]);
      if (remoteOrgs && remoteOrgs.length > 0) {
        remoteOrgs.forEach((o) => this.saveOrganization(o));
      }
      if (remoteUsers && remoteUsers.length > 0) {
        remoteUsers.forEach((u) => this.saveUser(u));
      }
      return this.getAllInstructors();
    } catch (err) {
      console.warn('[Sync] Falha ao sincronizar instrutores do Supabase:', err);
      return this.getAllInstructors();
    }
  },

  createUser(user: User): void {
    const users = readList<User>(STORAGE_KEYS.USERS);
    const index = users.findIndex((u) => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    writeList(STORAGE_KEYS.USERS, users);
    supabaseAdapter.saveUser(user).catch(console.error);
    this.addAuditLog(user.organizacaoId, user.id, 'CRIACAO_USUARIO', 'Usuario', user.id, `Criado usuário ${user.nome} (${user.papel})`);
  },

  async createUserAsync(user: User): Promise<void> {
    const users = readList<User>(STORAGE_KEYS.USERS);
    const index = users.findIndex((u) => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    writeList(STORAGE_KEYS.USERS, users);
    await supabaseAdapter.saveUser(user);
    this.addAuditLog(user.organizacaoId, user.id, 'CRIACAO_USUARIO', 'Usuario', user.id, `Criado usuário ${user.nome} (${user.papel})`);
  },

  saveUser(user: User): void {
    const users = readList<User>(STORAGE_KEYS.USERS);
    const index = users.findIndex((u) => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    writeList(STORAGE_KEYS.USERS, users);
    supabaseAdapter.saveUser(user).catch(console.error);
  },

  async saveUserAsync(user: User): Promise<void> {
    const users = readList<User>(STORAGE_KEYS.USERS);
    const index = users.findIndex((u) => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    writeList(STORAGE_KEYS.USERS, users);
    await supabaseAdapter.saveUser(user);
  },

  updateUser(user: User): void {
    const users = readList<User>(STORAGE_KEYS.USERS);
    const index = users.findIndex((u) => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
      writeList(STORAGE_KEYS.USERS, users);
      supabaseAdapter.saveUser(user).catch(console.error);
      const current = this.getCurrentUser();
      if (current && current.id === user.id) {
        this.setCurrentUser(user);
      }
      this.addAuditLog(user.organizacaoId, user.id, 'ATUALIZACAO_USUARIO', 'Usuario', user.id, `Atualizado perfil do usuário ${user.nome}`);
    }
  },

  /**
   * Salva a assinatura digital do instrutor (imagem base64 PNG/JPG até 2MB e ajustes de escala/posição)
   * Vincula ao perfil do instrutor, atualiza sessão e grava no Supabase + audit logs
   */
  async saveUserSignature(
    userId: string,
    signatureBase64: string,
    config?: SignatureConfig
  ): Promise<User | null> {
    const users = readList<User>(STORAGE_KEYS.USERS);
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) {
      console.warn(`saveUserSignature: Usuário ${userId} não encontrado.`);
      return null;
    }

    const updatedUser: User = {
      ...users[index],
      assinaturaUrl: signatureBase64 || undefined,
      assinaturaConfig: config || users[index].assinaturaConfig
    };
    users[index] = updatedUser;
    writeList(STORAGE_KEYS.USERS, users);

    const current = this.getCurrentUser();
    if (current && current.id === userId) {
      this.setCurrentUser(updatedUser);
    }

    try {
      await supabaseAdapter.saveUser(updatedUser);
    } catch (e) {
      console.warn('Erro ao salvar assinatura no Supabase users:', e);
    }

    try {
      await supabaseAdapter.addAuditLog({
        id: `aud_sig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        organizacaoId: updatedUser.organizacaoId,
        usuarioId: userId,
        acao: 'SALVAR_ASSINATURA_DIGITAL',
        entidade: 'InstructorSignatureMeta',
        registroId: userId,
        detalhes: JSON.stringify({
          userId,
          hasSignature: !!signatureBase64,
          signatureUrl: signatureBase64,
          signatureConfig: config || updatedUser.assinaturaConfig,
          updatedAt: new Date().toISOString()
        }),
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Erro ao gravar audit log de assinatura:', e);
    }

    notifyDataChange();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('agd:user-updated', { detail: updatedUser }));
    }

    return updatedUser;
  },

  getEffectivePixConfig(org?: Organization, user?: User): {
    chavePix: string;
    tipoChavePix: string;
    beneficiarioPix: string;
    cidadePix: string;
    origem: 'INSTRUTOR' | 'ORGANIZACAO' | 'PADRAO';
  } {
    if (user?.chavePix && user.chavePix.trim()) {
      return {
        chavePix: user.chavePix.trim(),
        tipoChavePix: user.tipoChavePix || 'EMAIL',
        beneficiarioPix: user.beneficiarioPix || user.nome,
        cidadePix: user.cidadePix || org?.cidade || 'SAO PAULO',
        origem: 'INSTRUTOR'
      };
    }
    if (org?.chavePix && org.chavePix.trim()) {
      return {
        chavePix: org.chavePix.trim(),
        tipoChavePix: org.tipoChavePix || (org.cnpjCpf.length > 14 ? 'CNPJ' : 'CPF'),
        beneficiarioPix: org.beneficiarioPix || org.nome,
        cidadePix: org.cidadePix || org.cidade || 'SAO PAULO',
        origem: 'ORGANIZACAO'
      };
    }
    return {
      chavePix: org?.email || user?.email || 'contato@direcaosegura.com.br',
      tipoChavePix: 'EMAIL',
      beneficiarioPix: org?.nome || user?.nome || 'Sistema de Direção',
      cidadePix: org?.cidade || 'SAO PAULO',
      origem: 'PADRAO'
    };
  },

  // Students
  getStudents(orgId: string, instrutorId?: string): Student[] {
    const list = readList<Student>(STORAGE_KEYS.STUDENTS).filter((s) => s.organizacaoId === orgId);
    if (!instrutorId) return list;
    return list.filter((s) => !s.instrutorId || s.instrutorId === instrutorId);
  },

  getStudentById(studentId: string): Student | undefined {
    return readList<Student>(STORAGE_KEYS.STUDENTS).find((s) => s.id === studentId);
  },

  getStudentByCPFFingerprint(cpfFingerprint: string): Student | undefined {
    return readList<Student>(STORAGE_KEYS.STUDENTS).find((s) => s.cpfFingerprint === cpfFingerprint);
  },

  async persistStudentMetaToCloud(student: Student, actorId?: string): Promise<void> {
    const metaAudit: AuditLog = {
      id: `stumeta_${student.id}`,
      organizacaoId: student.organizacaoId,
      usuarioId: actorId || student.instrutorId || 'sistema',
      usuarioNome: 'Instrutor',
      acao: 'META_FICHA_ALUNO',
      entidade: 'StudentFichaMeta',
      entidadeId: student.id,
      detalhes: JSON.stringify(student),
      timestamp: new Date().toISOString()
    };
    await supabaseAdapter.addAuditLog(metaAudit);
  },

  saveStudent(student: Student, actorId: string): void {
    const list = readList<Student>(STORAGE_KEYS.STUDENTS);
    const index = list.findIndex((s) => s.id === student.id);
    if (index >= 0) {
      list[index] = student;
    } else {
      list.push(student);
    }
    writeList(STORAGE_KEYS.STUDENTS, list);
    notifyDataChange();
    supabaseAdapter.saveStudent(student).catch(console.error);
    this.persistStudentMetaToCloud(student, actorId).catch(console.error);
    this.addAuditLog(
      student.organizacaoId,
      actorId,
      'SALVAR_ALUNO',
      'Aluno',
      student.id,
      `Salvo dados de ${student.nome} — CNH ${student.categoriaCnh} · Plano: ${student.pacoteNome || 'Padrão'} (Aulas: ${student.aulasCumpridas}/${student.totalAulasContratadas})`
    );
  },

  async addStudentContractAsync(params: {
    alunoId: string;
    contract: Omit<StudentPackageContract, 'id' | 'alunoId' | 'organizacaoId' | 'dataContratacao'> & {
      id?: string;
      dataContratacao?: string;
    };
    actorId: string;
    actorNome?: string;
    createAccountReceivable?: boolean;
    dataVencimento?: string;
    parcelasTotal?: number;
  }): Promise<{ student: Student; contract: StudentPackageContract; account?: AccountReceivable }> {
    const list = readList<Student>(STORAGE_KEYS.STUDENTS);
    const index = list.findIndex((s) => s.id === params.alunoId);
    if (index < 0) {
      throw new Error(`Aluno com ID ${params.alunoId} não encontrado.`);
    }

    const currentStudent = { ...list[index] };
    const today = new Date().toISOString().slice(0, 10);
    const contratos = Array.isArray(currentStudent.contratosPacotes) ? [...currentStudent.contratosPacotes] : [];

    // Se é a primeira contratação adicional e o aluno já possuía um pacote base sem registro em contratosPacotes,
    // sintetiza o pacote inicial para preservar o histórico cronológico completo
    if (contratos.length === 0 && (currentStudent.pacoteNome || currentStudent.pacoteId)) {
      contratos.push({
        id: `cnt_base_${currentStudent.id}`,
        alunoId: currentStudent.id,
        organizacaoId: currentStudent.organizacaoId,
        tipo: 'PACOTE_BASE',
        pacoteId: currentStudent.pacoteId,
        nome: currentStudent.pacoteNome || 'Pacote Inicial de Matrícula',
        categoriaCnh: currentStudent.categoriaCnh,
        quantidadeAulas: currentStudent.totalAulasContratadas || 20,
        valorCentavos: 0,
        dataContratacao: currentStudent.dataCadastro ? currentStudent.dataCadastro.slice(0, 10) : today,
        criadoPorId: currentStudent.instrutorId,
        criadoPorNome: 'Sistema (Matrícula)',
        criadoEm: currentStudent.dataCadastro || new Date().toISOString()
      });
    }

    const newContractId = params.contract.id || `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let createdAccount: AccountReceivable | undefined;

    if (params.createAccountReceivable !== false && params.contract.valorCentavos > 0) {
      createdAccount = {
        id: `acc_cnt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        organizacaoId: currentStudent.organizacaoId,
        alunoId: currentStudent.id,
        pacoteId: params.contract.pacoteId,
        descricao: params.contract.nome,
        valorTotalCentavos: params.contract.valorCentavos,
        valorPagoCentavos: 0,
        saldoDevedorCentavos: params.contract.valorCentavos,
        dataVencimento: params.dataVencimento || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        status: 'PENDENTE',
        parcelasTotal: params.parcelasTotal || 1,
        criadoEm: new Date().toISOString()
      };
      await this.saveAccountReceivableAsync(createdAccount, params.actorId);
    }

    const finalContract: StudentPackageContract = {
      id: newContractId,
      alunoId: currentStudent.id,
      organizacaoId: currentStudent.organizacaoId,
      tipo: params.contract.tipo,
      pacoteId: params.contract.pacoteId,
      nome: params.contract.nome,
      categoriaCnh: params.contract.categoriaCnh || currentStudent.categoriaCnh,
      quantidadeAulas: Math.max(1, Number(params.contract.quantidadeAulas) || 1),
      valorCentavos: Math.max(0, Number(params.contract.valorCentavos) || 0),
      dataContratacao: params.contract.dataContratacao || today,
      formaPagamento: params.contract.formaPagamento,
      contaReceberId: createdAccount?.id || params.contract.contaReceberId,
      observacoes: params.contract.observacoes,
      criadoPorId: params.actorId,
      criadoPorNome: params.actorNome || 'Instrutor',
      criadoEm: new Date().toISOString()
    };

    contratos.push(finalContract);

    // Incrementa a carga horária contratada
    const novoTotalAulas = (currentStudent.totalAulasContratadas || 0) + finalContract.quantidadeAulas;
    currentStudent.totalAulasContratadas = novoTotalAulas;
    currentStudent.contratosPacotes = contratos;

    // Se o aluno estava com status CONCLUIDO, ao adquirir mais aulas ele reabre para EM_ANDAMENTO
    if (currentStudent.status === 'CONCLUIDO' && currentStudent.aulasCumpridas < novoTotalAulas) {
      currentStudent.status = 'EM_ANDAMENTO';
    }

    list[index] = currentStudent;
    writeList(STORAGE_KEYS.STUDENTS, list);
    notifyDataChange();

    await Promise.all([
      supabaseAdapter.saveStudent(currentStudent),
      this.persistStudentMetaToCloud(currentStudent, params.actorId)
    ]);

    this.addAuditLog(
      currentStudent.organizacaoId,
      params.actorId,
      'CONTRATAR_PACOTE_ALUNO',
      'Aluno',
      currentStudent.id,
      `Contratação (${finalContract.tipo}) para ${currentStudent.nome}: "${finalContract.nome}" (+${finalContract.quantidadeAulas} aulas, R$ ${(finalContract.valorCentavos / 100).toFixed(2)}). Novo total: ${novoTotalAulas} aulas.`
    );

    return {
      student: currentStudent,
      contract: finalContract,
      account: createdAccount
    };
  },

  async saveStudentAsync(student: Student, actorId: string): Promise<void> {
    const list = readList<Student>(STORAGE_KEYS.STUDENTS);
    const index = list.findIndex((s) => s.id === student.id);
    if (index >= 0) {
      list[index] = student;
    } else {
      list.push(student);
    }
    writeList(STORAGE_KEYS.STUDENTS, list);
    notifyDataChange();
    await Promise.all([
      supabaseAdapter.saveStudent(student),
      this.persistStudentMetaToCloud(student, actorId)
    ]);
    this.addAuditLog(
      student.organizacaoId,
      actorId,
      'SALVAR_ALUNO',
      'Aluno',
      student.id,
      `Salvo dados de ${student.nome} — CNH ${student.categoriaCnh} · Plano: ${student.pacoteNome || 'Padrão'} (Aulas: ${student.aulasCumpridas}/${student.totalAulasContratadas})`
    );
  },

  transferStudent(params: {
    alunoId: string;
    instrutorDestinoId: string;
    motivo: string;
    actorId: string;
    actorNome: string;
  }): { success: boolean; error?: string; transfer?: StudentTransferHistory } {
    const list = readList<Student>(STORAGE_KEYS.STUDENTS);
    const student = list.find((s) => s.id === params.alunoId);
    if (!student) {
      return { success: false, error: 'Aluno não encontrado no sistema.' };
    }

    if (student.instrutorId === params.instrutorDestinoId) {
      return { success: false, error: 'O aluno já está vinculado a este instrutor.' };
    }

    const allUsers = readList<User>(STORAGE_KEYS.USERS);
    const prevInstructor = allUsers.find((u) => u.id === student.instrutorId);
    const newInstructor = allUsers.find((u) => u.id === params.instrutorDestinoId);

    if (!newInstructor) {
      return { success: false, error: 'Instrutor destinatário não encontrado ou inativo.' };
    }

    const transferRecord: StudentTransferHistory = {
      id: `trf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      organizacaoId: student.organizacaoId,
      alunoId: student.id,
      alunoNome: student.nome,
      alunoCpfMascarado: student.cpfMascarado,
      instrutorAnteriorId: student.instrutorId,
      instrutorAnteriorNome: prevInstructor ? prevInstructor.nome : 'Instrutor Anterior',
      instrutorNovoId: newInstructor.id,
      instrutorNovoNome: newInstructor.nome,
      motivo: params.motivo.trim() || 'Transferência entre instrutores homologada.',
      aulasCumpridasAteTransferencia: student.aulasCumpridas,
      dataTransferencia: new Date().toISOString(),
      autorId: params.actorId,
      autorNome: params.actorNome
    };

    if (!student.historicoTransferencias) {
      student.historicoTransferencias = [];
    }
    student.historicoTransferencias.unshift(transferRecord);
    student.instrutorId = newInstructor.id;

    writeList(STORAGE_KEYS.STUDENTS, list);
    supabaseAdapter.saveStudent(student).catch(console.error);
    supabaseAdapter.saveTransfer(transferRecord).catch(console.error);

    this.addAuditLog(
      student.organizacaoId,
      params.actorId,
      'TRANSFERENCIA_ALUNO',
      'Aluno',
      student.id,
      `Aluno ${student.nome} (CPF: ${student.cpfMascarado}) transferido de ${prevInstructor?.nome || 'Instrutor Anterior'} para ${newInstructor.nome}. Motivo: ${params.motivo} (Aulas até momento: ${student.aulasCumpridas}/${student.totalAulasContratadas})`
    );

    return { success: true, transfer: transferRecord };
  },

  // Vehicles
  getVehicles(orgId: string, instrutorId?: string): Vehicle[] {
    const primary = readList<Vehicle>(STORAGE_KEYS.VEHICLES);
    const backup = readList<Vehicle>(STORAGE_KEYS.VEHICLES_BACKUP);
    const deleted = new Set(readList<string>(STORAGE_KEYS.DELETED_VEHICLES));
    const mergedMap = new Map<string, Vehicle>();
    backup.forEach((v) => {
      if (!deleted.has(v.id)) mergedMap.set(v.id, v);
    });
    primary.forEach((v) => {
      if (!deleted.has(v.id)) mergedMap.set(v.id, v);
    });
    const all = Array.from(mergedMap.values());

    if (instrutorId) {
      const cleanTargetId = instrutorId.replace(/^usr_/, '').toLowerCase();
      return all.filter((v) => {
        if (v.instrutorId) {
          const cleanVehInstId = v.instrutorId.replace(/^usr_/, '').toLowerCase();
          if (v.instrutorId === instrutorId || cleanVehInstId === cleanTargetId) return true;
        }
        return (
          v.organizacaoId === orgId &&
          (!v.instrutorId ||
            v.instrutorId === instrutorId ||
            v.instrutorId.replace(/^usr_/, '').toLowerCase() === cleanTargetId)
        );
      });
    }

    return all.filter((v) => v.organizacaoId === orgId);
  },

  saveVehicle(vehicle: Vehicle): void {
    const updatedVehicle: Vehicle = {
      ...vehicle,
      atualizadoEm: new Date().toISOString()
    };
    const list = readList<Vehicle>(STORAGE_KEYS.VEHICLES);
    const index = list.findIndex((v) => v.id === updatedVehicle.id);
    if (index >= 0) {
      list[index] = updatedVehicle;
    } else {
      list.push(updatedVehicle);
    }
    writeList(STORAGE_KEYS.VEHICLES, list);
    writeList(STORAGE_KEYS.VEHICLES_BACKUP, list);

    const deleted = readList<string>(STORAGE_KEYS.DELETED_VEHICLES).filter((id) => id !== updatedVehicle.id);
    writeList(STORAGE_KEYS.DELETED_VEHICLES, deleted);

    const pending = new Set(readList<string>(STORAGE_KEYS.PENDING_VEHICLES));
    pending.add(updatedVehicle.id);
    writeList(STORAGE_KEYS.PENDING_VEHICLES, Array.from(pending));
    notifyDataChange();

    supabaseAdapter
      .saveVehicle(updatedVehicle)
      .then(() => {
        const afterPending = readList<string>(STORAGE_KEYS.PENDING_VEHICLES).filter(
          (id) => id !== updatedVehicle.id
        );
        writeList(STORAGE_KEYS.PENDING_VEHICLES, afterPending);
      })
      .catch(console.error);
  },

  async saveVehicleAsync(vehicle: Vehicle, actorId?: string): Promise<void> {
    const updatedVehicle: Vehicle = {
      ...vehicle,
      atualizadoEm: new Date().toISOString()
    };
    const list = readList<Vehicle>(STORAGE_KEYS.VEHICLES);
    const index = list.findIndex((v) => v.id === updatedVehicle.id);
    const isNew = index < 0;
    if (index >= 0) {
      list[index] = updatedVehicle;
    } else {
      list.push(updatedVehicle);
    }
    writeList(STORAGE_KEYS.VEHICLES, list);
    writeList(STORAGE_KEYS.VEHICLES_BACKUP, list);

    const deleted = readList<string>(STORAGE_KEYS.DELETED_VEHICLES).filter((id) => id !== updatedVehicle.id);
    writeList(STORAGE_KEYS.DELETED_VEHICLES, deleted);

    const pending = new Set(readList<string>(STORAGE_KEYS.PENDING_VEHICLES));
    pending.add(updatedVehicle.id);
    writeList(STORAGE_KEYS.PENDING_VEHICLES, Array.from(pending));
    notifyDataChange();

    if (supabaseAdapter.enabled) {
      await supabaseAdapter.saveVehicle(updatedVehicle).catch(console.error);
      const afterPending = readList<string>(STORAGE_KEYS.PENDING_VEHICLES).filter(
        (id) => id !== updatedVehicle.id
      );
      writeList(STORAGE_KEYS.PENDING_VEHICLES, afterPending);
    }

    this.addAuditLog(
      updatedVehicle.organizacaoId,
      actorId || updatedVehicle.instrutorId || 'sistema',
      isNew ? 'CADASTRAR_VEICULO' : 'ATUALIZAR_VEICULO',
      'Veiculo',
      updatedVehicle.id,
      `${updatedVehicle.modelo} (${updatedVehicle.placa}) · ${updatedVehicle.tipo} · Câmbio ${updatedVehicle.cambio || 'MANUAL'}`
    );
    notifyDataChange();
  },

  deleteVehicle(vehicleId: string, actorId?: string): void {
    const list = readList<Vehicle>(STORAGE_KEYS.VEHICLES);
    const veh = list.find((v) => v.id === vehicleId);
    const filtered = list.filter((v) => v.id !== vehicleId);
    writeList(STORAGE_KEYS.VEHICLES, filtered);
    writeList(STORAGE_KEYS.VEHICLES_BACKUP, filtered);

    const pending = readList<string>(STORAGE_KEYS.PENDING_VEHICLES).filter((id) => id !== vehicleId);
    writeList(STORAGE_KEYS.PENDING_VEHICLES, pending);

    const deleted = new Set(readList<string>(STORAGE_KEYS.DELETED_VEHICLES));
    deleted.add(vehicleId);
    writeList(STORAGE_KEYS.DELETED_VEHICLES, Array.from(deleted));
    notifyDataChange();

    supabaseAdapter.deleteVehicle(vehicleId).catch(console.error);
    if (veh) {
      this.addAuditLog(
        veh.organizacaoId,
        actorId || veh.instrutorId || 'sistema',
        'EXCLUIR_VEICULO',
        'Veiculo',
        vehicleId,
        `Veículo ${veh.modelo} (${veh.placa}) excluído.`
      );
    }
  },

  async deleteVehicleAsync(vehicleId: string, actorId?: string): Promise<void> {
    const list = readList<Vehicle>(STORAGE_KEYS.VEHICLES);
    const veh = list.find((v) => v.id === vehicleId);
    const filtered = list.filter((v) => v.id !== vehicleId);
    writeList(STORAGE_KEYS.VEHICLES, filtered);
    writeList(STORAGE_KEYS.VEHICLES_BACKUP, filtered);

    const pending = readList<string>(STORAGE_KEYS.PENDING_VEHICLES).filter((id) => id !== vehicleId);
    writeList(STORAGE_KEYS.PENDING_VEHICLES, pending);

    const deleted = new Set(readList<string>(STORAGE_KEYS.DELETED_VEHICLES));
    deleted.add(vehicleId);
    writeList(STORAGE_KEYS.DELETED_VEHICLES, Array.from(deleted));
    notifyDataChange();

    if (supabaseAdapter.enabled) {
      await supabaseAdapter.deleteVehicle(vehicleId).catch(console.error);
    }
    if (veh) {
      this.addAuditLog(
        veh.organizacaoId,
        actorId || veh.instrutorId || 'sistema',
        'EXCLUIR_VEICULO',
        'Veiculo',
        vehicleId,
        `Veículo ${veh.modelo} (${veh.placa}) excluído.`
      );
    }
    notifyDataChange();
  },

  async saveVehiclesBatchAsync(vehiclesToSave: Vehicle[], actorId?: string): Promise<void> {
    const deletedVehicles = new Set(readList<string>(STORAGE_KEYS.DELETED_VEHICLES));
    const activeVehicles = vehiclesToSave.filter((v) => !deletedVehicles.has(v.id));
    writeList(STORAGE_KEYS.VEHICLES, activeVehicles);
    writeList(STORAGE_KEYS.VEHICLES_BACKUP, activeVehicles);
    notifyDataChange();

    if (supabaseAdapter.enabled) {
      if (activeVehicles.length > 0) {
        await supabaseAdapter.saveVehiclesBatch(activeVehicles).catch(console.error);
      }
      if (deletedVehicles.size > 0) {
        await supabaseAdapter.deleteVehiclesBatch(Array.from(deletedVehicles)).catch(console.error);
      }
    }
    if (activeVehicles.length > 0) {
      const first = activeVehicles[0];
      this.addAuditLog(
        first.organizacaoId,
        actorId || first.instrutorId || 'sistema',
        'ATUALIZAR_VEICULO',
        'Veiculo',
        first.id,
        `Frota de ${activeVehicles.length} veículo(s) atualizada e sincronizada com sucesso.`
      );
    }
    notifyDataChange();
  },

  // Available Slots & Schedule
  getSlots(orgId: string, instrutorId?: string): AvailableSlot[] {
    const list = readList<AvailableSlot>(STORAGE_KEYS.SLOTS).filter((s) => s.organizacaoId === orgId);
    if (!instrutorId) return list;
    return list.filter((s) => !s.instrutorId || s.instrutorId === instrutorId);
  },

  saveSlot(slot: AvailableSlot): void {
    const list = readList<AvailableSlot>(STORAGE_KEYS.SLOTS);
    const index = list.findIndex((s) => s.id === slot.id);
    if (index >= 0) {
      list[index] = slot;
    } else {
      list.push(slot);
    }
    writeList(STORAGE_KEYS.SLOTS, list);
    const deletedSlots = readList<string>(STORAGE_KEYS.DELETED_SLOTS);
    if (deletedSlots.includes(slot.id)) {
      writeList(STORAGE_KEYS.DELETED_SLOTS, deletedSlots.filter((id) => id !== slot.id));
    }
    const pendingNew = readList<string>(STORAGE_KEYS.PENDING_NEW_SLOTS);
    if (!pendingNew.includes(slot.id)) {
      pendingNew.push(slot.id);
      writeList(STORAGE_KEYS.PENDING_NEW_SLOTS, pendingNew);
    }
    notifyDataChange();
    supabaseAdapter
      .saveSlot(slot)
      .then(() => {
        const currentPending = readList<string>(STORAGE_KEYS.PENDING_NEW_SLOTS);
        writeList(
          STORAGE_KEYS.PENDING_NEW_SLOTS,
          currentPending.filter((id) => id !== slot.id)
        );
      })
      .catch(console.error);
  },

  async saveSlotAsync(slot: AvailableSlot): Promise<void> {
    const list = readList<AvailableSlot>(STORAGE_KEYS.SLOTS);
    const index = list.findIndex((s) => s.id === slot.id);
    if (index >= 0) {
      list[index] = slot;
    } else {
      list.push(slot);
    }
    writeList(STORAGE_KEYS.SLOTS, list);
    const deletedSlots = readList<string>(STORAGE_KEYS.DELETED_SLOTS);
    if (deletedSlots.includes(slot.id)) {
      writeList(STORAGE_KEYS.DELETED_SLOTS, deletedSlots.filter((id) => id !== slot.id));
    }
    const pendingNew = readList<string>(STORAGE_KEYS.PENDING_NEW_SLOTS);
    if (!pendingNew.includes(slot.id)) {
      pendingNew.push(slot.id);
      writeList(STORAGE_KEYS.PENDING_NEW_SLOTS, pendingNew);
    }
    notifyDataChange();
    if (supabaseAdapter.enabled) {
      await supabaseAdapter.saveSlot(slot).catch(console.error);
      const currentPending = readList<string>(STORAGE_KEYS.PENDING_NEW_SLOTS);
      writeList(
        STORAGE_KEYS.PENDING_NEW_SLOTS,
        currentPending.filter((id) => id !== slot.id)
      );
    }
    notifyDataChange();
  },

  async saveSlotsBatchAsync(slotsToSave: AvailableSlot[], actorId?: string): Promise<void> {
    if (slotsToSave.length === 0) return;
    const list = readList<AvailableSlot>(STORAGE_KEYS.SLOTS);
    const slotMap = new Map<string, AvailableSlot>();
    list.forEach((s) => slotMap.set(s.id, s));
    slotsToSave.forEach((s) => slotMap.set(s.id, s));
    writeList(STORAGE_KEYS.SLOTS, Array.from(slotMap.values()));

    const saveIdsSet = new Set(slotsToSave.map((s) => s.id));
    const deletedSlots = readList<string>(STORAGE_KEYS.DELETED_SLOTS);
    if (deletedSlots.some((id) => saveIdsSet.has(id))) {
      writeList(
        STORAGE_KEYS.DELETED_SLOTS,
        deletedSlots.filter((id) => !saveIdsSet.has(id))
      );
    }

    const pendingNew = new Set(readList<string>(STORAGE_KEYS.PENDING_NEW_SLOTS));
    slotsToSave.forEach((s) => pendingNew.add(s.id));
    writeList(STORAGE_KEYS.PENDING_NEW_SLOTS, Array.from(pendingNew));
    notifyDataChange();

    if (supabaseAdapter.enabled) {
      await supabaseAdapter.saveSlotsBatch(slotsToSave).catch(console.error);
      const afterPending = readList<string>(STORAGE_KEYS.PENDING_NEW_SLOTS).filter((id) => !saveIdsSet.has(id));
      writeList(STORAGE_KEYS.PENDING_NEW_SLOTS, afterPending);
    }

    const first = slotsToSave[0];
    if (first) {
      this.addAuditLog(
        first.organizacaoId,
        actorId || first.instrutorId || 'sistema',
        'LIBERAR_HORARIOS_LOTE',
        'HorarioAgenda',
        first.id,
        `${slotsToSave.length} horário(s) liberado(s) na agenda do instrutor.`
      );
    }
    notifyDataChange();
  },

  deleteSlot(slotId: string, actorId?: string): void {
    const list = readList<AvailableSlot>(STORAGE_KEYS.SLOTS);
    const removed = list.find((s) => s.id === slotId);
    const filtered = list.filter((s) => s.id !== slotId);
    writeList(STORAGE_KEYS.SLOTS, filtered);
    const pendingNew = readList<string>(STORAGE_KEYS.PENDING_NEW_SLOTS);
    if (pendingNew.includes(slotId)) {
      writeList(STORAGE_KEYS.PENDING_NEW_SLOTS, pendingNew.filter((id) => id !== slotId));
    }
    const deletedSlots = readList<string>(STORAGE_KEYS.DELETED_SLOTS);
    if (!deletedSlots.includes(slotId)) {
      deletedSlots.push(slotId);
      writeList(STORAGE_KEYS.DELETED_SLOTS, deletedSlots);
    }
    notifyDataChange();
    supabaseAdapter.deleteSlot(slotId).catch(console.error);
    if (removed) {
      this.addAuditLog(
        removed.organizacaoId,
        actorId || removed.instrutorId || 'sistema',
        'EXCLUIR_HORARIO',
        'HorarioAgenda',
        slotId,
        `Horário ${removed.horaInicio}-${removed.horaFim} de ${removed.data} excluído da grade.`
      );
    }
  },

  async deleteSlotAsync(slotId: string, actorId?: string): Promise<void> {
    const list = readList<AvailableSlot>(STORAGE_KEYS.SLOTS);
    const removed = list.find((s) => s.id === slotId);
    const filtered = list.filter((s) => s.id !== slotId);
    writeList(STORAGE_KEYS.SLOTS, filtered);
    const pendingNew = readList<string>(STORAGE_KEYS.PENDING_NEW_SLOTS);
    if (pendingNew.includes(slotId)) {
      writeList(STORAGE_KEYS.PENDING_NEW_SLOTS, pendingNew.filter((id) => id !== slotId));
    }
    const deletedSlots = readList<string>(STORAGE_KEYS.DELETED_SLOTS);
    if (!deletedSlots.includes(slotId)) {
      deletedSlots.push(slotId);
      writeList(STORAGE_KEYS.DELETED_SLOTS, deletedSlots);
    }
    notifyDataChange();
    if (supabaseAdapter.enabled) {
      await supabaseAdapter.deleteSlot(slotId).catch(console.error);
    }
    if (removed) {
      this.addAuditLog(
        removed.organizacaoId,
        actorId || removed.instrutorId || 'sistema',
        'EXCLUIR_HORARIO',
        'HorarioAgenda',
        slotId,
        `Horário ${removed.horaInicio}-${removed.horaFim} de ${removed.data} excluído da grade.`
      );
    }
    notifyDataChange();
  },

  async deleteSlotsBatchAsync(slotIds: string[], actorId?: string, orgId?: string): Promise<void> {
    if (slotIds.length === 0) return;
    const removeSet = new Set(slotIds);
    const list = readList<AvailableSlot>(STORAGE_KEYS.SLOTS);
    const firstRemoved = list.find((s) => removeSet.has(s.id));
    const filtered = list.filter((s) => !removeSet.has(s.id));
    writeList(STORAGE_KEYS.SLOTS, filtered);

    const pendingNew = readList<string>(STORAGE_KEYS.PENDING_NEW_SLOTS).filter((id) => !removeSet.has(id));
    writeList(STORAGE_KEYS.PENDING_NEW_SLOTS, pendingNew);

    const deletedSet = new Set(readList<string>(STORAGE_KEYS.DELETED_SLOTS));
    slotIds.forEach((id) => deletedSet.add(id));
    writeList(STORAGE_KEYS.DELETED_SLOTS, Array.from(deletedSet));
    notifyDataChange();

    if (supabaseAdapter.enabled) {
      await supabaseAdapter.deleteSlotsBatch(slotIds).catch(console.error);
    }

    const targetOrgId = orgId || firstRemoved?.organizacaoId || 'org_direcao_certa_01';
    this.addAuditLog(
      targetOrgId,
      actorId || firstRemoved?.instrutorId || 'sistema',
      'EXCLUIR_HORARIOS_LOTE',
      'HorarioAgenda',
      slotIds[0],
      `${slotIds.length} horário(s) removido(s) da agenda pelo instrutor.`
    );
    notifyDataChange();
  },

  toggleSlotBlock(slotId: string, motivo?: string): void {
    const list = readList<AvailableSlot>(STORAGE_KEYS.SLOTS);
    const slot = list.find((s) => s.id === slotId);
    if (slot) {
      slot.bloqueado = !slot.bloqueado;
      slot.motivoBloqueio = slot.bloqueado ? (motivo || 'Horário Indisponível') : undefined;
      writeList(STORAGE_KEYS.SLOTS, list);
      notifyDataChange();
      supabaseAdapter.saveSlot(slot).catch(console.error);
    }
  },

  // Notificações de Aulas Desmarcadas (Tela do Aluno)
  getStudentNotifications(alunoId: string): StudentNotification[] {
    const list = readList<StudentNotification>(STORAGE_KEYS.STUDENT_NOTIFICATIONS);
    return list
      .filter((n) => n.alunoId === alunoId)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  },

  async createStudentNotificationAsync(notification: StudentNotification): Promise<void> {
    const list = readList<StudentNotification>(STORAGE_KEYS.STUDENT_NOTIFICATIONS);
    const idx = list.findIndex((n) => n.id === notification.id);
    if (idx >= 0) {
      list[idx] = notification;
    } else {
      list.unshift(notification);
    }
    writeList(STORAGE_KEYS.STUDENT_NOTIFICATIONS, list);

    const auditEntry: AuditLog = {
      id: notification.id,
      organizacaoId: notification.organizacaoId,
      usuarioId: notification.instrutorId,
      usuarioNome: notification.instrutorNome,
      acao: 'NOTIFICACAO_ALUNO_DESMARCACAO',
      entidade: 'StudentNotification',
      entidadeId: notification.alunoId,
      detalhes: JSON.stringify(notification),
      timestamp: notification.criadoEm
    };

    const auditList = readList<AuditLog>(STORAGE_KEYS.AUDIT);
    const auditIdx = auditList.findIndex((a) => a.id === auditEntry.id);
    if (auditIdx >= 0) {
      auditList[auditIdx] = auditEntry;
    } else {
      auditList.unshift(auditEntry);
    }
    writeList(STORAGE_KEYS.AUDIT, auditList.slice(0, 500));
    notifyDataChange();

    if (supabaseAdapter.enabled) {
      await supabaseAdapter.addAuditLog(auditEntry).catch(console.error);
    }
    notifyDataChange();
  },

  async markStudentNotificationReadAsync(notificationId: string): Promise<void> {
    const list = readList<StudentNotification>(STORAGE_KEYS.STUDENT_NOTIFICATIONS);
    const target = list.find((n) => n.id === notificationId);
    if (!target) return;
    target.lida = true;
    writeList(STORAGE_KEYS.STUDENT_NOTIFICATIONS, list);
    notifyDataChange();

    const auditEntry: AuditLog = {
      id: target.id,
      organizacaoId: target.organizacaoId,
      usuarioId: target.instrutorId,
      usuarioNome: target.instrutorNome,
      acao: 'NOTIFICACAO_ALUNO_DESMARCACAO',
      entidade: 'StudentNotification',
      entidadeId: target.alunoId,
      detalhes: JSON.stringify(target),
      timestamp: target.criadoEm
    };

    if (supabaseAdapter.enabled) {
      await supabaseAdapter.addAuditLog(auditEntry).catch(console.error);
    }
    notifyDataChange();
  },

  async cancelLessonByInstructorWithNotificationAsync(
    lesson: Lesson,
    instrutor: User,
    alunoNome?: string
  ): Promise<StudentNotification> {
    const list = readList<Lesson>(STORAGE_KEYS.LESSONS);
    const idx = list.findIndex((l) => l.id === lesson.id);
    const updatedLesson: Lesson = {
      ...lesson,
      status: 'CANCELADA',
      observacaoInstrutor: `[DESMARCADA_PELO_INSTRUTOR] O horário das ${lesson.horaInicio} do dia ${formatDateBR(lesson.data)} foi desmarcado pelo instrutor ${instrutor.nome}.`
    };
    if (idx >= 0) {
      list[idx] = updatedLesson;
    } else {
      list.push(updatedLesson);
    }
    writeList(STORAGE_KEYS.LESSONS, list);

    if (supabaseAdapter.enabled) {
      await supabaseAdapter.saveLesson(updatedLesson).catch(console.error);
    }

    const notif: StudentNotification = {
      id: `notif_lsn_${lesson.id}`,
      organizacaoId: lesson.organizacaoId,
      alunoId: lesson.alunoId,
      alunoNome,
      instrutorId: instrutor.id,
      instrutorNome: instrutor.nome,
      aulaId: lesson.id,
      dataAula: lesson.data,
      horaAula: lesson.horaInicio,
      tipo: 'AULA_DESMARCADA',
      titulo: 'Aula Desmarcada pelo Instrutor — Remarque seu Horário',
      mensagem: `O horário das ${lesson.horaInicio} da data ${formatDateBR(lesson.data)} foi desmarcado pelo instrutor ${instrutor.nome}. Solicita-se que você escolha e remarque para uma nova data e horário disponível na agenda.`,
      lida: false,
      criadoEm: new Date().toISOString()
    };

    await this.createStudentNotificationAsync(notif);
    return notif;
  },

  // Lessons
  getLessons(orgId: string): Lesson[] {
    return readList<Lesson>(STORAGE_KEYS.LESSONS).filter((l) => l.organizacaoId === orgId);
  },

  getLessonsByStudent(studentId: string): Lesson[] {
    return readList<Lesson>(STORAGE_KEYS.LESSONS).filter((l) => l.alunoId === studentId);
  },

  /**
   * Verifica se há conflito de horário para instrutor, aluno ou veículo
   */
  hasSchedulingConflict(orgId: string, date: string, startTime: string, endTime: string, alunoId: string, instrutorId: string, ignoreLessonId?: string): { conflict: boolean; reason?: string } {
    const activeLessons = this.getLessons(orgId).filter(
      (l) => l.status !== 'CANCELADA' && l.data === date && l.id !== ignoreLessonId
    );

    // Conflito para o instrutor
    const instrutorBusy = activeLessons.find(
      (l) => l.instrutorId === instrutorId && l.horaInicio === startTime
    );
    if (instrutorBusy) {
      return { conflict: true, reason: 'O instrutor já possui uma aula agendada neste horário.' };
    }

    // Conflito para o aluno
    const alunoBusy = activeLessons.find(
      (l) => l.alunoId === alunoId && l.horaInicio === startTime
    );
    if (alunoBusy) {
      return { conflict: true, reason: 'O aluno já possui outra aula agendada neste mesmo horário.' };
    }

    return { conflict: false };
  },

  createLesson(lesson: Lesson, actorId: string): { success: boolean; error?: string } {
    // 1. Validar se o slot está bloqueado
    const slots = this.getSlots(lesson.organizacaoId);
    const slot = slots.find((s) => s.data === lesson.data && s.horaInicio === lesson.horaInicio);
    if (slot && slot.bloqueado) {
      return { success: false, error: `Horário bloqueado pelo instrutor: ${slot.motivoBloqueio || 'Indisponível'}` };
    }

    // 2. Validar conflitos de agendamento concorrente
    const conflictCheck = this.hasSchedulingConflict(
      lesson.organizacaoId,
      lesson.data,
      lesson.horaInicio,
      lesson.horaFim,
      lesson.alunoId,
      lesson.instrutorId
    );
    if (conflictCheck.conflict) {
      return { success: false, error: conflictCheck.reason };
    }

    // 3. Salvar aula
    const list = readList<Lesson>(STORAGE_KEYS.LESSONS);
    list.push(lesson);
    writeList(STORAGE_KEYS.LESSONS, list);
    notifyDataChange();
    supabaseAdapter.saveLesson(lesson).then(() => notifyDataChange()).catch(console.error);

    this.addAuditLog(lesson.organizacaoId, actorId, 'AGENDAR_AULA', 'Aula', lesson.id, `Agendada aula em ${lesson.data} às ${lesson.horaInicio}`);
    return { success: true };
  },

  updateLesson(lesson: Lesson, actorId: string): void {
    const list = readList<Lesson>(STORAGE_KEYS.LESSONS);
    const index = list.findIndex((l) => l.id === lesson.id);
    if (index >= 0) {
      list[index] = lesson;
      writeList(STORAGE_KEYS.LESSONS, list);
      notifyDataChange();
      supabaseAdapter.saveLesson(lesson).then(() => notifyDataChange()).catch(console.error);
      this.addAuditLog(lesson.organizacaoId, actorId, 'ATUALIZAR_AULA', 'Aula', lesson.id, `Status: ${lesson.status}`);
    }
  },

  // Accounts Receivable
  getAccountsReceivable(orgId: string): AccountReceivable[] {
    return readList<AccountReceivable>(STORAGE_KEYS.ACCOUNTS).filter((a) => a.organizacaoId === orgId);
  },

  createAccountReceivable(account: AccountReceivable, actorId: string): void {
    const list = readList<AccountReceivable>(STORAGE_KEYS.ACCOUNTS);
    list.push(account);
    writeList(STORAGE_KEYS.ACCOUNTS, list);
    notifyDataChange();
    supabaseAdapter.saveAccountReceivable(account).catch(console.error);
    this.addAuditLog(account.organizacaoId, actorId, 'CRIAR_CONTA_RECEBER', 'ContaReceber', account.id, `${account.descricao} - Valor: R$ ${(account.valorTotalCentavos / 100).toFixed(2)}`);
  },

  updateAccountReceivable(account: AccountReceivable, actorId: string): void {
    const list = readList<AccountReceivable>(STORAGE_KEYS.ACCOUNTS);
    const index = list.findIndex((a) => a.id === account.id);
    if (index >= 0) {
      list[index] = account;
      writeList(STORAGE_KEYS.ACCOUNTS, list);
      notifyDataChange();
      supabaseAdapter.saveAccountReceivable(account).catch(console.error);
      this.addAuditLog(account.organizacaoId, actorId, 'ATUALIZAR_CONTA_RECEBER', 'ContaReceber', account.id, `${account.descricao} - Saldo: R$ ${(account.saldoDevedorCentavos / 100).toFixed(2)} (${account.status})`);
    }
  },

  async updateAccountReceivableAsync(account: AccountReceivable, actorId: string): Promise<void> {
    const list = readList<AccountReceivable>(STORAGE_KEYS.ACCOUNTS);
    const index = list.findIndex((a) => a.id === account.id);
    if (index >= 0) {
      list[index] = account;
    } else {
      list.push(account);
    }
    writeList(STORAGE_KEYS.ACCOUNTS, list);
    notifyDataChange();
    await supabaseAdapter.saveAccountReceivable(account);
    this.addAuditLog(account.organizacaoId, actorId, 'ATUALIZAR_CONTA_RECEBER', 'ContaReceber', account.id, `${account.descricao} - Saldo: R$ ${(account.saldoDevedorCentavos / 100).toFixed(2)} (${account.status})`);
  },

  // Payments & Amortization
  getPayments(orgId: string): PaymentRecord[] {
    return readList<PaymentRecord>(STORAGE_KEYS.PAYMENTS).filter((p) => p.organizacaoId === orgId);
  },

  recordPayment(payment: PaymentRecord, actorId: string): { success: boolean; error?: string } {
    const accounts = readList<AccountReceivable>(STORAGE_KEYS.ACCOUNTS);
    const account = accounts.find((a) => a.id === payment.contaReceberId);

    if (!account) {
      return { success: false, error: 'Conta a receber não encontrada.' };
    }

    if (payment.valorCentavos > account.saldoDevedorCentavos) {
      return { success: false, error: 'O valor do pagamento não pode ser maior que o saldo devedor restante.' };
    }

    // Amortizar conta
    account.valorPagoCentavos += payment.valorCentavos;
    account.saldoDevedorCentavos = Math.max(0, account.valorTotalCentavos - account.valorPagoCentavos);
    account.status = account.saldoDevedorCentavos === 0 ? 'PAGO' : 'PARCIAL';

    writeList(STORAGE_KEYS.ACCOUNTS, accounts);
    supabaseAdapter.saveAccountReceivable(account).catch(console.error);

    // Salvar registro de pagamento
    const paymentList = readList<PaymentRecord>(STORAGE_KEYS.PAYMENTS);
    paymentList.push(payment);
    writeList(STORAGE_KEYS.PAYMENTS, paymentList);
    supabaseAdapter.savePayment(payment).catch(console.error);

    this.addAuditLog(
      payment.organizacaoId,
      actorId,
      'REGISTRO_PAGAMENTO',
      'Pagamento',
      payment.id,
      `Pagamento de R$ ${(payment.valorCentavos / 100).toFixed(2)} via ${payment.metodo} amortizado com sucesso.`
    );

    return { success: true };
  },

  // Expenses
  getExpenses(orgId: string): Expense[] {
    return readList<Expense>(STORAGE_KEYS.EXPENSES).filter((e) => e.organizacaoId === orgId);
  },

  createExpense(expense: Expense, actorId: string): void {
    const list = readList<Expense>(STORAGE_KEYS.EXPENSES);
    list.push(expense);
    writeList(STORAGE_KEYS.EXPENSES, list);
    supabaseAdapter.saveExpense(expense).catch(console.error);
    this.addAuditLog(expense.organizacaoId, actorId, 'CRIAR_DESPESA', 'Despesa', expense.id, `${expense.descricao} - R$ ${(expense.valorCentavos / 100).toFixed(2)}`);
  },

  // Investments
  getInvestments(orgId: string): Investment[] {
    return readList<Investment>(STORAGE_KEYS.INVESTMENTS).filter((i) => i.organizacaoId === orgId);
  },

  createInvestment(inv: Investment, actorId: string): void {
    const list = readList<Investment>(STORAGE_KEYS.INVESTMENTS);
    list.push(inv);
    writeList(STORAGE_KEYS.INVESTMENTS, list);
    supabaseAdapter.saveInvestment(inv).catch(console.error);
    this.addAuditLog(inv.organizacaoId, actorId, 'CRIAR_INVESTIMENTO', 'Investimento', inv.id, `${inv.titulo}`);
  },

  makeInvestmentContribution(invId: string, valorCentavos: number, actorId: string): void {
    const list = readList<Investment>(STORAGE_KEYS.INVESTMENTS);
    const inv = list.find((i) => i.id === invId);
    if (inv) {
      inv.valorAcumuladoCentavos += valorCentavos;
      writeList(STORAGE_KEYS.INVESTMENTS, list);
      supabaseAdapter.saveInvestment(inv).catch(console.error);
      this.addAuditLog(inv.organizacaoId, actorId, 'APORTE_INVESTIMENTO', 'Investimento', inv.id, `Aporte de R$ ${(valorCentavos / 100).toFixed(2)}`);
    }
  },

  updateInvestment(inv: Investment, actorId: string): void {
    const list = readList<Investment>(STORAGE_KEYS.INVESTMENTS);
    const index = list.findIndex((i) => i.id === inv.id);
    if (index !== -1) {
      list[index] = inv;
      writeList(STORAGE_KEYS.INVESTMENTS, list);
      supabaseAdapter.saveInvestment(inv).catch(console.error);
      this.addAuditLog(inv.organizacaoId, actorId, 'ATUALIZAR_INVESTIMENTO', 'Investimento', inv.id, `Atualizado: ${inv.titulo}`);
    }
  },

  deleteInvestment(invId: string, orgId: string, actorId: string): void {
    const list = readList<Investment>(STORAGE_KEYS.INVESTMENTS);
    const filtered = list.filter((i) => i.id !== invId);
    writeList(STORAGE_KEYS.INVESTMENTS, filtered);
    supabaseAdapter.deleteInvestment(invId).catch(console.error);
    this.addAuditLog(orgId, actorId, 'EXCLUIR_INVESTIMENTO', 'Investimento', invId, `Plano de investimento excluído.`);
  },

  // Package Offers (Estritamente os pacotes que o próprio instrutor cadastrou, sem criação aleatória de outros pacotes)
  getPackages(orgId: string, instrutorId?: string): PackageOffer[] {
    const primary = readList<PackageOffer>(STORAGE_KEYS.PACKAGES);
    const backup = readList<PackageOffer>(STORAGE_KEYS.PACKAGES_BACKUP);
    const deleted = new Set(readList<string>(STORAGE_KEYS.DELETED_PACKAGES));
    const mergedAllMap = new Map<string, PackageOffer>();
    backup.forEach((p) => {
      if (!deleted.has(p.id)) mergedAllMap.set(p.id, p);
    });
    primary.forEach((p) => {
      if (!deleted.has(p.id)) mergedAllMap.set(p.id, p);
    });
    const all = Array.from(mergedAllMap.values());

    const instructorUser = instrutorId ? this.getUserById(instrutorId) : undefined;
    const effectiveOrgId = instructorUser?.organizacaoId || orgId;

    if (instrutorId) {
      const cleanTargetId = instrutorId.replace(/^usr_/, '').toLowerCase();
      const targetName = instructorUser?.nome?.trim().toLowerCase();

      // 1. Pacotes com instrutorId ou instrutorNome explícito deste instrutor (mesmo que em org diferente)
      const instructorSpecific = all.filter((p) => {
        if (p.instrutorId) {
          const cleanPkgInstId = p.instrutorId.replace(/^usr_/, '').toLowerCase();
          if (p.instrutorId === instrutorId || cleanPkgInstId === cleanTargetId) return true;
        }
        if (targetName && p.instrutorNome && p.instrutorNome.trim().toLowerCase() === targetName) {
          return true;
        }
        return false;
      });

      // 2. Pacotes da organização do instrutor que não pertençam exclusivamente a outro instrutor
      const orgPackagesForInstructor = all.filter(
        (p) =>
          p.organizacaoId === effectiveOrgId &&
          (!p.instrutorId ||
            p.instrutorId === instrutorId ||
            p.instrutorId.replace(/^usr_/, '').toLowerCase() === cleanTargetId ||
            p.instrutorId === 'sistema' ||
            p.instrutorId === '')
      );

      if (instructorSpecific.length > 0 || orgPackagesForInstructor.length > 0) {
        const merged = new Map<string, PackageOffer>();
        instructorSpecific.forEach((p) => merged.set(p.id, p));
        orgPackagesForInstructor.forEach((p) => merged.set(p.id, p));
        return Array.from(merged.values());
      }

      // Fallback para pacotes na orgId informada sem outro instrutorId
      return all.filter(
        (p) =>
          p.organizacaoId === orgId &&
          (!p.instrutorId ||
            p.instrutorId === instrutorId ||
            p.instrutorId.replace(/^usr_/, '').toLowerCase() === cleanTargetId ||
            p.instrutorId === 'sistema' ||
            p.instrutorId === '')
      );
    }

    return all.filter((p) => p.organizacaoId === orgId);
  },

  // Remove pacotes auto-injetados de outras categorias pelo sistema anteriormente
  sanitizePackages(orgId?: string): void {
    const all = readList<PackageOffer>(STORAGE_KEYS.PACKAGES);
    const autoInjectedPrefixes = [
      'pkg_cnh_a_20_',
      'pkg_cnh_ab_40_',
      'pkg_reforco_05_',
      'pkg_habilitados_10_',
      'pkg_cnh_d_20_'
    ];
    const toRemove = all.filter((p) => autoInjectedPrefixes.some((prefix) => p.id.startsWith(prefix)));
    if (toRemove.length > 0) {
      const cleaned = all.filter((p) => !autoInjectedPrefixes.some((prefix) => p.id.startsWith(prefix)));
      writeList(STORAGE_KEYS.PACKAGES, cleaned);
      writeList(STORAGE_KEYS.PACKAGES_BACKUP, cleaned);
      toRemove.forEach((p) => {
        supabaseAdapter.deletePackage(p.id).catch(() => {});
      });
    }
  },

  persistPackageMetaToCloud(pkg: PackageOffer, actorId?: string): void {
    const metaAudit: AuditLog = {
      id: `pkgmeta_${pkg.id}`,
      organizacaoId: pkg.organizacaoId,
      usuarioId: pkg.instrutorId || actorId || 'sistema',
      usuarioNome: pkg.instrutorNome || 'Instrutor',
      acao: 'META_PACOTE_INSTRUTOR',
      entidade: 'PackageOfferMeta',
      entidadeId: pkg.id,
      detalhes: JSON.stringify(pkg),
      timestamp: pkg.atualizadoEm || new Date().toISOString()
    };
    supabaseAdapter.addAuditLog(metaAudit).catch(() => {});
  },

  createPackage(pkg: PackageOffer, actorId: string): void {
    const updatedPkg: PackageOffer = {
      ...pkg,
      atualizadoEm: new Date().toISOString()
    };
    const list = readList<PackageOffer>(STORAGE_KEYS.PACKAGES);
    const idx = list.findIndex((p) => p.id === updatedPkg.id);
    if (idx >= 0) {
      list[idx] = updatedPkg;
    } else {
      list.unshift(updatedPkg);
    }
    writeList(STORAGE_KEYS.PACKAGES, list);
    writeList(STORAGE_KEYS.PACKAGES_BACKUP, list);

    const deleted = readList<string>(STORAGE_KEYS.DELETED_PACKAGES).filter((id) => id !== updatedPkg.id);
    writeList(STORAGE_KEYS.DELETED_PACKAGES, deleted);

    const pending = new Set(readList<string>(STORAGE_KEYS.PENDING_PACKAGES));
    pending.add(updatedPkg.id);
    writeList(STORAGE_KEYS.PENDING_PACKAGES, Array.from(pending));

    notifyDataChange();
    supabaseAdapter
      .savePackage(updatedPkg)
      .then(() => {
        const afterPending = readList<string>(STORAGE_KEYS.PENDING_PACKAGES).filter(
          (id) => id !== updatedPkg.id
        );
        writeList(STORAGE_KEYS.PENDING_PACKAGES, afterPending);
      })
      .catch(console.error);
    this.persistPackageMetaToCloud(updatedPkg, actorId);
    this.addAuditLog(updatedPkg.organizacaoId, actorId, 'CRIAR_PACOTE', 'Pacote', updatedPkg.id, `${updatedPkg.nome} - R$ ${(updatedPkg.valorCentavos / 100).toFixed(2)} (${updatedPkg.formaPagamento})`);
  },

  async createPackageAsync(pkg: PackageOffer, actorId: string): Promise<void> {
    const updatedPkg: PackageOffer = {
      ...pkg,
      atualizadoEm: new Date().toISOString()
    };
    const list = readList<PackageOffer>(STORAGE_KEYS.PACKAGES);
    const idx = list.findIndex((p) => p.id === updatedPkg.id);
    if (idx >= 0) {
      list[idx] = updatedPkg;
    } else {
      list.unshift(updatedPkg);
    }
    writeList(STORAGE_KEYS.PACKAGES, list);
    writeList(STORAGE_KEYS.PACKAGES_BACKUP, list);

    const deleted = readList<string>(STORAGE_KEYS.DELETED_PACKAGES).filter((id) => id !== updatedPkg.id);
    writeList(STORAGE_KEYS.DELETED_PACKAGES, deleted);

    const pending = new Set(readList<string>(STORAGE_KEYS.PENDING_PACKAGES));
    pending.add(updatedPkg.id);
    writeList(STORAGE_KEYS.PENDING_PACKAGES, Array.from(pending));

    notifyDataChange();
    if (supabaseAdapter.enabled) {
      await supabaseAdapter.savePackage(updatedPkg).catch(console.error);
      const afterPending = readList<string>(STORAGE_KEYS.PENDING_PACKAGES).filter(
        (id) => id !== updatedPkg.id
      );
      writeList(STORAGE_KEYS.PENDING_PACKAGES, afterPending);
    }
    this.persistPackageMetaToCloud(updatedPkg, actorId);
    this.addAuditLog(updatedPkg.organizacaoId, actorId, 'CRIAR_PACOTE', 'Pacote', updatedPkg.id, `${updatedPkg.nome} - R$ ${(updatedPkg.valorCentavos / 100).toFixed(2)} (${updatedPkg.formaPagamento})`);
    notifyDataChange();
  },

  savePackage(pkg: PackageOffer): void {
    const list = readList<PackageOffer>(STORAGE_KEYS.PACKAGES);
    const index = list.findIndex((p) => p.id === pkg.id);
    const updatedPkg: PackageOffer = {
      ...pkg,
      instrutorId: pkg.instrutorId || (index >= 0 ? list[index].instrutorId : undefined),
      instrutorNome: pkg.instrutorNome || (index >= 0 ? list[index].instrutorNome : undefined),
      atualizadoEm: pkg.atualizadoEm || new Date().toISOString()
    };
    if (index >= 0) {
      list[index] = updatedPkg;
    } else {
      list.push(updatedPkg);
    }
    writeList(STORAGE_KEYS.PACKAGES, list);
    writeList(STORAGE_KEYS.PACKAGES_BACKUP, list);

    const deleted = readList<string>(STORAGE_KEYS.DELETED_PACKAGES).filter((id) => id !== updatedPkg.id);
    writeList(STORAGE_KEYS.DELETED_PACKAGES, deleted);

    const pending = new Set(readList<string>(STORAGE_KEYS.PENDING_PACKAGES));
    pending.add(updatedPkg.id);
    writeList(STORAGE_KEYS.PENDING_PACKAGES, Array.from(pending));

    notifyDataChange();
    supabaseAdapter
      .savePackage(updatedPkg)
      .then(() => {
        const afterPending = readList<string>(STORAGE_KEYS.PENDING_PACKAGES).filter(
          (id) => id !== updatedPkg.id
        );
        writeList(STORAGE_KEYS.PENDING_PACKAGES, afterPending);
      })
      .catch(console.error);
    if (updatedPkg.instrutorId) {
      this.persistPackageMetaToCloud(updatedPkg, updatedPkg.instrutorId);
    }
  },

  togglePackageStatus(packageId: string, actorId: string): void {
    const list = readList<PackageOffer>(STORAGE_KEYS.PACKAGES);
    const pkg = list.find((p) => p.id === packageId);
    if (pkg) {
      pkg.ativo = !pkg.ativo;
      pkg.atualizadoEm = new Date().toISOString();
      writeList(STORAGE_KEYS.PACKAGES, list);
      writeList(STORAGE_KEYS.PACKAGES_BACKUP, list);

      const pending = new Set(readList<string>(STORAGE_KEYS.PENDING_PACKAGES));
      pending.add(pkg.id);
      writeList(STORAGE_KEYS.PENDING_PACKAGES, Array.from(pending));

      notifyDataChange();
      supabaseAdapter
        .savePackage(pkg)
        .then(() => {
          const afterPending = readList<string>(STORAGE_KEYS.PENDING_PACKAGES).filter((id) => id !== pkg.id);
          writeList(STORAGE_KEYS.PENDING_PACKAGES, afterPending);
        })
        .catch(console.error);
      this.persistPackageMetaToCloud(pkg, actorId);
      this.addAuditLog(pkg.organizacaoId, actorId, 'ALTERAR_STATUS_PACOTE', 'Pacote', pkg.id, `Status alterado para ${pkg.ativo ? 'ATIVO' : 'INATIVO'}`);
    }
  },

  async togglePackageStatusAsync(packageId: string, actorId: string): Promise<void> {
    const list = readList<PackageOffer>(STORAGE_KEYS.PACKAGES);
    const pkg = list.find((p) => p.id === packageId);
    if (pkg) {
      pkg.ativo = !pkg.ativo;
      pkg.atualizadoEm = new Date().toISOString();
      writeList(STORAGE_KEYS.PACKAGES, list);
      writeList(STORAGE_KEYS.PACKAGES_BACKUP, list);

      const pending = new Set(readList<string>(STORAGE_KEYS.PENDING_PACKAGES));
      pending.add(pkg.id);
      writeList(STORAGE_KEYS.PENDING_PACKAGES, Array.from(pending));

      notifyDataChange();
      if (supabaseAdapter.enabled) {
        await supabaseAdapter.savePackage(pkg).catch(console.error);
        const afterPending = readList<string>(STORAGE_KEYS.PENDING_PACKAGES).filter((id) => id !== pkg.id);
        writeList(STORAGE_KEYS.PENDING_PACKAGES, afterPending);
      }
      this.persistPackageMetaToCloud(pkg, actorId);
      this.addAuditLog(pkg.organizacaoId, actorId, 'ALTERAR_STATUS_PACOTE', 'Pacote', pkg.id, `Status alterado para ${pkg.ativo ? 'ATIVO' : 'INATIVO'}`);
      notifyDataChange();
    }
  },

  updatePackage(pkg: PackageOffer, actorId: string): void {
    const updatedPkg: PackageOffer = {
      ...pkg,
      atualizadoEm: new Date().toISOString()
    };
    const list = readList<PackageOffer>(STORAGE_KEYS.PACKAGES);
    const index = list.findIndex((p) => p.id === updatedPkg.id);
    if (index >= 0) {
      list[index] = {
        ...list[index],
        ...updatedPkg,
        instrutorId: updatedPkg.instrutorId || list[index].instrutorId,
        instrutorNome: updatedPkg.instrutorNome || list[index].instrutorNome
      };
    } else {
      list.push(updatedPkg);
    }
    writeList(STORAGE_KEYS.PACKAGES, list);
    writeList(STORAGE_KEYS.PACKAGES_BACKUP, list);

    const pending = new Set(readList<string>(STORAGE_KEYS.PENDING_PACKAGES));
    pending.add(updatedPkg.id);
    writeList(STORAGE_KEYS.PENDING_PACKAGES, Array.from(pending));

    notifyDataChange();
    supabaseAdapter
      .savePackage(updatedPkg)
      .then(() => {
        const afterPending = readList<string>(STORAGE_KEYS.PENDING_PACKAGES).filter(
          (id) => id !== updatedPkg.id
        );
        writeList(STORAGE_KEYS.PENDING_PACKAGES, afterPending);
      })
      .catch(console.error);
    this.persistPackageMetaToCloud(updatedPkg, actorId);
    this.addAuditLog(updatedPkg.organizacaoId, actorId, 'ATUALIZAR_PACOTE', 'Pacote', updatedPkg.id, `Atualizado pacote ${updatedPkg.nome} - R$ ${(updatedPkg.valorCentavos / 100).toFixed(2)}`);
  },

  async updatePackageAsync(pkg: PackageOffer, actorId: string): Promise<void> {
    const updatedPkg: PackageOffer = {
      ...pkg,
      atualizadoEm: new Date().toISOString()
    };
    const list = readList<PackageOffer>(STORAGE_KEYS.PACKAGES);
    const index = list.findIndex((p) => p.id === updatedPkg.id);
    if (index >= 0) {
      list[index] = {
        ...list[index],
        ...updatedPkg,
        instrutorId: updatedPkg.instrutorId || list[index].instrutorId,
        instrutorNome: updatedPkg.instrutorNome || list[index].instrutorNome
      };
    } else {
      list.push(updatedPkg);
    }
    writeList(STORAGE_KEYS.PACKAGES, list);
    writeList(STORAGE_KEYS.PACKAGES_BACKUP, list);

    const pending = new Set(readList<string>(STORAGE_KEYS.PENDING_PACKAGES));
    pending.add(updatedPkg.id);
    writeList(STORAGE_KEYS.PENDING_PACKAGES, Array.from(pending));

    notifyDataChange();
    if (supabaseAdapter.enabled) {
      await supabaseAdapter.savePackage(updatedPkg).catch(console.error);
      const afterPending = readList<string>(STORAGE_KEYS.PENDING_PACKAGES).filter(
        (id) => id !== updatedPkg.id
      );
      writeList(STORAGE_KEYS.PENDING_PACKAGES, afterPending);
    }
    this.persistPackageMetaToCloud(updatedPkg, actorId);
    this.addAuditLog(updatedPkg.organizacaoId, actorId, 'ATUALIZAR_PACOTE', 'Pacote', updatedPkg.id, `Atualizado pacote ${updatedPkg.nome} - R$ ${(updatedPkg.valorCentavos / 100).toFixed(2)}`);
    notifyDataChange();
  },

  deletePackage(packageId: string, actorId: string): void {
    const list = readList<PackageOffer>(STORAGE_KEYS.PACKAGES);
    const pkg = list.find((p) => p.id === packageId);
    const filtered = list.filter((p) => p.id !== packageId);
    writeList(STORAGE_KEYS.PACKAGES, filtered);
    writeList(STORAGE_KEYS.PACKAGES_BACKUP, filtered);

    const pending = readList<string>(STORAGE_KEYS.PENDING_PACKAGES).filter((id) => id !== packageId);
    writeList(STORAGE_KEYS.PENDING_PACKAGES, pending);

    const deleted = new Set(readList<string>(STORAGE_KEYS.DELETED_PACKAGES));
    deleted.add(packageId);
    writeList(STORAGE_KEYS.DELETED_PACKAGES, Array.from(deleted));

    notifyDataChange();
    supabaseAdapter.deletePackage(packageId).catch(console.error);
    if (pkg) {
      this.addAuditLog(pkg.organizacaoId, actorId, 'EXCLUIR_PACOTE', 'Pacote', pkg.id, `Excluído pacote ${pkg.nome}`);
    }
  },

  async deletePackageAsync(packageId: string, actorId: string): Promise<void> {
    const list = readList<PackageOffer>(STORAGE_KEYS.PACKAGES);
    const pkg = list.find((p) => p.id === packageId);
    const filtered = list.filter((p) => p.id !== packageId);
    writeList(STORAGE_KEYS.PACKAGES, filtered);
    writeList(STORAGE_KEYS.PACKAGES_BACKUP, filtered);

    const pending = readList<string>(STORAGE_KEYS.PENDING_PACKAGES).filter((id) => id !== packageId);
    writeList(STORAGE_KEYS.PENDING_PACKAGES, pending);

    const deleted = new Set(readList<string>(STORAGE_KEYS.DELETED_PACKAGES));
    deleted.add(packageId);
    writeList(STORAGE_KEYS.DELETED_PACKAGES, Array.from(deleted));

    notifyDataChange();
    if (supabaseAdapter.enabled) {
      await supabaseAdapter.deletePackage(packageId).catch(console.error);
    }
    if (pkg) {
      this.addAuditLog(pkg.organizacaoId, actorId, 'EXCLUIR_PACOTE', 'Pacote', pkg.id, `Excluído pacote ${pkg.nome}`);
    }
    notifyDataChange();
  },

  // Cobertura Geográfica do Instrutor (Raio 5 a 40 km, Cidades Atendidas, Veículos e Câmbio)
  getInstructorCoverage(instrutorId: string): InstructorCoverageProfile | undefined {
    const list = readList<InstructorCoverageProfile>(STORAGE_KEYS.INSTRUCTOR_COVERAGE);
    return list.find((c) => c.instrutorId === instrutorId);
  },

  getAllInstructorCoverages(): InstructorCoverageProfile[] {
    return readList<InstructorCoverageProfile>(STORAGE_KEYS.INSTRUCTOR_COVERAGE);
  },

  async saveInstructorCoverageAsync(profile: InstructorCoverageProfile): Promise<void> {
    const list = readList<InstructorCoverageProfile>(STORAGE_KEYS.INSTRUCTOR_COVERAGE);
    const normalized: InstructorCoverageProfile = {
      ...profile,
      raioAtendimentoKm: Math.max(5, Math.min(40, Math.round(profile.raioAtendimentoKm || 20))),
      atualizadoEm: new Date().toISOString()
    };
    const idx = list.findIndex((c) => c.instrutorId === normalized.instrutorId);
    if (idx >= 0) {
      list[idx] = normalized;
    } else {
      list.push(normalized);
    }
    writeList(STORAGE_KEYS.INSTRUCTOR_COVERAGE, list);

    // Também atualiza cidade/estado/bairro base no cadastro do usuário se estiver vazio
    const users = readList<User>(STORAGE_KEYS.USERS);
    const uIdx = users.findIndex((u) => u.id === normalized.instrutorId);
    if (uIdx >= 0) {
      users[uIdx].cidade = normalized.cidadeBase || users[uIdx].cidade;
      users[uIdx].estado = normalized.estadoBase || users[uIdx].estado;
      users[uIdx].bairro = normalized.bairroBase || users[uIdx].bairro;
      writeList(STORAGE_KEYS.USERS, users);
      if (supabaseAdapter.enabled) {
        supabaseAdapter.saveUser(users[uIdx]).catch(console.error);
      }
    }

    const auditEntry: AuditLog = {
      id: `cov_${normalized.instrutorId}`,
      organizacaoId: normalized.organizacaoId,
      usuarioId: normalized.instrutorId,
      usuarioNome: users[uIdx]?.nome || 'Instrutor',
      acao: 'CONFIGURAR_COBERTURA_GEOGRAFICA',
      entidade: 'InstructorCoverage',
      entidadeId: normalized.instrutorId,
      detalhes: JSON.stringify(normalized),
      timestamp: normalized.atualizadoEm
    };

    notifyDataChange();
    if (supabaseAdapter.enabled) {
      await supabaseAdapter.addAuditLog(auditEntry).catch(console.error);
    }
    notifyDataChange();
  },

  // Solicitações de Alunos à Procura de Instrutor (Demanda Reversa)
  getStudentLeads(): StudentLeadRequest[] {
    const list = readList<StudentLeadRequest>(STORAGE_KEYS.STUDENT_LEADS);
    return list.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  },

  async createStudentLeadAsync(lead: StudentLeadRequest): Promise<void> {
    const list = readList<StudentLeadRequest>(STORAGE_KEYS.STUDENT_LEADS);
    const idx = list.findIndex((l) => l.id === lead.id);
    if (idx >= 0) {
      list[idx] = lead;
    } else {
      list.unshift(lead);
    }
    writeList(STORAGE_KEYS.STUDENT_LEADS, list);

    const defaultOrgId = this.getOrganizations()[0]?.id || 'org_direcao_certa_01';
    const auditEntry: AuditLog = {
      id: lead.id,
      organizacaoId: defaultOrgId,
      usuarioId: lead.id,
      usuarioNome: lead.nome,
      acao: 'CADASTRO_PROCURA_INSTRUTOR',
      entidade: 'StudentLeadRequest',
      entidadeId: lead.id,
      detalhes: JSON.stringify(lead),
      timestamp: lead.criadoEm
    };

    notifyDataChange();
    if (supabaseAdapter.enabled) {
      await supabaseAdapter.addAuditLog(auditEntry).catch(console.error);
    }
    notifyDataChange();
  },

  async updateStudentLeadStatusAsync(
    leadId: string,
    status: StudentLeadRequest['status'],
    instrutor?: User
  ): Promise<void> {
    const list = readList<StudentLeadRequest>(STORAGE_KEYS.STUDENT_LEADS);
    const lead = list.find((l) => l.id === leadId);
    if (!lead) return;
    lead.status = status;
    if (instrutor) {
      lead.atendidoPorInstrutorId = instrutor.id;
      lead.atendidoPorInstrutorNome = instrutor.nome;
    }
    writeList(STORAGE_KEYS.STUDENT_LEADS, list);

    const defaultOrgId = instrutor?.organizacaoId || this.getOrganizations()[0]?.id || 'org_direcao_certa_01';
    const auditEntry: AuditLog = {
      id: lead.id,
      organizacaoId: defaultOrgId,
      usuarioId: instrutor?.id || lead.id,
      usuarioNome: instrutor?.nome || lead.nome,
      acao: 'ATUALIZAR_PROCURA_INSTRUTOR',
      entidade: 'StudentLeadRequest',
      entidadeId: lead.id,
      detalhes: JSON.stringify(lead),
      timestamp: new Date().toISOString()
    };

    notifyDataChange();
    if (supabaseAdapter.enabled) {
      await supabaseAdapter.addAuditLog(auditEntry).catch(console.error);
    }
    notifyDataChange();
  },

  // Discount Coupons (PLATAFORMA = Master → instrutores | ALUNO = instrutor → alunos)
  getCoupons(filter?: CouponListFilter): DiscountCoupon[] {
    return couponStore.list(filter);
  },

  getCouponByCode(code: string): DiscountCoupon | undefined {
    return couponStore.getByCode(code);
  },

  saveCoupon(coupon: DiscountCoupon, actorId: string): { success: boolean; error?: string; coupon?: DiscountCoupon } {
    const isNew = !couponStore.getAll().some((c) => c.id === coupon.id);
    const res = couponStore.save(coupon);
    if (res.success && res.coupon) {
      const orgId = res.coupon.organizacaoId || this.getOrganizations()[0]?.id || 'SISTEMA';
      this.addAuditLog(
        orgId,
        actorId,
        isNew ? 'CRIAR_CUPOM' : 'ATUALIZAR_CUPOM',
        'Cupom',
        res.coupon.id,
        `${isNew ? 'Criado' : 'Atualizado'} cupom ${res.coupon.codigo} (${res.coupon.escopo} · ${res.coupon.tipoDesconto})`
      );
    }
    return res;
  },

  toggleCoupon(couponId: string, actorId: string): void {
    const c = couponStore.toggle(couponId);
    if (c) {
      const orgId = c.organizacaoId || this.getOrganizations()[0]?.id || 'SISTEMA';
      this.addAuditLog(orgId, actorId, 'ALTERAR_STATUS_CUPOM', 'Cupom', c.id, `Cupom ${c.codigo} ${c.ativo ? 'ativado' : 'desativado'}`);
    }
  },

  deleteCoupon(couponId: string, actorId: string): { success: boolean; error?: string } {
    const c = couponStore.getAll().find((x) => x.id === couponId);
    const res = couponStore.remove(couponId);
    if (res.success && c) {
      const orgId = c.organizacaoId || this.getOrganizations()[0]?.id || 'SISTEMA';
      this.addAuditLog(orgId, actorId, 'EXCLUIR_CUPOM', 'Cupom', c.id, `Excluído cupom ${c.codigo}`);
    }
    return res;
  },

  previewCoupon(code: string, ctx: CouponValidationContext, valorOriginalCentavos: number): CouponPreview {
    return couponStore.preview(code, ctx, valorOriginalCentavos);
  },

  redeemCoupon(
    code: string,
    ctx: CouponValidationContext,
    valorOriginalCentavos: number,
    meta: { organizacaoId: string; usuarioId?: string; alunoId?: string },
    actorId: string
  ): CouponPreview & { redemption?: CouponRedemption } {
    const res = couponStore.redeem(code, ctx, valorOriginalCentavos, meta);
    if (res.valid && res.redemption) {
      this.addAuditLog(
        meta.organizacaoId,
        actorId,
        'RESGATE_CUPOM',
        'Cupom',
        res.redemption.cupomId,
        `Cupom ${res.redemption.codigo} aplicado em ${res.redemption.referenciaId}: ${res.result?.resumo || ''}`
      );
    }
    return res;
  },

  getCouponRedemptions(filter?: { cupomId?: string; organizacaoId?: string }): CouponRedemption[] {
    return couponStore.getRedemptions(filter);
  },

  /**
   * Valida regra estrita de negócio: cada aluno (CPF) fica acondicionado a apenas 1 instrutor por vez
   */
  checkStudentCPFEnrollment(orgId: string, cpfRaw: string, ignoreStudentId?: string): {
    alreadyRegistered: boolean;
    student?: Student;
    instructor?: User;
    message?: string;
  } {
    const fingerprint = generateCPFFingerprint(cpfRaw);
    const students = this.getStudents(orgId);
    const existing = students.find((s) => s.cpfFingerprint === fingerprint && s.id !== ignoreStudentId);
    if (!existing) {
      return { alreadyRegistered: false };
    }
    const instructor = this.getUsers(orgId).find((u) => u.id === existing.instrutorId);
    const instrName = instructor ? instructor.nome : 'Outro Instrutor';
    return {
      alreadyRegistered: true,
      student: existing,
      instructor,
      message: `Este CPF já está cadastrado no sistema e condicionado ao instrutor ${instrName}. Conforme regra do sistema, cada aluno fica acondicionado a apenas 1 instrutor. Para transferir este aluno, acesse o ambiente do instrutor atual e realize a transferência oficial para registrar o histórico e auditoria.`
    };
  },

  // Audit Logs (LGPD e Conformidade)
  getAuditLogs(orgId: string): AuditLog[] {
    return readList<AuditLog>(STORAGE_KEYS.AUDIT)
      .filter((a) => a.organizacaoId === orgId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  addAuditLog(orgId: string, usuarioId: string, acao: string, entidade: string, entidadeId: string, detalhes: string): void {
    const user = this.getCurrentUser();
    const list = readList<AuditLog>(STORAGE_KEYS.AUDIT);
    const newLog: AuditLog = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      organizacaoId: orgId,
      usuarioId: user ? user.id : usuarioId,
      usuarioNome: user ? user.nome : 'Sistema',
      acao,
      entidade,
      entidadeId,
      detalhes,
      timestamp: new Date().toISOString()
    };
    list.unshift(newLog);
    // Keep max 200 logs
    if (list.length > 200) list.length = 200;
    writeList(STORAGE_KEYS.AUDIT, list);
    supabaseAdapter.addAuditLog(newLog).catch(console.error);
  },

  // WhatsApp Reminder Logs
  getWhatsAppLogs(orgId: string): WhatsAppReminderLog[] {
    return readList<WhatsAppReminderLog>(STORAGE_KEYS.WHATSAPP_LOGS)
      .filter((w) => w.organizacaoId === orgId)
      .sort((a, b) => new Date(b.enviadoEm).getTime() - new Date(a.enviadoEm).getTime());
  },

  logWhatsAppReminder(log: WhatsAppReminderLog): void {
    const list = readList<WhatsAppReminderLog>(STORAGE_KEYS.WHATSAPP_LOGS);
    list.unshift(log);
    writeList(STORAGE_KEYS.WHATSAPP_LOGS, list);
    supabaseAdapter.logWhatsApp(log).catch(console.error);
  },

  // Offline Sync Queue
  getSyncQueue(): SyncQueueItem[] {
    return readList<SyncQueueItem>(STORAGE_KEYS.SYNC_QUEUE);
  },

  addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>): void {
    const queue = this.getSyncQueue();
    queue.push({
      ...item,
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      retryCount: 0
    });
    writeList(STORAGE_KEYS.SYNC_QUEUE, queue);
  },

  clearSyncQueue(): void {
    writeList(STORAGE_KEYS.SYNC_QUEUE, []);
  },

  // Validação de Recuperação de Senha por E-mail e CPF
  validateUserForPasswordRecovery(email: string, cpfInput: string): {
    success: boolean;
    user?: User;
    code?: string;
    message: string;
  } {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCpfDigits = cpfInput.replace(/\D/g, '');

    if (!cleanEmail || !cleanCpfDigits) {
      return {
        success: false,
        message: 'Por favor, informe tanto o e-mail quanto o CPF cadastrado.'
      };
    }

    const user = this.getUserByEmail(cleanEmail);
    if (!user) {
      return {
        success: false,
        message: 'Usuário não localizado no sistema. Verifique o e-mail informado.'
      };
    }

    // Validação estrita do CPF
    const userCpfDigits = user.cpfCompleto ? user.cpfCompleto.replace(/\D/g, '') : '';
    const userLast4 = user.cpfUltimos4 || '';
    const inputLast4 = cleanCpfDigits.slice(-4);

    let cpfMatches = false;
    if (userCpfDigits && userCpfDigits === cleanCpfDigits) {
      cpfMatches = true;
    } else if (user.cpfFingerprint && user.cpfFingerprint === generateCPFFingerprint(cleanCpfDigits)) {
      cpfMatches = true;
    } else if (userLast4 && userLast4 === inputLast4) {
      cpfMatches = true;
    }

    if (!cpfMatches) {
      return {
        success: false,
        message: 'Os dados não conferem. Por segurança e conformidade LGPD, a recuperação exige a confirmação estrita do CPF e do e-mail cadastrado.'
      };
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.addAuditLog(
      user.organizacaoId,
      user.id,
      'SOLICITACAO_RECUPERACAO_SENHA',
      'Usuario',
      user.id,
      `Solicitação de recuperação de senha confirmada com validação de CPF e E-mail para ${user.email}`
    );

    return {
      success: true,
      user,
      code,
      message: `Código de verificação gerado e enviado para ${user.email}!`
    };
  },

  updateUserPassword(userId: string, newPassword: string): boolean {
    const users = readList<User>(STORAGE_KEYS.USERS);
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) return false;

    users[index].senhaTemporaria = newPassword;
    users[index].ultimoAcesso = new Date().toISOString();
    writeList(STORAGE_KEYS.USERS, users);

    // Sincronizar com Supabase PostgreSQL
    supabaseAdapter.saveUser(users[index]).catch(console.error);

    // Se o usuário logado for o mesmo, atualizar sessão local
    const current = this.getCurrentUser();
    if (current && current.id === userId) {
      current.senhaTemporaria = newPassword;
      current.ultimoAcesso = users[index].ultimoAcesso;
      this.setCurrentUser(current);
    }

    this.addAuditLog(
      users[index].organizacaoId,
      userId,
      'REDEFINICAO_SENHA',
      'Usuario',
      userId,
      `Senha redefinida com sucesso para o usuário ${users[index].nome} (${users[index].email})`
    );
    return true;
  },

  async updateUserPasswordAsync(userId: string, newPassword: string): Promise<boolean> {
    const users = readList<User>(STORAGE_KEYS.USERS);
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) return false;

    users[index].senhaTemporaria = newPassword;
    users[index].ultimoAcesso = new Date().toISOString();
    writeList(STORAGE_KEYS.USERS, users);

    try {
      await supabaseAdapter.saveUser(users[index]);
    } catch (e) {
      console.error('[Supabase] Erro ao sincronizar nova senha:', e);
    }

    const current = this.getCurrentUser();
    if (current && current.id === userId) {
      current.senhaTemporaria = newPassword;
      current.ultimoAcesso = users[index].ultimoAcesso;
      this.setCurrentUser(current);
    }

    this.addAuditLog(
      users[index].organizacaoId,
      userId,
      'REDEFINICAO_SENHA',
      'Usuario',
      userId,
      `Senha redefinida com sucesso para o usuário ${users[index].nome} (${users[index].email})`
    );
    return true;
  },

  // Cadastro de Novo Administrador Master
  createMasterUser(
    data: {
      nome: string;
      email: string;
      telefone: string;
      cpf: string;
      senha: string;
      cep?: string;
      estado?: string;
      cidade?: string;
      bairro?: string;
      logradouro?: string;
      numero?: string;
      complemento?: string;
    },
    actorId?: string
  ): { success: boolean; user?: User; message?: string } {
    const cleanEmail = (data.email || '').trim().toLowerCase();
    const cleanNome = (data.nome || '').trim();
    const cleanTelefone = (data.telefone || '').trim();
    const cleanCpfDigits = (data.cpf || '').replace(/\D/g, '');
    const cleanSenha = (data.senha || '').trim();

    if (!cleanNome || cleanNome.length < 3) {
      return { success: false, message: 'O nome do Administrador Master deve conter no mínimo 3 caracteres.' };
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: 'Informe um endereço de e-mail válido.' };
    }

    const existingUser = this.getUserByEmail(cleanEmail);
    if (existingUser) {
      return { success: false, message: `Já existe um usuário cadastrado com o e-mail ${cleanEmail}.` };
    }

    if (cleanCpfDigits.length !== 11) {
      return { success: false, message: 'O CPF deve possuir exatamente 11 dígitos numéricos.' };
    }

    if (!cleanSenha || cleanSenha.length < 6) {
      return { success: false, message: 'A senha de acesso deve possuir no mínimo 6 caracteres.' };
    }

    const orgs = this.getOrganizations();
    const targetOrgId = orgs[0]?.id || 'org_direcao_certa_01';

    const newMaster: User = {
      id: `usr_master_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      organizacaoId: targetOrgId,
      nome: cleanNome,
      email: cleanEmail,
      papel: 'SUPER_ADMIN',
      telefone: cleanTelefone || '(11) 98765-4321',
      cpfCompleto: data.cpf.trim(),
      cpfMascarado: maskCPF(cleanCpfDigits),
      cpfUltimos4: cleanCpfDigits.slice(-4),
      cpfFingerprint: generateCPFFingerprint(cleanCpfDigits),
      cep: (data.cep || '').trim() || undefined,
      estado: (data.estado || '').trim().toUpperCase() || undefined,
      cidade: (data.cidade || '').trim() || undefined,
      bairro: (data.bairro || '').trim() || undefined,
      logradouro: (data.logradouro || '').trim() || undefined,
      numero: (data.numero || '').trim() || undefined,
      complemento: (data.complemento || '').trim() || undefined,
      senhaTemporaria: cleanSenha,
      twoFactorAtivo: true,
      ultimoAcesso: new Date().toISOString()
    };

    this.createUser(newMaster);

    this.addAuditLog(
      targetOrgId,
      actorId || newMaster.id,
      'CRIACAO_MASTER',
      'Usuario',
      newMaster.id,
      `Novo Administrador Master cadastrado: ${newMaster.nome} (${newMaster.email})`
    );

    return { success: true, user: newMaster };
  },

  // Edição dos Dados Cadastrais do Administrador Master
  updateMasterUser(
    userId: string,
    data: {
      nome: string;
      email: string;
      telefone: string;
      cpf: string;
      cep?: string;
      estado?: string;
      cidade?: string;
      bairro?: string;
      logradouro?: string;
      numero?: string;
      complemento?: string;
    },
    actorId?: string
  ): { success: boolean; user?: User; message?: string } {
    const users = readList<User>(STORAGE_KEYS.USERS);
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) {
      return { success: false, message: 'Administrador Master não encontrado.' };
    }

    const cleanEmail = (data.email || '').trim().toLowerCase();
    const cleanNome = (data.nome || '').trim();
    const cleanTelefone = (data.telefone || '').trim();
    const cleanCpfDigits = (data.cpf || '').replace(/\D/g, '');

    if (!cleanNome || cleanNome.length < 3) {
      return { success: false, message: 'O nome deve conter no mínimo 3 caracteres.' };
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: 'Informe um e-mail válido.' };
    }

    // Se mudou o e-mail, verificar se outro usuário já possui
    if (cleanEmail !== users[index].email.toLowerCase()) {
      const emailInUse = users.some((u) => u.id !== userId && u.email.toLowerCase() === cleanEmail);
      if (emailInUse) {
        return { success: false, message: `O e-mail ${cleanEmail} já está em uso por outro usuário.` };
      }
    }

    // Se o CPF foi alterado
    if (cleanCpfDigits) {
      if (cleanCpfDigits.length !== 11) {
        return { success: false, message: 'O CPF deve possuir exatamente 11 dígitos numéricos.' };
      }
      users[index].cpfCompleto = data.cpf.trim();
      users[index].cpfMascarado = maskCPF(cleanCpfDigits);
      users[index].cpfUltimos4 = cleanCpfDigits.slice(-4);
      users[index].cpfFingerprint = generateCPFFingerprint(cleanCpfDigits);
    }

    users[index].nome = cleanNome;
    users[index].email = cleanEmail;
    users[index].telefone = cleanTelefone;
    users[index].cep = (data.cep || '').trim() || undefined;
    users[index].estado = (data.estado || '').trim().toUpperCase() || undefined;
    users[index].cidade = (data.cidade || '').trim() || undefined;
    users[index].bairro = (data.bairro || '').trim() || undefined;
    users[index].logradouro = (data.logradouro || '').trim() || undefined;
    users[index].numero = (data.numero || '').trim() || undefined;
    users[index].complemento = (data.complemento || '').trim() || undefined;
    users[index].papel = 'SUPER_ADMIN'; // Garante persistência do papel Master
    users[index].ultimoAcesso = new Date().toISOString();

    writeList(STORAGE_KEYS.USERS, users);
    supabaseAdapter.saveUser(users[index]).catch(console.error);

    const current = this.getCurrentUser();
    if (current && current.id === userId) {
      this.setCurrentUser(users[index]);
    }

    this.addAuditLog(
      users[index].organizacaoId,
      actorId || userId,
      'ATUALIZACAO_MASTER',
      'Usuario',
      userId,
      `Dados cadastrais do Administrador Master atualizados: ${users[index].nome} (${users[index].email})`
    );

    return { success: true, user: users[index] };
  },

  // Troca de Senha do Administrador Master
  changeMasterPassword(
    userId: string,
    newPassword: string,
    actorId?: string
  ): { success: boolean; message?: string } {
    if (!newPassword || newPassword.trim().length < 6) {
      return { success: false, message: 'A nova senha deve possuir no mínimo 6 caracteres.' };
    }

    const ok = this.updateUserPassword(userId, newPassword.trim());
    if (!ok) {
      return { success: false, message: 'Usuário Master não encontrado para alteração de senha.' };
    }

    if (actorId && actorId !== userId) {
      const users = this.getUsers();
      const target = users.find((u) => u.id === userId);
      this.addAuditLog(
        target?.organizacaoId || 'org_direcao_certa_01',
        actorId,
        'TROCA_SENHA_MASTER_POR_TERCEIRO',
        'Usuario',
        userId,
        `Senha do Administrador Master ${target?.nome} foi alterada pelo Master ID: ${actorId}`
      );
    }

    return { success: true, message: 'Senha do Administrador Master atualizada com sucesso!' };
  },

  /**
   * Força o envio completo de todos os dados locais para o banco Supabase em ordem estrita de integridade
   */
  async pushAllLocalDataToSupabase(onProgress?: (msg: string) => void): Promise<{
    success: boolean;
    stats: Record<string, number>;
    errors: string[];
  }> {
    const errors: string[] = [];
    const stats: Record<string, number> = {
      organizations: 0,
      users: 0,
      students: 0,
      packages: 0,
      vehicles: 0,
      lessons: 0,
      slots: 0,
      coupons: 0
    };

    try {
      // 1. Organizações (devem ser persistidas primeiro para evitar violações de chave estrangeira em usuários e alunos)
      const orgs = this.getOrganizations();
      onProgress?.(`Gravando ${orgs.length} organização(ões) no Supabase...`);
      for (const org of orgs) {
        try {
          await supabaseAdapter.saveOrganization(org);
          stats.organizations++;
        } catch (e: any) {
          errors.push(`Org ${org.nome}: ${e.message}`);
        }
      }

      // 2. Usuários / Instrutores
      const users = this.getUsers();
      onProgress?.(`Gravando ${users.length} usuário(s)/instrutor(es) no Supabase...`);
      for (const user of users) {
        try {
          await supabaseAdapter.saveUser(user);
          stats.users++;
        } catch (e: any) {
          errors.push(`User ${user.nome}: ${e.message}`);
        }
      }

      // 3. Pacotes de Aulas
      const packages = readList<PackageOffer>(STORAGE_KEYS.PACKAGES);
      onProgress?.(`Gravando ${packages.length} pacote(s) no Supabase...`);
      for (const pkg of packages) {
        try {
          await supabaseAdapter.savePackage(pkg);
          stats.packages++;
        } catch (e: any) {
          errors.push(`Pacote ${pkg.nome}: ${e.message}`);
        }
      }

      // 4. Alunos
      const students = readList<Student>(STORAGE_KEYS.STUDENTS);
      onProgress?.(`Gravando ${students.length} aluno(s) no Supabase...`);
      for (const st of students) {
        try {
          await supabaseAdapter.saveStudent(st);
          stats.students++;
        } catch (e: any) {
          errors.push(`Aluno ${st.nome}: ${e.message}`);
        }
      }

      // 5. Veículos
      const vehicles = readList<Vehicle>(STORAGE_KEYS.VEHICLES);
      for (const v of vehicles) {
        try {
          await supabaseAdapter.saveVehicle(v);
          stats.vehicles++;
        } catch (e: any) {
          errors.push(`Veículo ${v.modelo}: ${e.message}`);
        }
      }

      // 6. Slots e Aulas
      const slots = readList<AvailableSlot>(STORAGE_KEYS.SLOTS);
      for (const sl of slots) {
        try {
          await supabaseAdapter.saveSlot(sl);
          stats.slots++;
        } catch (e: any) {
          errors.push(`Slot ${sl.id}: ${e.message}`);
        }
      }
      const lessons = readList<Lesson>(STORAGE_KEYS.LESSONS);
      for (const ls of lessons) {
        try {
          await supabaseAdapter.saveLesson(ls);
          stats.lessons++;
        } catch (e: any) {
          errors.push(`Aula ${ls.id}: ${e.message}`);
        }
      }

      // 7. Cupons de desconto
      const coupons = couponStore.getAll();
      for (const cp of coupons) {
        try {
          await supabaseAdapter.saveCoupon(cp);
          stats.coupons++;
        } catch (e: any) {
          errors.push(`Cupom ${cp.codigo}: ${e.message}`);
        }
      }

      return {
        success: errors.length === 0,
        stats,
        errors
      };
    } catch (err: any) {
      errors.push(`Erro geral: ${err?.message}`);
      return { success: false, stats, errors };
    }
  },

  reassignStudentInstructor(studentId: string, newInstructorId: string, actorId: string): boolean {
    const students = readList<Student>(STORAGE_KEYS.STUDENTS);
    const index = students.findIndex((s) => s.id === studentId);
    if (index === -1) return false;

    const student = students[index];
    const previousInstructorId = student.instrutorId;
    const users = this.getUsers();
    const newInstructor = users.find((u) => u.id === newInstructorId);
    if (!newInstructor) return false;

    student.instrutorId = newInstructorId;
    if (!student.historicoTransferencias) student.historicoTransferencias = [];
    const prevInstructor = users.find((u) => u.id === previousInstructorId);
    student.historicoTransferencias.push({
      id: `tr_${Date.now()}`,
      organizacaoId: student.organizacaoId,
      alunoId: student.id,
      alunoNome: student.nome,
      alunoCpfMascarado: student.cpfMascarado,
      instrutorAnteriorId: previousInstructorId,
      instrutorAnteriorNome: prevInstructor?.nome || 'Instrutor Anterior',
      instrutorNovoId: newInstructorId,
      instrutorNovoNome: newInstructor.nome,
      motivo: 'Reatribuição administrativa pelo Verificador de Cadastros',
      aulasCumpridasAteTransferencia: student.aulasCumpridas,
      dataTransferencia: new Date().toISOString(),
      autorId: actorId,
      autorNome: 'Administrador Master'
    });

    writeList(STORAGE_KEYS.STUDENTS, students);
    this.addAuditLog(
      student.organizacaoId,
      actorId,
      'REATRIBUICAO_INSTRUTOR_ADMIN',
      'Student',
      studentId,
      `Aluno ${student.nome} reatribuído para o instrutor ${newInstructor.nome} via Verificador Master`
    );
    return true;
  },

  // Verificador de Integridade dos Cadastros (Ambiente do Administrador)
  verifyCadastrosIntegrity(orgId?: string): CadastrosIntegrityReport {
    const allUsers = this.getUsers();
    const instructors = allUsers.filter((u) => u.papel === 'INSTRUTOR' || u.papel === 'ADMIN_ORG');
    const orgs = this.getOrganizations();
    const targetOrgId = orgId || orgs[0]?.id || 'org_direcao_certa_01';

    const allStudents = readList<Student>(STORAGE_KEYS.STUDENTS);
    const allLessons = readList<Lesson>(STORAGE_KEYS.LESSONS);
    const allAccounts = readList<AccountReceivable>(STORAGE_KEYS.ACCOUNTS);
    const allPayments = readList<PaymentRecord>(STORAGE_KEYS.PAYMENTS);

    const instructorIdSet = new Set(instructors.map((i) => i.id));
    const studentIdSet = new Set(allStudents.map((s) => s.id));

    // 1. Alunos Órfãos (sem instrutor válido)
    const orphanStudents = allStudents.filter((s) => !s.instrutorId || !instructorIdSet.has(s.instrutorId));

    // 2. Aulas Órfãs (sem aluno ou sem instrutor válido)
    const orphanLessons = allLessons.filter(
      (l) => !l.alunoId || !studentIdSet.has(l.alunoId) || !l.instrutorId || !instructorIdSet.has(l.instrutorId)
    );

    // 3. Contas Financeiras Órfãs (sem aluno válido)
    const orphanAccounts = allAccounts.filter((a) => !a.alunoId || !studentIdSet.has(a.alunoId));

    // 4. Detecção de CPFs duplicados
    const cpfMap: Record<string, string[]> = {};
    allStudents.forEach((s) => {
      if (!cpfMap[s.cpfFingerprint]) cpfMap[s.cpfFingerprint] = [];
      cpfMap[s.cpfFingerprint].push(s.id);
    });
    const duplicateStudentCPFs = Object.entries(cpfMap)
      .filter(([_, ids]) => ids.length > 1)
      .map(([cpfFingerprint, studentIds]) => ({
        cpfFingerprint,
        count: studentIds.length,
        studentIds
      }));

    // 5. Conflitos de Agenda
    const scheduleConflicts: { instructorId: string; date: string; time: string; lessonIds: string[] }[] = [];
    const lessonSlotMap: Record<string, string[]> = {};
    allLessons.forEach((l) => {
      if (l.status !== 'CANCELADA') {
        const key = `${l.instrutorId}_${l.data}_${l.horaInicio}`;
        if (!lessonSlotMap[key]) lessonSlotMap[key] = [];
        lessonSlotMap[key].push(l.id);
      }
    });
    Object.entries(lessonSlotMap).forEach(([key, ids]) => {
      if (ids.length > 1) {
        const [instructorId, date, time] = key.split('_');
        scheduleConflicts.push({ instructorId, date, time, lessonIds: ids });
      }
    });

    // 6. Relações Detalhadas de cada Instrutor e seus Alunos
    const instructorRelations = instructors.map((instructor) => {
      const myStudents = allStudents.filter((s) => s.instrutorId === instructor.id);
      const myLessons = allLessons.filter((l) => l.instrutorId === instructor.id && l.status !== 'CANCELADA');
      const myStudentIds = new Set(myStudents.map((s) => s.id));
      const myAccounts = allAccounts.filter((a) => myStudentIds.has(a.alunoId));
      const totalRevenueCentavos = myAccounts.reduce((acc, a) => acc + (a.valorPagoCentavos || 0), 0);
      const pendingRevenueCentavos = myAccounts.reduce((acc, a) => acc + (a.saldoDevedorCentavos || 0), 0);

      return {
        instructor,
        studentsCount: myStudents.length,
        students: myStudents,
        activeLessonsCount: myLessons.length,
        totalRevenueCentavos,
        pendingRevenueCentavos
      };
    });

    const isAllConsistent =
      orphanStudents.length === 0 &&
      orphanLessons.length === 0 &&
      orphanAccounts.length === 0 &&
      duplicateStudentCPFs.length === 0 &&
      scheduleConflicts.length === 0;

    let deductions = 0;
    deductions += orphanStudents.length * 20;
    deductions += orphanLessons.length * 10;
    deductions += orphanAccounts.length * 10;
    deductions += duplicateStudentCPFs.length * 15;
    deductions += scheduleConflicts.length * 15;
    const score = Math.max(0, 100 - deductions);

    return {
      timestamp: new Date().toISOString(),
      totalInstructors: instructors.length,
      totalStudents: allStudents.length,
      totalLessons: allLessons.length,
      totalAccounts: allAccounts.length,
      totalPayments: allPayments.length,
      orphanStudents,
      orphanLessons,
      orphanAccounts,
      duplicateStudentCPFs,
      scheduleConflicts,
      instructorRelations,
      isAllConsistent,
      score
    };
  },

  // Reset database limpo
  async resetDatabase(): Promise<void> {
    if (supabaseAdapter.enabled) {
      await supabaseAdapter.wipeAllData({ keepMasterAdmin: true });
    }
    seedCleanProductionData();
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem(STORAGE_KEYS.SESSION_EXPIRY);
  },

  // Limpa todos os dados de teste para entrada em produção oficial (Go-Live)
  // Preserva estritamente a conta do Administrador Master (cassiordcosta@gmail.com) e sua Organização Master
  async clearDatabaseForProduction(): Promise<void> {
    if (supabaseAdapter.enabled) {
      await supabaseAdapter.wipeAllData({ keepMasterAdmin: true });
    }
    seedCleanProductionData();
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem(STORAGE_KEYS.SESSION_EXPIRY);
  },

  getAllDataForExport() {
    return {
      organizations: this.getOrganizations(),
      users: this.getUsers(),
      students: readList<Student>(STORAGE_KEYS.STUDENTS),
      vehicles: readList<Vehicle>(STORAGE_KEYS.VEHICLES),
      lessons: readList<Lesson>(STORAGE_KEYS.LESSONS),
      slots: readList<AvailableSlot>(STORAGE_KEYS.SLOTS),
      accounts: readList<AccountReceivable>(STORAGE_KEYS.ACCOUNTS),
      payments: readList<PaymentRecord>(STORAGE_KEYS.PAYMENTS),
      expenses: readList<Expense>(STORAGE_KEYS.EXPENSES),
      investments: readList<Investment>(STORAGE_KEYS.INVESTMENTS),
      packages: readList<PackageOffer>(STORAGE_KEYS.PACKAGES),
      auditLogs: readList<AuditLog>(STORAGE_KEYS.AUDIT),
      whatsappLogs: readList<WhatsAppReminderLog>(STORAGE_KEYS.WHATSAPP_LOGS)
    };
  },

  // ==========================================
  // FIREBASE / FIRESTORE INTEGRATION & MIGRATION
  // ==========================================

  getFirebaseStatus() {
    return {
      configured: true,
      projectId: firebaseConfig.projectId,
      databaseId: firebaseConfig.firestoreDatabaseId,
      authDomain: firebaseConfig.authDomain,
      storageBucket: firebaseConfig.storageBucket,
      lastMigration: localStorage.getItem('agd_last_firestore_migration') || null
    };
  },

  async testFirebaseConnection(): Promise<{ connected: boolean; message: string }> {
    return testConnection();
  },

  /**
   * Migra todos os dados do localStorage diretamente para o Firestore provisionado.
   * Executa em lotes (writeBatch) para otimizar desempenho e respeitar quotas.
   */
  async migrateLocalDataToFirestore(
    onProgress?: (progress: MigrationProgress) => void
  ): Promise<MigrationResult> {
    const collectionsToMigrate: Array<{
      name: string;
      firestorePath: string;
      items: any[];
    }> = [
        { name: 'Organizações', firestorePath: 'organizations', items: this.getOrganizations() },
        { name: 'Usuários', firestorePath: 'users', items: this.getUsers() },
        { name: 'Alunos', firestorePath: 'students', items: readList<Student>(STORAGE_KEYS.STUDENTS) },
        { name: 'Veículos', firestorePath: 'vehicles', items: readList<Vehicle>(STORAGE_KEYS.VEHICLES) },
        { name: 'Aulas', firestorePath: 'lessons', items: readList<Lesson>(STORAGE_KEYS.LESSONS) },
        { name: 'Horários / Slots', firestorePath: 'availableSlots', items: readList<AvailableSlot>(STORAGE_KEYS.SLOTS) },
        { name: 'Contas a Receber', firestorePath: 'accountsReceivable', items: readList<AccountReceivable>(STORAGE_KEYS.ACCOUNTS) },
        { name: 'Registros de Pagamento', firestorePath: 'paymentRecords', items: readList<PaymentRecord>(STORAGE_KEYS.PAYMENTS) },
        { name: 'Despesas', firestorePath: 'expenses', items: readList<Expense>(STORAGE_KEYS.EXPENSES) },
        { name: 'Investimentos', firestorePath: 'investments', items: readList<Investment>(STORAGE_KEYS.INVESTMENTS) },
        { name: 'Pacotes de Aulas', firestorePath: 'packages', items: readList<PackageOffer>(STORAGE_KEYS.PACKAGES) },
        { name: 'Logs de Auditoria', firestorePath: 'auditLogs', items: readList<AuditLog>(STORAGE_KEYS.AUDIT) },
        { name: 'Logs WhatsApp', firestorePath: 'whatsAppLogs', items: readList<WhatsAppReminderLog>(STORAGE_KEYS.WHATSAPP_LOGS) },
      ];

    const totalItems = collectionsToMigrate.reduce((acc, c) => acc + c.items.length, 0);
    let processedItems = 0;
    const details: Record<string, number> = {};
    const errors: string[] = [];

    const progressState: MigrationProgress = {
      totalItems,
      processedItems: 0,
      percent: 0,
      currentCollection: 'Iniciando migração...',
      collections: {},
      status: 'EM_PROGRESSO',
    };

    for (const c of collectionsToMigrate) {
      progressState.collections[c.firestorePath] = {
        collectionName: c.name,
        total: c.items.length,
        migrated: 0,
        status: 'PENDENTE',
      };
    }

    if (onProgress) onProgress({ ...progressState });

    for (const col of collectionsToMigrate) {
      progressState.currentCollection = `Migrando ${col.name} (${col.items.length} itens)...`;
      progressState.collections[col.firestorePath].status = 'MIGRANDO';
      if (onProgress) onProgress({ ...progressState });

      if (col.items.length === 0) {
        progressState.collections[col.firestorePath].status = 'SUCESSO';
        details[col.firestorePath] = 0;
        continue;
      }

      // Process in batches of up to 250 items to avoid Firestore batch limits
      const chunkSize = 250;
      for (let i = 0; i < col.items.length; i += chunkSize) {
        const chunk = col.items.slice(i, i + chunkSize);
        const batch = writeBatch(firestoreDb);

        for (const item of chunk) {
          const docId = String(item.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
          const docRef = doc(firestoreDb, col.firestorePath, docId);
          // Clean item payload: remove undefined values which Firestore rejects
          const cleanItem = JSON.parse(JSON.stringify(item));
          batch.set(docRef, cleanItem, { merge: true });
        }

        try {
          await batch.commit();
          processedItems += chunk.length;
          progressState.processedItems = processedItems;
          progressState.percent = totalItems > 0 ? Math.round((processedItems / totalItems) * 100) : 100;
          progressState.collections[col.firestorePath].migrated += chunk.length;
          if (onProgress) onProgress({ ...progressState });
        } catch (batchErr) {
          const msg = `Falha ao migrar lote de ${col.name}: ${batchErr instanceof Error ? batchErr.message : String(batchErr)}`;
          console.error(msg, batchErr);
          errors.push(msg);
          progressState.collections[col.firestorePath].status = 'ERRO';
          progressState.collections[col.firestorePath].error = msg;
          try {
            handleFirestoreError(batchErr, OperationType.WRITE, col.firestorePath);
          } catch {
            // Logged via handleFirestoreError
          }
        }
      }

      if (progressState.collections[col.firestorePath].status !== 'ERRO') {
        progressState.collections[col.firestorePath].status = 'SUCESSO';
      }
      details[col.firestorePath] = progressState.collections[col.firestorePath].migrated;
    }

    const migrationDate = new Date().toISOString();
    localStorage.setItem('agd_last_firestore_migration', migrationDate);

    progressState.status = errors.length === 0 ? 'CONCLUIDO' : 'ERRO';
    progressState.currentCollection = errors.length === 0 ? 'Migração concluída com sucesso!' : 'Migração concluída com avisos.';
    if (onProgress) onProgress({ ...progressState });

    // Registra log de auditoria da migração
    const currentOrg = this.getOrganizations()[0]?.id || 'org_direcao_certa_01';
    this.addAuditLog(
      currentOrg,
      'SISTEMA',
      'MIGRACAO_FIRESTORE',
      'FirestoreDatabase',
      firebaseConfig.firestoreDatabaseId,
      `Migrados com sucesso ${processedItems} registros para o banco de dados Firestore.`
    );

    return {
      success: errors.length === 0,
      totalMigrated: processedItems,
      details,
      errors,
      migratedAt: migrationDate,
    };
  },

  /**
   * Lê uma coleção completa diretamente do Firestore
   */
  async fetchFromFirestore<T>(collectionPath: string, orgId?: string): Promise<T[]> {
    try {
      const colRef = collection(firestoreDb, collectionPath);
      const q = orgId ? query(colRef, where('organizacaoId', '==', orgId)) : colRef;
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as T));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, collectionPath);
    }
  },

  /**
   * Salva ou atualiza um documento isolado no Firestore
   */
  async saveToFirestore(collectionPath: string, docId: string, data: any): Promise<void> {
    try {
      const cleanData = JSON.parse(JSON.stringify(data));
      await setDoc(doc(firestoreDb, collectionPath, docId), cleanData, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${collectionPath}/${docId}`);
    }
  },
};

// Export Firestore instances and utilities for use throughout the application
export {
  firestoreDb as firestore,
  auth,
  testConnection,
  handleFirestoreError,
  OperationType,
  firebaseConfig,
};
