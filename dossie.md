# DOSSIÊ COMPLETO DO SISTEMA DE GESTÃO DE DIREÇÃO
**Documento Oficial de Registro Técnico, Arquitetura de Software, Catálogo de Telas, Funcionalidades, Regras de Negócio e Agentes de Segurança**  
*Data de Homologação: Outubro de 2026 | Versão da Plataforma: v5.6 Auditada, Homologada e Pronta para Produção (Go-Live & Supabase)*

---

## 1. RESUMO EXECUTIVO E IDENTIFICAÇÃO DO SISTEMA

O **Sistema de Administração de Gestão de Direção** é uma solução tecnológica full-stack de alta performance, projetada especialmente para **Instrutores de Trânsito Autônomos**, **Centros de Formação de Condutores (CFCs / Autoescolas)** e **Candidatos à Habilitação (Alunos)**.

A plataforma resolve a carência histórica de ferramentas integradas no setor de formação de condutores no Brasil, unificando em um único ambiente seguro:
1. **Gestão Pedagógica Completa**: Acompanhamento aula a aula das habilidades práticas do candidato conforme a matriz de competências do CONTRAN.
2. **Gestão Financeira Especializada**: Controle de receitas, contas a receber, parcelamento, integração PIX dinâmico (Copia e Cola + QR Code), despesas operacionais detalhadas (combustível, manutenção, seguro), metas de investimento e Demonstrativo do Resultado do Exercício (DRE).
3. **Agenda Inteligente Noturna e Diurna**: Calendário adaptativo operando das **06:00 às 00:00**, atendendo rigorosamente à exigência de carga horária noturna do Código de Trânsito Brasileiro.
4. **Governança Estrita de Acessos (RBAC)**: Separação categórica entre Administrador Master, Gestor do CFC, Instrutor Credenciado e Aluno.
5. **Auditoria LGPD e Perpetuidade de Dados**: Rastreamento imutável de todas as ações no sistema, mascaramento de CPFs e proteção ativa contra quebras de código por agentes autônomos de segurança.

---

## 2. MATRIZ DE PERFIS, HIERARQUIA E CONTROLE DE ACESSO (RBAC)

O sistema opera com controle de acesso baseado em papéis (*Role-Based Access Control*), garantindo que cada usuário visualize exclusivamente os dados pertinentes à sua alçada:

| Perfil | Identificador Interno | Descrição e Escopo de Acesso |
| :--- | :--- | :--- |
| **Administrador Master** | `SUPER_ADMIN` | Administrador supremo do sistema (**`cassiordcosta@gmail.com`**). Possui acesso irrestrito a todas as organizações, monitoramento de saúde do banco de dados, **Verificador de Cadastros e Integridade**, reatribuição forçada de alunos, manutenção do Firestore e **acesso exclusivo ao Dossiê Técnico e Agentes de Segurança**. |
| **Administrador do CFC** | `ADMIN_ORG` | Gestor da Autoescola. Gerencia múltiplos instrutores de sua própria unidade, veículos da frota, relatórios financeiros consolidados da instituição e auditoria de alunos da sua autoescola. |
| **Instrutor Credenciado** | `INSTRUTOR` | Profissional de trânsito (autônomo ou credenciado). Gerencia sua própria carteira de alunos vinculados, cria seus pacotes de aulas e planos, define sua agenda de horários (06h às 00h), avalia habilidades práticas, controla suas contas a receber e despesas operacionais, e emite cobranças/lembretes via WhatsApp. |
| **Aluno / Candidato** | `ALUNO` | Candidato à CNH (Categorias A, B, AB, C, D, E). Acessa exclusivamente o **Portal do Aluno**, visualizando seu instrutor responsável, carga horária cumprida versus restante, próximas aulas práticas agendadas, extrato financeiro com botão de pagamento PIX e notas pedagógicas de avaliação. |

### 2.1 Acesso Exclusivo do Administrador Master (`cassiordcosta@gmail.com`)
- O botão e link do **Dossiê Técnico & Agentes de Segurança** são restritos estritamente ao e-mail `cassiordcosta@gmail.com` e ao papel `SUPER_ADMIN`.
- Se qualquer outro usuário (mesmo com token alterado) tentar acessar o modal ou a rota, o sistema dispara bloqueio visual e registra tentativa não autorizada no `AuditLog`.
- O Administrador Master conta com atalho direto de autenticação com o **Google Social Login** e interface dedicada de gestão global.

### 2.2 Sistema de Recuperação de Senha Segura
- Caso o Administrador Master ou qualquer usuário perca o acesso:
  - O sistema disponibiliza o fluxo de recuperação cruzada exigindo obrigatoriamente **E-mail de cadastro + CPF completo cadastrado**.
  - O algoritmo valida a correspondência exata dos dígitos do CPF no banco de dados.
  - Sendo validado, gera um código temporário de verificação de uso único com expiração em 15 minutos e permite a redefinição segura da senha, prevenindo sequestro de contas por força bruta.

### 2.3 Autenticação em Duas Etapas (2FA)
- Proteção adicional por código de 6 dígitos para acessos administrativos.
- Interface responsiva adaptada para qualquer resolução de tela (mobile e desktop) sem corte de dígitos.

---

## 3. CATÁLOGO COMPLETO DE TELAS DO SISTEMA

Abaixo estão descritas todas as 19 interfaces que compõem o sistema (incluindo o módulo de Saúde Financeira e o Migrador Supabase):

### TELA 1: Login Unificado e Autenticação (`LoginScreen.tsx`)
- **Finalidade**: Ponto de entrada do sistema para todos os perfis.
- **Recursos Principais**:
  - Formulário de login por e-mail e senha com validação sintática em tempo real.
  - Botão **"Continuar com Google"** para login social ágil.
  - Acesso direto com 1 clique para o Administrador Master (`cassiordcosta@gmail.com`) e perfis de demonstração (Instrutor e Aluno).
  - Link de auto-cadastro para novos instrutores autônomos.
  - Link de auto-cadastro para alunos (condicionado obrigatoriamente ao código de indicação do instrutor).
  - Link "Esqueceu a senha?" acionando o modal de recuperação por CPF e e-mail.

### TELA 2: Recuperação de Senha por CPF e E-mail (`PasswordRecoveryModal.tsx`)
- **Finalidade**: Redefinição de senha com dupla validação de identidade.
- **Recursos Principais**:
  - Campo de entrada do e-mail cadastrado.
  - Campo de CPF com aplicação de máscara automática (`999.999.999-99`) e validação dos dígitos verificadores.
  - Checagem cruzada na base de dados (o CPF informado precisa pertencer exatamente ao titular do e-mail).
  - Geração de código de verificação de segurança descartável.
  - Formulário para definição e confirmação da nova senha com indicador de força da senha.

### TELA 3: Autenticação em Duas Etapas - 2FA (`TwoFactorModal.tsx`)
- **Finalidade**: Barreira criptográfica secundária para transações sensíveis e login seguro.
- **Recursos Principais**:
  - 6 caixas de entrada numéricas com foco automático consecutivo (*auto-focus chaining*).
  - Teclado numérico otimizado para dispositivos móveis (`inputMode="numeric"`).
  - Layout anti-quebra testado para telas estreitas de smartphones (a partir de 320px).
  - Temporizador de expiração de código e botão de reenvio.

### TELA 4: Cadastro de Novo Instrutor (`InstructorRegisterModal.tsx`)
- **Finalidade**: Credenciamento de novos profissionais na plataforma.
- **Recursos Principais**:
  - Dados pessoais: Nome completo, E-mail profissional, Telefone/WhatsApp, CPF completo e data de nascimento.
  - Dados profissionais: Número do registro de credencial de instrutor no DETRAN, Categoria da CNH em que atua (A, B, AB, C, D, E).
  - Definição do modelo de trabalho: Instrutor Autônomo ou Vinculado a CFC existente.
  - Criação da senha de acesso e termos de responsabilidade técnica.

### TELA 5: Disparo de Convites para Alunos (`StudentInviteModal.tsx`)
- **Finalidade**: Permitir que o instrutor envie links de matrícula personalizados para novos candidatos.
- **Recursos Principais**:
  - Geração automática de link com token criptográfico vinculado ao ID exclusivo do instrutor (`token = inv_[instrutorId]_[timestamp]`).
  - Campo para digitar o WhatsApp do aluno e botão com deep link direto abrindo o WhatsApp com mensagem formatada e link embutido.
  - Campo para digitar o e-mail do aluno e botão com disparador `mailto:` pré-preenchido.
  - Botão de cópia rápida para a área de transferência com confirmação tátil ("Link Copiado!").
  - Exibição destacada do código de indicação do instrutor.

### TELA 6: Matrícula de Aluno por Auto-Cadastro (`StudentSelfRegisterModal.tsx`)
- **Finalidade**: Formulário pelo qual o aluno conclui sua matrícula no sistema.
- **Recursos Principais**:
  - **Bloqueio de Cadastro Avulso**: É obrigatório que haja um instrutor selecionado ou fixado via link de convite. Não é permitido aluno "sem instrutor".
  - Se acessado por link com token do instrutor, o campo do instrutor fica **bloqueado e confirmado com selo verde**.
  - **Validação de CPF**: Máscara automática, cálculo de dígitos verificadores e checagem de duplicidade no banco (regra 1 CPF = 1 Instrutor).
  - **Seleção de Pacotes**: Lista em tempo real os pacotes de aulas criados pelo instrutor selecionado, exibindo carga horária, valor e formas de pagamento aceitas.
  - Coleta de dados complementares: Telefone, Data de Nascimento (validação de idade mínima de 18 anos) e Categoria de CNH pretendida.
  - Ao concluir, gera automaticamente o perfil do aluno, a conta de acesso e as parcelas a receber no financeiro do instrutor.

### TELA 7: Painel do Administrador Master (`AdminMasterPanel.tsx`)
- **Finalidade**: Cockpit de governança exclusiva do Administrador Master (`cassiordcosta@gmail.com`).
- **Subtelas e Funcionalidades**:
  1. **Verificador de Cadastros e Integridade**:
     - Varredura em tempo real de todas as relações do sistema.
     - **Card de Saúde Global**: Exibe a pontuação de integridade percentual da base (ex: 100% Saudável).
     - **Tabela de Instrutores e Alunos**: Lista cada instrutor, quantidade de alunos ativos, total de aulas agendadas e faturamento realizado versus pendente.
     - **Diagnóstico Ativo de Inconsistências**: Localiza e emite alertas visuais sobre:
       - Alunos órfãos (sem instrutor atribuído);
       - Aulas agendadas com instrutor inativo ou inexistente;
       - Títulos financeiros sem aluno vinculado;
       - Conflitos de horários em agendas;
       - Tentativas de duplicidade de CPF.
     - **Reatribuição Rápida de Alunos**: Ferramenta que permite ao Master transferir qualquer aluno de um instrutor para outro em caso de emergência ou descredenciamento com 1 clique.
  2. **Organizações e Autoescolas (CFCs)**:
     - Visualização de todas as autoescolas clientes, CNPJ, responsável, número de instrutores associados e plano assinado (Básico, Pro, Enterprise).
  3. **Manutenção do Banco de Dados**:
     - Monitor de armazenamento local e status da sincronização com o Cloud Firestore.
     - Ferramenta de migração de dados em lote (`MigrateLocalToFirebase`).
     - Botão de restauração e reset de dados para testes homologados.

