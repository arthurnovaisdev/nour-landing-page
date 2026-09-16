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
