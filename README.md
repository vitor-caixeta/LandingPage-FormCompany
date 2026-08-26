# Form Racing — versão local

Versão enxuta em React + Vite, sem as dependências de publicação do Cloudflare/Vinext.

## Requisitos

- Node.js 20.19.0 ou superior
- npm 10 ou superior

Seu Node `v20.20.2` é compatível.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra o endereço mostrado pelo terminal (normalmente `http://localhost:5173`).

## Gerar a versão de produção

```bash
npm run build
npm run preview
```

## Editar os Reels

Abra `src/App.tsx` e substitua os sete itens do array `reelLinks` pelos links reais do Instagram, no formato:

```text
https://www.instagram.com/reel/SEU_CODIGO/
```

As cores ficam no início de `src/index.css`, nas variáveis `--ink`, `--paper`, `--acid` e `--muted`.
