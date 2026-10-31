import type { Organization, SaaSPlanType, User } from '../types';

export interface SystemModule {
  id: string;
  nome: string;
  categoria: 'ESSENCIAL' | 'FINANCEIRO' | 'COMUNICACAO' | 'ESTRATEGICO' | 'CFC_ENTERPRISE';
  descricao: string;
  badge?: string;
}

export const ALL_SYSTEM_MODULES: SystemModule[] = [
  // Essenciais
  {
    id: 'DASHBOARD',
    nome: 'Painel Geral & Métricas',
    categoria: 'ESSENCIAL',
    descricao: 'Visão executiva diária com resumo de aulas, faturamento do dia e alertas.'
  },
  {
    id: 'STUDENTS',
    nome: 'Alunos & Progresso Pedagógico',
    categoria: 'ESSENCIAL',
    descricao: 'Cadastro de candidatos, matriz de 8 habilidades CONTRAN e diário de bordo.'
  },
  {
    id: 'SCHEDULE',
    nome: 'Agenda & Horários (06h às 00h)',
    categoria: 'ESSENCIAL',
    descricao: 'Grade horária adaptativa com suporte obrigatório à carga horária noturna.'
  },
  {
    id: 'FINANCE_RECEIVABLES',
    nome: 'Contas a Receber & PIX Instantâneo',
    categoria: 'ESSENCIAL',
    descricao: 'Carnês, parcelamentos, geração de QR Code e chave PIX Copia e Cola.'
  },
  {
    id: 'FINANCE_PACKAGES',
    nome: 'Catálogo de Pacotes e Planos',
    categoria: 'ESSENCIAL',
    descricao: 'Criação de planos de 20 aulas, regras de desconto à vista e valores.'
  },

  // Financeiro & Gestão Avançada
  {
    id: 'FINANCE_EXPENSES',
    nome: 'Despesas Operacionais do Veículo',
    categoria: 'FINANCEIRO',
    descricao: 'Controle de combustível diário, manutenção mecânica, seguro e taxas Detran.'
  },
  {
    id: 'FINANCE_INVESTMENTS',
    nome: 'Metas de Investimento e Reservas',
    categoria: 'FINANCEIRO',
    descricao: 'Planejamento de troca de veículo, reserva de emergência, conciliação e aportes.'
  },
  {
    id: 'FINANCE_DRE',
    nome: 'DRE - Demonstrativo do Exercício',
    categoria: 'FINANCEIRO',
    descricao: 'Cálculo exato de receita bruta, taxas de cartão, despesas e margem líquida real.'
  },
  {
    id: 'FINANCE_RECEIPTS',
    nome: 'Recibo Digital Oficial (Via do Aluno)',
    categoria: 'FINANCEIRO',
    descricao: 'Emissão de recibos com autenticação criptográfica e envio via WhatsApp.'
  },

  // Comunicação & Relatórios
  {
    id: 'WHATSAPP',
    nome: 'Central de Cobranças & Lembretes WhatsApp',
    categoria: 'COMUNICACAO',
    descricao: 'Mensagens automáticas de aula prática, vencimento e cobrança com chave PIX.'
  },
  {
    id: 'REPORTS',
    nome: 'Relatórios Automáticos & Ficha A4',
    categoria: 'COMUNICACAO',
    descricao: 'Impressão de fichas cadastrais completas e relatórios de frequência para o DETRAN.'
  },

  // Estratégico & Tributário
  {
    id: 'FINANCIAL_HEALTH',
    nome: 'Saúde Financeira & Simulador DETRAN',
    categoria: 'ESTRATEGICO',
    descricao: 'Score 0-100, regras dos 4 potes, limite de 8 anos da frota e custo real por aula.',
    badge: 'NOVO'
  },
  {
    id: 'FINANCE_IRPF',
    nome: 'IRPF / Carnê-Leão (Livro-Caixa e CSV)',
    categoria: 'ESTRATEGICO',
    descricao: 'Relatório fiscal anual por aluno pagador (com CPF) e exportação para o contador.'
  },

  // CFC Enterprise
  {
    id: 'VEHICLES',
    nome: 'Gestão da Frota de Veículos de Instrução',
    categoria: 'CFC_ENTERPRISE',
    descricao: 'Cadastro de carros e motos com controle de hodômetro e revisões periódicas.'
  },
  {
    id: 'MULTI_INSTRUCTORS',
    nome: 'Múltiplos Instrutores & Reatribuição',
    categoria: 'CFC_ENTERPRISE',
    descricao: 'Gestão de equipe de instrutores da autoescola com transferência de carteiras.'
  },
  {
    id: 'AUDIT_LGPD',
    nome: 'Livro de Auditoria Forense LGPD',
    categoria: 'CFC_ENTERPRISE',
    descricao: 'Rastreamento perene de todas as mutações no banco de dados com autor e IP.'
  }
];

