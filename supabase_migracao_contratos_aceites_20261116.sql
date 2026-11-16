-- Migração aditiva. Execute no SQL Editor do Supabase.
-- Vincule users.auth_user_id ao ID REAL de Authentication antes dos aceites.
-- O login legado baseado em localStorage não comprova identidade ao PostgreSQL.
begin;
alter table public.users add column if not exists auth_user_id uuid references auth.users(id);
create unique index if not exists users_legal_auth_unique on public.users(auth_user_id) where auth_user_id is not null;
create table if not exists public.legal_templates(code text not null, version text not null, content text not null, primary key(code,version));
create table if not exists public.legal_contract_versions(
 id uuid primary key default gen_random_uuid(), request_id uuid unique not null,
 organization_id text not null, student_id text not null, package_contract_id text not null,
 instructor_user_id text not null, student_user_id text not null,
 template_code text not null, template_version text not null, content text not null,
 content_sha256 text not null check(length(content_sha256)=64), variables jsonb not null,
 lesson_amount_cents bigint not null check(lesson_amount_cents>=0), rental_amount_cents bigint not null check(rental_amount_cents>=0),
 total_amount_cents bigint not null check(total_amount_cents=lesson_amount_cents+rental_amount_cents),
 created_at timestamptz not null default now(), created_by text not null);
create table if not exists public.legal_acceptances(
 id uuid primary key default gen_random_uuid(), contract_version_id uuid not null references public.legal_contract_versions(id),
 signer_user_id text not null, signer_auth_id uuid not null references auth.users(id),
 signer_role text not null check(signer_role in ('INSTRUTOR','ALUNO')),
 accepted_general boolean not null check(accepted_general), accepted_clauses_4_5 boolean not null check(accepted_clauses_4_5),
 content_sha256 text not null, accepted_at timestamptz not null default now(),
 user_agent text, network_context jsonb, ip_address inet, ip_source text not null default 'unavailable',
 unique(contract_version_id,signer_role));
alter table public.legal_templates enable row level security;
alter table public.legal_contract_versions enable row level security;
alter table public.legal_acceptances enable row level security;
create or replace function public.legal_actor_id() returns text language sql stable security definer set search_path=public as $$
 select id::text from public.users where auth_user_id=auth.uid()
$$;
drop policy if exists legal_versions_read on public.legal_contract_versions;
create policy legal_versions_read on public.legal_contract_versions for select to authenticated using(public.legal_actor_id() in(instructor_user_id,student_user_id));
drop policy if exists legal_acceptances_read on public.legal_acceptances;
create policy legal_acceptances_read on public.legal_acceptances for select to authenticated using(exists(select 1 from public.legal_contract_versions v where v.id=contract_version_id and public.legal_actor_id() in(v.instructor_user_id,v.student_user_id)));
revoke all on public.legal_templates,public.legal_contract_versions,public.legal_acceptances from anon,authenticated;
grant select on public.legal_contract_versions,public.legal_acceptances to authenticated;
create or replace function public.prepare_legal_contract(p_request_id uuid,p_student_id text,p_package_contract_id text,p_variables jsonb)
returns public.legal_contract_versions language plpgsql security definer set search_path=public,extensions as $$
declare actor text:=public.legal_actor_id(); student_record record; student_user text; package jsonb; body text; item record; total bigint; rental bigint; lessons bigint; result public.legal_contract_versions;
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
create or replace function public.accept_legal_contract(p_version_id uuid,p_hash text,p_general boolean,p_clauses boolean)
returns public.legal_acceptances language plpgsql security definer set search_path=public as $$
declare actor text:=public.legal_actor_id(); version public.legal_contract_versions; result public.legal_acceptances; party text; headers jsonb:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
begin
 if actor is null or p_general is distinct from true or p_clauses is distinct from true then raise exception 'Identidade e os dois aceites são obrigatórios'; end if;
 select * into version from public.legal_contract_versions where id=p_version_id;
 if not found or actor not in(version.instructor_user_id,version.student_user_id) then raise exception 'Contrato indisponível para esta identidade'; end if;
 if p_hash is distinct from version.content_sha256 then raise exception 'A versão mudou. Releia o contrato'; end if;
 party:=case when actor=version.instructor_user_id then 'INSTRUTOR' else 'ALUNO' end;
 insert into public.legal_acceptances(contract_version_id,signer_user_id,signer_auth_id,signer_role,accepted_general,accepted_clauses_4_5,content_sha256,user_agent,network_context,ip_source)
 values(version.id,actor,auth.uid(),party,true,true,version.content_sha256,left(headers->>'user-agent',1000),jsonb_build_object('x-forwarded-for',left(headers->>'x-forwarded-for',1000)),case when headers ? 'x-forwarded-for' then 'forwarded_header_unverified' else 'unavailable' end)
 on conflict(contract_version_id,signer_role) do nothing;
 select * into result from public.legal_acceptances where contract_version_id=version.id and signer_role=party;
 return result;
