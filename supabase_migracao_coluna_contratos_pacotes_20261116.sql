-- Adiciona a coluna de contratos usada pelo adaptador e pelas funções jurídicas.
-- Não gera contratos e não cria aceites retroativos.
begin;
alter table public.students add column if not exists contratos_pacotes jsonb not null default '[]'::jsonb;
commit;