### TELA 8: Dossiê & Agentes de Segurança (`SecurityAgentsModal.tsx`)
- **Finalidade**: Centro de comando de proteção de código, auditoria e conformidade técnica.
- **Acesso**: 100% exclusivo do Administrador Master.
- **Abas Integradas**:
  1. **Dossiê do Sistema**: Visualizador completo das especificações com botão de **Imprimir / Gerar PDF** formatado com cabeçalho oficial.
  2. **Agente de Monitoramento (Watchdog Agent)**: Métricas em tempo real de latência, integridade do storage, taxa de sucesso de operações e console de eventos estruturados com filtro por severidade (`INFO`, `SECURE`, `WARNING`, `CRITICAL`).
  3. **Agente de Proteção e Trava de Código (Code Guard Agent)**: Status da trava de código (`Trava Ativa`), gerenciador de Snapshots de restauração (Checkpoints) e formulário de autorização humana obrigatória para alterações estruturais.
  4. **Validação Multidisciplinar**: Matriz de checagem com critérios de UX/UI, Engenharia de Software, Arquitetura de Dados e Acessibilidade WCAG Mobile.
  5. **Banco de Dados & Firebase**: Monitor do Cloud Firestore, teste ativo de conectividade em tempo real, barra de progresso de migração e log de sincronização offline-first.

### TELA 9: Dashboard do Instrutor (`InstructorDashboard.tsx`)
- **Finalidade**: Tela inicial do instrutor com visão panorâmica do seu negócio.
- **Recursos Principais**:
  - Cards de métricas imediatas: Total de Alunos Ativos, Aulas Agendadas Hoje, Faturamento Recebido no Mês e Saldo a Receber.
  - Lista de próximas aulas do dia com horário, nome do aluno, tipo de treino e botão de chamada rápida via WhatsApp.
  - Atalhos rápidos de ação: "Novo Aluno", "Agendar Aula", "Lançar Despesa", "Enviar Convite".
  - Alertas pedagógicos: Notificação de alunos com aulas pendentes de agendamento ou próximos do exame prático do DETRAN.

### TELA 10: Gestão de Alunos, Financeiro Individual e Transferências (`StudentsView.tsx`)
- **Finalidade**: Cadastro, acompanhamento pedagógico, financeiro individual, histórico de pagamentos e transferências de alunos do instrutor.
- **Recursos Principais**:
  - Tabela responsiva com busca instantânea por nome ou CPF mascarado, filtros por Categoria (A, B, etc.) e Status (Em Andamento, Concluído, Cancelado).
  - Modal de cadastro direto de aluno pelo instrutor com campos obrigatórios: Nome, CPF completo, Telefone, Categoria, Pacote Contratado e Observações Iniciais.
  - **Ficha Pedagógica e Financeira do Aluno**:
    - Radar de habilidades (baliza, embreagem, trânsito pesado, conversões, rodovia, postura defensiva, simulado), histórico de aulas ministradas e parecer do instrutor.
    - **Financeiro & Recibos do Aluno**: Resumo financeiro imediato com Total Contratado, Total Pago / Amortizado e Saldo Devedor Restante.
    - Tabela de comprovantes e pagamentos registrados para o aluno com data, forma, valor, código de autenticação e botão **"Emitir Recibo"** individual para cada recebimento.
    - Botão **"+ Novo Recibo"**: Permite emitir recibo personalizado avulso, por parcela ou por período com 1 clique.
  - **Relatório Geral de Pagamentos de Alunos**:
    - Modal acessado pelo botão no cabeçalho com filtros por período (*Todos os Períodos*, *Este Mês*, *Mês Passado*, *Este Ano*).
    - Cards de totais: Total Recebido no Período, Quantidade de Comprovantes e Ticket Médio.
    - Tabela de pagamentos com Nome do Aluno, CPF, Data, Forma, Valor e botão para emitir o recibo oficial.
  - **Transferência Formal de Aluno (`StudentTransferModal.tsx`)**:
    - Permite repassar o aluno para outro instrutor credenciado.
    - Exige preenchimento obrigatório do **Motivo Formal da Transferência**.
    - Mantém 100% das aulas já concluídas preservadas.
    - Cria registro permanente no `StudentTransferHistory` e log de auditoria LGPD com autoria e timestamp.

### TELA 11: Gestão de Pacotes de Aulas e Planos (`PackagesManager.tsx`)
- **Finalidade**: Criação e administração dos planos comerciais oferecidos pelo instrutor.
- **Recursos Principais**:
  - Listagem dos pacotes em formato de cards com distinção visual entre **Ativo** e **Pausado**.
  - Modal de criação e edição com os seguintes parâmetros:
    - **Nome do Pacote**: Ex: "Pacote CNH B Completo 20 Aulas", "Intensivo Baliza e Garagem", "Treinamento para Habilitados Recém-Aprovados".
    - **Categoria de CNH**: A (Moto), B (Carro), AB (Carro e Moto), C (Caminhão), D (Ônibus), E (Carreta).
    - **Quantidade de Aulas Práticas**: Configurável (padrão 20 aulas ou avulso).
    - **Valor Total em Reais (R$)**: Armazenado em centavos para precisão centesimal.
    - **Formas de Pagamento Aceitas**: À Vista, Parcelado no Cartão, Negociado Direto, ou Todas as Opções.
    - **Condições Especiais**: Desconto percentual configurável para pagamento à vista (%) e número máximo de parcelas no cartão.
    - **Descrição Comercial**: Texto explicativo das competências incluídas.
  - Botão de ativação/pausa de pacote (pacotes pausados não aparecem para novos alunos, mas mantêm contratos vigentes).
  - Botão de clonagem rápida para criar variações de pacotes com 1 clique.

### TELA 12: Agenda de Aulas Práticas (`ScheduleView.tsx`)
- **Finalidade**: Agendamento, controle de presença e avaliação de aulas diurnas e noturnas.
- **Recursos Principais**:
  - **Horário Estendido (06:00 às 00:00)**: Suporta aulas desde a primeira hora da manhã até a meia-noite para cumprimento de exigências de direção noturna do CONTRAN.
  - Modos de visualização: Visão Diária detalhada e Visão Semanal em grade.
  - Modal de agendamento de aula: Seleção de aluno matriculado, data, horário de início e término, veículo a ser utilizado e foco pedagógico (Ex: Baliza, Estacionamento, Trânsito Urbano, Rodovia, Noturna).
  - **Lançamento de Presença e Nota de Desempenho**: O instrutor registra se o aluno compareceu ou faltou, atribui nota de 1 a 10 e assinala competências trabalhadas na sessão.
  - **Bloqueio de Horários**: Permite que o instrutor reserve slots para descanso, almoço, manutenção veicular ou compromissos particulares, impedindo agendamentos no período.

### TELA 13: Gestão Financeira Completa, DRE e IRPF Carnê-Leão (`FinanceView.tsx`)
- **Finalidade**: Controle financeiro profissional com fluxo de caixa, cobranças, emissão de recibos, DRE e relatório fiscal para IRPF (Carnê-Leão para autônomos).
- **Sub-Abas Especializadas**:
  1. **Contas a Receber (Recebíveis)**:
     - Tabela detalhada de parcelas e contratos dos alunos com status (Pago, Pendente, Vencido).
     - Baixa manual de pagamento registrando forma (PIX, Cartão, Dinheiro, Transferência) e número de comprovante.
     - **Gerador de Cobrança PIX**: Criação instantânea de chave PIX com QR Code de alta resolução e Copia e Cola.
     - **Histórico de Recebimentos Realizados & Emissão de Recibos**: Relação de todos os pagamentos baixados com dados do pagador, CPF, data, método, código de autenticação e botão **"Emitir Recibo"** oficial.
     - **Recibo Oficial em Via Única Digital**: Emissão de comprovante em layout vetorial moderno (Via do Aluno / Pagador), sem picote físico nem linha de corte ("✄"), com data formatada no padrão brasileiro (`DD/MM/YYYY`), valor por extenso automático (`numberToWordsBRL`), identificação do aluno com CPF protegido, credencial do instrutor e autenticação digital inviolável (`AUT-XXXXXX`), pronto para download em PDF ou compartilhamento instantâneo via WhatsApp.
  2. **Gestão de Despesas Operacionais**:
     - Lançamento de saídas com categorização profissional (*Combustível*, *Manutenção*, *Seguro*, *Taxas DETRAN*, *Alimentação*, *Marketing*).
     - Associação opcional da despesa com veículo específico da frota.
  3. **Metas de Investimento e Reservas (Planejamento Patrimonial e de Frota)**:
     - Planejamento estratégico de médio e longo prazo (Reserva de Emergência, Troca Programada de Frota exigida pelo DETRAN, Cursos de Especialização, Simuladores e Infraestrutura).
     - **Criação de Objetivos**: Definição de título, categoria, meta total (R$), aporte mensal sugerido (R$) e data prevista de conclusão.
     - **Edição em Tempo Real**: Botão de lápis em cada card abrindo modal completo para ajuste de título, categoria, valor da meta, aporte mensal e conciliação do valor já acumulado com o saldo real em banco.
     - **Exclusão Rastreada**: Botão de lixeira com confirmação para arquivar objetivos descontinuados, gerando registro auditado em `auditLogs`.
     - **Aporte Rápido do Mês**: Botão "+ Aporte do Mês" para integralizar cotas mensais diretamente ao saldo acumulado em 1 clique.
     - **Barra de Progresso Dinâmica**: Percentual visual comparando o valor acumulado em caixa com o teto estabelecido.
     - **Banner Integrado com Saúde Financeira**: Acesso direto ao módulo de diagnóstico, regras do Detran e simulador de custos de aula.
  4. **Demonstrativo do Resultado do Exercício (DRE)**:
     - Relatório gerencial consolidando Receita Bruta, Taxas de Intermediação/Cartão, Receita Líquida, Despesas Operacionais e Lucro Líquido do Exercício.
  5. **IRPF / Carnê-Leão (Livro-Caixa do Instrutor Autônomo)**:
     - **Ano-Calendário Selecionável** (2026, 2025, 2024).
     - **Resumo Fiscal Global**: Receita Bruta Anual (PF), Despesas Livro-Caixa Dedutíveis, Rendimento Líquido Tributável (Base Carnê-Leão) e Investimentos Acumulados.
     - **Apuração Mensal do Carnê-Leão**: Tabela de 12 meses (Janeiro a Dezembro) contendo Receita Bruta, Livro-Caixa, Líquido Tributável e quantidade de alunos pagantes no mês.
     - **Discriminação Individual por Aluno (Fontes Pagadoras PF com CPF)**: Tabela completa exigida pela Receita Federal, listando cada aluno pagador, CPF obrigatório, telefone, valor total anual pago, formas de pagamento e total de recibos gerados.
     - **Despesas Dedutíveis do Livro-Caixa**: Consolidação por categoria operacional (Combustível, Manutenção do Veículo de Instrução, Seguro e Taxas Detran/CFC).
     - **Investimentos e Reserva de Manutenção**: Aportes patrimoniais para expansão da atividade.
     - **Exportação Multiformato**:
       - Botão **"Baixar Relatório Fiscal PDF"**: Gera PDF oficial completo com cabeçalho contábil, tabelas e rodapés de declaração.
       - Botão **"CSV p/ Contador"**: Exporta arquivo `.csv` formatado pronto para importação direta no software do escritório de contabilidade ou preenchimento do Carnê-Leão Web.

