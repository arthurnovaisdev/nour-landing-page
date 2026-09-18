# SEO e indexação antes do deploy

## Imagem social pendente

Ainda não existe uma imagem definitiva e exclusiva para compartilhamento social. Não foi usado logo, screenshot ou preview de layout como substituto.

Antes do deploy, exportar a arte aprovada com:

- caminho público: `dist/assets/social/nour-social-preview.jpg`;
- URL: `https://nourcrypto.com.br/assets/social/nour-social-preview.jpg`;
- dimensão recomendada: `1200 × 630 px` (`1.91:1`);
- formato: JPG ou PNG otimizado;
- conteúdo: identidade oficial Nour, texto curto legível e sem promessas de rentabilidade.

Após a aprovação, adicionar `og:image`, `og:image:width` (`1200`), `og:image:height` (`630`) e `og:image:alt`. Trocar `twitter:card` de `summary` para `summary_large_image` e adicionar `twitter:image` e `twitter:image:alt`. Não manter duas declarações de `twitter:card`.

## Search Console depois do deploy

O projeto estará pronto para verificar o domínio real, enviar `https://nourcrypto.com.br/sitemap.xml` e usar a inspeção de URL. Nenhum token fictício deve ser adicionado.

## Google Tag Manager depois do recebimento do ID

O GTM não está instalado. Seletores estáveis preparados:

- `[data-track="plan-monthly"]`;
- `[data-track="plan-semiannual"]`;
- `[data-track="plan-annual"]`;
- `[data-track="whatsapp"]`.

Os atributos não contêm dados pessoais. O tracking futuro deve medir apenas o clique/saída para o PagBank, nunca uma confirmação de compra.

Ao instalar o container real, revisar também a Content Security Policy de `netlify.toml` para liberar somente os domínios estritamente necessários do GTM/Google e manter o restante da política restritivo. Essa liberação não foi antecipada sem o ID e a configuração aprovados.
