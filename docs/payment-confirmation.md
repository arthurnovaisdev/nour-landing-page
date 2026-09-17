# Confirmação segura — Prompt 6

Implementação local em 17/09/2026 (UTC; 16/09 em America/Bahia). Sem publicação, credenciais, provisionamento, cobrança ou alteração remota. Este documento atualiza os limites históricos dos Prompts 4/5. Produção continua bloqueada em código.

## Rotas e confiança

- `POST /api/webhooks/pagbank`: Function exclusiva, HTTPS na origem configurada, sem query, POST JSON UTF-8 não comprimido, até 64 KiB no stream e 3 s de leitura. Rejeita chamadas com Origin de navegador. Não há allowlist de IP inventada: IP confiável da plataforma serve somente ao limite de abuso. Autenticidade criptográfica e consulta autenticada são as provas exigidas.
- Checkout/Order: `x-authenticity-token = SHA256(token + "-" + bytes originais)`, comparação constante. Corpo não é convertido/normalizado antes da verificação.
- Chargeback: `x-payload-signature`, ECDSA SHA-256, uma assinatura válida entre até oito. Chave X.509/SPKI obtida por GET autenticado no Sandbox; cache por token de 60 s. Mudança de chave fica fechada até renovar o cache. Os contratos são separados; cabeçalhos simultâneos e fallback entre famílias são recusados.
- JSON inválido, chaves duplicadas (inclusive escapadas), BOM, UTF-8 inválido, profundidade excessiva, IDs inválidos e referências desconhecidas não atualizam pedidos. Dados pessoais presentes no corpo são descartados após validação; não persistimos corpo bruto.
- A inbox armazena somente UUID local, ID de recurso, hash SHA-256 do corpo, esquema de autenticação e instantes. Unicidade `(environment,payload_sha256)` torna redelivery idempotente. Checkout não documenta um ID próprio de evento; não inventamos um. Recurso e referência nunca são usados para conceder acesso por si só.
- Evento e job `RECONCILE` são inseridos na mesma transação. ACK 204 somente após commit; banco indisponível devolve 503. Repetição autenticada devolve 204 sem duplicar jobs/operações. Formatação diferente pode gerar outro job, mas a reconciliação e a liberação manual continuam idempotentes.
- GETs usam somente origem Sandbox fixa, caminhos montados com IDs validados, bearer no servidor e `redirect:error`. Nunca seguimos links do payload. Há limites de resposta (256 KiB), tempo por chamada (6 s), orçamento de rede por reconciliação (20 s), páginas e recursos.

## Reconciliação e fila

`payment-reconcile.mjs` é uma Scheduled Function de minuto em minuto, sem URL pública de invocação em deploy. Processa um job por execução, respeitando o limite de 30 s da plataforma. Atualiza também pedidos pendentes e pagos; a consulta do comprador pode antecipar o mesmo processamento. Não depende do comprador retornar ao site. Nada foi agendado remotamente nesta entrega.

Jobs possuem leases de 90 s, token de posse, contador, backoff de 10/20/40/80 s e limite de cinco tentativas. Crash permite retomada após o lease. Resultado atrasado não é aplicado se perdeu o lease ou se a versão do pedido mudou durante a consulta. Esgotamento ou inconsistência geram tarefa `MANUAL_REVIEW`; falhas mantêm a confirmação bloqueada. Não existe painel/alerta externo implementado nesta etapa: operação precisa acompanhar jobs DEAD e tarefas manuais antes de qualquer exposição pública.

A consulta verifica checkout armazenado, referência UUID do pedido, item/plano, quantidade, snapshot de valor, BRL, pedidos e cobranças associados, soma capturada e resumo de estornos. Não aceita alterações de preço/plano do navegador. Múltiplas capturas, status desconhecido, coleção ausente, referência divergente ou paginação inconclusiva vão para revisão. O limite conservador de 20 pedidos por checkout exige revisão quando ultrapassado. Links e cabeçalhos de produto recebidos não substituem esses vínculos.

| Resultado confirmado na API | Tratamento |
| --- | --- |
| WAITING | Aguardando; acesso bloqueado |
| IN_ANALYSIS ou AUTHORIZED | Em análise; acesso bloqueado |
| PAID, valor exato, sem disputa/estorno/revisão | Confirmação financeira; VIP aguarda liberação manual |
| DECLINED / CANCELED | Retry explícito no checkout ainda ativo, após nova consulta |
| EXPIRED, sem cobrança pendente/capturada | Retry explícito encerra vínculo da tentativa antiga e permite nova escolha de plano |
| Estorno parcial | Revisão, elegibilidade bloqueada e VIP existente suspenso |
| Estorno integral | REFUNDED, bloqueio e suspensão |
| Chargeback consultado e vinculado | CHARGEBACK, bloqueio persistente; inclusive WON/APPROVED exigem revisão para reativar |
| Falha de provedor/banco / prova vencida | Erro temporário; nenhuma confirmação positiva |

PAID não é rebaixado por um webhook antigo. Reembolso confirmado nunca é apagado por um PAID posterior. Captura após expiração ou após substituir a tentativa exige revisão. A substituição preserva pedido, eventos e auditoria anteriores; evento tardio continua ligado ao pedido original. Retry não cobra nem recria automaticamente: devolve o PAY já validado, ou permite uma nova escolha explícita. Não reutiliza checkout de pedido já pago.

