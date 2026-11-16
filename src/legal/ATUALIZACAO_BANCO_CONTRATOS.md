# Atualização de contratos e aceites

Execute supabase_migracao_contratos_aceites_20261116.sql no SQL Editor do Supabase. A migração é aditiva e foi testada duas vezes em PostgreSQL isolado. Faça o backup administrativo habitual antes de aplicar em produção.

## Estruturas
- legal_templates mantém código, versão e conteúdo do modelo. Para alterar uma minuta já usada, publique uma nova versão.
- legal_contract_versions guarda conteúdo renderizado no servidor, SHA-256, aluno, instrutor, pacote, variáveis, valores separados de aulas/locação e total. As partes consultam somente suas versões.
- legal_acceptances registra cada parte separadamente, identidade Supabase Auth, dois checkboxes, hash da versão, data UTC do servidor e user-agent. Repetir o mesmo aceite devolve o comprovante original. Clientes não têm permissão direta para inserir, alterar ou apagar essas tabelas.
- users.auth_user_id vincula o cadastro legado à identidade real em Authentication. O operador deve conferir cada pessoa antes de preencher esse vínculo. Não use IDs inventados nem envie senhas/chaves por mensagem.

## Ativação
1. Execute a migração e confirme as três tabelas e as funções prepare_legal_contract e accept_legal_contract.
2. Em Authentication, confira o UUID real do instrutor e do aluno. Em public.users, preencha auth_user_id no cadastro correspondente de cada pessoa. Os dois IDs devem ser distintos e cada pessoa deve entrar pela própria sessão Supabase Auth. O login legado que compara senha no navegador precisa de sessão Auth para usar os aceites.
3. Confira que o aluno está vinculado ao instrutor em students.instrutor_id, e que existe uma única conta ALUNO com seu e-mail na mesma organização.
4. O contrato do pacote continua persistido no JSON contratos_pacotes do aluno, já utilizado pelo adaptador. Campos opcionais novos são valorAulasCentavos, valorLocacaoExameCentavos e locacaoExameContratada. valorCentavos passa a ser o total de aulas + locação nesse novo fluxo. Registros antigos usam locação zero e mantêm seu valor original.
5. Na interface, selecione aluno e pacote, preencha pendências e registre uma versão. Cada parte consulta essa versão, lê o conteúdo, marca os dois checkboxes e confirma seu próprio aceite. Uma edição gera outra versão e exige novos aceites.

## Rede e retenção
O PostgreSQL registra o user-agent e o contexto x-forwarded-for recebido do gateway com origem forwarded_header_unverified. Esse cabeçalho pode ser informado por um cliente e exige validação na infraestrutura para ser considerado IP confiável. ip_address permanece nulo até essa validação. Nenhum IP é inventado. A associação principal do aceite usa auth.uid() e o cadastro vinculado.

As tabelas jurídicas não utilizam o cofre limitado a 600 auditorias. Configure backup, retenção e acesso administrativo do Supabase conforme a política da empresa. Esta revisão não instala automaticamente a migração nem configura Supabase Auth.

## Testes
- tests/legal-database.mjs executa o SQL em PGlite/PostgreSQL isolado. Instale @electric-sql/pglite em ambiente temporário e defina LEGAL_PGLITE_PATH para a pasta do pacote.
- tests/legal-contracts.mjs testa a interface com serviços interceptados, pacote com locação, campos exibidos, checkboxes, erro ao gravar e confirmação somente após resposta de sucesso.
- tests/legal-documents.mjs testa documentos e exportação em quatro áreas úteis.

## Aceites no cadastro
Execute também supabase_migracao_aceites_cadastro_20261116.sql antes de disponibilizar os cadastros atualizados. O campo users.registration_legal_consent guarda a declaração inicial, conteúdo dos termos/privacidade, versões, hashes, data e user-agent do cliente. No aluno inclui oferta identificada por instrutor/pacote, quantidade de aulas, total e hash da oferta, além dos dois reconhecimentos específicos. A interface começa com todas as caixas desmarcadas e exige confirmação explícita. Trocar oferta, instrutor ou preço reinicia a ciência do pacote. A pré-verificação do banco ocorre antes das gravações do cadastro. Essa declaração pré-autenticação tem origem declarada no cliente; o aceite autenticado bilateral permanece em legal_acceptances, com a identidade Auth e data do servidor.

## Documentos preenchidos na origem
Execute supabase_migracao_dados_cadastrais_contratos_20261116.sql após a migração de contratos/aceites. Ela adiciona users.rg, users.registro_detran e package_offers.condicoes_contratuais e atualiza a função de preparação para obter identificação e condições diretamente dos registros do banco. O leitor não possui campos de preenchimento. RG e registro DETRAN são informados nos cadastros de aluno/instrutor. Duração, aviso de exame, validade e multa são informados no cadastro ou contratação do pacote. Pacotes contratados mantêm as condições próprias; registros legados sem essas condições consultam a oferta de origem. Campos ausentes bloqueiam o registro e devem ser corrigidos na origem. CPF completo do aluno é obtido da sua conta vinculada por organização e fingerprint, sem usar CPF mascarado como identificação completa.

## Identificação por CPF
Execute supabase_migracao_contratos_cpf_20261116.sql após as migrações jurídicas anteriores para usar o modelo 1.0.1, sem RG obrigatório. Contratos já registrados mantêm seu conteúdo e seus hashes. O cadastro continua usando CPF completo e vínculo por identidade para as partes.

## Coluna de contratos detalhados
Execute supabase_migracao_coluna_contratos_pacotes_20261116.sql. A consulta de metadados identificou students.contratos_pacotes ausente, apesar de ser usada no adaptador e nas funções jurídicas. O comando apenas acrescenta a coluna JSONB, sem gerar contratos ou aceites. Depois, o instrutor deve conferir o aluno e o pacote e registrar a versão no fluxo existente. O aluno recebe a versão publicada para leitura e confirmação.
