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
│   ├── obrigado/              # Página informativa de pós-compra
│   ├── assets/scripts/config.js # Configuração pública de PagBank e WhatsApp
│   └── assets/styles/         # Base visual e identidade responsiva
├── docs/                      # Contexto, copy, decisões e checklist
├── previews/                  # Prévias visuais aprovadas e históricas
├── AGENTS.md                 # Regras permanentes para futuras sessões
└── SECURITY.md               # Política de segurança do projeto
```

## Desenvolvimento local

O projeto permanece propositalmente estático e sem dependências. Qualquer servidor HTTP local pode servir a pasta `dist/`. Abrir o arquivo diretamente pelo sistema pode limitar alguns comportamentos do navegador; prefira um servidor local durante a validação.

Use `dist/index.html` para a estrutura e `dist/assets/styles/identity.css` para os ajustes de identidade. `base.css` preserva os componentes da prévia anterior. Sirva somente `dist/`, nunca a raiz que contém contexto interno e documentos do cliente. O WhatsApp comercial está ativo. Os botões dos planos permanecem desativados até que os Links de Pagamento oficiais correspondentes sejam fornecidos e validados.

Toda a configuração pública do fluxo comercial fica em `dist/assets/scripts/config.js`:

- `monthlyPaymentUrl`: Link de Pagamento do plano mensal;
- `semiannualPaymentUrl`: Link de Pagamento do plano semestral;
- `annualPaymentUrl`: Link de Pagamento do plano anual;
- `whatsappNumber`: número comercial no formato país + DDD + número, somente dígitos;
- `whatsappMessage`: mensagem de suporte codificada pelo navegador ao formar a URL `wa.me`.

Mantenha qualquer link de pagamento ainda não recebido como `null`. O frontend aceita somente HTTPS em domínios esperados do PagBank/PagSeguro, não lê plano, preço ou destino de parâmetros da URL e mantém o CTA indisponível quando a configuração está ausente ou inválida.

## Publicação

A publicação, a criação do repositório remoto e o envio ao GitHub dependem de autorização explícita. Antes disso, siga `docs/pre-launch-checklist.md` e confirme todas as pendências comerciais e jurídicas registradas em `docs/landing-page-v2.md`.

## Pagamentos

Cada botão de plano deverá apontar diretamente para seu Link de Pagamento oficial do PagBank. Todo o processamento financeiro acontece no ambiente do PagBank. A Nour confere a venda diretamente no provedor e Samuel libera manualmente o acesso ao grupo VIP, sem exigir comprovante ou aviso do cliente.

Não há API de checkout, Functions, banco, pedidos, webhook, polling, painel ou variáveis de ambiente do PagBank neste projeto. Com Node.js 22 ou superior, execute `npm run build`, `npm run lint` e `npm run check`. Não há comando de deploy.

## Pós-compra e retorno

A rota estática de orientação é `/obrigado` (arquivo `dist/obrigado/index.html`). No domínio final, a URL prevista é `https://DOMINIO-OFICIAL/obrigado`; substitua `DOMINIO-OFICIAL` somente depois que o domínio de produção for confirmado.

Na documentação oficial atual, `redirect_url` e `return_url` pertencem ao objeto de Checkout criado pela API autenticada. A documentação do Link de Pagamento criado manualmente no painel/app não apresenta configuração de URL de retorno. Como este projeto não usa token, API, backend ou Function, nenhum retorno automático foi implementado. A página permanece disponível como fallback informativo e nunca deve ser interpretada como confirmação de pagamento.

Referências oficiais consultadas em 17/09/2026:

- [Checkout e Link de Pagamento](https://developer.pagbank.com.br/docs/checkout);
- [Objeto Checkout](https://developer.pagbank.com.br/dk/reference/objeto-checkout);
- [Como funciona o Link de Pagamento](https://faq.pagbank.com.br/duvida/como-faco-uma-venda-por-link-de-pagamento/76).