### TELA 13B: Saúde Financeira & Blindagem Estratégica (`FinancialHealthView.tsx`)
- **Finalidade**: Educação financeira aplicada e gestão de risco para que o instrutor de trânsito e o CFC trabalhem com estabilidade, previnam a obsolescência da frota pelo DETRAN, monitorem sua margem unitária por aula e alcancem independência sem sobressaltos.
- **Recursos e Módulos Integrados**:
  1. **Score de Saúde Financeira (0 a 100) & Termômetro Dinâmico**:
     - Avalia em tempo real a cobertura da reserva de emergência (meses de custos fixos cobertos), taxa de inadimplência, idade da frota e margem operacional.
     - Classificação visual: *Crítico*, *Atenção*, *Bom (Estável)* e *Excelente (Negócio Blindado)*.
  2. **Os 4 Pilares da Blindagem do Instrutor de Trânsito**:
     - **Pilar 1: A Regra dos 4 Potes**: Metodologia de repartição de cada pagamento recebido (40% Pró-labore livre do instrutor, 25% Despesas operacionais imediatas, 20% Depreciação e fundo de troca do veículo, 15% Reserva de emergência e Carnê-Leão). Inclui simulador de pacotes em tempo real.
     - **Pilar 2: A Armadilha da Frota Vencida no DETRAN**: Alerta sobre o limite de 8 anos para automóveis (Cat B) e 5 anos para motocicletas (Cat A), acrescido da provisão obrigatória do kit de pedais de duplo comando e laudo do INMETRO (CSV).
     - **Pilar 3: Manutenção Preventiva vs. Quebra no Exame**: Análise de perdas por quebra de embreagem ou suspensão com alunos e cálculo do prejuízo de dias parados.
     - **Pilar 4: Blindagem Fiscal e Carnê-Leão**: Como emitir recibos com CPF do aluno, deduzir custos de combustível no Livro-Caixa e evitar multas da Receita Federal.
  3. **Calculadora Interativa de Custo Real da Aula Prática (50 min)**:
     - Permite parametrizar preço do combustível, consumo urbano (km/l), km médio por aula (12 a 16 km), custos fixos de seguro/IPVA e média de aulas/mês.
     - Apura instantaneamente: Custo de combustível por aula, rateio fixo, desgaste de pneus/óleo, Custo Total por Aula, Lucro Líquido por Aula e Margem Percentual Real.
  4. **Checklist Interativo de Ação Anti-Aperto**:
     - 5 tarefas essenciais do mês com persistência no armazenamento local e links diretos para telas de ação (Recebíveis, Despesas, Metas, Frota e WhatsApp).

### TELA 14: Central de Cobranças e Lembretes por WhatsApp (`WhatsAppRemindersView.tsx`)
- **Finalidade**: Comunicação automatizada e redução de inadimplência e faltas em aulas práticas.
- **Recursos Principais**:
  - Modelos profissionais de mensagens prontos para disparo:
    - *Lembrete de Aula Prática*: Informa dia, horário e local de encontro da aula com recomendação de calçado adequado e documento de identidade;
    - *Aviso de Vencimento de Parcela*: Mensagem cordial alertando que a parcela vencerá em breve;
    - *Cobrança de Parcela Vencida com PIX*: Mensagem informativa com valor do débito e chave PIX Copia e Cola para quitação imediata;
    - *Confirmação de Matrícula*: Boas-vindas ao candidato com detalhes do plano contratado;
    - *Parabéns pela Aprovação*: Mensagem comemorativa após o aluno ser aprovado no exame prático do DETRAN.
  - Disparo nativo sem intermediários pagos através de deep link padrão da API do WhatsApp (`https://wa.me/55[telefone]?text=[mensagem]`).
  - Histórico de lembretes enviados registrado em `WhatsAppReminderLog`.

### TELA 15: Central de Relatórios Oficiais e Impressão (`ReportsView.tsx`)
- **Finalidade**: Geração de documentos formais para arquivamento no CFC e apresentação a órgãos de trânsito.
- **Recursos Principais**:
  - **Ficha Cadastral e Pedagógica Completa do Aluno**:
    - Layout oficial adaptado ao formato de folha A4 com regras CSS de impressão (`@media print` e `-webkit-print-color-adjust: exact`).
    - Dados do candidato (com proteção LGPD do CPF).
    - Dados do instrutor credenciado e identificação da autoescola.
    - Pacote de aulas contratado e formas de pagamento.
    - Tabela completa de aulas práticas realizadas com data, horários, veículo e notas.
    - Histórico formal de eventuais transferências de instrutores com motivo.
    - Campo oficial de assinaturas físicas/digitais do Instrutor e do Aluno para homologação no DETRAN.
  - **Relatório de Desempenho Financeiro e DRE**: Exportação do fechamento mensal para fins contábeis.
  - **Relatório de Frequência de Aulas**: Resumo de assiduidade e percentual de aproveitamento.
  - **Visualizador de Auditoria LGPD (`AuditLogViewer.tsx`)**: Tabela cronológica com busca e paginação de todas as transações, contendo: Data/Hora, Usuário Autor, Ação Executada, Entidade Afetada e IP/Fingerprint de origem.

### TELA 16: Portal do Aluno (`StudentPortal.tsx`)
- **Finalidade**: Espaço exclusivo e restrito do candidato autenticado.
- **Recursos Principais**:
  - **Identificação do Instrutor Responsável**: Exibe foto, nome, credencial e botão para contato direto por WhatsApp ou telefone.
  - **Progresso Pedagógico**: Barra percentual de evolução demonstrando quantas aulas foram executadas versus a carga horária total contratada (Ex: "14 de 20 aulas concluídas - 70%").
  - **Agenda de Próximas Aulas**: Lista das aulas confirmadas com data, horário e ponto de encontro.
  - **Extrato Financeiro e Pagamento PIX**:
    - Relação de parcelas pagas e parcelas pendentes.
    - Botão que gera instantaneamente a chave PIX Copia e Cola para pagamento sem precisar solicitar ao instrutor.
  - **Quadro de Habilidades Prontas para Exame**: Acompanhamento das notas atribuídas pelo instrutor nos fundamentos de baliza, controle de embreagem, conversões, rodovia e simulação de exame prático.

### TELA 17: Cabeçalho do Sistema e Barra de Navegação Mobile (`Header.tsx`)
- **Finalidade**: Navegação principal, alternância de perfis e indicador de conectividade.
- **Recursos Principais**:
  - Exibição da logomarca oficial e nome da organização ou CFC ativo.
  - **Indicador de Sincronização Online / Offline**: Exibe badge pulsante verde quando conectado e amarelo com contador de fila de sincronização pendente quando em modo desconectado.
  - **Botão Exclusivo do Dossiê & Agentes de Segurança**: Renderizado estritamente para o Administrador Master (`cassiordcosta@gmail.com`).
  - Menu do usuário com exibição do nome, papel e botão de logout seguro.
  - **Barra de Navegação Inferior Mobile**: Menu tátil fixado na base da tela com alvos de toque maiores que 44x44px (padrão WCAG AA), garantindo que o instrutor ou administrador navegue com facilidade pelo celular enquanto está em campo.

### TELA 18: Conector & Migrador Supabase / PostgreSQL (`SupabaseMigrationModal.tsx`)
- **Finalidade**: Integração com banco de dados relacional externo (Supabase / PostgreSQL), geração de DDL SQL, teste de conectividade e sincronização de dados via API REST ou Dump SQL.
- **Recursos Principais**:
  - **Aba 1: Credenciais Supabase**: Configuração e teste ativo da `Project URL` e `API Key` (anon ou service_role) com diagnóstico de rede em tempo real.
  - **Aba 2: Esquema Relacional SQL (DDL Completo)**: Geração do script oficial com 12 tabelas relacionais (`organizations`, `users`, `students`, `vehicles`, `lessons`, `accounts_receivable`, `payment_records`, `expenses`, `investments`, `package_offers`, `audit_logs`), chaves primárias, chaves estrangeiras com regras de cascata (`ON DELETE CASCADE` e `ON DELETE RESTRICT`), validações de maioridade (`idade >= 18`) e índices de busca. Inclui botões para copiar com 1 clique e baixar o arquivo `.sql`.
  - **Aba 3: Cópia e Sincronização**: Transmissão direta em lotes para a API PostgREST do Supabase com barra de progresso visual percentual, ou exportação completa de comandos transacionais `INSERT INTO` (Dump SQL).

---

## 4. TODOS OS TIPOS DE CADASTROS DO SISTEMA

Abaixo está o detalhamento técnico de todas as entidades de cadastro manipuladas pelo sistema:

### 4.1 Cadastro de Organizações (CFCs / Autoescolas ou Instrutores Autônomos)
- **Atributos**: ID único, Razão Social / Nome Fantasia, Tipo (`INSTRUTOR_AUTONOMO` ou `AUTOESCOLA_CFC`), CNPJ/CPF, Telefone, E-mail oficial, Cidade, Estado (UF), Status (`ATIVO`, `BLOQUEADO`, `TESTE`), Plano contratado (`BASICO`, `PRO`, `ENTERPRISE`), Data de criação.

### 4.2 Cadastro de Usuários (Contas de Acesso)
- **Atributos**: ID único, Vínculo de Organização (`organizacaoId`), Nome Completo, E-mail (chave de login), Papel de Acesso (`SUPER_ADMIN`, `ADMIN_ORG`, `INSTRUTOR`, `ALUNO`), Telefone celular, Últimos 4 dígitos do CPF (`cpfUltimos4`), Hash do CPF (`cpfFingerprint`), CPF Mascarado (`cpfMascarado`), CPF Completo protegido para recuperação (`cpfCompleto`), Status do 2FA (`twoFactorAtivo`), Chave Secreta 2FA (`twoFactorSecret`), Data do último acesso e URL do Avatar.

### 4.3 Cadastro de Alunos (Candidatos à Habilitação)
- **Atributos**: ID único, Vínculo de Organização (`organizacaoId`), Vínculo de Instrutor Responsável (`instrutorId` - **obrigatório**), Nome Completo, E-mail, Telefone/WhatsApp, CPF Mascarado com padrão LGPD, Hash do CPF, Data de Nascimento, Idade apurada (mínimo legal de 18 anos), Categoria de CNH pretendida (A, B, AB, C, D, E), Status Cadastral (`EM_ANDAMENTO`, `CONCLUIDO`, `CANCELADO`), Aulas Práticas Cumpridas, Carga Horária Total Contratada, Objeto de Habilidades Pedagógicas (`StudentSkills`), Observações Técnicas do Instrutor, Data de Matrícula, ID do Pacote Contratado, Nome do Pacote e Array de Histórico de Transferências.

### 4.4 Cadastro de Pacotes de Aulas e Planos
- **Atributos**: ID único, Vínculo de Organização, Vínculo de Instrutor (`instrutorId`), Nome Comercial do Pacote, Carga Horária em Aulas (padrão 20 ou avulso), Categoria de CNH, Valor Total em Centavos (`valorCentavos`), Forma de Pagamento Permitida (`A_VISTA`, `PARCELADO_CARTAO`, `NEGOCIADO`, `TODAS`), Máximo de Parcelas no Cartão, Percentual de Desconto para Pagamento à Vista, Descrição Comercial detalhada, Status de Ativação (`ativo: boolean`) e Data de Criação.

### 4.5 Cadastro de Veículos e Frota
- **Atributos**: ID único, Vínculo de Organização, Modelo e Marca do Veículo, Placa Oficial Mercosul, Ano de Fabricação, Tipo de Veículo (`CARRO`, `MOTO`, `CAMINHAO`, `ONIBUS`), Status Operacional (`DISPONIVEL`, `EM_AULA`, `MANUTENCAO`), Quilometragem Atual (`kmAtual`), Quilometragem da Próxima Revisão Obrigatória (`proximaRevisaoKm`).

### 4.6 Cadastro de Aulas Práticas (Agenda de Instrução)
- **Atributos**: ID único, Vínculo de Organização, Aluno Selecionado (`alunoId`), Instrutor Ministrante (`instrutorId`), Veículo Utilizado (`veiculoId`), Data da Aula (`YYYY-MM-DD`), Horário de Início (`HH:mm`), Horário de Término (`HH:mm`), Tópico Pedagógico da Aula, Status da Sessão (`AGENDADA`, `EM_ANDAMENTO`, `CONCLUIDA`, `CANCELADA`, `FALTA`), Observações do Instrutor, Nota da Sessão (1 a 10), Lista de Competências Trabalhadas e Timestamp de Criação.

