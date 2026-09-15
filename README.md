# Nour — Landing Page

Projeto da landing page da Nour, consultoria e inteligência em criptoativos apoiada pelo Nour Scoring System.

## Estado atual

A pasta contém os ativos oficiais de marca, o briefing, a copy consolidada, prévias visuais e uma demonstração estática em `dist/`. Nenhuma publicação ou integração real de pagamento foi realizada nesta etapa.

## Estrutura

```text
.
├── .openai/hosting.json       # Configuração local de hospedagem; ainda sem publicação
├── assets/brand/              # Arquivos-fonte oficiais da marca
├── dist/                      # Versão estática navegável da landing page
├── docs/                      # Contexto, copy, decisões e checklist
├── previews/                  # Prévias visuais aprovadas e históricas
├── .env.example              # Nomes das variáveis, sem valores reais
├── AGENTS.md                 # Regras permanentes para futuras sessões
└── SECURITY.md               # Política de segurança do projeto
```

## Desenvolvimento local

O projeto permanece propositalmente estático e sem dependências. Qualquer servidor HTTP local pode servir a pasta `dist/`. Abrir o arquivo diretamente pelo sistema pode limitar alguns comportamentos do navegador; prefira um servidor local durante a validação.

## Variáveis de ambiente

Somente crie um arquivo `.env` quando uma integração realmente precisar dele. Valores públicos e segredos estão separados no `.env.example`. Tokens do PagBank e segredos de webhook são exclusivos do servidor e nunca podem aparecer no HTML ou JavaScript entregue ao visitante.

## Publicação

A publicação, a criação do repositório remoto e o envio ao GitHub dependem de autorização explícita. Antes disso, siga `docs/pre-launch-checklist.md` e confirme todas as pendências comerciais e jurídicas registradas em `docs/landing-page-v2.md`.