end $$;
revoke all on function public.legal_actor_id(),public.prepare_legal_contract(uuid,text,text,jsonb),public.accept_legal_contract(uuid,text,boolean,boolean) from public,anon;
grant execute on function public.legal_actor_id(),public.prepare_legal_contract(uuid,text,text,jsonb),public.accept_legal_contract(uuid,text,boolean,boolean) to authenticated;

insert into public.legal_templates(code,version,content) values('CONTRATO_AULA_PRATICA','1.0.0',$legal_template$# CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE INSTRUÇÃO PRÁTICA DE DIREÇÃO VEICULAR

Pelo presente instrumento particular de prestação de serviços, firmado eletronicamente por meio da plataforma tecnológica **{{NOME_PLATAFORMA}}**, as partes abaixo qualificadas:

**CONTRATADO (INSTRUTOR AUTÔNOMO):** **{{NOME_INSTRUTOR}}**, inscrito(a) no CPF/CNPJ sob o nº **{{CPF_CNPJ_INSTRUTOR}}**, credenciado(a) junto ao Departamento Estadual de Trânsito (DETRAN/{{UF}}) sob o registro nº **{{REGISTRO_DETRAN}}**, residente e domiciliado(a) em {{CIDADE_UF_INSTRUTOR}}, doravante denominado simplesmente **INSTRUTOR**;

**CONTRATANTE (ALUNO):** **{{NOME_ALUNO}}**, inscrito(a) no CPF sob o nº **{{CPF_ALUNO}}**, portador(a) do RG nº **{{RG_ALUNO}}**, residente e domiciliado(a) em {{CIDADE_UF_ALUNO}}, doravante denominado simplesmente **ALUNO**;

Têm entre si justo e contratado o presente **Contrato de Prestação de Serviços de Instrução Prática de Direção Veicular**, que se regerá pelas disposições do Código de Defesa do Consumidor (Lei nº 8.078/1990), do Código Civil (Lei nº 10.406/2002), do Código de Trânsito Brasileiro (Lei nº 9.503/1997), das Resoluções do CONTRAN e pelas cláusulas seguintes:

---

### CLÁUSULA PRIMEIRA – DO OBJETO E DA NATUREZA DA PLATAFORMA
1.1. O objeto do presente contrato é a prestação de serviços de aulas práticas de direção veicular, categoria **{{CATEGORIA_CNH}}**, a serem ministradas pessoalmente pelo **INSTRUTOR** ao **ALUNO**, em veículo devidamente adaptado com duplo comando, homologado e vistoriado pelos órgãos de trânsito competentes.
1.2. **Modalidade Contratada:** {{MODALIDADE_CONTRATO}} (Ex.: Aula Avulsa / Pacote de {{QTD_AULAS}} aulas práticas), com duração efetiva de **{{DURACAO_MINUTOS}} minutos** cada aula.
1.3. **Papel da Plataforma Tecnológica:** As partes reconhecem expressamente que a plataforma **{{NOME_PLATAFORMA}}** atua exclusivamente como ferramenta digital de gestão cadastral, controle de agenda, relatórios e emissão de recibos, **não integrando a cadeia de fornecimento da instrução veicular nem intermediando, custodiando ou processando quaisquer pagamentos**, os quais são ajustados e liquidados diretamente entre **ALUNO** e **INSTRUTOR**.

---

### CLÁUSULA SEGUNDA – DOS REQUISITOS LEGAIS PARA A REALIZAÇÃO DAS AULAS E DO EXAME
2.1. Para a realização de cada aula prática e do exame de direção veicular, é obrigação indispensável do **ALUNO** portar e apresentar ao **INSTRUTOR**, antes do início da atividade:
   a) Documento oficial de identificação original com foto, válido em todo o território nacional;
   b) Licença para Aprendizagem de Direção Veicular (**LADV**) válida, física ou digital, expedida pelo DETRAN para a respectiva categoria.
2.2. O **ALUNO** deverá comparecer trajando vestimenta adequada e calçado firme que se prenda aos pés e não comprometa o uso dos pedais (vedado o uso de chinelos, sandálias abertas sem tira traseira ou saltos altos, nos termos do art. 252, IV, do CTB).
2.3. **O não cumprimento dos itens 2.1 ou 2.2 impedirá a realização da aula ou a disponibilização do veículo no exame por imperativo legal de segurança viária, configurando ausência injustificada por culpa exclusiva do ALUNO e acarretando o débito integral da respectiva aula ou taxa de exame, sem direito a reposição ou reembolso.**