### 4.7 Cadastro de Contas a Receber (Receitas / Cobranças)
- **Atributos**: ID único, Vínculo de Organização, Aluno Pagador (`alunoId`), Pacote Vinculado (`pacoteId`), Descrição da Cobrança, Valor Total em Centavos (`valorTotalCentavos`), Valor Efetivamente Pago em Centavos (`valorPagoCentavos`), Saldo Devedor em Centavos (`saldoDevedorCentavos`), Data de Vencimento, Status de Liquidação (`PENDENTE`, `PARCIAL`, `PAGO`, `VENCIDO`, `CANCELADO`), Código PIX Copia e Cola (`pixPayload`), URL do QR Code PIX, Total de Parcelas e Data de Emissão.

### 4.8 Cadastro de Registros de Pagamento (Baixas de Títulos)
- **Atributos**: ID único, Vínculo de Organização, Referência da Conta a Receber (`contaReceberId`), Aluno (`alunoId`), Valor Pago em Centavos (`valorCentavos`), Método de Pagamento (`PIX`, `CARTAO_CREDITO`, `DINHEIRO`, `TRANSFERENCIA`), Número de Parcelas, Taxa de Intermediação em Centavos, Data e Hora do Pagamento, Número do Comprovante Bancário e Observações.

### 4.9 Cadastro de Despesas Operacionais (Contas a Pagar)
- **Atributos**: ID único, Vínculo de Organização, Descrição do Gasto, Categoria da Despesa (`COMBUSTIVEL`, `MANUTENCAO_VEICULO`, `SEGURO`, `TAXAS_DETRAN`, `ALIMENTACAO`, `MARKETING`, `SISTEMAS_TELEFONIA`, `OUTROS`), Veículo Relacionado (opcional), Valor em Centavos (`valorCentavos`), Data de Vencimento, Data de Pagamento Efetivo, Status (`PENDENTE` ou `PAGA`) e URL/Arquivo do Comprovante.

### 4.10 Cadastro de Metas Financeiras e Investimentos
- **Atributos**: ID único, Vínculo de Organização, Título da Meta, Categoria (`RESERVA_EMERGENCIA`, `FROTA_NOVO_VEICULO`, `CURSOS_ESPECIALIZACAO`, `EQUIPAMENTOS_SIMULADORES`, `INFRAESTRUTURA`), Valor Meta em Centavos, Valor já Acumulado em Centavos, Aporte Mensal Programado em Centavos, Data de Início, Data Prevista para Atingimento da Meta e Anotações Estratégicas.

### 4.11 Cadastro de Histórico Perpétuo de Transferências
- **Atributos**: ID único, Vínculo de Organização, Identificação do Aluno (ID, Nome, CPF Mascarado), Identificação do Instrutor Anterior (ID e Nome), Identificação do Novo Instrutor (ID e Nome), Motivo Formal Detalhado da Mudança, Quantidade de Aulas Práticas Cumpridas até a data da transferência, Data e Hora da Transferência e Identificação do Autor da Operação (ID e Nome).

### 4.12 Cadastro de Logs de Auditoria LGPD (`AuditLog`)
- **Atributos**: ID único, Vínculo de Organização, ID e Nome do Usuário Responsável, Ação Executada (Ex: `CRIAR_ALUNO`, `TRANSFERIR_ALUNO`, `RECEBER_PAGAMENTO`, `ALTERAR_SENHA`), Entidade Afetada, ID do Objeto, Detalhes Textuais da Alteração, Endereço IP / Fingerprint da Conexão e Timestamp Imutável ISO 8601.

---

## 5. REGRAS DE NEGÓCIO E POLÍTICAS DE INTEGRIDADE

1. **Regra Impeditiva: 1 Aluno (CPF) = 1 Instrutor**:
   - Cada CPF de aluno só pode estar vinculado a **um único instrutor** de cada vez.
   - Qualquer tentativa de cadastrar um CPF já existente gera bloqueio imediato com aviso claro de alocação prévia.
2. **Proibição de Alunos Avulsos sem Instrutor**:
   - A plataforma impede o auto-cadastro solto. Todo aluno obrigatoriamente se registra por meio da indicação e vínculo com um instrutor credenciado.
3. **Preservação Perpétua de Histórico de Ensino**:
   - Transferências de alunos entre instrutores **nunca apagam aulas realizadas, notas ou histórico**. O novo instrutor assume a continuidade pedagógica exatamente de onde o aluno parou.
4. **Precisão Centesimal Financeira**:
   - Todos os valores monetários são calculados em centavos inteiros (`number` inteiro) para eliminar imprecisões de arredondamento inerentes a números de ponto flutuante (*floating point issues*).
5. **Horários Noturnos das 06:00 às 00:00**:
   - A agenda atende aos parâmetros legais das aulas práticas noturnas estipuladas pelo art. 158 do CTB.
6. **Privacidade e LGPD**:
   - O CPF do aluno é exibido de forma mascarada nas listagens e relatórios (`***.***.123-45`), prevenindo vazamento de dados sensíveis em conformidade com a Lei 13.709/2018.

---

## 6. GESTÃO DO FINANCEIRO EM DETALHES

O módulo financeiro do sistema foi estruturado para fornecer autonomia contábil tanto para o instrutor autônomo quanto para a direção do CFC:

1. **Contas a Receber e Carnê de Parcelas**:
   - Na contratação de um pacote, o sistema divide automaticamente o valor acordado no número de parcelas escolhido, gerando o cronograma de vencimentos.
   - Cada parcela pode ser baixada individualmente mediante comprovação de recebimento.
2. **Tecnologia de Cobrança PIX Integrada**:
   - Gera dinamicamente a string EMV padrão do Banco Central com chave PIX, identificador da transação e valor em centavos.
   - Fornece botão de cópia instantânea ("PIX Copia e Cola") e renderiza imagem de QR Code escaneável por qualquer aplicativo bancário.
3. **Plano de Contas para Despesas Operacionais**:
   - Permite ao instrutor lançar todos os custos inerentes à sua profissão (combustível diário, revisões periódicas de suspensão e freios, seguro veicular com cobertura para terceiros e aprendizes, taxas sindicais e do DETRAN).
4. **Metas de Reserva e Expansão**:
   - Ferramenta de educação financeira que incentiva a criação de colchão de liquidez para imprevistos (ex: quebra de veículo de trabalho) e programação de troca de veículo a cada 3 ou 5 anos.
5. **DRE Automatizado**:
   - Consolida receitas e despesas no período selecionado, informando com precisão contábil o **Lucro Líquido Real**, permitindo ao instrutor saber exatamente quanto sobrou no mês.

---

## 7. GESTÃO DE PLANOS E PACOTES DE AULAS

1. **Autonomia de Criação por Instrutor**:
   - O instrutor não depende de tabelas pré-fixadas; ele tem autonomia comercial para criar planos ajustados ao mercado local da sua cidade.
2. **Configuração Comercial Flexível**:
   - Carga horária ajustável (ex: pacote de 20 aulas para 1ª habilitação, pacote de 10 aulas para adição de categoria, pacote de 5 aulas para aperfeiçoamento de baliza).
   - Definição de regras de desconto: incentivo a pagamentos à vista via PIX (ex: 5% a 10% de desconto) ou parcelamento facilitado em até 12x no cartão.
3. **Vínculo Automático com a Matrícula**:
   - Ao se matricular pelo link do instrutor, o aluno seleciona o pacote desejado; o sistema já configura a quantidade de aulas contratadas no cadastro pedagógico e lança a cobrança no financeiro.

---

## 8. CATÁLOGO COMPLETO DE RELATÓRIOS DO SISTEMA

1. **Ficha Oficial do Aluno para Impressão / PDF (A4)**:
   - Documento padrão para comprovação pedagógica perante a fiscalização do DETRAN e arquivo do CFC.
   - Inclui cabeçalho do CFC, dados protegidos do aluno, carga horária cumprida, notas por habilidade, histórico de transferências e campos para assinaturas formais.
2. **Relatório Gerencial Financeiro e DRE**:
   - Extrato consolidado de faturamento, recebimentos efetivados, valores a vencer e despesas categorizadas com cálculo de margem líquida.
3. **Relatório de Aulas e Frequência**:
   - Listagem cronológica de todas as sessões práticas ministradas, veículos empregados, quilometragem percorrida e faltas registradas.
4. **Relatório de Integridade de Cadastros (Master)**:
   - Relatório técnico do Administrador Master contendo o diagnóstico de consistência da base de dados, lista de todos os instrutores e faturamento da rede.
5. **Livro de Auditoria e Conformidade LGPD**:
   - Registro cronológico imutável com filtros avançados para auditorias forenses e investigações de acessos indevidos.
6. **Recibo Digital de Pagamento de Aulas Práticas (PDF e WhatsApp)**:
   - Documento emitido em PDF direto pelo sistema como comprovante digital de pagamento (Via do Aluno), sem picote ou duplicidade, pronto para envio direto via WhatsApp ou e-mail.
   - Contém número sequencial, valor numérico e valor por extenso em reais (`numberToWordsBRL`), identificação do aluno com CPF, identificação do instrutor, serviço prestado, modalidade (parcela, período ou quitação integral) e código criptográfico de autenticação digital (`AUT-XXXXXX`).
   - Botão integrado de disparo no WhatsApp com mensagem formatada e autenticação.
7. **Relatório Fiscal Anual para IRPF e Carnê-Leão (Livro-Caixa de Autônomo)**:
   - Relatório gerado em PDF e CSV estruturado para atender estritamente às exigências da Receita Federal do Brasil para profissionais autônomos que operam pelo Carnê-Leão Web.
   - Apuração mensal dos 12 meses do ano-calendário: Receita Bruta Não-Assalariada de Pessoas Físicas, Deduções do Livro-Caixa e Rendimento Tributável Líquido.
   - **Discriminação Individual por Aluno com CPF**: Listagem obrigatória contendo Nome, CPF do pagador, total pago no ano e formas de pagamento.
   - Despesas operacionais do Livro-Caixa agrupadas por categoria (combustível, manutenção veicular, taxas do Detran e seguro) e aportes em planos de investimento.
8. **Planilha CSV Formatada para Escritório de Contabilidade**:
   - Arquivo `.csv` gerado com 1 clique para importação direta em softwares fiscais e contábeis de contadores parceiros.
9. **Relatório Geral de Pagamentos por Período**:
   - Visualização consolidada acessada na gestão de alunos, permitindo filtrar recebimentos por Mês Atual, Mês Anterior, Ano Corrente ou Histórico Total, com cálculo dinâmico de ticket médio e atalho para emitir recibos individuais.

---

## 9. AMBIENTE DO ADMINISTRADOR MASTER, GESTÃO DE CFCS E PLANOS SAAS

O Administrador Master possui o controle supremo e irrestrito sobre todo o ecossistema da plataforma:
- **E-mail Soberano Designado**: `cassiordcosta@gmail.com`
- **Gestão Centralizada de Instituições e CFCs**:
  - Consulta detalhada da ficha cadastral de cada autoescola/instrutor, incluindo seus instrutores vinculados, alunos ativos e métricas financeiras.
  - Edição completa de dados, alteração de plano contratado, prorrogação de vigência e valor da mensalidade.
  - **Controle Granular de Módulos (Menu Override)**: O Master pode ligar ou desligar individualmente qualquer um dos 16 módulos do sistema para uma organização específica através de caixas de seleção (*checkboxes*).
  - **Geração e Envio de Chaves de Acesso**: Geração de chaves criptográficas exclusivas (`KEY-CFC-XXXXXX` / `KEY-INST-XXXXXX`) e encaminhamento instantâneo com mensagem formatada para WhatsApp ou E-mail.
  - **Aprovação Obrigatória de Novos Cadastros**: Nenhum novo usuário entra na plataforma sem a liberação explícita do Master. Solicitações de auto-cadastro entram como `PENDENTE_APROVACAO` e aguardam autorização e concessão de chave.
  - **Reset de Senha de Usuários pelo Master**: O Administrador Master pode gerar uma nova senha temporária para qualquer instrutor ou gestor da organização com 1 clique.
  - **Bloqueio e Desbloqueio**: Suspensão manual ou por inadimplência com motivo registrado.
  - **Exclusão de Organizações**: Remoção segura de tenants com preservação de integridade.

