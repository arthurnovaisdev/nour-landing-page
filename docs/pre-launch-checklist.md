# Checklist antes da publicação

## Conteúdo e comercial

- [ ] Categoria do serviço validada juridicamente.
- [ ] Entregas e frequência confirmadas.
- [ ] Regras de cobrança, cancelamento e reembolso confirmadas.
- [ ] Benefícios de cada plano confirmados.
- [x] Três Links de Pagamento oficiais do PagBank recebidos, associados aos valores aprovados e validados sem efetuar compra real: mensal R$ 100, semestral R$ 500 e anual R$ 900.
- [x] `monthlyPaymentUrl`, `semiannualPaymentUrl` e `annualPaymentUrl` preenchidos em `dist/assets/scripts/config.js`.
- [ ] Contatos e redes sociais oficiais confirmados; domínio oficial definido como `nourcrypto.com.br` e ainda pendente de vinculação na Netlify/DNS.

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
- [ ] `/obrigado` testada diretamente, sem parâmetros e sem qualquer mensagem de confirmação técnica do pagamento.
- [ ] Metadados, favicon, performance e imagens revisados.
- [ ] Termos, privacidade e disclaimer revisados juridicamente.

## Entrega

- [ ] Branch e histórico revisados.
- [ ] Repositório remoto autorizado pelo responsável.
- [ ] Publicação autorizada explicitamente.
- [ ] Verificação final realizada no domínio de produção.


## Pagamentos externos — bloqueios antes da ativação

- [x] Cada CTA aponta diretamente para o Link de Pagamento oficial do PagBank do plano correspondente.
- [x] Links usam HTTPS e o domínio oficial esperado do PagBank, sem redirecionador intermediário da Nour.
- [ ] Mensagens e termos deixam claro que o pagamento é processado externamente pelo PagBank.
- [ ] Processo operacional de conferência direta no PagBank e liberação manual do VIP definido pela Nour.
- [x] URL final `https://nourcrypto.com.br/obrigado` revisada (página informativa, não confirmação de pagamento).
- [ ] Cliente não é orientado a enviar comprovante nem a avisar Samuel após o pagamento.
- [ ] WhatsApp permanece apresentado somente como canal de dúvidas, objeções e suporte.
- [ ] Não existem banco, pedidos, painel, autenticação administrativa, webhook, polling, endpoints financeiros, Functions de pagamento, token PagBank ou dados financeiros no projeto.
