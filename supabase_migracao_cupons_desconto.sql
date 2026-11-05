-- ==============================================================================
-- MIGRAÇÃO DE TABELAS DE CUPONS DE DESCONTO (SaaS & ALUNOS)
-- Sistema de Gestão AD (Auto Direção)
-- Execute no SQL Editor do Supabase (https://supabase.com/dashboard/project/ozizhwejagjlhmaygvlf/sql/new)
-- ==============================================================================

-- 1. Tabela: DISCOUNT_COUPONS (Cupons da Plataforma SaaS e dos Pacotes de Alunos)
CREATE TABLE IF NOT EXISTS public.discount_coupons (
    id VARCHAR(100) PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    escopo VARCHAR(30) NOT NULL, -- 'PLATAFORMA' ou 'ALUNO'
    tipo_desconto VARCHAR(30) NOT NULL, -- 'PERIODO_GRATIS', 'PERCENTUAL', 'VALOR_FIXO'
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

-- 2. Tabela: COUPON_REDEMPTIONS (Histórico e Auditoria de Resgates de Cupons)
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
    id VARCHAR(100) PRIMARY KEY,
    cupom_id VARCHAR(100) NOT NULL REFERENCES public.discount_coupons(id) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    escopo VARCHAR(30) NOT NULL,
    organizacao_id VARCHAR(100) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    usuario_id VARCHAR(100) REFERENCES public.users(id) ON DELETE SET NULL,
    aluno_id VARCHAR(100) REFERENCES public.students(id) ON DELETE SET NULL,
    referencia_id VARCHAR(100) NOT NULL, -- ID do plano SaaS ou do Pacote
    valor_original_centavos INTEGER NOT NULL,
    valor_desconto_centavos INTEGER NOT NULL,
    valor_final_centavos INTEGER NOT NULL,
    meses_gratis INTEGER,
    resgatado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Índices de Performance
CREATE INDEX IF NOT EXISTS idx_discount_coupons_codigo ON public.discount_coupons(codigo);
CREATE INDEX IF NOT EXISTS idx_discount_coupons_escopo ON public.discount_coupons(escopo);
CREATE INDEX IF NOT EXISTS idx_discount_coupons_org ON public.discount_coupons(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_discount_coupons_instrutor ON public.discount_coupons(instrutor_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_cupom ON public.coupon_redemptions(cupom_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_org ON public.coupon_redemptions(organizacao_id);

-- 4. Row Level Security (RLS liberado para suporte offline-first/anon como o restante do sistema)
ALTER TABLE public.discount_coupons DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions DISABLE ROW LEVEL SECURITY;

