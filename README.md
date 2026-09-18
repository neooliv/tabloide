# Gerador de Tabloide

Ferramenta simples para montar tabloides/encartes de produtos (grade A4, 12 produtos por página) a partir de uma planilha Excel ou de cadastro manual, com recorte de imagem em quadrado e exportação em PDF/PNG.

Feita para rodar **sem servidor** (100% front-end), pronta para hospedar no GitHub Pages e evoluir depois para dentro do WordPress.

## Como testar localmente

Como o app usa `fetch`/módulos de arquivo local, o ideal é servir por um servidor HTTP simples (abrir o `index.html` direto do disco funciona na maior parte das vezes, mas alguns navegadores bloqueiam certas APIs em `file://`):

```bash
cd gerador-tabloide
python3 -m http.server 8080
# depois acesse http://localhost:8080
```

## Como hospedar no GitHub Pages

1. Crie um repositório novo e suba esta pasta (`index.html`, `css/`, `js/`).
2. Em **Settings → Pages**, escolha a branch `main` e a pasta raiz (`/`).
3. Pronto — o GitHub gera uma URL pública (`https://seuusuario.github.io/repo/`) sem precisar de nenhum backend.

## Estrutura do projeto

```
gerador-tabloide/
├── index.html          → estrutura das 3 etapas (wizard) + templates
├── css/styles.css       → estilos e o layout A4 do tabloide
├── js/db.js             → salva as imagens já recortadas (IndexedDB), por EAN/código
├── js/editor.js         → editor de recorte (pan + zoom), retorna só quando "Aplicar" é clicado
└── js/app.js            → import da planilha, lista de produtos, geração das páginas, exportação
```

## Decisões de design (e por que evitam o bug que tínhamos no app anterior)

- **A imagem nunca é salva antes do recorte.** `ImageEditor.open()` é uma Promise que só entrega o `dataURL` final quando o usuário clica "Aplicar". Se ele cancelar, nada é gravado — nem no estado, nem no banco de imagens. Isso evita que uma imagem crua (não quadrada) "vaze" para a exportação ou fique salva para reaproveitar no próximo produto do mesmo código.
- **Toda imagem que entra na grade já chega quadrada** (recorte feito no canvas do editor, 900×900, com fundo branco). Isso importa porque a exportação em PNG usa `html2canvas`, que não é confiável para *aplicar* `object-fit`/`aspect-ratio` — mas como a imagem-fonte já é um quadrado perfeito, não existe o que distorcer, independente do que a lib suporta.
- **Exportar em PDF usa a impressão nativa do navegador** (`window.print()` + CSS `@media print`), não `html2canvas`. Isso dá um PDF com texto vetorial (nítido em qualquer zoom) e elimina de vez o risco de distorção de imagem no PDF — o `html2canvas` fica reservado só para o PNG (necessário porque PDF não dá pra "printar" como imagem para WhatsApp/redes sociais).
- **Biblioteca de imagens por código (EAN)**: ao importar uma planilha, o app procura no `IndexedDB` se aquele código já teve imagem recortada antes e reaproveita automaticamente — mesmo comportamento do app anterior, mas sem o vazamento de imagem crua.

## Reconhecimento de colunas da planilha

O `app.js` procura, nas primeiras linhas da planilha, um cabeçalho contendo pelo menos duas destas palavras-chave (sem acento, case-insensitive):

| Coluna | Palavras-chave aceitas |
|---|---|
| Código/EAN | `ean`, `codigo`, `cod` |
| Descrição | `descri`, `produto`, `nome` |
| Marca | `marca` |
| Preço | `preco`, `valor`, `pc.liq` |

Não precisa ser em ordem fixa — o app lê pelo **nome do cabeçalho**, não pela posição da coluna. Se sua planilha usa nomes diferentes, ajuste o objeto `COL_KEYWORDS` no topo de `js/app.js`.

## O que ainda é simplificado (comparado ao app anterior) — e como estender

Peguei o essencial para funcionar bem e ficar fácil de mexer. Itens que dava pra portar do app anterior, se fizerem falta:

- **Múltiplas marcas/cabeçalhos por campanha** — hoje o tabloide tem um único título/subtítulo/cor para o catálogo inteiro. Para reintroduzir cabeçalhos diferentes por marca, dá pra agrupar `state.products` por `p.brand` e gerar um cabeçalho por grupo antes de fatiar em páginas de 12.
- **Drag & drop para reordenar produtos** — não incluí a lib de reorder por arrastar; hoje a ordem é a da planilha (ou da criação manual). Se precisar, dá pra portar a lógica de `form_reorder.js` do app anterior.
- **Compartilhar direto no WhatsApp** — removi o botão específico porque depende de Web Share API (só funciona bem em mobile/HTTPS); o PNG gerado já pode ser compartilhado manualmente.

## Caminho de evolução para o WordPress

A ideia de guardar as imagens no `IndexedDB` (só no navegador de quem está usando) funciona bem para uso individual, mas não é compartilhada entre pessoas/computadores. Quando for para o WordPress, dá pra trocar **só o `js/db.js`** por uma versão que fale com a Biblioteca de Mídia via REST API, mantendo a mesma assinatura (`getImage(key)` / `saveImage(key, dataURL)`) — o resto do app não muda:

1. Criar um Custom Post Type ou usar post meta para associar `key` (EAN) → ID do anexo de mídia.
2. Um endpoint REST customizado (`register_rest_route`) que:
   - `GET /tabloide/v1/imagem/{key}` → retorna a URL da imagem salva (se existir);
   - `POST /tabloide/v1/imagem` → recebe `{ key, dataURL }`, decodifica o base64, salva via `wp_insert_attachment` e associa ao `key`.
3. Embutir o app como um **shortcode** que carrega `index.html` (adaptado) dentro de um `<div>`, enfileirando `css/styles.css` e os `js/*.js` via `wp_enqueue_script`/`wp_enqueue_style` (nesse ponto, o `xlsx` e o `html2canvas-pro` podem continuar vindo de CDN ou ser baixados para dentro do tema/plugin).
4. Usar `wp_localize_script` para passar o `nonce` de autenticação da REST API para o `js/db.js`.

Isso mantém a mesma UI e o mesmo fluxo — só troca "onde a imagem mora".
