-- Adição ao perfil para evidência declarada durante o cadastro, antes do vínculo Auth.
-- Aceites autenticados bilaterais continuam nas tabelas jurídicas específicas.
begin;
alter table public.users add column if not exists registration_legal_consent jsonb;
comment on column public.users.registration_legal_consent is 'Termos exibidos, versões, hashes, oferta e ciência declarados no cadastro. Data e user-agent do cliente. Aceite autenticado definitivo em legal_acceptances.';
commit;
