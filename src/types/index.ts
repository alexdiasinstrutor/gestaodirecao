// Domain Types for Auto Gestão de Direção

export type UserRole = 'SUPER_ADMIN' | 'ADMIN_ORG' | 'INSTRUTOR' | 'ALUNO';

export type OrganizationType = 'INSTRUTOR_AUTONOMO' | 'AUTOESCOLA_CFC';

export type OrganizationStatus = 'ATIVO' | 'BLOQUEADO' | 'PENDENTE_APROVACAO' | 'VENCIDO' | 'TESTE';

export type SaaSPlanType = 'DEMO' | 'BASICO' | 'AVANCADO' | 'MASTER' | 'PRO' | 'ENTERPRISE';

export type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'TELEFONE' | 'ALEATORIA';

export interface AddressFields {
  cep?: string;
  estado?: string;
  cidade?: string;
  bairro?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
}

export interface Organization {
  id: string;
  nome: string;
  tipo: OrganizationType;
  cnpjCpf: string;
  telefone: string;
  email: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
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
  // Configurações de Recebimento PIX
  chavePix?: string;
  tipoChavePix?: PixKeyType;
  beneficiarioPix?: string;
  cidadePix?: string;
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
  // Campos de Endereço Completo do Usuário (Instrutor, Master, Gestor, Aluno)
  cep?: string;
  estado?: string;
  cidade?: string;
  bairro?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  twoFactorAtivo: boolean;
  twoFactorSecret?: string;
  ultimoAcesso?: string;
  avatarUrl?: string;
  senhaTemporaria?: string;
  aprovadoPorMaster?: boolean;
  // Configurações de Recebimento PIX do Instrutor
  chavePix?: string;
  tipoChavePix?: PixKeyType;
  beneficiarioPix?: string;
  cidadePix?: string;
}

export type CnhCategory =
  | 'ACC'
  | 'A'
  | 'B'
  | 'AB'
  | 'C'
  | 'AC'
  | 'D'
  | 'AD'
  | 'E'
  | 'AE'
  | 'PCD'
  | 'OUTRA';

export interface CnhCategoryDef {
  value: CnhCategory;
  label: string;
  badge: string;
  descricao: string;
  veiculos: string;
}

export const CNH_CATEGORIES: CnhCategoryDef[] = [
  { value: 'ACC', label: 'ACC - Ciclomotores (até 50cc)', badge: 'ACC', descricao: 'Autorização para Conduzir Ciclomotores', veiculos: 'Cinquentinhas e ciclomotores de até 50 cilindradas' },
  { value: 'A', label: 'Categoria A - Motocicleta / Triciclo', badge: 'Cat. A', descricao: 'Veículos motorizados de 2 ou 3 rodas', veiculos: 'Motos, motonetas, ciclomotores e triciclos' },
  { value: 'B', label: 'Categoria B - Carro / Utilitário', badge: 'Cat. B', descricao: 'Automóveis leves e comerciais', veiculos: 'Carros de passeio, caminhonetes e utilitários até 3.500kg (máx. 8 passageiros)' },
  { value: 'AB', label: 'Categoria AB - Carro e Moto', badge: 'Cat. AB', descricao: 'Habilitação combinada Carro + Moto', veiculos: 'Automóveis leves e motocicletas' },
  { value: 'C', label: 'Categoria C - Caminhão (Carga > 3,5t)', badge: 'Cat. C', descricao: 'Veículos de transporte de carga', veiculos: 'Caminhões e tratores com peso bruto total acima de 3.500kg' },
  { value: 'AC', label: 'Categoria AC - Moto e Caminhão', badge: 'Cat. AC', descricao: 'Habilitação combinada Moto + Caminhão', veiculos: 'Motocicletas e veículos de carga acima de 3.500kg' },
  { value: 'D', label: 'Categoria D - Ônibus / Micro-ônibus / Vans', badge: 'Cat. D', descricao: 'Veículos de transporte de passageiros', veiculos: 'Vans, micro-ônibus e ônibus com mais de 8 passageiros' },
  { value: 'AD', label: 'Categoria AD - Moto e Ônibus / Van', badge: 'Cat. AD', descricao: 'Habilitação combinada Moto + Transporte de Passageiros', veiculos: 'Motocicletas e veículos de passageiros com mais de 8 lugares' },
  { value: 'E', label: 'Categoria E - Carreta / Bitrem / Articulado', badge: 'Cat. E', descricao: 'Veículos com unidades acopladas e articulados', veiculos: 'Carretas, treminhões, bitrens e veículos com reboque acima de 6.000kg' },
  { value: 'AE', label: 'Categoria AE - Moto e Carreta', badge: 'Cat. AE', descricao: 'Habilitação combinada Moto + Veículos Articulados', veiculos: 'Motocicletas e carretas/articulados' },
  { value: 'PCD', label: 'PCD - Habilitação Especial (Adaptada)', badge: 'PCD', descricao: 'Habilitação para Condutores com Deficiência', veiculos: 'Veículos automotores com adaptações específicas conforme junta médica' },
  { value: 'OUTRA', label: 'Outra / Cursos Especializados (MOPP, Escolar)', badge: 'Outra', descricao: 'Cursos de especialização, reciclagem e capacitação', veiculos: 'MOPP, Transporte Escolar, Emergência, Cargas Indivisíveis' },
];

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
  categoriaCnh: CnhCategory;
  // Campos de Endereço Completo do Aluno
  cep?: string;
  estado?: string;
  cidade?: string;
  bairro?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
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
  categoriaCnh: CnhCategory;
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