### 9.1 Matriz Oficial dos 3 Planos SaaS + Plano DEMO

| Recurso / Módulo | DEMO (Degustação) | BÁSICO (Operacional) | AVANÇADO (Profissional) | MASTER (CFC Enterprise) |
| :--- | :---: | :---: | :---: | :---: |
| **Público Recomendado** | Visitante avaliando | Instrutor autônomo | Instrutores experientes | Autoescolas e CFCs |
| **Preço Sugerido** | **Grátis (7 dias)** | **R$ 69,90 / mês** | **R$ 139,90 / mês** | **R$ 249,90 / mês** |
| **Limite de Alunos Ativos** | Até 3 alunos | Até 25 alunos | Até 100 alunos | **Ilimitado** |
| **Limite de Instrutores** | 1 instrutor | 1 instrutor | Até 3 instrutores | **Ilimitado** |
| **Painel Geral & Métricas** | Sim | Sim | Sim | Sim |
| **Alunos & Matriz CONTRAN** | Sim | Sim | Sim | Sim |
| **Agenda Prática (06h às 00h)** | Sim | Sim | Sim | Sim |
| **Contas a Receber & PIX** | Não | Sim | Sim | Sim |
| **Catálogo de Pacotes/Planos** | Não | Sim | Sim | Sim |
| **Despesas do Veículo/Oficina** | Não | Não | Sim | Sim |
| **Metas de Investimento & Frota**| Não | Não | Sim | Sim |
| **DRE - Demonstrativo Gerencial**| Não | Não | Sim | Sim |
| **Recibo Digital Oficial Aluno** | Não | Não | Sim | Sim |
| **Cobrança/Lembretes WhatsApp**| Não | Não | Sim | Sim |
| **Relatórios e Ficha A4 PDF** | Não | Não | Sim | Sim |
| **Saúde Financeira & DETRAN** | Não | Não | Não | **Sim** |
| **IRPF / Carnê-Leão (PDF/CSV)** | Não | Não | Não | **Sim** |
| **Gestão de Frota Veicular** | Não | Não | Não | **Sim** |
| **Múltiplos Instrutores CFC** | Não | Não | Não | **Sim** |
| **Auditoria LGPD Perpétua** | Não | Não | Não | **Sim** |

### 9.2 Ferramenta de Varredura de Integridade (`verifyCadastrosIntegrity`)
- Algoritmo que executa validação cruzada entre Alunos, Instrutores, Organizações, Aulas e Pagamentos.
- Verifica:
  - Se existem alunos sem instrutor atribuído ou vinculados a instrutor inexistente;
  - Se há aulas práticas sem instrutor ou aluno associado;
  - Se há contas a receber sem titular correspondente;
  - Se existem CPFs duplicados na base;
  - Se existem agendamentos com sobreposição de horários para o mesmo instrutor ou veículo.
- **Ação Corretiva Imediata**: Em caso de descredenciamento ou substituição de instrutor, o Administrador Master utiliza o modal de **Reatribuição de Alunos** para transferir a carteira de alunos com 1 clique, sem perdas pedagógicas.
- **Acesso ao Dossiê**: O botão do Dossiê Técnico é restrito exclusivamente ao Master, garantindo sigilo das regras de segurança e agentes de governança.



### 9.3 Ferramenta de Limpeza Segura para Produção (Modo Go-Live)
- **Finalidade**: Preparar a base de dados para a entrada em produção real com clientes e alunos verdadeiros.
- **Segurança e Preservação Absoluta**:
  - Remove com segurança todos os registros de teste e demonstração (alunos fictícios Pedro e Mariana, histórico simulado de aulas, contas a receber de teste e despesas fictícias).
  - **Preserva 100% intacta a conta do Administrador Master (`cassiordcosta@gmail.com`)** com permissão soberana `SUPER_ADMIN`.
  - **Preserva a Organização Principal** vinculada com o plano `MASTER` e chave mestra.
  - Registra o evento de inicialização `SISTEMA_GOLIVE_LIMPEZA` no livro de auditoria forense.
- **Localização**: Console Master → Aba "Manutenção & Banco Demo" → Botão "Limpar e Iniciar Produção".

### 9.4 Módulo de Integração, Migração e Esquema Relacional Supabase (PostgreSQL)
- **Finalidade**: Permitir ao Administrador Master conectar a plataforma a um banco relacional externo PostgreSQL gerenciado no Supabase.
- **Recursos Principais**:
  - **Gerador de DDL Oficial com Integridade Relacional**:
    - Script SQL pronto para execução no SQL Editor do Supabase criando 12 tabelas relacionais (`organizations`, `users`, `students`, `vehicles`, `lessons`, `accounts_receivable`, `payment_records`, `expenses`, `investments`, `package_offers`, `audit_logs`).
    - Chaves estrangeiras com regras de cascata (`ON DELETE CASCADE` para isolamento por organização e `ON DELETE RESTRICT` para vínculos de instrutores).
    - Regras de integridade rígidas: restrição de idade legal do Código de Trânsito Brasileiro (`idade >= 18`), integridade financeira em centavos inteiros (eliminando erros de arredondamento) e notas de 1 a 10.
    - Criação automática de índices de alta performance para queries por aluno, instrutor, data e organização.
  - **Conector Nativo via API REST PostgREST**:
    - Teste de conectividade com a URL do projeto (`https://xxx.supabase.co`) e chave de API (`anon` ou `service_role`).
    - Sincronização e cópia em lotes com tratamento de erro e barra de progresso visual percentual.
  - **Gerador de Dump SQL Transacional**:
    - Exportação de script `.sql` completo com comandos `INSERT INTO ... ON CONFLICT DO NOTHING`, envolvidos em transação (`BEGIN / COMMIT`) para carga instantânea via terminal ou SQL Editor.
- **Localização**: Console Master → Botão "Supabase / PostgreSQL [SQL]" no menu de navegação ou aba "Manutenção & Banco Demo".

### 9.5 Fluxo Ágil de Aprovação de Cadastros e Gestão de Chaves de Acesso (Tokens)
- **Controle de Entrada (Zero-Trust)**: Nenhum novo usuário opera no sistema sem que o Administrador Master aprove sua solicitação. Cadastros de novos CFCs e instrutores entram com status `PENDENTE_APROVACAO`.
- **Card de Alerta e Aprovação com 1 Clique**:
  - Destaque no topo da aba "Instituições & CFCs" com o número de solicitações pendentes e botão "Aprovar & Gerar Chave".
  - Botão de aprovação direta na linha da tabela de instituições.
  - Ao aprovar, o status é alterado para `ATIVO` e uma chave de acesso segura é emitida imediatamente (`KEY-CFC-XXXXXX` / `KEY-INST-XXXXXX`).
- **Encaminhamento Multicanal**:
  - Modal com visualização da chave, botão de cópia e botões de disparo direto:
    - **WhatsApp**: Abre a conversa com mensagem cordial pré-formatada contendo nome da instituição, plano liberado, chave de acesso e link direto de login.
    - **E-mail**: Disparo com assunto e corpo configurados para envio formal.
  - Botão de regeneração para revogar e emitir nova chave em caso de perda ou suspeita de vazamento.

---

## 10. ARQUITETURA DE SEGURANÇA, AGENTES E BANCO DE DADOS

### 10.1 Agente de Monitoramento em Tempo Real (Watchdog Agent)
- Observa ativamente em background todas as transações, requisições e mutações de dados.
- Mede em tempo real a latência do sistema, saúde das entidades e integridade do storage.
- Classifica eventos por criticidade (`INFO`, `SECURE`, `WARNING`, `CRITICAL`).

### 10.2 Agente de Proteção e Travamento de Código (Code Guard Agent)
- Bloqueia modificações estruturais destrutivas acidentais geradas por automações ou terceiros sem autorização explícita do administrador.
- Mantém **Snapshots de Restauração** que permitem reverter o banco e esquemas para um ponto anterior com segurança instantânea.

### 10.3 Arquitetura de Dados Híbrida: Offline-First + Cloud Firestore
- **Operação Offline-First**: O instrutor pode ministrar aulas e registrar presenças em locais com sinal de internet fraco ou inexistente; os dados são persistidos localmente de forma segura.
- **Sincronização com Cloud Firestore**: Assim que a conexão é restabelecida, a fila de eventos (`SyncQueueItem`) sincroniza as operações com a nuvem do Firebase, garantindo backup perpétuo e integridade remota.
- **Regras de Segurança Estritas (`firestore.rules`)**:
  - Restrição de leitura e escrita baseada na autenticação (`request.auth != null`).
  - Cada instrutor só altera registros da sua organização e dos seus respectivos alunos.
  - O Administrador Master possui permissão de leitura e auditoria global.

---

## 11. RESPONSIVIDADE MOBILE E DESIGN SYSTEM

- **Diretriz Touch Target (WCAG 2.1 AA)**: Todos os botões, links de menus e alvos de toque possuem área mínima de **44 x 44 pixels**, evitando toques acidentais em smartphones.
- **Arquitetura Bottom-Sheet**: Todos os modais em telas móveis abrem suavemente a partir da borda inferior da tela, facilitando a operação com uma só mão pelo instrutor durante as aulas.
- **Proteção Contra Vazamento e Cortes de Texto**:
  - Grids flexíveis (`grid-cols-1 sm:grid-cols-2`);
  - Tabelas com rolagem horizontal suave e cabeçalhos fixos;
  - Cards informativos com quebra de linha inteligente (`break-words` e `text-ellipsis`), eliminando qualquer corte em telas pequenas de 320px a 375px.

---

## 12. ARQUITETURA DE BANCO DE DADOS, ENTIDADES, CAMPOS E RELACIONAMENTOS

### 12.1 Visão Geral da Modelagem de Dados
O banco de dados do **Sistema de Gestão de Direção** foi projetado com uma arquitetura híbrida de alta disponibilidade:
1. **Camada Operacional Local (Offline-First)**: Estruturada em memória e persistida via `LocalStorage` / `IndexedDB`, permitindo que instrutores ministrem aulas e computem frequências e notas mesmo sem conexão com a internet.
2. **Camada em Nuvem Persistente (Google Cloud Firestore)**: Banco de dados NoSQL NoOps, distribuído globalmente, com validação de esquema estrita via `firebase-blueprint.json` e regras de segurança granulares em `firestore.rules`.
3. **Padrão de Precisão Monetária em Centavos**: Nenhum valor financeiro é manipulado ou persistido como número de ponto flutuante (*float/double*). Todos os valores monetários utilizam o sufixo `Centavos` e tipo inteiro (ex: R$ 1.850,50 é armazenado como `185050`), prevenindo erros de arredondamento em balancetes e relatórios contábeis.
4. **Camada Criptográfica e LGPD de Documentos**: O CPF de alunos e instrutores é armazenado com 3 representações distintas:
   - `cpfMascarado` (ex: `***.***.892-01`): Para visualização operacional e impressão de relatórios sem expor dados sensíveis;
   - `cpfFingerprint`: Hash SHA-256 criptográfico unívoco, utilizado como índice de busca e trava de segurança anti-duplicidade em todo o sistema;
   - `cpfUltimos4`: Para confirmações ágeis de identidade e 2FA (Autenticação de Dois Fatores).
5. **Isolamento Estrito Multi-Tenancy**: Toda entidade operacional possui a chave de particionamento `organizacaoId`, garantindo que autoescolas e instrutores autônomos nunca tenham acesso cruzado aos dados uns dos outros.

---

### 12.2 Diagrama de Entidade-Relacionamento (DER) e Matriz de Cardinalidades

