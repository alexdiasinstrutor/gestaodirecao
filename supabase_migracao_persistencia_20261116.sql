-- Migracao aditiva e idempotente: preserva os dados e as politicas de acesso.
BEGIN;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS assinatura_url text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS assinatura_config jsonb;
ALTER TABLE public.package_offers ADD COLUMN IF NOT EXISTS instrutor_id text;
ALTER TABLE public.package_offers ADD COLUMN IF NOT EXISTS instrutor_nome text;
ALTER TABLE public.package_offers ADD COLUMN IF NOT EXISTS atualizado_em timestamptz;
COMMIT;
