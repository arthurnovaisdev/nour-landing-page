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
- WhatsApp usa símbolo local em SVG e funciona como apoio comercial. Os três botões de pagamento usam os Links de Pagamento oficiais centralizados em `dist/assets/scripts/config.js`; redes e textos legais não possuem links provisórios.
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

- Regras de cobrança, parcelamento, renovação, cancelamento e reembolso.
- Frequência final das análises, calls e atualizações.
- Revisão jurídica do posicionamento e dos textos legais.
- Vinculação de `nourcrypto.com.br` à Netlify, configuração DNS e HTTPS; e-mail oficial e identificadores de analytics, caso aprovados.
- Foto profissional do fundador, se for utilizada.

Para copy completa, arquitetura e critérios de validação, consulte `docs/landing-page-v2.md`.

## Escopo definitivo de pagamentos — 17/09/2026

O projeto Nour é uma landing page comercial. Os pagamentos são processados externamente pelo PagBank. A landing page não processa, confirma nem armazena pagamentos. A conferência e a liberação do acesso ao grupo VIP são operacionais e realizadas manualmente pela Nour.

- O visitante escolhe um plano e segue diretamente ao Link de Pagamento PagBank correspondente.
- Todo o processamento financeiro e a consulta da venda acontecem no PagBank.
- Samuel confere a venda e libera manualmente o grupo VIP. O cliente não precisa enviar comprovante nem avisar que pagou.
- O WhatsApp público permanece apenas para dúvidas, objeções e suporte.
- O projeto não possui banco, pedidos, painel, autenticação administrativa, webhook, reconciliação, polling, endpoint de status, API de checkout, Functions financeiras, token PagBank ou liberação automática.
- A Netlify permanece somente como hospedagem estática de `dist/`.
- A infraestrutura local dos Prompts 4 a 6 foi removida sem publicação.
