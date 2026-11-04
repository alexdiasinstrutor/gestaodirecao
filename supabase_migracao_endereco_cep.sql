-- ==============================================================================
-- SCRIPT DE ATUALIZAÇÃO DO SUPABASE · CAMPOS DE ENDEREÇO COMPLETO (CEP) & PIX
-- Projeto: ozizhwejagjlhmaygvlf (Gestão AD - Auto Direção)
-- Como aplicar: Cole este script no SQL Editor do Supabase e clique em "Run".
-- ==============================================================================

-- 1. Tabela ORGANIZATIONS (Autoescolas, CFCs e Instrutores Autônomos)
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS cep VARCHAR(15);
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS logradouro VARCHAR(255);
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS numero VARCHAR(30);
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS complemento VARCHAR(150);
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS bairro VARCHAR(120);
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS cidade VARCHAR(100);
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS estado VARCHAR(10);
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS chave_pix VARCHAR(255);
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS tipo_chave_pix VARCHAR(30);
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS beneficiario_pix VARCHAR(100);
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS cidade_pix VARCHAR(50);

-- 2. Tabela USERS (Master, Gestor CFC, Instrutor e Aluno)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS cep VARCHAR(15);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS estado VARCHAR(10);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS cidade VARCHAR(100);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bairro VARCHAR(120);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS logradouro VARCHAR(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS numero VARCHAR(30);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS complemento VARCHAR(150);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS chave_pix VARCHAR(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tipo_chave_pix VARCHAR(30);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS beneficiario_pix VARCHAR(100);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS cidade_pix VARCHAR(50);

-- 3. Tabela STUDENTS (Alunos Matriculados)
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS cep VARCHAR(15);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS estado VARCHAR(10);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS cidade VARCHAR(100);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS bairro VARCHAR(120);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS logradouro VARCHAR(255);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS numero VARCHAR(30);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS complemento VARCHAR(150);
ALTER TABLE public.students ALTER COLUMN categoria_cnh TYPE VARCHAR(15);
ALTER TABLE public.package_offers ALTER COLUMN categoria_cnh TYPE VARCHAR(15);

-- 4. Recarregar o cache do schema PostgREST do Supabase imediatamente
NOTIFY pgrst, 'reload schema';

