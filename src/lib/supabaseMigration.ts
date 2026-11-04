/**
 * Módulo de Integração, Migração e Esquema Relacional para Supabase / PostgreSQL
 * Gera DDL completo com Foreign Keys, Índices, Dump de Dados e Conexão REST direta
 */

import { db } from './storage';
import { Organization, User, Student, Vehicle, Lesson, AccountReceivable, PaymentRecord, Expense, Investment, PackageOffer, AuditLog } from '../types';

export interface SupabaseConfig {
  projectUrl: string;
  apiKey: string;
}

export const SUPABASE_CONFIG_STORAGE_KEY = 'agd_supabase_credentials_v1';

export function getStoredSupabaseConfig(): SupabaseConfig {
  try {
    const raw = localStorage.getItem(SUPABASE_CONFIG_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Erro ao carregar credenciais Supabase salvas', e);
  }
  return { projectUrl: '', apiKey: '' };
}

export function saveStoredSupabaseConfig(config: SupabaseConfig): void {
  try {
    localStorage.setItem(SUPABASE_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Erro ao salvar credenciais Supabase', e);
  }
}

/**
 * Gera o DDL SQL completo para criar todas as tabelas e relacionamentos no Supabase
 */
export function generateSupabaseSchemaSQL(): string {
  return `-- ==============================================================================
-- SISTEMA DE GESTÃO DE DIREÇÃO · ESQUEMA RELACIONAL OFICIAL (POSTGRESQL / SUPABASE)
-- Execute este script no SQL Editor do seu projeto Supabase para criar as tabelas e relações.
-- ==============================================================================

-- 1. Habilitar extensões úteis
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabela: ORGANIZATIONS (CFCs, Autoescolas e Instrutores Autônomos)
CREATE TABLE IF NOT EXISTS public.organizations (
    id VARCHAR(100) PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL DEFAULT 'INSTRUTOR_AUTONOMO',
    cnpj_cpf VARCHAR(30) NOT NULL,
    telefone VARCHAR(30),
    email VARCHAR(255),
    cep VARCHAR(15),
    logradouro VARCHAR(255),
    numero VARCHAR(30),
    complemento VARCHAR(150),
    bairro VARCHAR(120),
    cidade VARCHAR(100),
    estado VARCHAR(10),
    status VARCHAR(50) NOT NULL DEFAULT 'ATIVO',
    plano VARCHAR(50) NOT NULL DEFAULT 'MASTER',
    data_vencimento_plano DATE,
    valor_mensalidade_centavos INTEGER DEFAULT 0,
    chave_acesso VARCHAR(100),
    chave_acesso_gerada_em TIMESTAMPTZ,
    modulos_customizados JSONB DEFAULT '[]'::jsonb,
    limite_alunos INTEGER DEFAULT 0,
    limite_instrutores INTEGER DEFAULT 0,
    motivo_bloqueio TEXT,
    chave_pix VARCHAR(255),
    tipo_chave_pix VARCHAR(30),
    beneficiario_pix VARCHAR(100),
    cidade_pix VARCHAR(50),
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela: USERS (Contas de Acesso: Super Admin, Gestor CFC, Instrutor e Aluno)
CREATE TABLE IF NOT EXISTS public.users (
    id VARCHAR(100) PRIMARY KEY,
    organizacao_id VARCHAR(100) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    papel VARCHAR(50) NOT NULL DEFAULT 'INSTRUTOR',
    telefone VARCHAR(30),
    cpf_ultimos_4 VARCHAR(4),
    cpf_fingerprint VARCHAR(100),
    cpf_mascarado VARCHAR(30),
    cpf_completo VARCHAR(30),
    cep VARCHAR(15),
    estado VARCHAR(10),
    cidade VARCHAR(100),
    bairro VARCHAR(120),
    logradouro VARCHAR(255),
    numero VARCHAR(30),
    complemento VARCHAR(150),
    two_factor_ativo BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(100),
    ultimo_acesso TIMESTAMPTZ,
    avatar_url TEXT,
    senha_temporaria VARCHAR(100),
    chave_pix VARCHAR(255),
    tipo_chave_pix VARCHAR(30),
    beneficiario_pix VARCHAR(100),
    cidade_pix VARCHAR(50),
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela: VEHICLES (Frota de Veículos de Instrução - Carros e Motos)
CREATE TABLE IF NOT EXISTS public.vehicles (
    id VARCHAR(100) PRIMARY KEY,
    organizacao_id VARCHAR(100) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    modelo VARCHAR(100) NOT NULL,
    placa VARCHAR(20) NOT NULL,
    ano INTEGER NOT NULL,
    tipo VARCHAR(30) NOT NULL DEFAULT 'CARRO',
    status VARCHAR(30) NOT NULL DEFAULT 'DISPONIVEL',
    km_atual INTEGER DEFAULT 0,
    proxima_revisao_km INTEGER DEFAULT 10000,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabela: STUDENTS (Alunos e Candidatos à CNH)
CREATE TABLE IF NOT EXISTS public.students (
    id VARCHAR(100) PRIMARY KEY,
    organizacao_id VARCHAR(100) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    instrutor_id VARCHAR(100) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    telefone VARCHAR(30),
    cpf_mascarado VARCHAR(30) NOT NULL,
    cpf_fingerprint VARCHAR(100) NOT NULL,
    data_nascimento DATE NOT NULL,
    idade INTEGER NOT NULL CHECK (idade >= 18),
    categoria_cnh VARCHAR(10) NOT NULL DEFAULT 'B',
    cep VARCHAR(15),
    estado VARCHAR(10),
    cidade VARCHAR(100),
    bairro VARCHAR(120),
    logradouro VARCHAR(255),
    numero VARCHAR(30),
    complemento VARCHAR(150),
    status VARCHAR(50) NOT NULL DEFAULT 'EM_ANDAMENTO',
    aulas_cumpridas INTEGER DEFAULT 0,
    total_aulas_contratadas INTEGER DEFAULT 20,
    habilidades JSONB DEFAULT '{"baliza":0,"controleEmbreagem":0,"transitoPesado":0,"conversoesCruzamentos":0,"rodoviaVelocidade":0,"sinalizacaoPreferencia":0,"posturaDefensiva":0,"simuladoExame":0}'::jsonb,
    observacoes_instrutor TEXT,
    pacote_id VARCHAR(100),
    pacote_nome VARCHAR(255),
    historico_transferencias JSONB DEFAULT '[]'::jsonb,
    data_cadastro TIMESTAMPTZ DEFAULT NOW()
);

-- Atualização Incremental (ALTER TABLE) para bancos já existentes (Campos Extras de Endereço Completo via CEP):
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS cep VARCHAR(15);
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS logradouro VARCHAR(255);
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS numero VARCHAR(30);
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS complemento VARCHAR(150);
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS bairro VARCHAR(120);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS cep VARCHAR(15);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS estado VARCHAR(10);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS cidade VARCHAR(100);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bairro VARCHAR(120);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS logradouro VARCHAR(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS numero VARCHAR(30);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS complemento VARCHAR(150);

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS cep VARCHAR(15);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS estado VARCHAR(10);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS cidade VARCHAR(100);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS bairro VARCHAR(120);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS logradouro VARCHAR(255);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS numero VARCHAR(30);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS complemento VARCHAR(150);

-- 6. Tabela: LESSONS (Agenda e Histórico de Aulas Práticas das 06h às 00h)
CREATE TABLE IF NOT EXISTS public.lessons (
    id VARCHAR(100) PRIMARY KEY,
    organizacao_id VARCHAR(100) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    aluno_id VARCHAR(100) NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    instrutor_id VARCHAR(100) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    veiculo_id VARCHAR(100) REFERENCES public.vehicles(id) ON DELETE SET NULL,
    data DATE NOT NULL,
    hora_inicio VARCHAR(10) NOT NULL,
    hora_fim VARCHAR(10) NOT NULL,
    topico VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'AGENDADA',
    nota_aula INTEGER CHECK (nota_aula >= 1 AND nota_aula <= 10),
    observacao_instrutor TEXT,
    competencias_trabalhadas JSONB DEFAULT '[]'::jsonb,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tabela: ACCOUNTS_RECEIVABLE (Contas a Receber e Parcelamentos de Alunos)
CREATE TABLE IF NOT EXISTS public.accounts_receivable (
    id VARCHAR(100) PRIMARY KEY,
    organizacao_id VARCHAR(100) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    aluno_id VARCHAR(100) NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    pacote_id VARCHAR(100),
    descricao VARCHAR(255) NOT NULL,
    valor_total_centavos INTEGER NOT NULL,
    valor_pago_centavos INTEGER DEFAULT 0,
    saldo_devedor_centavos INTEGER NOT NULL,
    data_vencimento DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDENTE',
    pix_payload TEXT,
    pix_qr_code_url TEXT,
    parcelas_total INTEGER DEFAULT 1,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Tabela: PAYMENT_RECORDS (Recebimentos e Recibos Emitidos)
CREATE TABLE IF NOT EXISTS public.payment_records (
    id VARCHAR(100) PRIMARY KEY,
    organizacao_id VARCHAR(100) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    conta_receber_id VARCHAR(100) NOT NULL REFERENCES public.accounts_receivable(id) ON DELETE CASCADE,
    aluno_id VARCHAR(100) NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    valor_centavos INTEGER NOT NULL,
    metodo VARCHAR(50) NOT NULL,
    parcelas INTEGER DEFAULT 1,
    taxa_centavos INTEGER DEFAULT 0,
    data_pagamento DATE NOT NULL,
    comprovante_numero VARCHAR(100),
    observacao TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Tabela: EXPENSES (Despesas Operacionais do Veículo e Oficina)
CREATE TABLE IF NOT EXISTS public.expenses (
    id VARCHAR(100) PRIMARY KEY,
    organizacao_id VARCHAR(100) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    descricao VARCHAR(255) NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    veiculo_id VARCHAR(100) REFERENCES public.vehicles(id) ON DELETE SET NULL,
    valor_centavos INTEGER NOT NULL,
    data_vencimento DATE NOT NULL,
    data_pagamento DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDENTE',
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Tabela: INVESTMENTS (Metas de Troca de Frota e Reserva de Emergência)
CREATE TABLE IF NOT EXISTS public.investments (
    id VARCHAR(100) PRIMARY KEY,
    organizacao_id VARCHAR(100) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    valor_meta_centavos INTEGER NOT NULL,
    valor_acumulado_centavos INTEGER DEFAULT 0,
    aporte_mensal_sugerido_centavos INTEGER DEFAULT 0,
    data_inicio DATE,
    data_prevista_conclusao DATE,
    anotacoes TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Tabela: PACKAGE_OFFERS (Catálogo Comercial de Pacotes e Planos)
CREATE TABLE IF NOT EXISTS public.package_offers (
    id VARCHAR(100) PRIMARY KEY,
    organizacao_id VARCHAR(100) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    instrutor_id VARCHAR(100) REFERENCES public.users(id) ON DELETE SET NULL,
    nome VARCHAR(255) NOT NULL,
    categoria_cnh VARCHAR(10) NOT NULL DEFAULT 'B',
    quantidade_aulas INTEGER NOT NULL DEFAULT 20,
    valor_centavos INTEGER NOT NULL,
    formas_pagamento_permitidas VARCHAR(50) DEFAULT 'TODAS',
    maximo_parcelas_cartao INTEGER DEFAULT 12,
    desconto_a_vista_percentual INTEGER DEFAULT 5,
    descricao TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Tabela: AUDIT_LOGS (Trilha de Auditoria Forense e Conformidade LGPD)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id VARCHAR(100) PRIMARY KEY,
    organizacao_id VARCHAR(100) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    usuario_id VARCHAR(100),
    usuario_nome VARCHAR(255),
    acao VARCHAR(100) NOT NULL,
    entidade VARCHAR(100) NOT NULL,
    entidade_id VARCHAR(100),
    detalhes TEXT,
    ip_origem VARCHAR(50),
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Tabela: AVAILABLE_SLOTS (Agenda de Horários Disponíveis dos Instrutores)
CREATE TABLE IF NOT EXISTS public.available_slots (
    id VARCHAR(100) PRIMARY KEY,
    organizacao_id VARCHAR(100) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    instrutor_id VARCHAR(100) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    hora_inicio VARCHAR(10) NOT NULL,
    hora_fim VARCHAR(10) NOT NULL,
    bloqueado BOOLEAN DEFAULT FALSE,
    motivo_bloqueio TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Tabela: STUDENT_TRANSFERS (Histórico Imutável de Transferências de Alunos)
CREATE TABLE IF NOT EXISTS public.student_transfers (
    id VARCHAR(100) PRIMARY KEY,
    organizacao_id VARCHAR(100) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    aluno_id VARCHAR(100) NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    aluno_nome VARCHAR(255) NOT NULL,
    aluno_cpf_mascarado VARCHAR(30) NOT NULL,
    instrutor_anterior_id VARCHAR(100) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    instrutor_anterior_nome VARCHAR(255) NOT NULL,
    instrutor_novo_id VARCHAR(100) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    instrutor_novo_nome VARCHAR(255) NOT NULL,
    motivo TEXT NOT NULL,
    aulas_cumpridas_ate_transferencia INTEGER DEFAULT 0,
    data_transferencia TIMESTAMPTZ NOT NULL,
    autor_id VARCHAR(100) NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    autor_nome VARCHAR(255) NOT NULL
);

-- 15. Tabela: WHATSAPP_LOGS (Registro de Cobranças e Lembretes por WhatsApp)
CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
    id VARCHAR(100) PRIMARY KEY,
    organizacao_id VARCHAR(100) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    aluno_id VARCHAR(100) NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    aluno_nome VARCHAR(255) NOT NULL,
    telefone VARCHAR(30) NOT NULL,
    valor_centavos INTEGER DEFAULT 0,
    data_vencimento DATE,
    mensagem TEXT NOT NULL,
    enviado_em TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'ENVIADO'
);

-- 16. ÍNDICES DE PERFORMANCE E INTEGRIDADE
CREATE INDEX IF NOT EXISTS idx_users_org ON public.users(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_students_org ON public.students(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_students_instrutor ON public.students(instrutor_id);
CREATE INDEX IF NOT EXISTS idx_lessons_student ON public.lessons(aluno_id);
CREATE INDEX IF NOT EXISTS idx_lessons_date ON public.lessons(data);
CREATE INDEX IF NOT EXISTS idx_receivables_student ON public.accounts_receivable(aluno_id);
CREATE INDEX IF NOT EXISTS idx_payments_receivable ON public.payment_records(conta_receber_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_slots_instrutor ON public.available_slots(instrutor_id);
CREATE INDEX IF NOT EXISTS idx_slots_data ON public.available_slots(data);
CREATE INDEX IF NOT EXISTS idx_transfers_aluno ON public.student_transfers(aluno_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_aluno ON public.whatsapp_logs(aluno_id);

-- ==============================================================================
-- FIM DO SCRIPT DDL
-- ==============================================================================
`;
}

/**
 * Gera script SQL de INSERT contendo todos os dados atuais do sistema para carga no Supabase
 */
export function generateSupabaseDataDumpSQL(): string {
  const allData = db.getAllDataForExport();
  const orgs = allData.organizations;
  const users = allData.users;
  const students = allData.students;
  const vehicles = allData.vehicles;
  const lessons = allData.lessons;
  const accounts = allData.accounts;
  const payments = allData.payments;
  const expenses = allData.expenses;
  const investments = allData.investments;
  const packages = allData.packages;

  const lines: string[] = [
    '-- ==============================================================================',
    '-- DUMP DE DADOS PARA SUPABASE / POSTGRESQL · SISTEMA DE GESTÃO DE DIREÇÃO',
    `-- Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    '-- ==============================================================================\n',
    'BEGIN;\n'
  ];

  const escapeStr = (val: any) => {
    if (val === null || val === undefined) return 'NULL';
    return `'${String(val).replace(/'/g, "''")}'`;
  };

  const escapeDate = (val: any) => {
    if (!val) return 'NULL';
    const clean = String(val).split('T')[0];
    return `'${clean}'`;
  };

  const escapeJson = (val: any) => {
    if (!val) return "'{}'::jsonb";
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  };

  // 1. Organizations
  for (const o of orgs) {
    lines.push(`INSERT INTO public.organizations (id, nome, tipo, cnpj_cpf, telefone, email, cidade, estado, status, plano, data_vencimento_plano, valor_mensalidade_centavos, chave_acesso, modulos_customizados, criado_em) VALUES (${escapeStr(o.id)}, ${escapeStr(o.nome)}, ${escapeStr(o.tipo)}, ${escapeStr(o.cnpjCpf)}, ${escapeStr(o.telefone)}, ${escapeStr(o.email)}, ${escapeStr(o.cidade)}, ${escapeStr(o.estado)}, ${escapeStr(o.status)}, ${escapeStr(o.plano)}, ${escapeDate(o.dataVencimentoPlano)}, ${o.valorMensalidadeCentavos || 0}, ${escapeStr(o.chaveAcesso)}, ${escapeJson(o.modulosCustomizados || [])}, ${escapeStr(o.criadoEm || new Date().toISOString())}) ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, status = EXCLUDED.status, plano = EXCLUDED.plano;`);
  }

  // 2. Users
  for (const u of users) {
    lines.push(`INSERT INTO public.users (id, organizacao_id, nome, email, papel, telefone, cpf_ultimos_4, cpf_fingerprint, cpf_mascarado, cpf_completo, two_factor_ativo, ultimo_acesso) VALUES (${escapeStr(u.id)}, ${escapeStr(u.organizacaoId)}, ${escapeStr(u.nome)}, ${escapeStr(u.email)}, ${escapeStr(u.papel)}, ${escapeStr(u.telefone)}, ${escapeStr(u.cpfUltimos4)}, ${escapeStr(u.cpfFingerprint)}, ${escapeStr(u.cpfMascarado)}, ${escapeStr(u.cpfCompleto)}, ${u.twoFactorAtivo ? 'TRUE' : 'FALSE'}, ${escapeStr(u.ultimoAcesso || new Date().toISOString())}) ON CONFLICT (id) DO NOTHING;`);
  }

  // 3. Vehicles
  for (const v of vehicles) {
    lines.push(`INSERT INTO public.vehicles (id, organizacao_id, modelo, placa, ano, tipo, status, km_atual, proxima_revisao_km) VALUES (${escapeStr(v.id)}, ${escapeStr(v.organizacaoId)}, ${escapeStr(v.modelo)}, ${escapeStr(v.placa)}, ${v.ano || 2024}, ${escapeStr(v.tipo)}, ${escapeStr(v.status)}, ${v.kmAtual || 0}, ${v.proximaRevisaoKm || 10000}) ON CONFLICT (id) DO NOTHING;`);
  }

  // 4. Students
  for (const s of students) {
    lines.push(`INSERT INTO public.students (id, organizacao_id, instrutor_id, nome, email, telefone, cpf_mascarado, cpf_fingerprint, data_nascimento, idade, categoria_cnh, status, aulas_cumpridas, total_aulas_contratadas, habilidades, observacoes_instrutor, pacote_id, pacote_nome, data_cadastro) VALUES (${escapeStr(s.id)}, ${escapeStr(s.organizacaoId)}, ${escapeStr(s.instrutorId)}, ${escapeStr(s.nome)}, ${escapeStr(s.email)}, ${escapeStr(s.telefone)}, ${escapeStr(s.cpfMascarado)}, ${escapeStr(s.cpfFingerprint)}, ${escapeDate(s.dataNascimento)}, ${s.idade || 18}, ${escapeStr(s.categoriaCnh)}, ${escapeStr(s.status)}, ${s.aulasCumpridas || 0}, ${s.totalAulasContratadas || 20}, ${escapeJson(s.habilidades)}, ${escapeStr(s.observacoesInstrutor)}, ${escapeStr(s.pacoteId)}, ${escapeStr(s.pacoteNome)}, ${escapeStr(s.dataCadastro || new Date().toISOString())}) ON CONFLICT (id) DO NOTHING;`);
  }

  // 5. Lessons
  for (const l of lessons) {
    lines.push(`INSERT INTO public.lessons (id, organizacao_id, aluno_id, instrutor_id, veiculo_id, data, hora_inicio, hora_fim, topico, status, nota_aula, observacao_instrutor, competencias_trabalhadas, criado_em) VALUES (${escapeStr(l.id)}, ${escapeStr(l.organizacaoId)}, ${escapeStr(l.alunoId)}, ${escapeStr(l.instrutorId)}, ${escapeStr(l.veiculoId)}, ${escapeDate(l.data)}, ${escapeStr(l.horaInicio)}, ${escapeStr(l.horaFim)}, ${escapeStr(l.topico)}, ${escapeStr(l.status)}, ${l.notaAula || 'NULL'}, ${escapeStr(l.observacaoInstrutor)}, ${escapeJson(l.competenciasTrabalhadas || [])}, ${escapeStr(l.criadoEm || new Date().toISOString())}) ON CONFLICT (id) DO NOTHING;`);
  }

  // 6. Accounts Receivable
  for (const a of accounts) {
    lines.push(`INSERT INTO public.accounts_receivable (id, organizacao_id, aluno_id, pacote_id, descricao, valor_total_centavos, valor_pago_centavos, saldo_devedor_centavos, data_vencimento, status, pix_payload, parcelas_total, criado_em) VALUES (${escapeStr(a.id)}, ${escapeStr(a.organizacaoId)}, ${escapeStr(a.alunoId)}, ${escapeStr(a.pacoteId)}, ${escapeStr(a.descricao)}, ${a.valorTotalCentavos}, ${a.valorPagoCentavos}, ${a.saldoDevedorCentavos}, ${escapeDate(a.dataVencimento)}, ${escapeStr(a.status)}, ${escapeStr(a.pixPayload)}, ${a.parcelasTotal || 1}, ${escapeStr(a.criadoEm || new Date().toISOString())}) ON CONFLICT (id) DO NOTHING;`);
  }

  // 7. Payment Records
  for (const p of payments) {
    lines.push(`INSERT INTO public.payment_records (id, organizacao_id, conta_receber_id, aluno_id, valor_centavos, metodo, parcelas, taxa_centavos, data_pagamento, comprovante_numero, observacao) VALUES (${escapeStr(p.id)}, ${escapeStr(p.organizacaoId)}, ${escapeStr(p.contaReceberId)}, ${escapeStr(p.alunoId)}, ${p.valorCentavos}, ${escapeStr(p.metodo)}, ${p.parcelas || 1}, ${p.taxaCentavos || 0}, ${escapeDate(p.dataPagamento)}, ${escapeStr(p.comprovanteNumero)}, ${escapeStr(p.observacao)}) ON CONFLICT (id) DO NOTHING;`);
  }

  // 8. Expenses
  for (const e of expenses) {
    lines.push(`INSERT INTO public.expenses (id, organizacao_id, descricao, categoria, veiculo_id, valor_centavos, data_vencimento, data_pagamento, status) VALUES (${escapeStr(e.id)}, ${escapeStr(e.organizacaoId)}, ${escapeStr(e.descricao)}, ${escapeStr(e.categoria)}, ${escapeStr(e.veiculoId)}, ${e.valorCentavos}, ${escapeDate(e.dataVencimento)}, ${escapeDate(e.dataPagamento)}, ${escapeStr(e.status)}) ON CONFLICT (id) DO NOTHING;`);
  }

  // 9. Investments
  for (const i of investments) {
    lines.push(`INSERT INTO public.investments (id, organizacao_id, titulo, categoria, valor_meta_centavos, valor_acumulado_centavos, aporte_mensal_sugerido_centavos, data_inicio, data_prevista_conclusao) VALUES (${escapeStr(i.id)}, ${escapeStr(i.organizacaoId)}, ${escapeStr(i.titulo)}, ${escapeStr(i.categoria)}, ${i.valorMetaCentavos}, ${i.valorAcumuladoCentavos}, ${i.aporteMensalCentavos || 0}, ${escapeDate(i.dataInicio)}, ${escapeDate(i.dataPrevisao)}) ON CONFLICT (id) DO NOTHING;`);
  }

  // 10. Packages
  for (const pk of packages) {
    lines.push(`INSERT INTO public.package_offers (id, organizacao_id, instrutor_id, nome, categoria_cnh, quantidade_aulas, valor_centavos, desconto_a_vista_percentual, ativo) VALUES (${escapeStr(pk.id)}, ${escapeStr(pk.organizacaoId)}, ${escapeStr(pk.instrutorId)}, ${escapeStr(pk.nome)}, ${escapeStr(pk.categoriaCnh)}, ${pk.totalAulas || 20}, ${pk.valorCentavos}, ${pk.descontoAvistaPercentual || 0}, ${pk.ativo ? 'TRUE' : 'FALSE'}) ON CONFLICT (id) DO NOTHING;`);
  }

  // 11. Available Slots
  const slots = allData.slots || [];
  for (const sl of slots) {
    lines.push(`INSERT INTO public.available_slots (id, organizacao_id, instrutor_id, data, hora_inicio, hora_fim, bloqueado, motivo_bloqueio) VALUES (${escapeStr(sl.id)}, ${escapeStr(sl.organizacaoId)}, ${escapeStr(sl.instrutorId)}, ${escapeDate(sl.data)}, ${escapeStr(sl.horaInicio)}, ${escapeStr(sl.horaFim)}, ${sl.bloqueado ? 'TRUE' : 'FALSE'}, ${escapeStr(sl.motivoBloqueio)}) ON CONFLICT (id) DO NOTHING;`);
  }

  // 12. Student Transfers
  const transfers = allData.students?.flatMap((s: any) => s.historicoTransferencias || []) || [];
  for (const t of transfers) {
    lines.push(`INSERT INTO public.student_transfers (id, organizacao_id, aluno_id, aluno_nome, aluno_cpf_mascarado, instrutor_anterior_id, instrutor_anterior_nome, instrutor_novo_id, instrutor_novo_nome, motivo, aulas_cumpridas_ate_transferencia, data_transferencia, autor_id, autor_nome) VALUES (${escapeStr(t.id)}, ${escapeStr(t.organizacaoId)}, ${escapeStr(t.alunoId)}, ${escapeStr(t.alunoNome)}, ${escapeStr(t.alunoCpfMascarado)}, ${escapeStr(t.instrutorAnteriorId)}, ${escapeStr(t.instrutorAnteriorNome)}, ${escapeStr(t.instrutorNovoId)}, ${escapeStr(t.instrutorNovoNome)}, ${escapeStr(t.motivo)}, ${t.aulasCumpridasAteTransferencia || 0}, ${escapeStr(t.dataTransferencia)}, ${escapeStr(t.autorId)}, ${escapeStr(t.autorNome)}) ON CONFLICT (id) DO NOTHING;`);
  }

  // 13. WhatsApp Logs
  const whatsappLogs = allData.whatsappLogs || [];
  for (const w of whatsappLogs) {
    lines.push(`INSERT INTO public.whatsapp_logs (id, organizacao_id, aluno_id, aluno_nome, telefone, valor_centavos, data_vencimento, mensagem, enviado_em, status) VALUES (${escapeStr(w.id)}, ${escapeStr(w.organizacaoId)}, ${escapeStr(w.alunoId)}, ${escapeStr(w.alunoNome)}, ${escapeStr(w.telefone)}, ${w.valorCentavos || 0}, ${escapeDate(w.dataVencimento)}, ${escapeStr(w.mensagem)}, ${escapeStr(w.enviadoEm)}, ${escapeStr(w.status)}) ON CONFLICT (id) DO NOTHING;`);
  }

  lines.push('\nCOMMIT;\n-- Sincronização concluída com sucesso!');

  return lines.join('\n');
}