// ─── Cupons de Desconto ──────────────────────────────────────────────────────
// PLATAFORMA: criado pelo Master, aplicado na assinatura SaaS do instrutor/autoescola.
// ALUNO: criado pelo instrutor, aplicado no valor do pacote de aulas do aluno.
export type CouponScope = 'PLATAFORMA' | 'ALUNO';

// PERIODO_GRATIS: meses de uso sem cobrança (ex.: 3, 6 ou 12 meses de teste) — apenas PLATAFORMA.
// PERCENTUAL: desconto % sobre a mensalidade (PLATAFORMA) ou sobre o pacote (ALUNO).
// VALOR_FIXO: desconto em centavos sobre a mensalidade (PLATAFORMA) ou sobre o pacote (ALUNO).
export type CouponDiscountType = 'PERIODO_GRATIS' | 'PERCENTUAL' | 'VALOR_FIXO';

export interface DiscountCoupon {
  id: string;
  codigo: string; // Sempre em MAIÚSCULAS, sem espaços
  escopo: CouponScope;
  tipoDesconto: CouponDiscountType;
  mesesGratis?: number; // PERIODO_GRATIS
  percentual?: number; // PERCENTUAL (1 a 100)
  valorCentavos?: number; // VALOR_FIXO
  duracaoMeses?: number; // PLATAFORMA: por quantos meses o desconto na mensalidade vale (0/undefined = permanente)
  planosPermitidos?: string[]; // IDs de planos SaaS (PLATAFORMA) ou de pacotes (ALUNO). Vazio = todos
  organizacaoId?: string; // ALUNO: organização dona do cupom
  instrutorId?: string; // ALUNO: instrutor dono do cupom
  criadoPorId: string;
  criadoPorNome: string;
  validoAte?: string; // YYYY-MM-DD (inclusive). Vazio = sem data limite
  limiteUsos?: number; // 0/undefined = ilimitado
  usosRealizados: number;
  ativo: boolean;
  descricao?: string;
  criadoEm: string;
}

export interface CouponRedemption {
  id: string;
  cupomId: string;
  codigo: string;
  escopo: CouponScope;
  organizacaoId: string;
  usuarioId?: string;
  alunoId?: string;
  referenciaId: string; // ID do plano SaaS ou do pacote
  valorOriginalCentavos: number;
  valorDescontoCentavos: number;
  valorFinalCentavos: number;
  mesesGratis?: number;
  resgatadoEm: string;
}

export interface SyncQueueItem {
  id: string;
  timestamp: number;
  action: string;
  entity: string;
  payload: any;
  retryCount: number;
}