---

### CLÁUSULA TERCEIRA – DO QUADRO FINANCEIRO, FORMA DE PAGAMENTO E OBRIGAÇÕES FISCAIS
3.1. Pelos serviços contratados, o **ALUNO** pagará diretamente ao **INSTRUTOR** os valores discriminados no resumo financeiro abaixo, na forma acordada diretamente entre as partes (**{{FORMA_PAGAMENTO_ACORDADA}}**):

* **Plano / Pacote Escolhido:** {{MODALIDADE_CONTRATO}} ({{QTD_AULAS}} aula(s) prática(s))
* **Valor Unitário por Aula:** R$ {{VALOR_UNITARIO}}
* **Subtotal das Aulas:** R$ {{SUBTOTAL_AULAS}}
* **Cessão/Aluguel do Veículo para Exame Prático do DETRAN:** **{{STATUS_EXAME}}** *(Ex.: Incluso no Pacote / Cobrado à parte por exame)* — **Valor Destacado: R$ {{VALOR_ALUGUEL_EXAME}}**
* **VALOR TOTAL DO CONTRATO:** **R$ {{VALOR_TOTAL}}** ({{VALOR_EXTENSO}})

3.2. A confirmação definitiva dos horários agendados na plataforma fica condicionada à quitação dos valores ajustados diretamente junto ao **INSTRUTOR**, conforme cronograma combinado entre as partes.
3.3. A cada pagamento recebido, o **INSTRUTOR** compromete-se a registrar a baixa na plataforma para geração do respectivo recibo eletrônico e a cumprir integralmente suas obrigações tributárias, fiscais e previdenciárias (ISS, IRPF/IRPJ e INSS) incidentes sobre sua atividade autônoma, isentando o **ALUNO** e a plataforma de quaisquer encargos dessa natureza.

---

### CLÁUSULA QUARTA – DO AGENDAMENTO, PONTUALIDADE, FALTAS E CANCELAMENTOS (CLÁUSULA EM DESTAQUE – ART. 54, § 4º DO CDC)
4.1. **Antecedência Mínima para Cancelamento ou Reagendamento:** **O ALUNO poderá cancelar ou solicitar o reagendamento de qualquer aula agendada, sem qualquer ônus ou perda financeira, desde que o faça formalmente por meio da plataforma ou canal registrado com antecedência mínima de 24 (vinte e quatro) horas do horário previsto para o início da aula.**
4.2. **Perda da Aula por Falta ou Aviso Tardio (*No-Show*):** **Caso o ALUNO não compareça à aula agendada ou solicite o cancelamento/reagendamento com antecedência inferior a 24 (vinte e quatro) horas, a aula será considerada integralmente ministrada, disponível e consumida, sendo debitada do saldo do pacote (ou cobrada integralmente, se avulsa), sem direito a reposição ou restituição de valores**, em razão da reserva exclusiva da agenda profissional e da disponibilidade operacional do veículo.
4.3. **Tolerância de Atraso do Aluno:** **O INSTRUTOR aguardará o ALUNO no local combinado pelo prazo máximo de tolerância de 15 (quinze) minutos após o horário agendado. Ultrapassado esse limite sem o comparecimento do ALUNO, ficará caracterizada a falta injustificada, encerrando-se a espera com o consequente débito integral da aula.** Caso o **ALUNO** compareça dentro do prazo de tolerância, a aula será ministrada pelo tempo restante originalmente agendado, sem acréscimo de minutos ao final.
4.4. **Atraso ou Cancelamento pelo Instrutor:** Caso o **INSTRUTOR** atrase além da tolerância prevista no item 4.3, cancele a aula com menos de 24 horas de antecedência, ou fique impossibilitado de ministrá-la por falha mecânica, falta de combustível ou irregularidade documental do veículo, **a aula não será debitada e deverá ser integralmente reposta em novo horário acordado com o ALUNO, sem qualquer custo adicional**.
4.5. **Exceção por Caso Fortuito ou Força Maior:** Excepcionalmente, não haverá perda da aula se o **ALUNO** comprovar, no prazo de até 48 (quarenta e oito) horas após o horário agendado, impedimento grave, imprevisível e inevitável — exclusivamente mediante apresentação de atestado médico de atendimento de urgência/emergência, declaração de internação hospitalar ou certidão de óbito de parente de até 2º grau — hipótese em que a aula será reagendada sem ônus.