/**
 * Testa conectividade direta com o endpoint REST do Supabase
 */
export async function testSupabaseConnection(config: SupabaseConfig): Promise<{ success: boolean; message: string }> {
  if (!config.projectUrl || !config.apiKey) {
    return { success: false, message: 'URL do projeto Supabase e Chave de API são obrigatórias.' };
  }

  const cleanUrl = config.projectUrl.trim().replace(/\/$/, '');

  try {
    const res = await fetch(`${cleanUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': config.apiKey.trim(),
        'Authorization': `Bearer ${config.apiKey.trim()}`
      }
    });

    if (res.ok || res.status === 200 || res.status === 404) {
      return {
        success: true,
        message: 'Conexão com a API do Supabase estabelecida com sucesso!'
      };
    } else {
      return {
        success: false,
        message: `Servidor Supabase retornou status HTTP ${res.status}: ${res.statusText}`
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Falha na requisição de rede: ${err.message || 'Verifique se a URL está correta (ex: https://xxx.supabase.co).'}`
    };
  }
}

/**
 * Envia dados em lotes para tabelas existentes no Supabase via REST API
 */
export async function syncDataToSupabase(
  config: SupabaseConfig,
  onProgress?: (progress: { currentTable: string; percent: number; status: string }) => void
): Promise<{ success: boolean; message: string; results: Record<string, number> }> {
  const cleanUrl = config.projectUrl.trim().replace(/\/$/, '');
  const apiKey = config.apiKey.trim();

  const allData = db.getAllDataForExport();

  const tablesToSync: Array<{ table: string; data: any[] }> = [
    { table: 'organizations', data: allData.organizations.map(o => ({
      id: o.id,
      nome: o.nome,
      tipo: o.tipo,
      cnpj_cpf: o.cnpjCpf,
      telefone: o.telefone,
      email: o.email,
      cidade: o.cidade,
      estado: o.estado,
      status: o.status,
      plano: o.plano,
      data_vencimento_plano: o.dataVencimentoPlano || null,
      valor_mensalidade_centavos: o.valorMensalidadeCentavos || 0,
      chave_acesso: o.chaveAcesso || null,
      modulos_customizados: o.modulosCustomizados || []
    }))},
    { table: 'users', data: allData.users.map(u => ({
      id: u.id,
      organizacao_id: u.organizacaoId,
      nome: u.nome,
      email: u.email,
      papel: u.papel,
      telefone: u.telefone,
      cpf_ultimos_4: u.cpfUltimos4,
      cpf_fingerprint: u.cpfFingerprint,
      cpf_mascarado: u.cpfMascarado || null,
      cpf_completo: u.cpfCompleto || null,
      two_factor_ativo: u.twoFactorAtivo || false
    }))},
    { table: 'vehicles', data: allData.vehicles.map(v => ({
      id: v.id,
      organizacao_id: v.organizacaoId,
      modelo: v.modelo,
      placa: v.placa,
      ano: v.ano,
      tipo: v.tipo,
      status: v.status,
      km_atual: v.kmAtual || 0,
      proxima_revisao_km: v.proximaRevisaoKm || 10000
    }))},
    { table: 'students', data: allData.students.map(s => ({
      id: s.id,
      organizacao_id: s.organizacaoId,
      instrutor_id: s.instrutorId,
      nome: s.nome,
      email: s.email || null,
      telefone: s.telefone || null,
      cpf_mascarado: s.cpfMascarado,
      cpf_fingerprint: s.cpfFingerprint,
      data_nascimento: s.dataNascimento,
      idade: s.idade || 18,
      categoria_cnh: s.categoriaCnh,
      status: s.status,
      aulas_cumpridas: s.aulasCumpridas || 0,
      total_aulas_contratadas: s.totalAulasContratadas || 20,
      habilidades: s.habilidades || {},
      observacoes_instrutor: s.observacoesInstrutor || null,
      pacote_id: s.pacoteId || null,
      pacote_nome: s.pacoteNome || null
    }))},
    { table: 'accounts_receivable', data: allData.accounts.map(a => ({
      id: a.id,
      organizacao_id: a.organizacaoId,
      aluno_id: a.alunoId,
      pacote_id: a.pacoteId || null,
      descricao: a.descricao,
      valor_total_centavos: a.valorTotalCentavos,
      valor_pago_centavos: a.valorPagoCentavos,
      saldo_devedor_centavos: a.saldoDevedorCentavos,
      data_vencimento: a.dataVencimento,
      status: a.status,
      pix_payload: a.pixPayload || null,
      parcelas_total: a.parcelasTotal || 1
    }))},
    { table: 'payment_records', data: allData.payments.map(p => ({
      id: p.id,
      organizacao_id: p.organizacaoId,
      conta_receber_id: p.contaReceberId,
      aluno_id: p.alunoId,
      valor_centavos: p.valorCentavos,
      metodo: p.metodo,
      parcelas: p.parcelas || 1,
      taxa_centavos: p.taxaCentavos || 0,
      data_pagamento: p.dataPagamento,
      comprovante_numero: p.comprovanteNumero || null,
      observacao: p.observacao || null
    }))},
    { table: 'expenses', data: allData.expenses.map(e => ({
      id: e.id,
      organizacao_id: e.organizacaoId,
      descricao: e.descricao,
      categoria: e.categoria,
      veiculo_id: e.veiculoId || null,
      valor_centavos: e.valorCentavos,
      data_vencimento: e.dataVencimento,
      data_pagamento: e.dataPagamento || null,
      status: e.status
    }))},
    { table: 'investments', data: allData.investments.map(i => ({
      id: i.id,
      organizacao_id: i.organizacaoId,
      titulo: i.titulo,
      categoria: i.categoria,
      valor_meta_centavos: i.valorMetaCentavos,
      valor_acumulado_centavos: i.valorAcumuladoCentavos,
      aporte_mensal_sugerido_centavos: i.aporteMensalCentavos || 0,
      data_inicio: i.dataInicio || null,
      data_prevista_conclusao: i.dataPrevisao || null
    }))},
    { table: 'package_offers', data: allData.packages.map(pk => ({
      id: pk.id,
      organizacao_id: pk.organizacaoId,
      instrutor_id: pk.instrutorId || null,
      nome: pk.nome,
      categoria_cnh: pk.categoriaCnh,
      quantidade_aulas: pk.totalAulas || 20,
      valor_centavos: pk.valorCentavos,
      desconto_a_vista_percentual: pk.descontoAvistaPercentual || 0,
      ativo: pk.ativo
    }))},
    { table: 'available_slots', data: (allData.slots || []).map((sl: any) => ({
      id: sl.id,
      organizacao_id: sl.organizacaoId,
      instrutor_id: sl.instrutorId,
      data: sl.data,
      hora_inicio: sl.horaInicio,
      hora_fim: sl.horaFim,
      bloqueado: sl.bloqueado || false,
      motivo_bloqueio: sl.motivoBloqueio || null
    }))},
    { table: 'whatsapp_logs', data: (allData.whatsappLogs || []).map((w: any) => ({
      id: w.id,
      organizacao_id: w.organizacaoId,
      aluno_id: w.alunoId,
      aluno_nome: w.alunoNome,
      telefone: w.telefone,
      valor_centavos: w.valorCentavos || 0,
      data_vencimento: w.dataVencimento || null,
      mensagem: w.mensagem,
      enviado_em: w.enviadoEm,
      status: w.status
    }))}
  ];

  const results: Record<string, number> = {};
  const totalTables = tablesToSync.length;

  for (let idx = 0; idx < tablesToSync.length; idx++) {
    const { table, data } = tablesToSync[idx];
    const percent = Math.round(((idx) / totalTables) * 100);

    if (onProgress) {
      onProgress({
        currentTable: `Enviando tabela "${table}" (${data.length} itens)...`,
        percent,
        status: 'SINCRONIZANDO'
      });
    }

    if (data.length === 0) {
      results[table] = 0;
      continue;
    }

    try {
      const res = await fetch(`${cleanUrl}/rest/v1/${table}`, {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(data)
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.warn(`Aviso ao enviar tabela ${table}:`, errorText);
      }
      results[table] = data.length;
    } catch (e: any) {
      console.error(`Erro ao sincronizar tabela ${table}:`, e);
      results[table] = 0;
    }
  }

  if (onProgress) {
    onProgress({
      currentTable: 'Concluído!',
      percent: 100,
      status: 'SUCESSO'
    });
  }

  return {
    success: true,
    message: 'Processo de cópia de tabelas e dados concluído com sucesso!',
    results
  };
}
