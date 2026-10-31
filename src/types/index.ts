// Domain Types for Auto Gestão de Direção

export type UserRole = 'SUPER_ADMIN' | 'ADMIN_ORG' | 'INSTRUTOR' | 'ALUNO';

export type OrganizationType = 'INSTRUTOR_AUTONOMO' | 'AUTOESCOLA_CFC';

export type OrganizationStatus = 'ATIVO' | 'BLOQUEADO' | 'PENDENTE_APROVACAO' | 'VENCIDO' | 'TESTE';

export type SaaSPlanType = 'DEMO' | 'BASICO' | 'AVANCADO' | 'MASTER' | 'PRO' | 'ENTERPRISE';

export interface Organization {
  id: string;
  nome: string;
  tipo: OrganizationType;
  cnpjCpf: string;
  telefone: string;
  email: string;
  cidade: string;
  estado: string;
  status: OrganizationStatus;
  plano: SaaSPlanType;
  criadoEm: string;
  // Campos de Gestão SaaS & Assinatura Master
  dataVencimentoPlano?: string;
  valorMensalidadeCentavos?: number;
  chaveAcesso?: string;
  chaveAcessoGeradaEm?: string;
  modulosCustomizados?: string[];
  limiteAlunos?: number;
  limiteInstrutores?: number;
  solicitadoPorNome?: string;
  solicitadoPorEmail?: string;
  solicitadoPorTelefone?: string;
  motivoBloqueio?: string;
}

export interface User {
  id: string;
  organizacaoId: string;
  nome: string;
  email: string;
  papel: UserRole;
  telefone: string;
  cpfUltimos4: string;
  cpfFingerprint: string;
  cpfMascarado?: string;
  cpfCompleto?: string;
  twoFactorAtivo: boolean;
  twoFactorSecret?: string;
  ultimoAcesso?: string;
  avatarUrl?: string;
  senhaTemporaria?: string;
  aprovadoPorMaster?: boolean;
}

export interface Student {
  id: string;
  organizacaoId: string;
  instrutorId: string;
  nome: string;
  email: string;
  telefone: string;
  cpfMascarado: string; // Ex: ***.***.892-01
  cpfFingerprint: string;
  dataNascimento: string; // YYYY-MM-DD
  idade: number; // Must be >= 18
  categoriaCnh: 'A' | 'B' | 'AB' | 'C' | 'D' | 'E';
  status: 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO';
  aulasCumpridas: number;
  totalAulasContratadas: number; // Tipicamente 20 aulas
  habilidades: StudentSkills;
  observacoesInstrutor: string;
  dataCadastro: string;
  pacoteId?: string;
  pacoteNome?: string;
  historicoTransferencias?: StudentTransferHistory[];
}

export interface StudentSkills {
  baliza: number; // 0 - 10
  controleEmbreagem: number; // 0 - 10
  transitoPesado: number; // 0 - 10
  conversoesCruzamentos: number; // 0 - 10
  rodoviaVelocidade: number; // 0 - 10
  sinalizacaoPreferencia: number; // 0 - 10
  posturaDefensiva: number; // 0 - 10
  simuladoExame: number; // 0 - 10
}

export interface Vehicle {
  id: string;
  organizacaoId: string;
  modelo: string;
  placa: string;
  ano: number;
  tipo: 'CARRO' | 'MOTO' | 'CAMINHAO' | 'ONIBUS';
  status: 'DISPONIVEL' | 'EM_AULA' | 'MANUTENCAO';
  proximaRevisaoKm: number;
  kmAtual: number;
}

export type LessonStatus = 'AGENDADA' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA' | 'FALTA';

export interface Lesson {
  id: string;
  organizacaoId: string;
  alunoId: string;
  instrutorId: string;
  veiculoId: string;
  data: string; // YYYY-MM-DD
  horaInicio: string; // HH:mm
  horaFim: string; // HH:mm
  topico: string;
  status: LessonStatus;
  observacaoInstrutor?: string;
  notaAula?: number; // 1 to 10
  competenciasTrabalhadas?: string[];
  criadoEm: string;
}

export interface AvailableSlot {
  id: string;
  organizacaoId: string;
  instrutorId: string;
  data: string; // YYYY-MM-DD
  horaInicio: string; // HH:mm
  horaFim: string; // HH:mm
  bloqueado: boolean;
  motivoBloqueio?: string;
}