---

### CLÁUSULA QUINTA – DA DISPONIBILIZAÇÃO DO VEÍCULO PARA O EXAME PRÁTICO DE DIREÇÃO (DETRAN)
5.1. **Escopo da Cessão para Exame:** Havendo contratação da cessão/aluguel do veículo para o dia do exame prático (conforme destacado na Cláusula Terceira), o **INSTRUTOR** compromete-se a comparecer e disponibilizar o veículo homologado no local, data e horário oficial designados pelo DETRAN, acompanhando o **ALUNO** durante o período de realização da prova.
5.2. **Taxas Administrativas do Órgão de Trânsito:** O valor destacado na Cláusula Terceira refere-se **exclusivamente à disponibilização operacional do veículo, deslocamento e acompanhamento profissional do INSTRUTOR**, não incluindo taxas estaduais do DETRAN (tais como taxa de marcação de exame, DAE/DUDA ou taxa de reteste), que são de responsabilidade exclusiva do **ALUNO**.
5.3. **Comunicação da Data da Prova e Disponibilidade:** O **ALUNO** deverá informar ao **INSTRUTOR** a data e o horário oficiais do exame com antecedência mínima de **{{DIAS_AVISO_EXAME}} dias corridos**, para que o **INSTRUTOR** bloqueie sua agenda e evite conflito de horários com outros candidatos.
5.4. **Falta, Atraso ou Desistência no Dia do Exame:** **Caso o ALUNO não compareça ao local do exame no horário estabelecido pelo DETRAN, chegue atrasado após o fechamento da pauta pelo examinador, seja impedido de realizar a prova por falta de documentação obrigatória (item 2.1) ou desista da utilização do veículo com menos de 24 (vinte e quatro) horas de antecedência, o serviço de cessão para exame será considerado integralmente prestado e consumido, não havendo direito a reembolso ou reaproveitamento gratuito para novo exame.**
5.5. **Novo Exame (Reteste):** A contratação descrita na Cláusula Terceira cobre **01 (uma) tentativa de exame prático** (salvo especificação expressa diversa no pacote). Em caso de reprovação ou necessidade de novo exame por motivo não imputável ao **INSTRUTOR**, eventual nova cessão do veículo dependerá de novo agendamento e pagamento da respectiva taxa de aluguel vigente.
5.6. **Impedimento por Culpa do Instrutor ou Falha do Veículo:** Caso o exame não se realize por ausência do **INSTRUTOR**, falha mecânica do veículo ou irregularidade documental do carro/instrutor constatada pela banca examinadora do DETRAN, o **INSTRUTOR** deverá disponibilizar o veículo gratuitamente no reteste subsequente e ressarcir eventuais taxas de remarcação do DETRAN comprovadamente pagas pelo **ALUNO** em razão dessa falha.

---

### CLÁUSULA SEXTA – DO PRAZO DE VALIDADE DO PACOTE E DO DIREITO DE ARREPENDIMENTO
6.1. **Prazo de Utilização:** Quando contratado na modalidade de pacote, o **ALUNO** deverá agendar e concluir todas as aulas adquiridas no prazo máximo de **{{PRAZO_VALIDADE_DIAS}} dias corridos** a contar da data do aceite deste contrato, observado sempre o prazo legal de validade do seu processo de habilitação (RENACH) junto ao DETRAN. Após esse prazo, eventuais aulas não agendadas por inércia exclusiva do **ALUNO** expirarão, salvo prorrogação expressa concedida pelo **INSTRUTOR**.
6.2. **Direito de Arrependimento (Art. 49 do CDC):** Por tratar-se de contratação formalizada em ambiente digital, o **ALUNO** poderá exercer o direito de arrependimento imotivado no prazo de até **7 (sete) dias corridos** a contar da assinatura eletrônica deste instrumento, fazendo jus à devolução integral (100%) dos valores eventualmente pagos ao **INSTRUTOR**. Caso o **ALUNO** já tenha usufruído de alguma(s) aula(s) ou da cessão para exame dentro desse período de 7 (sete) dias, será descontado apenas o valor proporcional dos serviços efetivamente prestados (ou debitados por falta injustificada).

---

