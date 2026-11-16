begin;
alter table public.users add column if not exists rg text;
alter table public.users add column if not exists registro_detran text;
alter table public.package_offers add column if not exists condicoes_contratuais jsonb;
create or replace function public.prepare_legal_contract(p_request_id uuid,p_student_id text,p_package_contract_id text,p_variables jsonb)
returns public.legal_contract_versions language plpgsql security definer set search_path=public,extensions as $$
declare instructor_data jsonb; buyer_data jsonb; offer_conditions jsonb; canonical jsonb; actor text:=public.legal_actor_id(); student_record record; student_user text; package jsonb; body text; item record; total bigint; rental bigint; lessons bigint; result public.legal_contract_versions;
begin
 if actor is null then raise exception 'Autenticação verificada e vínculo auth_user_id obrigatórios'; end if;
 select * into student_record from public.students where id::text=p_student_id;
 if not found or student_record.instrutor_id::text<>actor then raise exception 'Somente o instrutor vinculado pode preparar este contrato'; end if;
 if (select count(*) from public.users where lower(email)=lower(student_record.email) and organizacao_id::text=student_record.organizacao_id::text and papel='ALUNO')<>1 then raise exception 'Vínculo do aluno ambíguo ou inexistente'; end if;
 select id::text into student_user from public.users where lower(email)=lower(student_record.email) and organizacao_id::text=student_record.organizacao_id::text and papel='ALUNO';
 if student_user is null then raise exception 'Aluno precisa de conta própria vinculada à organização'; end if;
 select value into package from jsonb_array_elements(coalesce(student_record.contratos_pacotes::jsonb,'[]'::jsonb)) where value->>'id'=p_package_contract_id;
 if package is null then raise exception 'Pacote não pertence ao aluno'; end if;
 total:=(package->>'valorCentavos')::bigint; rental:=coalesce((package->>'valorLocacaoExameCentavos')::bigint,0); lessons:=coalesce((package->>'valorAulasCentavos')::bigint,total-rental);
 if total<>lessons+rental or total<0 or rental<0 or lessons<0 then raise exception 'Valores do pacote inconsistentes'; end if;
 if replace(p_variables->>'VALOR_TOTAL',',','.')::numeric*100 is distinct from total::numeric or replace(p_variables->>'VALOR_ALUGUEL_EXAME',',','.')::numeric*100 is distinct from rental::numeric or replace(p_variables->>'SUBTOTAL_AULAS',',','.')::numeric*100 is distinct from lessons::numeric then raise exception 'Valores da minuta divergem do pacote'; end if;
 select to_jsonb(u) into instructor_data from public.users u where id::text=actor;
 select to_jsonb(u) into buyer_data from public.users u where id::text=student_user;
 select condicoes_contratuais into offer_conditions from public.package_offers where id::text=package->>'pacoteId' and organizacao_id::text=student_record.organizacao_id::text;
 canonical:=jsonb_build_object(
 'NOME_INSTRUTOR',instructor_data->>'nome','CPF_CNPJ_INSTRUTOR',instructor_data->>'cpf_completo',
 'REGISTRO_DETRAN',instructor_data->>'registro_detran','UF',instructor_data->>'estado',
 'CIDADE_UF_INSTRUTOR',concat_ws('/',instructor_data->>'cidade',instructor_data->>'estado'),
 'CIDADE_UF',concat_ws('/',instructor_data->>'cidade',instructor_data->>'estado'),
 'NOME_ALUNO',student_record.nome,'CPF_ALUNO',buyer_data->>'cpf_completo','RG_ALUNO',buyer_data->>'rg',
 'CIDADE_UF_ALUNO',concat_ws('/',student_record.cidade,student_record.estado),
 'MODALIDADE_CONTRATO',package->>'nome','QTD_AULAS',package->>'quantidadeAulas',
 'FORMA_PAGAMENTO_ACORDADA',package->>'formaPagamento',
 'DURACAO_MINUTOS',coalesce(package->>'duracaoAulaMinutos',offer_conditions->>'duracaoAulaMinutos'),
 'DIAS_AVISO_EXAME',coalesce(package->>'diasAvisoExame',offer_conditions->>'diasAvisoExame'),
 'PRAZO_VALIDADE_DIAS',coalesce(package->>'prazoValidadeDias',offer_conditions->>'prazoValidadeDias'),
 'PERCENTUAL_MULTA',coalesce(package->>'percentualMulta',offer_conditions->>'percentualMulta'),
 'HASH_INSTRUTOR','Conforme comprovante de aceite vinculado','HASH_ALUNO','Conforme comprovante de aceite vinculado',
 'IP_ALUNO','Conforme registro do comprovante eletrônico');
 if exists(select 1 from jsonb_each_text(canonical) where value is null or btrim(value)='') then raise exception 'Dados cadastrais ou condições do pacote incompletos. Atualize a origem dos dados'; end if;
 p_variables:=p_variables||canonical;
 select content into body from public.legal_templates where code='CONTRATO_AULA_PRATICA' and version='1.0.0';
 for item in select key,value from jsonb_each_text(p_variables) loop body:=replace(body,'{{'||item.key||'}}',item.value); end loop;
 if body is null or body ~ '\{\{[A-Z_]+\}\}' or body like '%[PREENCHER%' then raise exception 'Preencha todas as variáveis do contrato'; end if;
 select * into result from public.legal_contract_versions where request_id=p_request_id;
 if found then
  if result.created_by<>actor or result.content<>body or result.student_id<>p_student_id or result.package_contract_id<>p_package_contract_id then raise exception 'Chave de operação reutilizada com dados diferentes'; end if;
  return result;
 end if;
 insert into public.legal_contract_versions(request_id,organization_id,student_id,package_contract_id,instructor_user_id,student_user_id,template_code,template_version,content,content_sha256,variables,lesson_amount_cents,rental_amount_cents,total_amount_cents,created_by)
 values(p_request_id,student_record.organizacao_id::text,p_student_id,p_package_contract_id,actor,student_user,'CONTRATO_AULA_PRATICA','1.0.0',body,encode(sha256(convert_to(body,'UTF8')),'hex'),p_variables,lessons,rental,total,actor) returning * into result;
 return result;
end $$;

commit;