export interface SaaSPlanDefinition {
  id: SaaSPlanType | string;
  nome: string;
  tagline: string;
  precoSugeridoMensalCentavos: number;
  limiteAlunos: number; // 0 = ilimitado
  limiteInstrutores: number; // 0 = ilimitado
  diasValidadePadrao: number;
  corBadge: string;
  modulosPermitidos: string[];
  destaques: string[];
  recomendadoPara: string;
}

const DEFAULT_SAAS_PLANS: Record<string, SaaSPlanDefinition> = {
  DEMO: {
    id: 'DEMO',
    nome: 'Plano Demonstração (Degustação)',
    tagline: 'Experimentação rápida das funções essenciais antes da contratação',
    precoSugeridoMensalCentavos: 0,
    limiteAlunos: 3,
    limiteInstrutores: 1,
    diasValidadePadrao: 7,
    corBadge: 'bg-slate-100 text-slate-800 border-slate-300',
    modulosPermitidos: [
      'DASHBOARD',
      'STUDENTS',
      'SCHEDULE'
    ],
    destaques: [
      'Até 3 alunos de teste cadastrados',
      'Agenda de horários demonstrativa (06h às 00h)',
      'Painel geral simplificado',
      'Sem emissão de recibos nem relatórios fiscais'
    ],
    recomendadoPara: 'Visitantes e instrutores avaliando o sistema'
  },

  BASICO: {
    id: 'BASICO',
    nome: 'Plano Básico (Operacional)',
    tagline: 'O essencial para o instrutor autônomo organizar sua rotina e cobranças',
    precoSugeridoMensalCentavos: 6990, // R$ 69,90/mês
    limiteAlunos: 25,
    limiteInstrutores: 1,
    diasValidadePadrao: 30,
    corBadge: 'bg-blue-50 text-blue-800 border-blue-200',
    modulosPermitidos: [
      'DASHBOARD',
      'STUDENTS',
      'SCHEDULE',
      'FINANCE_RECEIVABLES',
      'FINANCE_PACKAGES'
    ],
    destaques: [
      'Até 25 alunos ativos simultâneos',
      '1 Instrutor credenciado titular',
      'Agenda prática completa (dia e noite)',
      'Contas a receber com cobrança PIX Copia e Cola',
      'Catálogo comercial de pacotes e planos'
    ],
    recomendadoPara: 'Instrutor autônomo individual iniciando a digitalização'
  },

  AVANCADO: {
    id: 'AVANCADO',
    nome: 'Plano Avançado (Profissional)',
    tagline: 'Gestão completa com controle de despesas, metas, recibos digitais e WhatsApp',
    precoSugeridoMensalCentavos: 13990, // R$ 139,90/mês
    limiteAlunos: 100,
    limiteInstrutores: 3,
    diasValidadePadrao: 30,
    corBadge: 'bg-purple-50 text-purple-800 border-purple-200',
    modulosPermitidos: [
      'DASHBOARD',
      'STUDENTS',
      'SCHEDULE',
      'FINANCE_RECEIVABLES',
      'FINANCE_PACKAGES',
      'FINANCE_EXPENSES',
      'FINANCE_INVESTMENTS',
      'FINANCE_DRE',
      'FINANCE_RECEIPTS',
      'WHATSAPP',
      'REPORTS'
    ],
    destaques: [
      'Até 100 alunos ativos simultâneos',
      'Até 3 instrutores vinculados',
      'Tudo do Plano Básico +',
      'Despesas operacionais (gasolina e manutenção do carro)',
      'Metas de investimento, troca de frota e reservas',
      'Recibo digital oficial em via única com código de autenticação',
      'Disparo de lembretes e cobranças pelo WhatsApp',
      'Ficha pedagógica do aluno em PDF A4 e DRE gerencial'
    ],
    recomendadoPara: 'Instrutores experientes e pequenas parcerias de autoescola'
  },

  MASTER: {
    id: 'MASTER',
    nome: 'Plano Master / CFC Enterprise (Total)',
    tagline: 'Controle irrestrito para autoescolas consolidadas e instrutores de alto volume',
    precoSugeridoMensalCentavos: 24990, // R$ 249,90/mês
    limiteAlunos: 0, // Ilimitado
    limiteInstrutores: 0, // Ilimitado
    diasValidadePadrao: 30,
    corBadge: 'bg-gradient-to-r from-amber-50 to-orange-50 text-amber-900 border-amber-300 font-black',
    modulosPermitidos: ALL_SYSTEM_MODULES.map((m) => m.id),
    destaques: [
      'Alunos e instrutores ILIMITADOS',
      'Tudo do Plano Avançado +',
      'Relatório Fiscal para IRPF / Carnê-Leão com exportação PDF e CSV',
      'Módulo de Saúde Financeira com simulador de custos de aula e regras DETRAN',
      'Gestão completa da frota veicular e alertas de revisões',
      'Auditoria forense e conformidade LGPD perene',
      'Suporte prioritário e reatribuição livre de alunos'
    ],
    recomendadoPara: 'Centros de Formação de Condutores (CFCs) e grandes frotas'
  }
};

