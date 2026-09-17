# Verificações — Prompt 5, 16/09/2026

## Resultado final

- `npm test`: **27 testes aprovados, zero falhas**. Inclui os cinco cenários pedidos: criação válida dos três planos, plano inválido, requisição repetida, erro do gateway e ausência de configuração.
- Cobertura adicional: preço/JSON/callback adulterados, Origin/Fetch Metadata, HTTP/conteúdo/stream, timeout de corpo, sessão/cookie seguro, limites compartilhados, concorrência HTTP, nova instância, rollback de reserva, falha de commit após gateway, lease vencido, resposta/valor/link inválidos e persistência de UNKNOWN.
- Migrações 001 e 002 executadas em Postgres WASM isolado (PGlite) nos testes. Verificadas constraints, unicidade, rollback e consultas parametrizadas.
- `npm run check`: sintaxe, fronteira pública, IDs, âncoras e ativos dos nove arquivos públicos aprovados. Inclui página de retorno e JavaScript do checkout; varredura heurística sem indícios de segredo.
- `npm ci --ignore-scripts --dry-run --no-audit --no-fund`: lockfile aceito.
- `npm audit --omit=dev --audit-level=high`: zero vulnerabilidades reportadas nas dependências de execução.
- git diff --check: sem erros de whitespace após normalização dos arquivos alterados.
- Arquivos .env reais e banco mock em .qa permanecem ignorados. Somente .env.example, com token e segredo em branco, integra o repositório.

## Navegador e interface

Edge local com Playwright; toda rede externa bloqueada. Nenhum checkout do PagBank aberto. Prévia servindo somente dist e usando pedidos mock persistidos localmente.

- 1440, 1024, 768, 390 e 320 px: sem overflow horizontal, três planos habilitados com JavaScript, CTA para planos e FAQ funcionam.
- Cliques duplos geram uma solicitação; nova tentativa preserva a chave; o corpo enviado contém somente planId.
- Mock registra PENDING e informa simulação sem redirecionar.
- Erro do gateway e configuração ausente mostram mensagens claras e nova tentativa. Estado incerto oferece verificar a mesma solicitação.
- Cookie Secure/HttpOnly/SameSite=Lax verificado no navegador.
- Teclado, foco, região de status, imagens com alt e prefers-reduced-motion verificados.
- Sem JavaScript, botões permanecem desativados e há orientação visível. Corrigido o aviso que não era detectado como visível na primeira execução.
- Retorno com query status=PAID não altera o conteúdo nem libera acesso.
- Zero exceções JavaScript da aplicação. Dez requisições externas do ambiente local foram bloqueadas na execução final; nenhuma delas integra os ativos do projeto e nenhuma dependência externa foi adicionada ao navegador.
- Capturas e roteiro desta máquina: .qa/checkout-mock-1440.png, .qa/checkout-mock-320.png e .qa/check-checkout-ui.mjs (ignorados pelo Git).

## Limites e próxima homologação

Nenhuma chamada autenticada ao PagBank, cobrança, migração remota, credencial conectada, provisionamento, publicação ou envio ao GitHub. Respostas HTTP do gateway foram simuladas; os testes não atestam homologação da conta Sandbox.

PGlite utiliza uma conexão serializada: testa SQL real e concorrência HTTP, mas não reproduz disputa entre múltiplas conexões/instâncias Postgres remotas nem o transporte do SDK Netlify. Validar isso em ambiente Sandbox autorizado antes de exposição pública. Não foi usado banco temporário em Functions.

Confirmar hostname PAY e formato de resposta da conta Sandbox; a allowlist é restritiva e rejeita qualquer divergência. Não presumir idempotência externa. Worker, autenticação de webhooks, consulta financeira, reconciliação, recuperação de sessões e liberação VIP continuam pendentes; as respectivas rotas permanecem bloqueadas. A checagem de segredos é heurística, e a revisão de acessibilidade não substitui auditoria completa.

Implementação, fontes oficiais e execução: [checkout-sandbox.md](checkout-sandbox.md).

---


# Verificações — Prompt 4, 16/09/2026

## Resultado local

- `npm test`: 8 testes aprovados, nenhuma falha. Catálogo estrito e imutável; expiração de checkout; meses de calendário/fim de mês/ano bissexto; bloqueio de estados não pagos; evidência incompleta, valor/moeda divergentes, reembolso e disputa; validade temporal da consulta; assinatura Order/Charge adulterada; rotas permanentemente bloqueadas e sem rede mesmo com `PAYMENTS_ENABLED=true`.
- `npm run check`: sintaxe dos módulos válida; pasta pública restrita a `dist/`; sete arquivos públicos, IDs, âncoras e ativos locais verificados. Varredura heurística sem indícios de segredos no conteúdo público.
- `git diff --check`: sem erro de whitespace. `.env` e `.env.production` ignorados; somente `.env.example` rastreado entre arquivos de ambiente. `.netlify/` também ignorado.
- Nenhuma dependência instalada, migração aplicada, credencial conectada ou requisição de pagamento executada.