O estado `nour_vip_access` só é criado como `WAITING_MANUAL`. Em estorno/disputa/revisão, um ACTIVE existente passa a SUSPENDED e uma tarefa `MANUAL_REMOVE` única é gravada. **Isso bloqueia o acesso no modelo local; não remove pessoas de um grupo externo.** A remoção efetiva depende de Samuel. Não existe código que conceda ACTIVE ou envie mensagem/convite.

## Consulta e página

`GET /api/orders/status` usa cookie `__Host-nour-order` já existente: 32 bytes aleatórios, Secure, HttpOnly, SameSite=Lax, duração de 24 h, somente hash no Postgres. Requer sessão válida vinculada, sem identificador na URL, código público como autenticação, CORS permissivo ou credencial em localStorage. Código desconhecido, cookie ausente e expirado não revelam existência do pedido. Proteção de mesma origem, no-store e limites persistentes: 30/min/sessão, 60/min/IP, 600/min globais. Webhook: 300/min/IP e 600/min globais; homologar capacidade/rajadas da conta.

Resposta mínima: `{state, canRetry, access:"BLOCKED", mode}`. Não expõe preço, dados pessoais, IDs internos, IDs PagBank, payload ou token. A tela só mostra PAID com prova recente, sem reconciliação pendente. A consulta tenta atualizar prova com mais de 60 s; política de elegibilidade geral expira em 5 min. Sessão vencida não é renovada silenciosamente para um pedido.

`checkout-return.html` contempla aguardo, análise, confirmado, recusado, cancelado, expirado, erro temporário, sessão indisponível e revisão. Ignora query/fragmento como evidência. Poll a cada 15 s, no máximo 20 consultas por ciclo, pausa em aba oculta; respeita Retry-After. Reentrada invalida a exibição anterior. Live region, teclado, foco visível, botões sem clique duplo, mobile 320 px e movimento reduzido. Não há link de grupo nem WhatsApp pós-pagamento, inclusive em Sandbox PAID.

## Contratos que ainda precisam de homologação real

A documentação oficial de `GET /checkouts/{id}` descreve todos os pagamentos e `offset/limit`, mas seu exemplo OpenAPI público não mostra a coleção de pagamentos. O adaptador usa **`orders: [{id: ORDE_...}]` como envelope restritivo de simulação a homologar**, e exige a coleção inclusive vazia. Não é uma afirmação de que esse formato já foi comprovado na conta. Se o PagBank responder de outra forma ou sem a coleção, a implementação recusa confirmar e exige revisão; não usa somente o ORDE do webhook como substituto de uma lista completa. Confirmar e ajustar esse envelope com evidência oficial/Sandbox é condição obrigatória antes de conectar a integração.

A nova API documenta o objeto Chargeback e assinatura ECDSA, mas a entrega exata do envelope e o preenchimento de `transaction.reference_id` para Checkout precisam ser homologados. O receptor aceita o objeto CBKS documentado com referência UUID da Nour; referência nula/envelope desconhecido é recusado. A preferência CHARGEBACK precisa ser configurada posteriormente na conta. Não presumir que os eventos tradicionais de Checkout incluam disputas ou que a ausência de webhook prove ausência de chargeback. O contrato legado XML pós-transacional está fora deste adaptador e não é aceito como JSON.

Continuam pendentes: hostname PAY real, autenticação de cada família na conta, isolamento e grants do Database, concorrência multiconexão, volume/monitoramento, custos e eventual entrega manual. Mocks comprovam as invariantes locais, não a homologação do provedor. Produção segue bloqueada e nenhuma credencial deve ser enviada pela conversa.

## Executar localmente

1. `npm test`: SQL real em PGlite de desenvolvimento + HTTP interceptado; nenhuma chamada PagBank.
2. `npm run check`: sintaxe, links/âncoras, fronteira pública e varredura heurística de segredos.
3. `npm run preview:checkout`: prévia loopback, banco de desenvolvimento isolado e gateway proibido em código. A simulação sem token fica aguardando; não há botão público que force PAID.

Migração aditiva `202609170003_payment_confirmation.sql`, após 001 e 002. Foi aplicada somente aos bancos efêmeros dos testes. Não provisionar nem aplicar remotamente nesta etapa. Não foi adicionada dependência.

## Fontes oficiais consultadas

- [Webhooks Checkout](https://developer.pagbank.com.br/reference/webhooks-checkout): famílias e estados de Checkout.
- [Autenticidade SHA-256](https://developer.pagbank.com.br/reference/confirmar-autenticidade-da-notificacao): bytes originais e x-authenticity-token.
- [Consulta de Checkout](https://developer.pagbank.com.br/reference/consultar-checkout): paginação; lacuna do exemplo anotada acima.
- [Consulta de pedido](https://developer.pagbank.com.br/reference/consultar-pedido) e [Objeto Charge](https://developer.pagbank.com.br/reference/objeto-charge): cobrança, captura, moeda e estorno.
- [Autenticidade ECDSA](https://developer.pagbank.com.br/reference/validacao-de-autenticidade): chave pública, múltiplas assinaturas e rotação.
- [Chargeback](https://developer.pagbank.com.br/docs/chargeback), [Objeto Chargeback](https://developer.pagbank.com.br/reference/objeto-chargeback), [Consultar Chargeback](https://developer.pagbank.com.br/reference/consultar-chargeback): vinculação e consulta da disputa.
- [Scheduled Functions](https://docs.netlify.com/build/functions/scheduled-functions/): agendamento, limite de 30 s e ausência de URL pública.
