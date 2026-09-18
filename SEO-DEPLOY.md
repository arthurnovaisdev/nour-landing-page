# SEO e indexação antes do deploy

## Imagem social

A imagem social definitiva está integrada em `dist/assets/social/nour-social-preview.jpg`, no formato JPEG e com 1200 × 630 px. A URL pública prevista é `https://nourcrypto.com.br/assets/social/nour-social-preview.jpg`.

A página principal usa essa URL em `og:image` e `twitter:image`, com `twitter:card` configurado como `summary_large_image`.

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
