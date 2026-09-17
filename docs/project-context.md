# Contexto executivo do projeto

## Estado após o Prompt 2 — 15/09/2026

- Pasta principal: `C:\Projects\nour-landing-page`.
- Página completa em `dist/index.html`; estilos em `dist/assets/styles/base.css` e `identity.css` (carregado por último).
- O DOCX do cliente prevalece sobre as propostas antigas de copy em `landing-page-v2.md`.
- Headline preservada: “O mercado muda em segundos. Suas decisões também deveriam evoluir.”
- CTA final: “O mercado não vai ficar mais simples. Sua forma de interpretá-lo pode.”; apoio “Menos ruído. Mais contexto. Mais clareza.”; botão “Entrar para a Nour” leva a `#planos`.
- NSS identificado no início e detalhado em seção própria com exemplo ilustrativo.
- Seção “O desafio” reequilibrada com o monograma oficial, anéis discretos e títulos proporcionais.
- Oito entregas, seis etapas de funcionamento, fundador, perfis, três planos e oito FAQs implementados.
- WhatsApp usa símbolo local em SVG. Botões de pagamento e WhatsApp estão desativados; redes e textos legais não possuem links provisórios.
- Nenhum serviço externo conectado. A demonstração usa `noindex, nofollow`; remover somente na preparação da publicação autorizada.
- Conteúdo legível sem JavaScript. Refinamento de motion contínuo fica para o Prompt 3.
- A frase do fundador “Dinheiro não aceita desaforo.” consta no DOCX do cliente e foi incluída como citação secundária.
- Frequência e condições de cancelamento ainda pendentes: FAQ informa que serão disponibilizadas antes da contratação.

### Validação desta etapa

Página inspecionada em 1440, 1024, 768, 390 e 320 px. Corrigida a largura mínima que provocava rolagem lateral em 320 px. Verificados CTAs internos, FAQ, imagens locais e ausência de erros no console. Integrações reais e auditoria de publicação permanecem nas etapas 4 e 5.

## Produto

A Nour oferece consultoria, inteligência e acompanhamento de mercado em criptoativos. A comunicação deve deixar essa categoria clara nos primeiros segundos da página, sem sugerir corretora, custódia, sala de sinais ou garantia de retorno.

## Diferencial central

O Nour Scoring System é a metodologia proprietária criada por Samuel Seza. Ele organiza múltiplas dimensões de análise, como risco, momento, volatilidade, liquidez e horizonte. A fórmula não será exposta, e exemplos de score precisam ser identificados como ilustrativos.

## Público e objetivo

A landing page atende pessoas que desejam acompanhar criptoativos com mais método e contexto. O fluxo principal apresenta a proposta, constrói valor, explica o NSS e encaminha o visitante aos planos. O WhatsApp funciona como apoio comercial.

## Identidade aprovada

- Fundo azul-noturno e destaques em cobalto.
- Logo em champanhe preservado.
- Tecnologia com sobriedade e respiro.
- Ícone Nour como elemento de movimento e reconhecimento.
- Sem planeta, moedas, foguetes, ostentação ou elementos de trading genéricos.

## Movimento planejado

Na seção “O desafio”, o ícone da Nour pode ocupar o espaço negativo com flutuação vertical lenta, anéis finos e pontos de dados discretos. O efeito deve ser leve, não bloquear conteúdo e ser removido quando o dispositivo solicitar redução de movimento.

## Pendências externas

- Homologação PagBank, conta Netlify com Database elegível e contato oficial de Samuel; checkouts exclusivos serão criados no servidor.
- Regras de cobrança, parcelamento, renovação, cancelamento e reembolso.
- Frequência final das análises, calls e atualizações.
- Revisão jurídica do posicionamento e dos textos legais.
- Domínio, e-mail oficial e identificadores de analytics, caso aprovados.
- Foto profissional do fundador, se for utilizada.

Para copy completa, arquitetura e critérios de validação, consulte `docs/landing-page-v2.md`.

## Estado após o Prompt 4 — 16/09/2026

- Análise inicial concluída antes de editar; landing e motions preservados byte a byte.
- Arquitetura escolhida: Checkout hospedado PagBank, Netlify Functions e Netlify Database/Postgres persistente.
- `netlify.toml` serve apenas `dist/`; Functions, SQL, testes e documentação ficam privados no repositório.
- Rotas de criação, consulta e webhook são esqueletos bloqueados (503), sem rede ou credenciais.
- Migração SQL preparada e não aplicada. SDK/adaptadores, sessões, worker e painel administrativo ainda não implementados.
- Catálogo interno acompanha os preços atuais: R$ 100/500/800; checkout 2 h, VIP 1/6/12 meses desde a liberação manual, com condições comerciais a validar antes das vendas.
- PAID só permite pós-pagamento após reconciliação autenticada; Samuel verifica identidade e aprova/adiciona manualmente ao grupo.
- Código de pedido é referência pública, nunca comprovante ou senha. Não expor convite permanente do grupo.
- `.env.example` contém somente configuração fictícia, sem links fixos de checkout nem segredo de webhook inventado.
- Netlify Database consta no Free baseado em créditos; confirmar conta/franquia/custo vigente. Autenticidade e idempotência exigem homologação específica de Checkout.
- Nenhuma publicação, banco provisionado, chamada de pagamento ou credencial conectada.

Documento principal: `docs/payment-architecture.md`. Verificações locais e limitações: `docs/payment-verification.md`.

## Estado após o Prompt 5 — 16/09/2026

- Criação de checkout e sessão implementadas em Netlify Functions, exclusivamente Sandbox/mocks.
- Botões enviam somente planId; catálogo, valores, nomes e duração permanecem no servidor.
- Snapshot PENDING e tentativa persistidos antes do gateway; link só devolvido após commit.
- Sessão HttpOnly, validação estrita, limites Postgres e idempotência local implementados.
- Sem token, modo mock persiste a simulação e não gera link de pagamento; sem banco/configuração, falha fechada.
- Prévia local isolada: npm run preview:checkout. Nenhuma credencial, conta ou banco remoto conectado.
- Retorno do checkout não comprova pagamento. Webhook, consulta financeira, reconciliação e VIP seguem bloqueados.
- Contratos reais da conta Sandbox e concorrência multiconexão do Postgres ainda exigem homologação.
- Implementação e fontes oficiais: docs/checkout-sandbox.md. Testes: docs/payment-verification.md.
- Nenhuma publicação, cobrança real ou envio ao GitHub.

## Estado após o Prompt 6 — confirmação local

Webhook, inbox idempotente, fila durável, reconciliação Sandbox, consulta por sessão opaca e página de estados implementados e simulados. Somente PAID conferido pode produzir confirmação financeira; VIP permanece manual e sem convite público. Estorno e disputa suspendem o modelo local de acesso e geram tarefa de remoção manual. Contratos, fontes, limites e homologações pendentes: [payment-confirmation.md](payment-confirmation.md). Nenhuma publicação, credencial, provisão de banco ou pagamento real. Produção continua bloqueada.
