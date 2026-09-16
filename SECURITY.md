# Segurança

## Princípios

- O navegador recebe somente informações que podem ser públicas.
- Tokens, credenciais e segredos de webhook permanecem exclusivamente no servidor.
- O repositório nunca deve conter arquivos `.env` preenchidos.
- Dependências externas são evitadas quando recursos nativos atendem ao projeto.
- Toda nova integração precisa ser revisada antes de ser habilitada em produção.

## PagBank

Cada pedido terá um checkout exclusivo criado por uma Netlify Function. Os botões da demonstração permanecem desativados até implementar e homologar o fluxo completo. O token da API nunca pode ser incluído em HTML, CSS, JavaScript do navegador, URL, mensagem de erro ou ferramenta de analytics.

Webhooks devem validar autenticidade, formato, método HTTP, tipo de conteúdo e identificador do evento antes de alterar qualquer estado. Eventos repetidos precisam ser tratados de forma idempotente.

## Links e contato

- Links externos abertos em nova aba devem usar `rel="noopener noreferrer"`.
- Números de telefone e mensagens pré-preenchidas são considerados dados públicos do site.
- Parâmetros recebidos pela URL não devem ser inseridos diretamente no HTML.

## Relato de vulnerabilidade

Não publique detalhes de uma vulnerabilidade em issues públicas. Registre o problema internamente com passos de reprodução, impacto e arquivos afetados até que um canal privado oficial seja definido.


## Fronteira do servidor e persistência — Prompt 4

- Arquitetura normativa: `docs/payment-architecture.md`. Functions e `server/` nunca entram em `dist/`.
- Apenas `dist/` pode ser servida publicamente. Não publicar raiz, SQL, contexto, `.env`, dumps ou backups.
- `.env.example` contém somente valores fictícios. Não solicitar credenciais na conversa. Configuração futura diretamente no painel seguro da Netlify; no Free, escopo Functions exclusivo pode não estar disponível.
- Banco escolhido: Netlify Database/Postgres com transações, unicidade, leases e auditoria. Não usar armazenamento temporário das Functions como banco.
- Papéis de aplicação/migração separados e acesso administrativo restrito com MFA. Sandbox, produção e previews isolados; previews não confiáveis nunca recebem dados/credenciais reais.
- Sem cartões, CVV, CPF, e-mail, telefone ou payload bruto no esquema desta etapa. Retenção final deve ser definida antes de produção.

## Pagamento e liberação

- Somente PAID reconciliado com a API autenticada, checkout/cobrança/referência, valor e moeda corretos habilita pós-pagamento. Reembolso, disputa, revisão ou verificação vencida bloqueiam.
- Redirecionamento, parâmetro de URL, mensagem de WhatsApp e código público não são prova de pagamento ou posse do pedido.
- Sessão futura: cookie Secure/HttpOnly/SameSite e apenas hash persistido, sem credencial em URLs/localStorage. O navegador nunca recebe segredos PagBank/Database.
- Samuel confere identidade e estado em área privada e registra a liberação manual. Nenhum convite permanente de grupo deve ser público.
- Reembolso/chargeback e vencimento geram tarefas de suspensão/remoção manual; o estado financeiro é separado da validade do VIP.

## Entradas, webhooks e recuperação

- JSON estrito, limites de corpo, allowlist de planos, Origin/CSRF e limitação de requisições nas rotas do comprador.
- Verificar assinatura no corpo bruto antes do parse. Order/Charge SHA-256 e nova Notificação ECDSA são contratos distintos; homologar por família, sem fallback permissivo.
- O helper Order/Charge está isolado. As rotas atuais sempre recusam operação; não há webhook autenticado em produção nesta etapa.
- Webhook só confirma recebimento após persistir evento e job na mesma transação. Deduplicar e reconciliar o estado atual; não aplicar status arbitrário do payload.
- Não seguir links de webhooks. Origem da API e URLs de retorno fixas no servidor; links de checkout devem passar por HTTPS e hostname exato homologado.
- Idempotência local com unicidade e trava de concorrência; suporte do provedor deve ser homologado especificamente em Checkout. Timeout de criação vira UNKNOWN, sem nova criação automática.
- Logs apenas com códigos sanitizados e contagens. Nunca registrar tokens, cookies, headers, payloads, URL de conexão ou erros brutos do provedor.
- Falha de banco/provedor não libera acesso. Repetições limitadas e fila persistente com revisão para falhas esgotadas.
