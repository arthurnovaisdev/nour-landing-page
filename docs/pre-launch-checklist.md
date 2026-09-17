# Checklist antes da publicação

## Conteúdo e comercial

- [ ] Categoria do serviço validada juridicamente.
- [ ] Entregas e frequência confirmadas.
- [ ] Regras de cobrança, cancelamento e reembolso confirmadas.
- [ ] Benefícios de cada plano confirmados.
- [ ] Checkouts exclusivos por pedido homologados no sandbox; links retornados pelo provedor validados, sem compra real em testes.
- [ ] Contatos, domínio e redes sociais oficiais confirmados.

## Segurança

- [ ] Nenhum token, senha, segredo ou `.env` real está versionado.
- [ ] Segredos do PagBank existem somente no servidor, caso a API seja utilizada.
- [ ] Links externos usam as proteções adequadas.
- [ ] Formulários e webhooks validam entradas e rejeitam métodos ou formatos inesperados.
- [ ] Dependências e scripts externos foram justificados e revisados.
- [ ] Conteúdo sensível não aparece em logs ou mensagens de erro.

## Qualidade

- [ ] Desktop, tablet e celular testados.
- [ ] Não existe rolagem horizontal acidental.
- [ ] Navegação por teclado e foco visível funcionam.
- [ ] Contraste e descrições acessíveis revisados.
- [ ] `prefers-reduced-motion` respeitado.
- [ ] Links, âncoras, FAQs, WhatsApp e CTAs testados.
- [ ] Console do navegador sem erros.
- [ ] Metadados, favicon, performance e imagens revisados.
- [ ] Termos, privacidade e disclaimer revisados juridicamente.

## Entrega

- [ ] Branch e histórico revisados.
- [ ] Repositório remoto autorizado pelo responsável.
- [ ] Publicação autorizada explicitamente.
- [ ] Verificação final realizada no domínio de produção.


## Pagamentos — bloqueios antes da ativação

- [ ] Conta Netlify Database elegível, franquia, custo atual, backups e limites conferidos.
- [ ] Migração testada em Postgres isolado; transações, rollback e concorrência aprovados.
- [ ] Adaptadores, sessões HttpOnly, CSRF e limitação persistente de requisições implementados.
- [ ] Assinatura de cada família de webhook e idempotência do endpoint Checkout homologadas.
- [ ] Evento repetido, replay e evento fora de ordem não duplicam/liberam acesso.
- [ ] Só PAID consultado no servidor, com IDs/valor/moeda corretos, abre pós-pagamento.
- [ ] Falhas de rede/banco e criação ambígua não produzem checkout duplicado ou falso sucesso.
- [ ] Worker, reconciliação, alertas e recuperação de jobs testados.
- [ ] Reembolso parcial/integral e chargeback bloqueiam elegibilidade e geram tarefa manual.
- [ ] Área privada com MFA permite a Samuel conferir identidade, liberar uma vez e auditar.
- [ ] Validade 1/6/12 meses, início manual e ausência de recorrência confirmados nos termos.
- [ ] Expiração do acesso gera tarefa de remoção, sem alegar remoção automática no WhatsApp.
- [ ] Código público não permite consultar dados privados ou comprovar pagamento.
- [ ] Credenciais só no servidor e isolamento de sandbox/produção/previews revisado.
- [ ] Política de retenção financeira/privacidade definida antes de persistir dados reais.
- [ ] Habilitação de produção somente após implementar e homologar o fluxo completo. Botões do Prompt 5 limitados a Sandbox/mocks.

## Etapa local do Prompt 5

- [x] Function de checkout aceita apenas plano, com valores definidos no servidor.
- [x] Sessão, limites persistentes, reserva transacional e reutilização de checkout implementados.
- [x] Mocks sem credenciais e página de retorno sem liberação de acesso implementados.
- [x] URLs fixas do servidor; POST para produção bloqueado por código.
- [ ] Homologar hostname PAY e respostas reais da conta Sandbox, sem cobranças reais.
- [ ] Validar SDK Netlify/concorrência multiconexão em banco Sandbox autorizado.
- [ ] Implementar e homologar notificações, reconciliação, recuperação e painel nas etapas correspondentes.

## Etapa local do Prompt 6

- [x] Webhook separado com assinatura documentada, limites, inbox/job atômicos e idempotência.
- [x] Consulta servidor a servidor com validação de vínculo/valor/moeda e bloqueio em divergências.
- [x] Lease, fencing, retries limitados e revisão de falhas.
- [x] Consulta mínima por cookie opaco com expiração; página responsiva com os estados solicitados.
- [x] Estorno/chargeback bloqueiam elegibilidade e suspendem acesso local; tarefa manual deduplicada.
- [x] Todos os estados simulados sem credenciais nem pagamentos; produção bloqueada.
- [ ] Homologar coleção paginada de pagamentos do Checkout: envelope público insuficientemente detalhado; adaptador falha fechado.
- [ ] Homologar envelope CBKS/ECDSA e referência do Checkout; configurar preferência CHARGEBACK em ambiente autorizado.
- [ ] Validar concorrência multiconexão, worker na Netlify e alertas operacionais antes de exposição pública.

Detalhes: [payment-confirmation.md](payment-confirmation.md). Os itens acima não autorizam publicação ou provisionamento.
