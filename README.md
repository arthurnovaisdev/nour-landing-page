# Nour — Landing Page

Projeto da landing page da Nour, consultoria e inteligência em criptoativos apoiada pelo Nour Scoring System.

## Estado atual

A pasta contém os ativos oficiais de marca, o briefing, a copy consolidada, prévias visuais e uma demonstração estática em `dist/`. Nenhuma publicação ou integração real de pagamento foi realizada nesta etapa.

## Estrutura

```text
.
├── .openai/hosting.json       # Configuração local de hospedagem; ainda sem publicação
├── assets/brand/              # Arquivos-fonte oficiais da marca
├── dist/                      # Página completa; única pasta servida ao navegador
│   └── assets/styles/         # Base visual e identidade responsiva
├── docs/                      # Contexto, copy, decisões e checklist
├── previews/                  # Prévias visuais aprovadas e históricas
├── .env.example              # Nomes das variáveis, sem valores reais
├── AGENTS.md                 # Regras permanentes para futuras sessões
└── SECURITY.md               # Política de segurança do projeto
```

## Desenvolvimento local

O projeto permanece propositalmente estático e sem dependências. Qualquer servidor HTTP local pode servir a pasta `dist/`. Abrir o arquivo diretamente pelo sistema pode limitar alguns comportamentos do navegador; prefira um servidor local durante a validação.

Use `dist/index.html` para a estrutura e `dist/assets/styles/identity.css` para os ajustes de identidade. `base.css` preserva os componentes da prévia anterior. Sirva somente `dist/`, nunca a raiz que contém contexto interno e documentos do cliente. Os botões de compra e contato estão desativados até a etapa de integrações.

## Variáveis de ambiente

Somente crie um arquivo `.env` quando uma integração realmente precisar dele. O `.env.example` contém somente nomes e valores fictícios reservados ao servidor. Tokens do PagBank e material de autenticação são exclusivos do servidor e nunca podem aparecer no HTML ou JavaScript entregue ao visitante.

## Publicação

A publicação, a criação do repositório remoto e o envio ao GitHub dependem de autorização explícita. Antes disso, siga `docs/pre-launch-checklist.md` e confirme todas as pendências comerciais e jurídicas registradas em `docs/landing-page-v2.md`.

## Estrutura de pagamentos — Prompt 4

Arquitetura completa em `docs/payment-architecture.md`; evidências em `docs/payment-verification.md`.

- `netlify.toml`: pasta pública `dist/` e diretório das Functions.
- `netlify/functions/`: criação de checkout, consulta de pedido e webhook, todos bloqueados (503).
- `server/payments/`: políticas internas e verificador isolado Order/Charge, sem chamadas externas.
- `netlify/database/migrations/`: modelo Postgres para pedidos, sessões, eventos, fila e acesso manual; não aplicado.
- `tests/` e `scripts/`: verificações locais usando apenas Node.js.

Com Node.js 22 ou superior, execute `npm test` e `npm run check`. Não é necessário instalar dependências para estas verificações. Não há comando de deploy. O frontend continua estático e intocado.

Netlify Database foi escolhido por persistência e transações; está documentado no plano Free baseado em créditos, sujeito à franquia e às condições vigentes. Nenhuma conta foi conectada. Adaptadores, worker, sessões e área privada do Samuel serão implementados na próxima etapa, antes de ativar os botões. Não execute publicação ou migração remota nesta etapa.
