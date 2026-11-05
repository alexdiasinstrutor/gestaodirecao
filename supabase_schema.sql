-- ==============================================================================
-- SISTEMA DE GESTÃO DE DIREÇÃO · ESQUEMA RELACIONAL OFICIAL (POSTGRESQL / SUPABASE)
-- Execute este script no SQL Editor do seu projeto Supabase (https://supabase.com/dashboard/project/ozizhwejagjlhmaygvlf/sql/new)
-- ==============================================================================

-- 1. Habilitar extensões úteis
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Migrações incrementais seguras para bancos já existentes
ALTER TABLE IF EXISTS public.organizations ADD COLUMN IF NOT EXISTS chave_pix VARCHAR(255);
ALTER TABLE IF EXISTS public.organizations ADD COLUMN IF NOT EXISTS tipo_chave_pix VARCHAR(50);
ALTER TABLE IF EXISTS public.organizations ADD COLUMN IF NOT EXISTS beneficiario_pix VARCHAR(255);
ALTER TABLE IF EXISTS public.organizations ADD COLUMN IF NOT EXISTS cidade_pix VARCHAR(100);

ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS chave_pix VARCHAR(255);
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS tipo_chave_pix VARCHAR(50);
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS beneficiario_pix VARCHAR(255);
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS cidade_pix VARCHAR(100);

-- 2. Tabela: ORGANIZATIONS (CFCs, Autoescolas e Instrutores Autônomos)
CREATE TABLE IF NOT EXISTS public.organizations (
    id VARCHAR(100) PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL DEFAULT 'INSTRUTOR_AUTONOMO',
    cnpj_cpf VARCHAR(30) NOT NULL,
    telefone VARCHAR(30),
    email VARCHAR(255),
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
    tipo_chave_pix VARCHAR(50),
    beneficiario_pix VARCHAR(255),
    cidade_pix VARCHAR(100),
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
    two_factor_ativo BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(100),
    ultimo_acesso TIMESTAMPTZ,
    avatar_url TEXT,
    senha_temporaria VARCHAR(100),
    chave_pix VARCHAR(255),
    tipo_chave_pix VARCHAR(50),
    beneficiario_pix VARCHAR(255),
    cidade_pix VARCHAR(100),
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

-- 16. Tabela: DISCOUNT_COUPONS (Cupons de Desconto - SaaS e Alunos)
CREATE TABLE IF NOT EXISTS public.discount_coupons (
    id VARCHAR(100) PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    escopo VARCHAR(30) NOT NULL,
    tipo_desconto VARCHAR(30) NOT NULL,
    meses_gratis INTEGER DEFAULT 0,
    percentual NUMERIC(5,2),
    valor_centavos INTEGER,
    duracao_meses INTEGER DEFAULT 0,
    planos_permitidos JSONB DEFAULT '[]'::jsonb,
    organizacao_id VARCHAR(100) REFERENCES public.organizations(id) ON DELETE CASCADE,
    instrutor_id VARCHAR(100) REFERENCES public.users(id) ON DELETE CASCADE,
    criado_por_id VARCHAR(100),
    criado_por_nome VARCHAR(255),
    valido_ate DATE,
    limite_usos INTEGER DEFAULT 0,
    usos_realizados INTEGER DEFAULT 0,
    ativo BOOLEAN DEFAULT TRUE,
    descricao TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 17. Tabela: COUPON_REDEMPTIONS (Histórico de Resgates de Cupons)
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
    id VARCHAR(100) PRIMARY KEY,
    cupom_id VARCHAR(100) NOT NULL REFERENCES public.discount_coupons(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    escopo VARCHAR(30) NOT NULL,
    organizacao_id VARCHAR(100) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    usuario_id VARCHAR(100) REFERENCES public.users(id) ON DELETE SET NULL,
    aluno_id VARCHAR(100) REFERENCES public.students(id) ON DELETE SET NULL,
    referencia_id VARCHAR(100) NOT NULL,
    valor_original_centavos INTEGER NOT NULL,
    valor_desconto_centavos INTEGER NOT NULL,
    valor_final_centavos INTEGER NOT NULL,
    meses_gratis INTEGER,
    resgatado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 18. ÍNDICES DE PERFORMANCE E INTEGRIDADE
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
CREATE INDEX IF NOT EXISTS idx_discount_coupons_codigo ON public.discount_coupons(codigo);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_cupom ON public.coupon_redemptions(cupom_id);

-- ==============================================================================
-- 19. POLÍTICAS DE ACESSO (ROW LEVEL SECURITY - RLS)
-- Permite leitura e escrita completa via chave pública anon (Dual-Write & Offline First)
-- ==============================================================================
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.students DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_receivable DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_offers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.available_slots DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_transfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_coupons DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions DISABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- FIM DO SCRIPT DDL
-- ==============================================================================

