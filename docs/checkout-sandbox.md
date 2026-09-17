# Checkout Sandbox — Prompt 5

Implementação local de 16/09/2026. Este documento atualiza o estado do Prompt 4 somente para criação de checkout. Nenhuma publicação, conta, banco remoto, credencial ou cobrança foi criada/configurada nesta entrega.

## Contrato implementado

- `POST /api/checkout-session`: JSON vazio `{}`, mesma origem HTTPS, cria/reutiliza sessão. Cookie `__Host-nour-order` com 32 bytes aleatórios, Secure, HttpOnly, SameSite=Lax, Path=/ e validade de 24 h. Somente SHA-256 persistido. A sessão antecede a compra, para que uma resposta perdida não deixe pedido sem vínculo.
- `POST /api/checkouts`: corpo exclusivamente `{"planId":"mensal"}`, `semestral` ou `anual`; cookie e `Idempotency-Key` UUID v4 nos headers. Preço, quantidade, descrição, duração, retorno e status não são aceitos do navegador. Chaves JSON duplicadas, objetos extras e entradas fora da gramática fechada são rejeitados.
- 201: pedido criado; 200: resultado existente; 202: criação em andamento/incerta; 400/401/403/405/413/415: entrada recusada; 409: conflito ou revisão necessária; 429: limite/cooldown; 502: rejeição definitiva do gateway; 503: configuração/banco indisponível. Respostas não têm cache nem CORS permissivo.
- O resultado contém somente código público, modo, estado PENDING e link validado quando disponível. IDs internos e dados pessoais não são retornados.
- Os botões enviam apenas o plano, bloqueiam clique duplo, preservam a chave entre tentativas e usam Web Locks quando disponível. A proteção principal fica no banco, inclusive com chaves diferentes na mesma sessão.
- Mensagens usam região de status acessível, foco visível e botão de nova tentativa. Falha de rede reutiliza a mesma solicitação; 202 permite verificar novamente, sem recriar checkout.

## Catálogo e persistência

`server/payments/policy.mjs` define nomes, descrições, moeda BRL e snapshots:

| Plano | Valor enviado | Duração |
| --- | --- | --- |
| mensal | 10000 centavos (R$ 100) | 1 mês |
| semestral | 50000 centavos (R$ 500) | 6 meses |
| anual | 80000 centavos (R$ 800) | 12 meses |

Pagamento único, sem `recurrence_plan`. A vigência permanece vinculada à futura liberação manual. Checkout válido por duas horas. Pix e cartão em uma parcela são as opções solicitadas para Sandbox; condições comerciais definitivas permanecem pendentes.

Antes da rede, uma transação grava pedido PENDING, snapshot, sessão, tentativa CREATING e auditoria. UUID v4 interno vai em `reference_id`; código público usa 12 bytes aleatórios. A unicidade é assegurada no Postgres. Só depois do segundo commit, contendo ID e URL do gateway, o servidor entrega o link ao navegador.

`@netlify/database@2.0.1` é a única dependência direta de execução. Queries parametrizadas e `pool.connect()` mantêm BEGIN/COMMIT na mesma conexão. Pool reutilizado com até três conexões por instância; nenhum armazenamento local/memória de pedidos nas Functions. A migração 002 estende a 001, sem substituir o esquema anterior. Aplicar ambas em ordem somente num banco Sandbox isolado e previamente autorizado.

## Repetição, falhas e abuso

Uma tentativa vinculada a cada sessão impede criação adicional mesmo com nova chave. Mesmo plano/modo reutiliza o resultado; plano/modo diferente retorna 409. Pedido vencido ou sessão expirada não cria outro automaticamente. Essa restrição conservadora dura a sessão e precisa ser ampliada com reconciliação/recuperação nas próximas etapas.

Não pressupomos suporte a idempotência do provedor: a referência específica de Checkout não documenta `x-idempotency-key`. O UUID reservado para esse contrato não é enviado. Não há retry automático de POST.

- 400/401/403/422 do gateway: FAILED, retry manual após 10 s no mesmo pedido, até três retries além da tentativa inicial.
- Timeout, erro de rede, 5xx, 429, redirecionamento HTTP, JSON inválido ou resposta incompatível: UNKNOWN, tarefa durável MANUAL_REVIEW, sem repetir POST.
- Crash em CREATING: lease de 30 s; a próxima consulta transforma tentativa vencida em UNKNOWN.
- Falha de commit depois da rede: nenhum link devolvido; estado incerto bloqueia recriação. O reconciliador/operador futuro resolve a ambiguidade.
- A expiração do checkout não é usada como prova de ausência de pagamento.

