# Gerador de Tabloides

Ferramenta web (HTML/JS puro, sem dependência de servidor) para montar tabloides/encartes promocionais em A4 a partir de uma planilha de produtos. Atualmente em produção embarcada em uma página do WordPress.

## O que faz

- Importa planilha (`.xlsx`/`.csv`) com colunas de código de barras, código, marca, descrição e valor
- Associa imagens dos produtos automaticamente por código de barras/código (upload de pasta) ou manualmente (arrastar/soltar, clique)
- Gera páginas A4 automaticamente, agrupando os produtos por marca (12 produtos por página)
- Permite personalizar cabeçalho por marca (cor, logo, título, chamada) e rodapé padrão
- Permite configurar as cores de destaque (fundo/texto de preço, descrição, imagem, página)
- Exporta o resultado em **PDF** (documento único) ou **PNG** (uma imagem por página)

## Stack

- HTML + CSS + JavaScript vanilla, sem build step, um único arquivo (`index.html`)
- Bibliotecas via CDN (cdnjs): [SheetJS/xlsx](https://cdnjs.com/libraries/xlsx) para leitura de planilha, [html2canvas](https://html2canvas.hertzen.com/) para rasterizar as páginas, [jsPDF](https://github.com/parallax/jsPDF) para montar o PDF final

## Como usar

Basta abrir o `index.html` em um navegador (ou publicá-lo em qualquer hospedagem estática/CMS). Não há back-end: toda a planilha, imagens e páginas geradas ficam em memória no navegador durante a sessão.

## Status

Esta versão é uma **cópia fiel** do código que já está rodando em produção (embarcado via WordPress), servindo como ponto de partida para evolução e versionamento fora do CMS. O ambiente de produção não deve ser alterado diretamente — melhorias serão desenvolvidas e testadas aqui antes de irem para lá.

## Problema conhecido / próxima melhoria

**Distorção de imagens na exportação (PDF/PNG):** no preview em tela, as imagens dos produtos respeitam a proporção original (`background-size: contain`). Porém, na exportação via `html2canvas`, imagens aplicadas como `background-image` às vezes são esticadas, perdendo a proporção original — mesmo que a visualização em tela esteja correta.

Causa provável: suporte inconsistente do html2canvas para `background-image` + `background-size: contain`.

Caminhos de correção avaliados (ver discussão/commits futuros):
1. Trocar `background-image` por tag `<img>` com `object-fit: contain` dentro do slot — abordagem mais simples e com suporte mais confiável no html2canvas.
2. Pré-processar a imagem no momento do upload, desenhando-a centralizada em um `<canvas>` de proporção fixa (ex: quadrado) antes de salvar como `dataURL` — resolve de forma mais definitiva, independente da lib de exportação.
3. Usar o callback `onclone` do html2canvas para ajustar o DOM apenas no momento da captura, sem alterar o preview.

## Roadmap

- [ ] Corrigir distorção de imagens na exportação
- [ ] Avaliar padronização do formato/proporção das imagens de produto
- [ ] Revisar performance para planilhas grandes (muitas marcas/produtos)
