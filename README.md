# Nour — Landing Page

Projeto da landing page da Nour, consultoria e inteligência em criptoativos apoiada pelo Nour Scoring System.

## Estado atual

A pasta contém os ativos oficiais de marca, o briefing, a copy consolidada, prévias visuais e a landing page estática em `dist/`. Nenhuma publicação foi realizada nesta etapa.

O projeto Nour é uma landing page comercial. Os pagamentos são processados externamente pelo PagBank. A landing page não processa, confirma nem armazena pagamentos. A conferência e a liberação do acesso ao grupo VIP são operacionais e realizadas manualmente pela Nour.

## Estrutura

```text
.
├── .openai/hosting.json       # Configuração local de hospedagem; ainda sem publicação
├── assets/brand/              # Arquivos-fonte oficiais da marca
├── dist/                      # Página completa; única pasta servida ao navegador
│   └── assets/styles/         # Base visual e identidade responsiva
├── docs/                      # Contexto, copy, decisões e checklist
├── previews/                  # Prévias visuais aprovadas e históricas
├── AGENTS.md                 # Regras permanentes para futuras sessões
└── SECURITY.md               # Política de segurança do projeto
```

## Desenvolvimento local

O projeto permanece propositalmente estático e sem dependências. Qualquer servidor HTTP local pode servir a pasta `dist/`. Abrir o arquivo diretamente pelo sistema pode limitar alguns comportamentos do navegador; prefira um servidor local durante a validação.

Use `dist/index.html` para a estrutura e `dist/assets/styles/identity.css` para os ajustes de identidade. `base.css` preserva os componentes da prévia anterior. Sirva somente `dist/`, nunca a raiz que contém contexto interno e documentos do cliente. O WhatsApp comercial está ativo. Os botões dos planos permanecem desativados até que os Links de Pagamento oficiais correspondentes sejam fornecidos e validados.

## Publicação

A publicação, a criação do repositório remoto e o envio ao GitHub dependem de autorização explícita. Antes disso, siga `docs/pre-launch-checklist.md` e confirme todas as pendências comerciais e jurídicas registradas em `docs/landing-page-v2.md`.

## Pagamentos

Cada botão de plano deverá apontar diretamente para seu Link de Pagamento oficial do PagBank. Todo o processamento financeiro acontece no ambiente do PagBank. A Nour confere a venda diretamente no provedor e Samuel libera manualmente o acesso ao grupo VIP, sem exigir comprovante ou aviso do cliente.

Não há API de checkout, Functions, banco, pedidos, webhook, polling, painel ou variáveis de ambiente do PagBank neste projeto. Com Node.js 22 ou superior, execute `npm run build` e `npm run check`. Não há comando de deploy.
