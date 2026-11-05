-- ==============================================================================
-- LIBERAÇÃO DE PERMISSÕES E DESATIVAÇÃO DE RLS PARA O SUPABASE
-- Sistema de Gestão AD (Auto Direção)
-- Copie e execute este script completo no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/ozizhwejagjlhmaygvlf/sql/new
-- ==============================================================================

-- 1. Desativar RLS em todas as tabelas (permite operações diretas via chave anon / offline-first)
ALTER TABLE IF EXISTS public.organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.students DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lessons DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.accounts_receivable DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.package_offers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.available_slots DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_transfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.whatsapp_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.discount_coupons DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.coupon_redemptions DISABLE ROW LEVEL SECURITY;

-- 2. Garantir privilégios completos de leitura/escrita para as roles anon e authenticated
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- 3. (Opcional, caso o Supabase reative RLS no dashboard) Criar políticas permissivas universais:
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "allow_all_anon" ON public.%I', tbl);
        EXECUTE format('CREATE POLICY "allow_all_anon" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', tbl);
    END LOOP;
END
$$;

