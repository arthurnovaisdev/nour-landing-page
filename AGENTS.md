# Contexto permanente — Landing Page Nour

## Objetivo

Construir uma landing page premium, rápida e responsiva para a Nour, posicionada como consultoria e inteligência em criptoativos. O Nour Scoring System (NSS), criado por Samuel Seza, é o principal diferencial do produto.

## Direção visual aprovada

- Azul-noturno e azul-cobalto, com o champanhe original do logo.
- Visual tecnológico, financeiro, minimalista e com bastante respiro.
- Evitar planeta, moedas, foguetes, luxo, gráficos de lucro, neon excessivo e estética cyberpunk.
- Usar apenas os arquivos oficiais em `assets/brand/` como fonte da marca.
- O movimento deve reforçar a marca e o NSS, respeitando `prefers-reduced-motion`.

## Fluxo de conversão

- CTAs gerais como “Entrar para a Nour” levam à seção de planos.
- Prompt 5: botões iniciam checkout exclusivamente Sandbox/mocks. Contratos e configuração em docs/checkout-sandbox.md. Produção continua bloqueada.
- WhatsApp é contato de apoio, com ícone reconhecível e rótulo acessível.
- Nunca inventar links de pagamento nem disparar pagamentos em testes.

## Segurança obrigatória

- Nunca inserir tokens, senhas, chaves, segredos ou credenciais no código do navegador.
- Nunca usar prefixos públicos para segredos de servidor.
- Não registrar valores reais em `.env.example`, documentação, logs ou commits.
- Integrações que exigem segredo devem ser executadas no servidor.
- Validar e restringir qualquer entrada recebida por formulário ou webhook.
- Usar HTTPS, proteção contra redirecionamentos indevidos e atributos seguros em links externos.
- Não adicionar scripts, CDNs, pixels ou bibliotecas externas sem necessidade e autorização.

## Operação do projeto

- Preservar conteúdo e alterações existentes antes de editar.
- Manter a implementação simples e sem dependências enquanto HTML, CSS e JavaScript nativos forem suficientes.
- Não publicar, criar repositório remoto ou enviar alterações ao GitHub sem autorização explícita.
- Antes de concluir uma etapa, verificar responsividade, acessibilidade, links, erros no navegador e ausência de segredos.

## Fontes de contexto

- Copy, arquitetura e pendências: `docs/landing-page-v2.md`.
- Resumo executivo: `docs/project-context.md`.
- Segurança: `SECURITY.md`.
- Checklist de entrega: `docs/pre-launch-checklist.md`.


## Pagamentos — decisão do Prompt 4

- Arquitetura e limites: `docs/payment-architecture.md`.
- Netlify Functions + Netlify Database/Postgres; nenhum banco temporário das Functions.
- Somente PAID reconciliado com a API, valor/moeda e vínculo do pedido permite pós-pagamento.
- Código público não autentica comprador. Samuel confere e libera manualmente o VIP.
- Criação e sessão no Prompt 5; webhook, reconciliação e consulta no Prompt 6, somente Sandbox/mocks. Contratos e pendências de homologação em docs/payment-confirmation.md. Produção e liberação automática do VIP continuam bloqueadas; não conectar credenciais nem publicar sem autorização.
- Segredos configurados futuramente no painel seguro; nunca solicitar valores pela conversa.
- Netlify Database Free usa créditos; confirmar condições da conta e cobrança antes de provisionar.
- Não presumir assinatura ou idempotência de Checkout; homologar os contratos indicados na arquitetura.
