# Checklist antes da publicação

## Conteúdo e comercial

- [ ] Categoria do serviço validada juridicamente.
- [ ] Entregas e frequência confirmadas.
- [ ] Regras de cobrança, cancelamento e reembolso confirmadas.
- [ ] Benefícios de cada plano confirmados.
- [ ] Três Links de Pagamento oficiais do PagBank recebidos, associados ao plano correto e validados sem efetuar compra real.
- [ ] Contatos, domínio e redes sociais oficiais confirmados.

## Segurança

- [ ] Nenhum token, senha, segredo ou `.env` real está versionado.
- [ ] Nenhum token, segredo ou credencial PagBank existe no projeto.
- [ ] Links externos usam as proteções adequadas.
- [ ] A landing não contém formulários financeiros, webhooks ou endpoints de pagamento.
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


## Pagamentos externos — bloqueios antes da ativação

- [ ] Cada CTA aponta diretamente para o Link de Pagamento oficial do PagBank do plano correspondente.
- [ ] Links usam HTTPS e o domínio oficial esperado do PagBank, sem redirecionador intermediário.
- [ ] Mensagens e termos deixam claro que o pagamento é processado externamente pelo PagBank.
- [ ] Processo operacional de conferência direta no PagBank e liberação manual do VIP definido pela Nour.
- [ ] Cliente não é orientado a enviar comprovante nem a avisar Samuel após o pagamento.
- [ ] WhatsApp permanece apresentado somente como canal de dúvidas, objeções e suporte.
- [ ] Não existem banco, pedidos, painel, autenticação administrativa, webhook, polling, endpoints financeiros, Functions de pagamento, token PagBank ou dados financeiros no projeto.