Contadores Postgres, compartilhados entre instâncias, usam janelas de 60 s: checkout 5 por sessão, 20 por IP e 100 globais; sessão 20 por IP, 5 por sessão existente e 200 globais. Tentativas recusadas por limite continuam contabilizadas. IP vem exclusivamente de `context.ip`, protegido por HMAC com segredo independente; nenhum IP bruto é persistido. Contadores antigos são limpos em lotes nas requisições aceitas. Esses limites são proteção inicial, não substituem avaliação operacional/DDoS da plataforma antes de exposição pública.

Origin e URL da requisição precisam corresponder exatamente a `SITE_ORIGIN`. Fetch Metadata, quando presente, exige same-origin. Sem origem válida ou cookie na compra, falha fechada. Somente POST/JSON UTF-8 não comprimido, corpo de até 1 KiB medido no stream e leitura limitada a 3 s. Resposta do gateway: até 64 KiB e chamada de até 8 s; redirects HTTP não são seguidos. Logs da aplicação não contêm corpos, cookies, tokens, erros brutos ou dados completos de comprador.

## URLs e limites desta integração

A origem da API é fixa em código: `https://sandbox.api.pagseguro.com/checkouts`. Não existe rota para produção nem variável que altere esse endpoint.

Retorno e redirecionamento usam `SITE_ORIGIN + /checkout-return.html`. A página existe, não interpreta query strings como pagamento e não libera VIP. As duas listas de notificação usam `SITE_ORIGIN + /api/webhooks/pagbank`, com limite de 100 caracteres validado na configuração.

A rota de webhook permanece 503, assim como a consulta de estado financeiro: não confirmar recebimento de eventos sem autenticação, persistência e reconciliação. Configurar as URLs nesta etapa não significa que as notificações já são processadas.

A allowlist técnica do link PAY exige HTTPS, hostname exato `sandbox.pagamento.pagseguro.uol.com.br`, caminho `/pagamento` e somente parâmetro `code`; não permite produção, QA, userinfo, portas não padrão, fragmentos ou hosts parecidos. **Esse host ainda precisa ser confirmado na resposta real da conta Sandbox.** A documentação consultada contém exemplos PAY de produção e QA; não fornece garantia do hostname Sandbox para a conta. A allowlist é uma hipótese restritiva a homologar, não um contrato já verificado. Resposta com outro host fica UNKNOWN, sem redirecionamento nem tentativa automática. A URL nunca é construída a partir do ID: apenas a resposta validada do provedor é usada. Links sintéticos aparecem exclusivamente nos testes HTTP interceptados.

## Executar sem credenciais

```sh
npm ci --ignore-scripts
npm test
npm run check
npm run preview:checkout
```

A prévia em `http://127.0.0.1:8766` serve apenas `dist/` e simula a ponte HTTP local. Não publica, não lê tokens nem arquivos .env e bloqueia a chamada ao gateway por código. Postgres WASM `@electric-sql/pglite@0.5.8` é uma dependência somente de desenvolvimento, usada nos testes e nessa prévia, fora das Functions. Na prévia, dados fictícios persistem em `.qa/checkout-mock-postgres`, ignorado pelo Git. Não usar esse mecanismo como banco hospedado.

Nas Functions, token ausente seleciona modo mock: grava pedido com `gateway_mode=mock`, ID/URL de checkout nulos e status PENDING. A interface informa simulação concluída, sem redirecionar. Banco, origem HTTPS e segredo de abuso continuam obrigatórios; se ausentes, retorna 503. Não há fallback de banco para memória.

Para teste futuro da integração real, configurar no painel protegido: ambiente sandbox, origem HTTPS do site Sandbox, token Sandbox e segredo aleatório de abuso com pelo menos 32 caracteres. Database fornece sua conexão gerenciada. Não enviar valores pelo chat, versionar .env ou disponibilizar segredos para previews não confiáveis. Conferir conta/cobrança antes de provisionar Database. Nada foi configurado nesta etapa.

## Fontes oficiais consultadas antes da implementação

- [Criar Checkout](https://developer.pagbank.com.br/reference/criar-checkout): endpoint Sandbox, referência, expiração e callbacks.
- [Objeto Checkout](https://developer.pagbank.com.br/reference/objeto-checkout): item/descrição, valor em centavos, customer_modifiable e links.
- [Checkout e Link de Pagamento](https://developer.pagbank.com.br/docs/checkout): fluxo, PAY e configuração de parcelas.
- [Webhooks Checkout](https://developer.pagbank.com.br/reference/webhooks-checkout): notificações separadas e estados.
- [Functions API](https://docs.netlify.com/build/functions/api/): Request/Response e context.ip.
- [Database API](https://docs.netlify.com/build/data-and-storage/netlify-database/api/): getDatabase, pool e transações.

O resultado dos testes e os limites de homologação constam em `docs/payment-verification.md`. Produção, processamento de webhooks, reconciliação e liberação do VIP permanecem fora do Prompt 5.