export type PaymentMethod = 'PIX' | 'CARTAO_CREDITO' | 'DINHEIRO' | 'TRANSFERENCIA';

export type AccountReceivableStatus = 'PENDENTE' | 'PARCIAL' | 'PAGO' | 'VENCIDO' | 'CANCELADO';

export interface AccountReceivable {
  id: string;
  organizacaoId: string;
  alunoId: string;
  pacoteId?: string;
  descricao: string;
  valorTotalCentavos: number;
  valorPagoCentavos: number;
  saldoDevedorCentavos: number;
  dataVencimento: string; // YYYY-MM-DD
  status: AccountReceivableStatus;
  pixPayload?: string;
  pixQrCodeUrl?: string;
  parcelasTotal?: number;
  criadoEm: string;
}

export interface PaymentRecord {
  id: string;
  organizacaoId: string;
  contaReceberId: string;
  alunoId: string;
  valorCentavos: number;
  metodo: PaymentMethod;
  parcelas?: number;
  taxaCentavos?: number;
  dataPagamento: string;
  comprovanteNumero?: string;
  observacao?: string;
}

export type ExpenseCategory = 
  | 'COMBUSTIVEL'
  | 'MANUTENCAO_VEICULO'
  | 'SEGURO'
  | 'TAXAS_DETRAN'
  | 'ALIMENTACAO'
  | 'MARKETING'
  | 'SISTEMAS_TELEFONIA'
  | 'OUTROS';

export interface Expense {
  id: string;
  organizacaoId: string;
  descricao: string;
  categoria: ExpenseCategory;
  veiculoId?: string;
  valorCentavos: number;
  dataVencimento: string;
  dataPagamento?: string;
  status: 'PENDENTE' | 'PAGA';
  comprovanteUrl?: string;
}

export type InvestmentCategory = 
  | 'RESERVA_EMERGENCIA'
  | 'FROTA_NOVO_VEICULO'
  | 'CURSOS_ESPECIALIZACAO'
  | 'EQUIPAMENTOS_SIMULADORES'
  | 'INFRAESTRUTURA';

export interface Investment {
  id: string;
  organizacaoId: string;
  titulo: string;
  categoria: InvestmentCategory;
  valorMetaCentavos: number;
  valorAcumuladoCentavos: number;
  aporteMensalCentavos: number;
  dataInicio: string;
  dataPrevisao: string;
  notas?: string;
}

export type PackagePaymentType = 'A_VISTA' | 'PARCELADO_CARTAO' | 'NEGOCIADO' | 'TODAS';

export interface PackageOffer {
  id: string;
  organizacaoId: string;
  instrutorId?: string;
  instrutorNome?: string;
  nome: string;
  totalAulas: number;
  categoriaCnh: 'A' | 'B' | 'AB' | 'C' | 'D' | 'E';
  valorCentavos: number;
  formaPagamento: PackagePaymentType;
  maxParcelas?: number;
  descontoAvistaPercentual?: number;
  descricao: string;
  ativo: boolean;
  criadoEm?: string;
}

export interface StudentTransferHistory {
  id: string;
  organizacaoId: string;
  alunoId: string;
  alunoNome: string;
  alunoCpfMascarado: string;
  instrutorAnteriorId: string;
  instrutorAnteriorNome: string;
  instrutorNovoId: string;
  instrutorNovoNome: string;
  motivo: string;
  aulasCumpridasAteTransferencia: number;
  dataTransferencia: string;
  autorId: string;
  autorNome: string;
}

export interface AuditLog {
  id: string;
  organizacaoId: string;
  usuarioId: string;
  usuarioNome: string;
  acao: string;
  entidade: string;
  entidadeId: string;
  detalhes: string;
  ipOrigem?: string;
  timestamp: string;
}

export interface WhatsAppReminderLog {
  id: string;
  organizacaoId: string;
  alunoId: string;
  alunoNome: string;
  telefone: string;
  valorCentavos: number;
  dataVencimento: string;
  mensagem: string;
  enviadoEm: string;
  status: 'ENVIADO' | 'FALHA';
}

export interface SyncQueueItem {
  id: string;
  timestamp: number;
  action: string;
  entity: string;
  payload: any;
  retryCount: number;
}