## Landing e navegador

Prévia em localhost servindo somente `dist/`, com Edge headless já instalado. Rede externa bloqueada no teste; nenhum checkout aberto.

- Larguras 1440, 1024, 768, 390 e 320 px: sem overflow horizontal; três botões de plano desativados; âncora de planos e abertura do FAQ funcionam.
- Imagens com atributo alt; navegação pelo primeiro Tab e link “Pular para o conteúdo” verificada.
- `prefers-reduced-motion: reduce`: conteúdo de todas as áreas `.reveal` visível.
- Sem exceções JavaScript ou erros de console originados na aplicação. Houve seis tentativas bloqueadas de carregar script externo injetado pelo antivírus Kaspersky local; registradas separadamente, sem alterar a proteção do computador ou adicionar scripts ao projeto.
- O helper de UI integrado falhou ao inicializar o sandbox. A verificação foi realizada com Playwright e Edge locais já instalados. Capturas e script de QA estão em `.qa/`, ignorado pelo Git.

Hashes SHA-256 iguais antes/depois:

| Arquivo | SHA-256 |
| --- | --- |
| `dist/index.html` | `D2CF08BD8B6D44464D2662DD92CC3A46EE9500536888728A67FFE933AF4E1DBB` |
| `dist/assets/styles/base.css` | `60E87F69BF80A8D2F6C1AEF0C7C5ECAA7527CAF776F4A5AF1FFB0E6A495A1967` |
| `dist/assets/styles/identity.css` | `64B356A3A0AFD1BE4F06C9F5A71C9E1FA23203A4B7249887F03CC44EBD356E61` |
| `dist/assets/styles/motion.css` | `4DE5F74B709D95F551404E2784FE15E56CE8E90391F743364A41D5E21B711934` |
| `dist/assets/scripts/motion.js` | `7F4E4D9ACC8D27A9EC0EF1D77FE796C1D7D3C180B477AF9265F41822111DF1C7` |

## Limites da validação

Os testes são locais, sem PagBank/Netlify reais. Não validam autenticação de Checkout em sandbox, SDK Database, concorrência SQL, transações, migração em Postgres, fila/worker, identidade do comprador ou administração. Não havia `psql` local disponível; a migração está preparada e exige execução em banco isolado na próxima etapa. A checagem de segredos é heurística e os testes básicos de acessibilidade não substituem auditoria completa.

Os detalhes de implementação pendentes e critérios de homologação estão em `docs/payment-architecture.md` e `docs/pre-launch-checklist.md`. As Functions permanecem bloqueadas (503) até a implementação completa; testes aprovados não autorizam ativar pagamentos.

## Verificação do Prompt 6

- `npm test`: 44 testes, abrangendo regressão do checkout e 17 cenários de confirmação (alguns percorrem vários estados/casos). SQL de produção executado em PGlite somente de desenvolvimento; HTTP PagBank substituído por fixtures.
- `npm run check`: estrutura pública, sintaxe, IDs HTML, ativos, âncoras e varredura heurística de segredos.
- `scripts/check-confirmation-browser.mjs`: 40 combinações (oito estados × 1440, 1024, 768, 390 e 320 px), sessão inválida, teclado e retry seguro. Sem overflow, erros de JavaScript ou requisição externa do site. Injeção do antivírus local observada e bloqueada no teste; nenhum recurso externo foi autorizado.
- Capturas locais inspecionadas em `.qa/confirmation-PAID-1440.png` e `.qa/confirmation-PAID-320.png`; demais capturas e banco mock ficam ignorados pelo Git.
- O teste de navegador pode usar Playwright já instalado via `NOUR_QA_PACKAGE_JSON` (caminho para package.json que resolve Playwright), `NOUR_QA_BROWSER` (executável de teste) e `NOUR_QA_URL` (somente loopback; padrão 8766 com a prévia mock). Não adiciona Playwright ao site nem dependência de produção.
- Concorrência HTTP, deduplicação, rollback, leases vencidos e fencing foram simulados; PGlite tem uma conexão e não comprova contenção multiconexão de Postgres remoto.
- Não foram feitas chamadas autenticadas ao PagBank, pagamentos, publicação, provisionamento ou envio ao GitHub.
- Os contratos reais de coleção paginada de pagamentos e notificação CBKS ainda precisam de homologação. Ausência/divergência de evidência bloqueia confirmação. Ver [payment-confirmation.md](payment-confirmation.md).
