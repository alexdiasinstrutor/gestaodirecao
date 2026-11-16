# Documentos Jurídicos da Plataforma (Instrução Veicular)

Este pacote contém os documentos jurídicos estruturados em Markdown com placeholders dinâmicos (`{{VARIAVEL}}`) prontos para renderização no frontend/backend do sistema.

## Estrutura dos Arquivos
1. `01_contrato_prestacao_servicos.md`: Contrato bilateral entre **Instrutor Autônomo** e **Aluno**, contendo regras de janela de cancelamento de 24h, tolerância de atraso, cessão de veículo para exame prático do DETRAN, direito de arrependimento (7 dias - CDC) e isenção financeira da plataforma.
2. `02_termos_de_uso_plataforma.md`: Termos de Uso do software SaaS, blindando a plataforma contra responsabilidade solidária por pagamentos diretos, execução das aulas e exames.
3. `03_politica_privacidade_lgpd.md`: Política de Privacidade adequada à Lei nº 13.709/2018 (LGPD), definindo papéis de Controladora e Operadora.
4. `variaveis_schema.json`: Mapeamento estruturado de todas as variáveis dinâmicas de cada documento para facilitar a criação de templates, tipagens TypeScript e tabelas de banco de dados.

## Dicas de Integração (Supabase / PostgreSQL)
- Armazene o hash SHA-256 do conteúdo renderizado no momento do aceite junto com `user_id`, `ip_address`, `user_agent` e `accepted_at` (UTC) para garantir validade probatória conforme a MP 2.200-2/2001.
- Exiba o segundo checkbox destacado (Cláusulas 4 e 5) no fluxo de contratação do aluno para cumprir o art. 54, § 4º do CDC.

## Integração local — 16/11/2026
Acesso no login e cabeçalho por Termos, privacidade e contratos. Modelos carregados diretamente destes arquivos e variáveis guiadas por variaveis_schema.json. O leitor preserva o Markdown original, permite conferência e preenchimento, seleção de aluno vinculado ao instrutor e exportação JSON da minuta com conteúdo integral, versão, pendências e SHA-256.

Configuração pública da provedora por VITE_LEGAL_RAZAO_SOCIAL, VITE_LEGAL_CNPJ, VITE_LEGAL_ENDERECO, VITE_LEGAL_CIDADE e VITE_LEGAL_EMAIL_DPO no ambiente Vite. Nenhum desses valores deve conter segredos. A UF da sede ainda deve ser conferida no campo do documento.

Estado atual: preparação de minutas. Exportações levam status MINUTA_SEM_ACEITE. A apresentação do destaque das cláusulas Quarta e Quinta está pronta para conferência. A coleta dos dois checkboxes no fluxo de contratação, o aceite bilateral com identidade autenticada, IP obtido no servidor e tabela de evidências com retenção própria ainda estão pendentes. Nenhum clique ou download nesta interface representa assinatura. Não usar o cofre de auditoria limitado a 600 eventos como arquivo definitivo de contratos.
