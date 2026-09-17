# Segurança

## Princípios

- O navegador recebe somente informações que podem ser públicas.
- Tokens, credenciais e segredos não pertencem a este projeto estático.
- O repositório nunca deve conter arquivos `.env` preenchidos.
- Dependências externas são evitadas quando recursos nativos atendem ao projeto.
- Toda nova integração precisa ser revisada antes de ser habilitada em produção.

## PagBank

O projeto Nour é uma landing page comercial. Os pagamentos são processados externamente pelo PagBank. A landing page não processa, confirma nem armazena pagamentos. A conferência e a liberação do acesso ao grupo VIP são operacionais e realizadas manualmente pela Nour.

Somente Links de Pagamento oficiais do PagBank, um para cada plano, podem ser publicados. O projeto não deve receber token PagBank, webhook, API financeira, identificador de pedido ou dados financeiros.

## Links e contato

- Links externos abertos em nova aba devem usar `rel="noopener noreferrer"`.
- Números de telefone e mensagens pré-preenchidas são considerados dados públicos do site.
- Parâmetros recebidos pela URL não devem ser inseridos diretamente no HTML.

## Relato de vulnerabilidade

Não publique detalhes de uma vulnerabilidade em issues públicas. Registre o problema internamente com passos de reprodução, impacto e arquivos afetados até que um canal privado oficial seja definido.


## Fronteira estática e pagamentos

- Apenas `dist/` pode ser servida publicamente. Não publicar a raiz, documentos internos, arquivos de ambiente, dumps ou backups.
- A Netlify é usada somente para hospedagem estática da landing page.
- A página não coleta cartão, CVV, CPF, e-mail, telefone ou qualquer dado financeiro.
- A página não possui backend, persistência, autenticação administrativa ou fluxo pós-pagamento.
- Samuel confere a venda diretamente no PagBank e libera manualmente o acesso. O cliente não precisa enviar comprovante nem avisar que pagou.
- O WhatsApp público é exclusivamente um canal de dúvidas, objeções e suporte; não é etapa obrigatória da compra.