| Entidade Origem (1) | Cardinalidade | Entidade Destino (N) | Chave Estrangeira (FK) | Regra de Integridade Referencial |
| :--- | :---: | :--- | :--- | :--- |
| `organizations` | **1 : N** | `users` | `users.organizacaoId` | Todo usuário pertence obrigatoriamente a uma organização/CFC ou conta autônoma. |
| `organizations` | **1 : N** | `students` | `students.organizacaoId` | Alunos são vinculados unicamente à organização cadastrada. |
| `organizations` | **1 : N** | `vehicles` | `vehicles.organizacaoId` | Cada veículo de aprendizagem pertence exclusivamente a um CFC ou instrutor autônomo. |
| `organizations` | **1 : N** | `packages` | `packages.organizacaoId` | Catálogo de pacotes e preços configurado por organização. |
| `organizations` | **1 : N** | `expenses` | `expenses.organizacaoId` | Controle financeiro segregado por organização. |
| `organizations` | **1 : N** | `investments` | `investments.organizacaoId` | Metas de capital e reservas financeiras exclusivas do tenant. |
| `users` *(Papel INSTRUTOR)* | **1 : N** | `students` | `students.instrutorId` | **Regra 1 CPF = 1 Instrutor**: Um aluno ativo tem um único instrutor titular responsável. |
| `users` *(Papel INSTRUTOR)* | **1 : N** | `availableSlots` | `availableSlots.instrutorId` | Grade horária configurada pelo próprio instrutor (06:00 às 00:00). |
| `users` *(Papel INSTRUTOR)* | **1 : N** | `lessons` | `lessons.instrutorId` | Aulas práticas ministradas pelo instrutor credenciado. |
| `students` | **1 : N** | `lessons` | `lessons.alunoId` | Diário de bordo de aulas práticas cumpridas e agendadas pelo aluno. |
| `students` | **1 : N** | `accountsReceivable`| `accountsReceivable.alunoId` | Carnê financeiro e títulos de cobrança emitidos em nome do aluno. |
| `students` | **1 : N** | `studentTransfers` | `studentTransfers.alunoId` | Trilha de auditoria histórica de transferências de instrutor. |
| `students` | **1 : N** | `whatsappLogs` | `whatsappLogs.alunoId` | Histórico de cobranças e lembretes enviados via WhatsApp ao aluno. |
| `vehicles` | **1 : N** | `lessons` | `lessons.veiculoId` | Registro do veículo utilizado em cada aula prática para controle de quilometragem. |
| `vehicles` | **1 : N** | `expenses` | `expenses.veiculoId` *(opcional)* | Custo de combustível ou manutenção associado a um veículo específico da frota. |
| `packages` | **1 : N** | `students` | `students.pacoteId` *(opcional)* | Pacote contratado pelo aluno no ato de matrícula. |
| `packages` | **1 : N** | `accountsReceivable`| `accountsReceivable.pacoteId` *(opcional)* | Vínculo comercial da fatura gerada. |
| `accountsReceivable` | **1 : N** | `paymentRecords` | `paymentRecords.contaReceberId` | Registro de quitações parciais ou integrais efetuadas para a conta a receber. |
| `users` | **1 : N** | `auditLogs` | `auditLogs.usuarioId` | Trilha de auditoria forense registrando o autor de cada modificação no sistema. |

---

### 12.3 Dicionário de Dados Completo e Especificação de Entidades

#### 12.3.1 Coleção: `organizations` (Organizações e Centros de Formação de Condutores)
Representa os clientes empresariais ou autônomos que utilizam a plataforma (Tenants).
- **Caminho Firestore**: `/organizations/{orgId}`
- **Chave Primária**: `id` (String UUID)

| Campo | Tipo TypeScript | Tipo Firestore/JSON | Obrigatório | Descrição e Regras |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `string` | `string` | Sim | Identificador exclusivo da organização (UUID v4). |
| `nome` | `string` | `string` | Sim | Razão social ou nome fantasia da autoescola ou instrutor autônomo. |
| `tipo` | `'INSTRUTOR_AUTONOMO' \| 'AUTOESCOLA_CFC'` | `string` | Sim | Categoria da empresa/profissional no ecossistema. |
| `cnpjCpf` | `string` | `string` | Sim | CNPJ formatado (`XX.XXX.XXX/0001-XX`) ou CPF do autônomo. |
| `telefone` | `string` | `string` | Sim | Telefone de contato e atendimento via WhatsApp. |
| `email` | `string` | `string` | Sim | E-mail corporativo principal do tenant. |
| `cidade` | `string` | `string` | Sim | Município de atuação cadastrado junto ao DETRAN. |
| `estado` | `string` | `string` | Sim | Sigla da Unidade Federativa (UF, 2 caracteres). |
| `status` | `'ATIVO' \| 'BLOQUEADO' \| 'PENDENTE_APROVACAO' \| 'VENCIDO' \| 'TESTE'` | `string` | Sim | Situação cadastral da instituição e liberação pelo Master. |
| `plano` | `'DEMO' \| 'BASICO' \| 'AVANCADO' \| 'MASTER'` | `string` | Sim | Plano SaaS contratado com regras e limites de recursos. |
| `dataVencimentoPlano` | `string` | `string` | Não | Data de validade da mensalidade/assinatura (`YYYY-MM-DD`). |
| `valorMensalidadeCentavos` | `number` | `number` | Não | Valor nominal da mensalidade acordada em centavos. |
| `chaveAcesso` | `string` | `string` | Não | Chave de liberação oficial emitida pelo Master (`KEY-CFC-XXXXXX`). |
| `chaveAcessoGeradaEm` | `string` | `string` | Não | Timestamp ISO 8601 da emissão da chave de acesso. |
| `modulosCustomizados` | `string[]` | `array` | Não | Lista personalizada de módulos liberados pelo Master (Menu Override). |
| `criadoEm` | `string` | `string` | Sim | Data e hora de criação no padrão ISO 8601. |

---

#### 12.3.2 Coleção: `users` (Contas de Acesso e Usuários do Sistema)
Armazena todos os perfis autenticáveis do sistema (Administradores Master, Gestores, Instrutores e Alunos).
- **Caminho Firestore**: `/users/{userId}`
- **Chave Primária**: `id` (String UUID / Firebase Auth UID)

| Campo | Tipo TypeScript | Tipo Firestore/JSON | Obrigatório | Descrição e Regras |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `string` | `string` | Sim | Identificador exclusivo do usuário (UID de autenticação). |
| `organizacaoId` | `string` | `string` | Sim | Chave estrangeira para `organizations.id`. |
| `nome` | `string` | `string` | Sim | Nome completo do usuário. |
| `email` | `string` | `string` | Sim | E-mail único de autenticação (suporta Google OAuth e login por senha). |
| `papel` | `UserRole` | `string` | Sim | Enums: `'SUPER_ADMIN'` \| `'ADMIN_ORG'` \| `'INSTRUTOR'` \| `'ALUNO'`. |
| `telefone` | `string` | `string` | Sim | Número de telefone/WhatsApp com DDD. |
| `cpfUltimos4` | `string` | `string` | Sim | Últimos 4 dígitos do CPF para validações rápidas. |
| `cpfFingerprint` | `string` | `string` | Sim | Hash criptográfico SHA-256 do CPF completo para busca sem quebra de sigilo. |
| `cpfMascarado` | `string` | `string` | Não | Representação protegida do documento (ex: `***.***.892-01`). |
| `cpfCompleto` | `string` | `string` | Não | CPF em claro (usado transitoriamente em memória no cadastro inicial). |
| `twoFactorAtivo` | `boolean` | `boolean` | Sim | Flag indicando se a autenticação de 2 fatores está habilitada. |
| `twoFactorSecret` | `string` | `string` | Não | Segredo TOTP criptografado para geração de códigos 2FA. |
| `ultimoAcesso` | `string` | `string` | Não | Timestamp ISO 8601 do último login realizado na plataforma. |
| `avatarUrl` | `string` | `string` | Não | URL da foto de perfil ou gravatar do usuário. |

---

#### 12.3.3 Coleção: `students` (Ficha Cadastral e Pedagógica de Alunos)
Armazena os dados cadastrais, pedagógicos e status de formação dos candidatos à CNH.
- **Caminho Firestore**: `/students/{studentId}`
- **Chave Primária**: `id` (String UUID)

| Campo | Tipo TypeScript | Tipo Firestore/JSON | Obrigatório | Descrição e Regras |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `string` | `string` | Sim | Identificador exclusivo do aluno. |
| `organizacaoId` | `string` | `string` | Sim | Chave estrangeira para `organizations.id`. |
| `instrutorId` | `string` | `string` | Sim | Chave estrangeira para `users.id` (Instrutor titular). |
| `nome` | `string` | `string` | Sim | Nome completo do aluno. |
| `email` | `string` | `string` | Sim | E-mail para contato, envio de relatórios e acesso. |
| `telefone` | `string` | `string` | Sim | WhatsApp do aluno para envio de cobranças e lembretes. |
| `cpfMascarado` | `string` | `string` | Sim | CPF no padrão LGPD (`***.***.892-01`). |
| `cpfFingerprint` | `string` | `string` | Sim | Hash SHA-256 do CPF, garantindo que 1 CPF pertença a apenas 1 instrutor. |
| `dataNascimento` | `string` | `string` | Sim | Data de nascimento no formato `YYYY-MM-DD`. |
| `idade` | `number` | `number` | Sim | Idade calculada (validação de sistema: deve ser >= 18 anos conforme CTB). |
| `categoriaCnh` | `'A'\|'B'\|'AB'\|'C'\|'D'\|'E'` | `string` | Sim | Categoria de habilitação pretendida pelo candidato. |
| `status` | `'EM_ANDAMENTO' \| 'CONCLUIDO' \| 'CANCELADO'` | `string` | Sim | Situação do processo pedagógico de habilitação. |
| `aulasCumpridas` | `number` | `number` | Sim | Quantidade de aulas práticas já concluídas e assinadas. |
| `totalAulasContratadas` | `number` | `number` | Sim | Carga horária total contratada (padrão 20 aulas). |
| `habilidades` | `StudentSkills` | `map / object` | Sim | Objeto aninhado com as 8 notas práticas de trânsito (0 a 10). |
| `observacoesInstrutor` | `string` | `string` | Sim | Diário e observações gerais de evolução pedagógica. |
| `dataCadastro` | `string` | `string` | Sim | Data e hora ISO 8601 da matrícula do aluno. |
| `pacoteId` | `string` | `string` | Não | Chave estrangeira para `packages.id` (Pacote comercial adquirido). |
| `pacoteNome` | `string` | `string` | Não | Nome legível do pacote para relatórios e recibos. |
| `historicoTransferencias` | `StudentTransferHistory[]` | `array` | Não | Lista histórica e imutável de transferências de instrutor. |

---

#### 12.3.4 Objeto Embutido: `StudentSkills` (Matriz de Habilidades Práticas de Direção)
Embutido dentro de cada documento em `students/{studentId}` no campo `habilidades`. Avaliado aula a aula pelo instrutor conforme as diretrizes do CONTRAN.

| Campo | Tipo | Escala | Descrição da Competência Avaliada |
| :--- | :---: | :---: | :--- |
| `baliza` | `number` | `0 a 10` | Alinhamento, noções de espaço, ré e estacionamento em vagas delimitadas. |
| `controleEmbreagem` | `number` | `0 a 10` | Ponto de fricção em rampas, aclives acentuados e arrancadas suaves. |
| `transitoPesado` | `number` | `0 a 10` | Fluidez em tráfego denso, trocas de faixa e leitura dinâmica do trânsito. |
| `conversoesCruzamentos` | `number` | `0 a 10` | Entrada correta em esquinas, conversões à esquerda/direita e rotatórias. |
| `rodoviaVelocidade` | `number` | `0 a 10` | Desenvolvimento de velocidade, uso da 4ª/5ª marchas e ultrapassagens. |
| `sinalizacaoPreferencia` | `number` | `0 a 10` | Respeito rigoroso a placas (PARE/Preferência), faixas e semáforos. |
| `posturaDefensiva` | `number` | `0 a 10` | Distância regulamentar de seguimento, espelhos retrovisores e antecipação. |
| `simuladoExame` | `number` | `0 a 10` | Simulação pontuada segundo a tabela oficial de faltas do DETRAN. |