export const SAAS_PLANS = DEFAULT_SAAS_PLANS;

const STORAGE_KEY_PLANS = 'agd_saas_custom_plans_v1';

export function getSaaSPlans(): Record<string, SaaSPlanDefinition> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PLANS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SAAS_PLANS, ...parsed };
    }
  } catch (e) {
    console.warn('Erro ao ler planos customizados', e);
  }
  return DEFAULT_SAAS_PLANS;
}

export function saveSaaSPlan(planId: string, planDef: SaaSPlanDefinition): void {
  const plans = getSaaSPlans();
  plans[planId] = planDef;
  try {
    localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(plans));
  } catch (e) {
    console.error('Erro ao salvar plano SaaS', e);
  }
}

export function resetSaaSPlans(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_PLANS);
  } catch (e) {
    console.error('Erro ao resetar planos', e);
  }
}

/**
 * Verifica se uma organização ou usuário tem permissão para acessar determinado módulo
 */
export function canAccessModule(
  org: Organization | undefined,
  moduleId: string,
  user?: User | null
): boolean {
  // Administrador Master ou e-mail mestre tem acesso universal e irrestrito
  if (user?.papel === 'SUPER_ADMIN' || user?.email === 'cassiordcosta@gmail.com') {
    return true;
  }

  if (!org) return false;

  // Se a organização estiver bloqueada, nenhum módulo interno é permitido
  if (org.status === 'BLOQUEADO') {
    return false;
  }

  // Se tiver módulos customizados definidos pelo Master, respeita rigorosamente essa lista
  if (org.modulosCustomizados && Array.isArray(org.modulosCustomizados) && org.modulosCustomizados.length > 0) {
    return org.modulosCustomizados.includes(moduleId);
  }

  // Senão, pega a lista padrão do plano contratado
  const plans = getSaaSPlans();
  const normalizedPlan = org.plano === 'PRO' ? 'AVANCADO' : org.plano;
  const planDef = plans[normalizedPlan] || plans.BASICO || DEFAULT_SAAS_PLANS.BASICO;
  return planDef.modulosPermitidos.includes(moduleId);
}

/**
 * Retorna os detalhes de um plano
 */
export function getPlanDetails(plano: SaaSPlanType | string): SaaSPlanDefinition {
  const plans = getSaaSPlans();
  const normalized = plano === 'PRO' ? 'AVANCADO' : plano;
  return plans[normalized] || plans.BASICO || DEFAULT_SAAS_PLANS.BASICO;
}
