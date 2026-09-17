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
- Cada botão de plano aponta diretamente para o Link de Pagamento oficial do PagBank correspondente, quando esses links forem fornecidos e validados.
- WhatsApp é contato de apoio, com ícone reconhecível e rótulo acessível.
- Nunca inventar links de pagamento nem disparar pagamentos em testes.

## Segurança obrigatória

- Nunca inserir tokens, senhas, chaves, segredos ou credenciais no código do navegador.
- Nunca usar prefixos públicos para segredos de servidor.
- Não registrar tokens, segredos ou credenciais em documentação, logs ou commits.
- O projeto não utiliza integração autenticada, backend, formulário financeiro ou webhook.
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


## Pagamentos — escopo definitivo

O projeto Nour é uma landing page comercial. Os pagamentos são processados externamente pelo PagBank. A landing page não processa, confirma nem armazena pagamentos. A conferência e a liberação do acesso ao grupo VIP são operacionais e realizadas manualmente pela Nour.

- Não adicionar banco, pedidos, painel, autenticação administrativa, webhook, consulta de status, polling, API de checkout, Netlify Functions financeiras ou token PagBank.
- O cliente não precisa enviar comprovante nem avisar Samuel após pagar.
- O WhatsApp público serve apenas para dúvidas, objeções e suporte.
- Nunca inventar Links de Pagamento. Manter os CTAs desativados até receber os links oficiais correspondentes.
