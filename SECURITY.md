# Segurança

## Princípios

- O navegador recebe somente informações que podem ser públicas.
- Tokens, credenciais e segredos de webhook permanecem exclusivamente no servidor.
- O repositório nunca deve conter arquivos `.env` preenchidos.
- Dependências externas são evitadas quando recursos nativos atendem ao projeto.
- Toda nova integração precisa ser revisada antes de ser habilitada em produção.

## PagBank

Links públicos de checkout podem ser usados nos botões dos planos. Uma integração direta com a API do PagBank deve passar por uma função de servidor. O token da API nunca pode ser incluído em HTML, CSS, JavaScript do navegador, URL, mensagem de erro ou ferramenta de analytics.

Webhooks devem validar autenticidade, formato, método HTTP, tipo de conteúdo e identificador do evento antes de alterar qualquer estado. Eventos repetidos precisam ser tratados de forma idempotente.

## Links e contato

- Links externos abertos em nova aba devem usar `rel="noopener noreferrer"`.
- Números de telefone e mensagens pré-preenchidas são considerados dados públicos do site.
- Parâmetros recebidos pela URL não devem ser inseridos diretamente no HTML.

## Relato de vulnerabilidade

Não publique detalhes de uma vulnerabilidade em issues públicas. Registre o problema internamente com passos de reprodução, impacto e arquivos afetados até que um canal privado oficial seja definido.