---

#### 12.3.5 Coleção: `vehicles` (Frota de Veículos de Treinamento)
Controla a frota de automóveis, motocicletas e veículos pesados utilizados nas aulas.
- **Caminho Firestore**: `/vehicles/{vehicleId}`
- **Chave Primária**: `id` (String UUID)

| Campo | Tipo TypeScript | Tipo Firestore/JSON | Obrigatório | Descrição e Regras |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `string` | `string` | Sim | Identificador exclusivo do veículo. |
| `organizacaoId` | `string` | `string` | Sim | Chave estrangeira para `organizations.id`. |
| `modelo` | `string` | `string` | Sim | Marca e modelo (ex: "Volkswagen Gol 1.0", "Honda CG 160 Fan"). |
| `placa` | `string` | `string` | Sim | Placa de identificação oficial no padrão Mercosul ou clássico. |
| `ano` | `number` | `number` | Sim | Ano de fabricação do veículo. |
| `tipo` | `'CARRO' \| 'MOTO' \| 'CAMINHAO' \| 'ONIBUS'` | `string` | Sim | Categoria veicular de acordo com a CNH pretendida. |
| `status` | `'DISPONIVEL' \| 'EM_AULA' \| 'MANUTENCAO'` | `string` | Sim | Disponibilidade operacional para agendamento de aulas. |
| `proximaRevisaoKm` | `number` | `number` | Sim | Quilometragem programada para a próxima troca de óleo e manutenção. |
| `kmAtual` | `number` | `number` | Sim | Hodômetro atual do veículo, atualizado a cada aula ou abastecimento. |

---

#### 12.3.6 Coleção: `lessons` (Aulas Práticas e Diário de Bordo)
Registra todas as sessões de treinamento prático de direção veicular.
- **Caminho Firestore**: `/lessons/{lessonId}`
- **Chave Primária**: `id` (String UUID)

| Campo | Tipo TypeScript | Tipo Firestore/JSON | Obrigatório | Descrição e Regras |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `string` | `string` | Sim | Identificador exclusivo da aula prática. |
| `organizacaoId` | `string` | `string` | Sim | Chave estrangeira para `organizations.id`. |
| `alunoId` | `string` | `string` | Sim | Chave estrangeira para `students.id`. |
| `instrutorId` | `string` | `string` | Sim | Chave estrangeira para `users.id` (Instrutor ministrante). |
| `veiculoId` | `string` | `string` | Sim | Chave estrangeira para `vehicles.id`. |
| `data` | `string` | `string` | Sim | Data da aula no formato `YYYY-MM-DD`. |
| `horaInicio` | `string` | `string` | Sim | Horário de início (`HH:mm`), permitindo janela ampla das 06:00 às 00:00. |
| `horaFim` | `string` | `string` | Sim | Horário de término (`HH:mm`). |
| `topico` | `string` | `string` | Sim | Conteúdo pedagógico abordado (ex: "Baliza em 2 etapas", "Aclive"). |
| `status` | `'AGENDADA' \| 'EM_ANDAMENTO' \| 'CONCLUIDA' \| 'CANCELADA' \| 'FALTA'` | `string` | Sim | Situação atual da aula prática. |
| `observacaoInstrutor` | `string` | `string` | Não | Parecer descritivo do desempenho do aluno durante a sessão. |
| `notaAula` | `number` | `number` | Não | Nota pedagógica da aula (escala de 1 a 10). |
| `competenciasTrabalhadas` | `string[]` | `array` | Não | Tags de habilidades desenvolvidas durante a sessão. |
| `criadoEm` | `string` | `string` | Sim | Timestamp ISO 8601 da criação do agendamento. |

---

#### 12.3.7 Coleção: `availableSlots` (Grade de Horários e Disponibilidade)
Permite ao instrutor definir e bloquear janelas de atendimento na sua agenda diurna e noturna.
- **Caminho Firestore**: `/availableSlots/{slotId}`
- **Chave Primária**: `id` (String UUID)

| Campo | Tipo TypeScript | Tipo Firestore/JSON | Obrigatório | Descrição e Regras |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `string` | `string` | Sim | Identificador exclusivo da janela de horário. |
| `organizacaoId` | `string` | `string` | Sim | Chave estrangeira para `organizations.id`. |
| `instrutorId` | `string` | `string` | Sim | Chave estrangeira para `users.id` (Instrutor titular da agenda). |
| `data` | `string` | `string` | Sim | Data do slot no formato `YYYY-MM-DD`. |
| `horaInicio` | `string` | `string` | Sim | Horário de abertura da janela (`HH:mm`). |
| `horaFim` | `string` | `string` | Sim | Horário de encerramento da janela (`HH:mm`). |
| `bloqueado` | `boolean` | `boolean` | Sim | Indica se o horário está travado para compromissos pessoais ou folga. |
| `motivoBloqueio` | `string` | `string` | Não | Justificativa do travamento (ex: "Manutenção do veículo", "Feriado"). |

---

#### 12.3.8 Coleção: `accountsReceivable` (Contas a Receber e Faturas)
Gerencia as cobranças emitidas para os alunos, controlando recebimentos, saldo devedor e faturamento.
- **Caminho Firestore**: `/accountsReceivable/{accountId}`
- **Chave Primária**: `id` (String UUID)

| Campo | Tipo TypeScript | Tipo Firestore/JSON | Obrigatório | Descrição e Regras |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `string` | `string` | Sim | Identificador exclusivo do título financeiro. |
| `organizacaoId` | `string` | `string` | Sim | Chave estrangeira para `organizations.id`. |
| `alunoId` | `string` | `string` | Sim | Chave estrangeira para `students.id`. |
| `pacoteId` | `string` | `string` | Não | Chave estrangeira para `packages.id` (se originado de pacote). |
| `descricao` | `string` | `string` | Sim | Discriminação do serviço (ex: "Matrícula CNH B - 20 Aulas"). |
| `valorTotalCentavos` | `number` | `number` | Sim | Valor nominal total em centavos (ex: R$ 2.000,00 = `200000`). |
| `valorPagoCentavos` | `number` | `number` | Sim | Total já liquidado em centavos através de amortizações. |
| `saldoDevedorCentavos` | `number` | `number` | Sim | Saldo remanescente em aberto (`valorTotalCentavos - valorPagoCentavos`). |
| `dataVencimento` | `string` | `string` | Sim | Data limite para pagamento sem juros (`YYYY-MM-DD`). |
| `status` | `'PENDENTE' \| 'PARCIAL' \| 'PAGO' \| 'VENCIDO' \| 'CANCELADO'` | `string` | Sim | Situação da cobrança financeira. |
| `pixPayload` | `string` | `string` | Não | Linha digitável do PIX Copia e Cola (padrão EMVCo / BACEN). |
| `pixQrCodeUrl` | `string` | `string` | Não | Imagem em Base64 ou URL para renderização do QR Code PIX dinâmico. |
| `parcelasTotal` | `number` | `number` | Não | Número total de parcelas contratadas pelo aluno. |
| `criadoEm` | `string` | `string` | Sim | Timestamp ISO 8601 da emissão da cobrança. |

---

#### 12.3.9 Coleção: `paymentRecords` (Registros de Pagamento e Amortizações)
Guarda as confirmações de pagamentos e quitações vinculadas às contas a receber.
- **Caminho Firestore**: `/paymentRecords/{paymentId}`
- **Chave Primária**: `id` (String UUID)

| Campo | Tipo TypeScript | Tipo Firestore/JSON | Obrigatório | Descrição e Regras |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `string` | `string` | Sim | Identificador exclusivo do comprovante de pagamento. |
| `organizacaoId` | `string` | `string` | Sim | Chave estrangeira para `organizations.id`. |
| `contaReceberId` | `string` | `string` | Sim | Chave estrangeira para `accountsReceivable.id`. |
| `alunoId` | `string` | `string` | Sim | Chave estrangeira para `students.id`. |
| `valorCentavos` | `number` | `number` | Sim | Montante amortizado na transação em centavos. |
| `metodo` | `'PIX' \| 'CARTAO_CREDITO' \| 'DINHEIRO' \| 'TRANSFERENCIA'` | `string` | Sim | Meio de pagamento utilizado pelo cliente. |
| `parcelas` | `number` | `number` | Não | Quantidade de parcelas selecionadas caso pago via cartão de crédito. |
| `taxaCentavos` | `number` | `number` | Não | Tarifa de intermediação cobrada pela adquirente ou gateway. |
| `dataPagamento` | `string` | `string` | Sim | Data e hora em que a liquidação financeira foi registrada. |
| `comprovanteNumero` | `string` | `string` | Não | Número da autorização bancária, NSU ou hash de transferência. |
| `observacao` | `string` | `string` | Não | Notas internas lançadas pelo operador financeiro. |

---

#### 12.3.10 Coleção: `expenses` (Despesas Operacionais e Custos de Manutenção)
Controla o fluxo de saídas financeiras, combustíveis, revisões veiculares e custos fixos.
- **Caminho Firestore**: `/expenses/{expenseId}`
- **Chave Primária**: `id` (String UUID)

| Campo | Tipo TypeScript | Tipo Firestore/JSON | Obrigatório | Descrição e Regras |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `string` | `string` | Sim | Identificador exclusivo da despesa. |
| `organizacaoId` | `string` | `string` | Sim | Chave estrangeira para `organizations.id`. |
| `descricao` | `string` | `string` | Sim | Descrição do gasto (ex: "Abastecimento Gasolina 45L", "Seguro Frota"). |
| `categoria` | `ExpenseCategory` | `string` | Sim | Enums: `'COMBUSTIVEL'`, `'MANUTENCAO_VEICULO'`, `'SEGURO'`, `'TAXAS_DETRAN'`, `'ALIMENTACAO'`, `'MARKETING'`, `'SISTEMAS_TELEFONIA'`, `'OUTROS'`. |
| `veiculoId` | `string` | `string` | Não | Chave estrangeira para `vehicles.id` (caso o gasto seja atrelado a um carro/moto). |
| `valorCentavos` | `number` | `number` | Sim | Valor nominal do custo em centavos. |
| `dataVencimento` | `string` | `string` | Sim | Data de vencimento do boleto ou fatura (`YYYY-MM-DD`). |
| `dataPagamento` | `string` | `string` | Não | Data em que o pagamento foi efetivamente compensado. |
| `status` | `'PENDENTE' \| 'PAGA'` | `string` | Sim | Situação da despesa no fluxo de caixa. |
| `comprovanteUrl` | `string` | `string` | Não | Link de anexo de cupom fiscal ou recibo digitalizado. |

---

#### 12.3.11 Coleção: `investments` (Metas Financeiras e Reservas de Capital)
Registra metas de longo prazo para renovação de frota, aquisição de simuladores e reservas de emergência.
- **Caminho Firestore**: `/investments/{investmentId}`
- **Chave Primária**: `id` (String UUID)