### CLÁUSULA SÉTIMA – DA RESCISÃO ANTECIPADA E QUEBRA CONTRATUAL
7.1. **Desistência Imotivada pelo Aluno (Após 7 dias):** Transcorrido o prazo legal de arrependimento de 7 (sete) dias, o **ALUNO** poderá solicitar a rescisão antecipada do pacote a qualquer momento. Nesta hipótese, o **INSTRUTOR** restituirá diretamente ao **ALUNO**, no prazo de até 10 (dez) dias úteis, o valor correspondente às aulas **não realizadas** e à cessão de exame (caso paga e ainda não utilizada/agendada dentro das 24h), ficando autorizada a retenção de **multa compensatória de {{PERCENTUAL_MULTA}}%** incidente exclusivamente sobre o saldo remanescente cancelado, a título de cobertura de custos administrativos e bloqueio de agenda.
7.2. **Rescisão por Justa Causa (Quebra Contratual pelo Aluno):** O **INSTRUTOR** poderá rescindir imediatamente o presente contrato, sem prejuízo do débito das aulas já realizadas/faltadas e da cobrança da multa prevista no item 7.1, caso o **ALUNO**:
   a) Compareça à aula ou ao exame sob influência de álcool ou qualquer substância psicoativa;
   b) Pratique atos de desrespeito grave, ofensa moral, assédio de qualquer natureza ou agressão contra o **INSTRUTOR**;
   c) Desobedeça deliberadamente às instruções de segurança viária, colocando em risco iminente a integridade física das partes, de terceiros ou do patrimônio;
   d) Incorra em inadimplência financeira ou estorno fraudulento dos valores devidos.
7.3. **Rescisão por Justa Causa (Quebra Contratual pelo Instrutor):** O **ALUNO** poderá rescindir imediatamente o contrato, exigindo a **restituição integral e imediata de 100% do valor dos serviços não prestados (aulas e exame), sem incidência de qualquer multa**, além de eventuais perdas e danos cabíveis, caso o **INSTRUTOR**:
   a) Cancele aulas agendadas de forma reiterada e injustificada (3 ou mais ocorrências);
   b) Reduza unilateralmente o tempo efetivo de duração das aulas contratadas;
   c) Aja com negligência grave durante a instrução (uso contínuo de aparelho celular pessoal durante a condução do aluno, sonolência ou falta de atenção) ou pratique desrespeito/assédio;
   d) Tenha seu credenciamento junto ao DETRAN suspenso ou cassado durante a vigência deste contrato.

---

### CLÁUSULA OITAVA – DA RESPONSABILIDADE CIVIL E SEGURANÇA DO VEÍCULO
8.1. Compete ao **INSTRUTOR** manter o veículo em perfeitas condições de segurança, higiene, manutenção preventiva e regularidade documental, bem como exercer vigilância ativa por meio dos comandos auxiliares (duplo comando de freio e embreagem).
8.2. O **INSTRUTOR** assume integralmente os riscos inerentes ao aprendizado normal da direção veicular (desgaste mecânico, pequenas avarias decorrentes de imperícia natural do aprendiz sob supervisão), sendo vedada a cobrança de franquia de seguro ou reparos do **ALUNO**, **salvo se comprovado que o dano decorreu de ato doloso (intencional) ou de desobediência deliberada do ALUNO às ordens expressas de parada ou manobra dadas pelo INSTRUTOR** (arts. 186 e 927 do Código Civil).

---

### CLÁUSULA NONA – DA PROTEÇÃO DE DADOS (LGPD) E VALIDADE DA ASSINATURA ELETRÔNICA
9.1. As partes comprometem-se a tratar os dados pessoais compartilhados nesta relação estritamente para a execução deste contrato e cumprimento das normas dos órgãos de trânsito, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
9.2. As partes reconhecem como plenamente válida, eficaz e vinculante a assinatura eletrônica deste instrumento mediante aceite digital na plataforma **{{NOME_PLATAFORMA}}**, com registro de data, hora, endereço IP e identificação de sessão, nos termos do art. 10, § 2º, da Medida Provisória nº 2.200-2/2001 e do art. 784, § 4º, do Código de Processo Civil.

---

### CLÁUSULA DÉCIMA – DO FORO
10.1. Para dirimir quaisquer controvérsias oriundas deste contrato, fica eleito o foro do domicílio do **ALUNO** (consumidor), nos termos do art. 101, inciso I, do Código de Defesa do Consumidor.

E, por estarem assim justas e contratadas, as partes manifestam seu aceite eletrônico expresso.

**Local e Data:** {{CIDADE_UF}}, {{DATA_ACEITE_EXTENSO}}.

---
**ASSINATURA ELETRÔNICA – INSTRUTOR:** {{NOME_INSTRUTOR}} (ID/Log: {{HASH_INSTRUTOR}})
**ASSINATURA ELETRÔNICA – ALUNO:** {{NOME_ALUNO}} (ID/Log: {{HASH_ALUNO}} | IP: {{IP_ALUNO}})
$legal_template$) on conflict(code,version) do nothing;
commit;