| Campo | Tipo TypeScript | Tipo Firestore/JSON | Obrigatório | Descrição e Regras |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `string` | `string` | Sim | Identificador exclusivo da meta de investimento. |
| `organizacaoId` | `string` | `string` | Sim | Chave estrangeira para `organizations.id`. |
| `titulo` | `string` | `string` | Sim | Título da meta (ex: "Reserva de Emergência 6 Meses", "Entrada Novo Carro"). |
| `categoria` | `InvestmentCategory` | `string` | Sim | Enums: `'RESERVA_EMERGENCIA'`, `'FROTA_NOVO_VEICULO'`, `'CURSOS_ESPECIALIZACAO'`, `'EQUIPAMENTOS_SIMULADORES'`, `'INFRAESTRUTURA'`. |
| `valorMetaCentavos` | `number` | `number` | Sim | Valor total pretendido para o objetivo em centavos. |
| `valorAcumuladoCentavos` | `number` | `number` | Sim | Saldo acumulado até o momento na reserva em centavos. |
| `aporteMensalCentavos` | `number` | `number` | Sim | Valor médio planejado para economizar mensalmente em centavos. |
| `dataInicio` | `string` | `string` | Sim | Data de início do plano financeiro (`YYYY-MM-DD`). |
| `dataPrevisao` | `string` | `string` | Sim | Data limite planejada para atingimento da meta total. |
| `notas` | `string` | `string` | Não | Justificativas e anotações do plano de investimento. |

---

#### 12.3.12 Coleção: `packages` (Tabelas de Pacotes e Planos de Treinamento)
Catálogo comercial de serviços e pacotes de aulas oferecidos aos alunos.
- **Caminho Firestore**: `/packages/{packageId}`
- **Chave Primária**: `id` (String UUID)

| Campo | Tipo TypeScript | Tipo Firestore/JSON | Obrigatório | Descrição e Regras |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `string` | `string` | Sim | Identificador exclusivo do pacote. |
| `organizacaoId` | `string` | `string` | Sim | Chave estrangeira para `organizations.id`. |
| `instrutorId` | `string` | `string` | Não | Chave estrangeira para `users.id` (opcional, caso seja pacote exclusivo de um autônomo). |
| `instrutorNome` | `string` | `string` | Não | Nome legível do instrutor para exibição rápida. |
| `nome` | `string` | `string` | Sim | Nome comercial (ex: "Primeira Habilitação B Completa", "Treinamento para Habilitados"). |
| `totalAulas` | `number` | `number` | Sim | Carga horária total de aulas práticas inclusas no pacote. |
| `categoriaCnh` | `'A' \| 'B' \| 'AB' \| 'C' \| 'D' \| 'E'` | `string` | Sim | Categoria da Carteira Nacional de Habilitação do plano. |
| `valorCentavos` | `number` | `number` | Sim | Preço comercial do pacote em centavos (ex: `190000`). |
| `formaPagamento` | `PackagePaymentType` | `string` | Sim | Enums: `'A_VISTA'`, `'PARCELADO_CARTAO'`, `'NEGOCIADO'`, `'TODAS'`. |
| `maxParcelas` | `number` | `number` | Não | Limite máximo de parcelas permitidas na modalidade a prazo. |
| `descontoAvistaPercentual` | `number` | `number` | Não | Porcentagem de desconto concedida para liquidação à vista (0 a 100). |
| `descricao` | `string` | `string` | Sim | Detalhamento dos diferenciais, material incluso e condições de contrato. |
| `ativo` | `boolean` | `boolean` | Sim | Define se o pacote aparece listado para novas matrículas. |
| `criadoEm` | `string` | `string` | Não | Data e hora ISO 8601 da criação do produto. |

---

#### 12.3.13 Coleção: `studentTransfers` (Histórico Imutável de Transferências de Alunos)
Auditoria perpétua de reatribuição de candidatos entre instrutores credenciados.
- **Caminho Firestore**: `/studentTransfers/{transferId}`
- **Chave Primária**: `id` (String UUID)

| Campo | Tipo TypeScript | Tipo Firestore/JSON | Obrigatório | Descrição e Regras |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `string` | `string` | Sim | Identificador exclusivo do registro forense de transferência. |
| `organizacaoId` | `string` | `string` | Sim | Chave estrangeira para `organizations.id`. |
| `alunoId` | `string` | `string` | Sim | Chave estrangeira para `students.id`. |
| `alunoNome` | `string` | `string` | Sim | Nome completo do aluno no momento da reatribuição. |
| `alunoCpfMascarado` | `string` | `string` | Sim | Documento protegido arquivado no momento da alteração. |
| `instrutorAnteriorId` | `string` | `string` | Sim | Chave estrangeira para `users.id` (Instrutor anterior desvinculado). |
| `instrutorAnteriorNome` | `string` | `string` | Sim | Nome do instrutor anterior para leitura histórica imediata. |
| `instrutorNovoId` | `string` | `string` | Sim | Chave estrangeira para `users.id` (Novo instrutor titular atribuído). |
| `instrutorNovoNome` | `string` | `string` | Sim | Nome do novo instrutor receptor. |
| `motivo` | `string` | `string` | Sim | Justificativa formal da transferência (ex: "Troca de turno", "Mudança de cidade"). |
| `aulasCumpridasAteTransferencia` | `number` | `number` | Sim | Saldo de aulas já realizadas preservado integralmente. |
| `dataTransferencia` | `string` | `string` | Sim | Data e hora ISO 8601 em que a transferência foi oficializada. |
| `autorId` | `string` | `string` | Sim | Chave estrangeira para `users.id` do Administrador que aprovou a troca. |
| `autorNome` | `string` | `string` | Sim | Nome legível do administrador que efetuou a operação. |

---

#### 12.3.14 Coleção: `auditLogs` (Trilha de Auditoria Forense e LGPD)
Registra de maneira perene cada alteração de dados, acessos, exclusões e modificações no banco de dados.
- **Caminho Firestore**: `/auditLogs/{logId}`
- **Chave Primária**: `id` (String UUID)

| Campo | Tipo TypeScript | Tipo Firestore/JSON | Obrigatório | Descrição e Regras |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `string` | `string` | Sim | Identificador exclusivo do log de auditoria. |
| `organizacaoId` | `string` | `string` | Sim | Chave estrangeira para `organizations.id`. |
| `usuarioId` | `string` | `string` | Sim | Chave estrangeira para `users.id` do autor do evento. |
| `usuarioNome` | `string` | `string` | Sim | Nome do operador registrado no instante da ação. |
| `acao` | `string` | `string` | Sim | Código da ação executada (ex: `'CRIAR_ALUNO'`, `'TRANSFERIR_ALUNO'`, `'BAIXA_PAGAMENTO'`). |
| `entidade` | `string` | `string` | Sim | Nome da tabela/coleção modificada (ex: `'students'`, `'accountsReceivable'`). |
| `entidadeId` | `string` | `string` | Sim | Identificador do registro específico que sofreu a mutação. |
| `detalhes` | `string` | `string` | Sim | Dados complementares, campos alterados ou parâmetros em formato JSON/texto. |
| `ipOrigem` | `string` | `string` | Não | Endereço IP ou metadados de conexão do cliente requisitante. |
| `timestamp` | `string` | `string` | Sim | Carimbo temporal ISO 8601 com milissegundos do evento. |

---

#### 12.3.15 Coleção: `whatsappLogs` (Registro de Cobranças e Lembretes por WhatsApp)
Armazena a trilha de mensagens geradas e transmitidas via WhatsApp para confirmações e cobranças.
- **Caminho Firestore**: `/whatsappLogs/{logId}`
- **Chave Primária**: `id` (String UUID)

| Campo | Tipo TypeScript | Tipo Firestore/JSON | Obrigatório | Descrição e Regras |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `string` | `string` | Sim | Identificador exclusivo do registro de envio. |
| `organizacaoId` | `string` | `string` | Sim | Chave estrangeira para `organizations.id`. |
| `alunoId` | `string` | `string` | Sim | Chave estrangeira para `students.id`. |
| `alunoNome` | `string` | `string` | Sim | Nome do aluno que recebeu a comunicação. |
| `telefone` | `string` | `string` | Sim | Telefone celular destinatário com código DDI e DDD. |
| `valorCentavos` | `number` | `number` | Sim | Valor financeiro mencionado na mensagem em centavos. |
| `dataVencimento` | `string` | `string` | Sim | Data de vencimento do débito mencionado na notificação. |
| `mensagem` | `string` | `string` | Sim | Texto exato gerado para o corpo da mensagem via deep link. |
| `enviadoEm` | `string` | `string` | Sim | Timestamp ISO 8601 do acionamento do envio. |
| `status` | `'ENVIADO' \| 'FALHA'` | `string` | Sim | Situação do disparo da notificação. |

---

#### 12.3.16 Coleção: `syncQueue` (Fila de Sincronização Offline-First)
Controla a fila transacional armazenada localmente no cliente, transmitida ao Firestore após restabelecimento de internet.
- **Armazenamento**: `IndexedDB` / `LocalStorage` (`auto_gestao_sync_queue`)
- **Chave Primária**: `id` (String UUID)

| Campo | Tipo TypeScript | Tipo Firestore/JSON | Obrigatório | Descrição e Regras |
| :--- | :--- | :--- | :---: | :--- |
| `id` | `string` | `string` | Sim | Identificador exclusivo do item em espera na fila. |
| `timestamp` | `number` | `number` | Sim | Epoch timestamp em milissegundos para ordenação cronológica estrita. |
| `action` | `string` | `string` | Sim | Operação a ser replicada no Firestore: `'CREATE'`, `'UPDATE'` ou `'DELETE'`. |
| `entity` | `string` | `string` | Sim | Coleção de destino no Firestore (`'students'`, `'lessons'`, `'payments'`, etc.). |
| `payload` | `any` | `map / object` | Sim | Documento completo serializado a ser gravado no banco de dados. |
| `retryCount` | `number` | `number` | Sim | Contador de tentativas de retransmissão em caso de intermitência de rede. |

---

### 12.4 Regras de Validação, Restrições de Integridade e Índices do Banco

1. **Unicidade de CPF por Instrutor**:
   - Cada aluno cadastrado gera um `cpfFingerprint` (SHA-256).
   - O sistema impede a criação de dois alunos ativos com o mesmo `cpfFingerprint` dentro da mesma ou entre organizações diferentes sem transferência formal aprovada pelo Administrador Master.
2. **Restrição de Idade Legal**:
   - O campo `dataNascimento` é submetido à validação de idade mínima no ato da criação: `idade >= 18 anos`. Candidatos menores de 18 anos são impedidos de cadastro por força do Código de Trânsito Brasileiro.
3. **Carga Horária e Diário de Aulas**:
   - A soma de aulas de um aluno (`aulasCumpridas`) é incrementada automaticamente apenas quando uma aula em `lessons` atinge o status `'CONCLUIDA'`.
   - Cancelamentos e faltas não computam como presença pedagógica cumprida.
4. **Política de Centavos Financeiros (Zero Floating-Point Error)**:
   - Todo cálculo de saldo devedor obedece rigorosamente à fórmula:  
     `saldoDevedorCentavos = valorTotalCentavos - valorPagoCentavos`
   - O status da conta muda automaticamente para `'PAGO'` quando `saldoDevedorCentavos === 0` e para `'PARCIAL'` quando `valorPagoCentavos > 0 && saldoDevedorCentavos > 0`.
5. **Auditoria LGPD e Imutabilidade**:
   - Nenhum registro na coleção `auditLogs` ou `studentTransfers` pode ser alterado ou excluído via aplicação.
   - Qualquer tentativa de deleção é bloqueada nas regras de segurança do Firestore (`firestore.rules`).

---

## 13. TERMO DE HOMOLOGAÇÃO E DECLARAÇÃO DE INTEGRIDADE

Este Dossiê constitui o registro definitivo e exaustivo de todas as funcionalidades, interfaces, modelos de dados, tabelas, relacionamentos e salvaguardas tecnológicas implementadas no **Sistema de Administração de Gestão de Direção**.

*Homologado para produção e operação contínua.*  
*Administração Master: cassiordcosta@gmail.com*  
*Versão do Sistema: v5.6 Estável, Auditada e Protegida (Go-Live & Supabase)*

