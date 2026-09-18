/* =========================================================
   App — Gerador de Tabloide (estado + fluxo dos 3 passos)
========================================================= */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const COLS = 4, ROWS = 3, PER_PAGE = COLS * ROWS;

  const state = {
    header: { title: '', subtitle: '', color: '#2f6fe0' },
    products: [] // { key, desc, brand, reais, cents, img }
  };

  // ---------- util ----------
  const esc = (s) => String(s || '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));

  const norm = (s) => String(s || '')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  const onlyDigits = (s) => String(s || '').replace(/\D+/g, '');

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function newProduct() {
    return { key: '', desc: '', brand: '', reais: '', cents: '00', img: '' };
  }

  // =========================================================
  // ETAPA 1 · Modo de entrada (planilha ou manual)
  // =========================================================
  const modeXlsxBtn = $('#modeXlsxBtn'), modeManualBtn = $('#modeManualBtn');
  const modeXlsx = $('#modeXlsx'), modeManual = $('#modeManual');

  modeXlsxBtn.onclick = () => {
    modeXlsxBtn.classList.add('is-active'); modeManualBtn.classList.remove('is-active');
    modeXlsx.classList.remove('is-hidden'); modeManual.classList.add('is-hidden');
  };
  modeManualBtn.onclick = () => {
    modeManualBtn.classList.add('is-active'); modeXlsxBtn.classList.remove('is-active');
    modeManual.classList.remove('is-hidden'); modeXlsx.classList.add('is-hidden');
  };

  // ---- Dropzone da planilha ----
  const xlsxDrop = $('#xlsxDrop'), xlsxInput = $('#xlsxInput'), xlsxStatus = $('#xlsxStatus');

  xlsxDrop.onclick = () => xlsxInput.click();
  xlsxDrop.addEventListener('dragover', (e) => { e.preventDefault(); xlsxDrop.classList.add('is-dragover'); });
  xlsxDrop.addEventListener('dragleave', () => xlsxDrop.classList.remove('is-dragover'));
  xlsxDrop.addEventListener('drop', (e) => {
    e.preventDefault(); xlsxDrop.classList.remove('is-dragover');
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) importXlsx(f);
  });
  xlsxInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) importXlsx(f);
    e.target.value = '';
  });

  // palavras-chave para identificar cada coluna pelo cabeçalho
  const COL_KEYWORDS = {
    key:   ['ean', 'codigo', 'cod'],
    desc:  ['descri', 'produto', 'nome'],
    brand: ['marca'],
    price: ['preco', 'valor', 'pc.liq', 'pcliq', 'pc liq']
  };

  function matchColumn(headerCell) {
    const h = norm(headerCell);
    for (const col of Object.keys(COL_KEYWORDS)) {
      if (COL_KEYWORDS[col].some((kw) => h.includes(kw))) return col;
    }
    return null;
  }

  function parsePrice(raw) {
    if (raw == null || raw === '') return { reais: '', cents: '00' };
    if (typeof raw === 'number') {
      const cents = Math.round(raw * 100);
      return { reais: String(Math.floor(cents / 100)), cents: String(cents % 100).padStart(2, '0') };
    }
    const cleaned = String(raw).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(,|$))/g, '');
    const parts = cleaned.replace(',', '.').split('.');
    const reais = onlyDigits(parts[0] || '0');
    const cents = onlyDigits((parts[1] || '0')).padEnd(2, '0').slice(0, 2);
    return { reais, cents };
  }

  async function importXlsx(file) {
    xlsxStatus.textContent = 'Lendo planilha…';
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });

      // acha a linha de cabeçalho (primeira linha com pelo menos 2 colunas reconhecidas)
      let headerRowIdx = -1, colMap = {};
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const map = {};
        rows[i].forEach((cell, j) => { const c = matchColumn(cell); if (c) map[c] = j; });
        if (Object.keys(map).length >= 2) { headerRowIdx = i; colMap = map; break; }
      }
      if (headerRowIdx === -1) {
        xlsxStatus.textContent = 'Não consegui identificar as colunas automaticamente. Verifique se a planilha tem um cabeçalho com nomes como "EAN", "Descrição", "Marca" e "Preço".';
        return;
      }

      const products = [];
      for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const r = rows[i];
        const desc = colMap.desc != null ? r[colMap.desc] : '';
        if (!String(desc || '').trim()) continue;
        const priceRaw = colMap.price != null ? r[colMap.price] : '';
        const { reais, cents } = parsePrice(priceRaw);
        products.push({
          key: colMap.key != null ? String(r[colMap.key] || '').trim() : '',
          desc: String(desc).trim(),
          brand: colMap.brand != null ? String(r[colMap.brand] || '').trim() : '',
          reais, cents, img: ''
        });
      }

      if (!products.length) {
        xlsxStatus.textContent = 'Nenhum produto encontrado nas linhas abaixo do cabeçalho.';
        return;
      }

      // tenta reaproveitar imagens já recortadas anteriormente para os mesmos códigos
      await Promise.all(products.map(async (p) => {
        if (p.key) {
          const saved = await ImgDB.getImage(p.key);
          if (saved) p.img = saved;
        }
      }));

      state.products = products;
      xlsxStatus.textContent = `${products.length} produto(s) importado(s).`;
      goToStep(2);
    } catch (err) {
      console.error(err);
      xlsxStatus.textContent = 'Não foi possível ler esse arquivo. Confirme que é um .xlsx válido.';
    }
  }

  // ---- Modo manual ----
  $('#addManualBtn').onclick = () => {
    const n = Math.max(1, Math.min(60, parseInt($('#qty').value, 10) || 1));
    state.products = Array.from({ length: n }, newProduct);
    goToStep(2);
  };

  // =========================================================
  // ETAPA 2 · Lista de produtos
  // =========================================================
  const productList = $('#productList');
  const rowTpl = $('#productRowTpl');
  let editingIndex = -1;
  const hiddenFileInput = (() => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.hidden = true;
    document.body.appendChild(inp);
    return inp;
  })();

  function renderProductList() {
    productList.innerHTML = '';
    state.products.forEach((p, i) => {
      const node = rowTpl.content.firstElementChild.cloneNode(true);
      node.dataset.index = i;

      const img = $('.prod-thumb img', node);
      const thumb = $('.prod-thumb', node);
      if (p.img) { img.src = p.img; img.hidden = false; thumb.classList.add('has-image'); }

      $('.prod-desc', node).value = p.desc || '';
      $('.prod-reais', node).value = p.reais || '';
      $('.prod-cents', node).value = p.cents || '';

      $('.prod-desc', node).addEventListener('input', (e) => { p.desc = e.target.value; });
      $('.prod-reais', node).addEventListener('input', (e) => { e.target.value = onlyDigits(e.target.value).slice(0, 4); p.reais = e.target.value; });
      $('.prod-cents', node).addEventListener('input', (e) => { e.target.value = onlyDigits(e.target.value).slice(0, 2); p.cents = e.target.value; });

      thumb.addEventListener('click', () => { editingIndex = i; hiddenFileInput.click(); });
      $('.prod-remove', node).addEventListener('click', () => {
        state.products.splice(i, 1);
        renderProductList();
      });

      productList.appendChild(node);
    });
    $('#productCount').textContent = state.products.length;
  }

  hiddenFileInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file || editingIndex < 0) return;
    const raw = await readFileAsDataURL(file);
    const cropped = await ImageEditor.open(raw); // só volta algo se o usuário clicar "Aplicar"
    if (!cropped) return; // cancelado: nada é salvo, imagem crua nunca entra no estado
    const p = state.products[editingIndex];
    p.img = cropped;
    if (p.key) ImgDB.saveImage(p.key, cropped); // guarda só a versão já recortada
    renderProductList();
  });

  $('#addOneBtn').onclick = () => { state.products.push(newProduct()); renderProductList(); };

  $('#backTo1').onclick = () => goToStep(1);
  $('#backTo2').onclick = () => goToStep(2);

  $('#goTo3').onclick = () => {
    const semImagem = state.products.filter((p) => !p.img).length;
    const semDesc = state.products.filter((p) => !p.desc.trim()).length;
    if (semDesc || semImagem) {
      const partes = [];
      if (semDesc) partes.push(`${semDesc} sem descrição`);
      if (semImagem) partes.push(`${semImagem} sem imagem`);
      if (!confirm(`Atenção: ${partes.join(' e ')}. Gerar mesmo assim?`)) return;
    }
    state.header.title = $('#hTitle').value.trim();
    state.header.subtitle = $('#hSubtitle').value.trim();
    state.header.color = $('#hColor').value;
    renderPages();
    goToStep(3);
  };

  // =========================================================
  // ETAPA 3 · Páginas do tabloide
  // =========================================================
  const pagesEl = $('#pages');
  const pageTpl = $('#pageTpl');
  const cardTpl = $('#cardTpl');

  function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  function renderPages() {
    pagesEl.innerHTML = '';
    const groups = chunk(state.products, PER_PAGE);

    groups.forEach((group) => {
      const page = pageTpl.content.firstElementChild.cloneNode(true);
      page.style.setProperty('--page-accent', state.header.color);
      $('.page-title', page).textContent = state.header.title || 'OFERTAS';
      $('.page-subtitle', page).textContent = state.header.subtitle || '';

      const grid = $('.page-grid', page);
      group.forEach((p) => {
        const card = cardTpl.content.firstElementChild.cloneNode(true);
        $('.card-img', card).src = p.img || '';
        $('.card-desc', card).textContent = p.desc || '';
        $('.value', card).textContent = p.reais || '0';
        $('.cents', card).textContent = ',' + (p.cents || '00');
        grid.appendChild(card);
      });
      // preenche slots vazios da última página para manter o grid alinhado
      for (let i = group.length; i < PER_PAGE; i++) {
        const ghost = document.createElement('div');
        ghost.style.visibility = 'hidden';
        grid.appendChild(ghost);
      }

      pagesEl.appendChild(page);
    });
  }

  // ---- Exportar PDF (impressão nativa do navegador — sem distorção, texto vetorial) ----
  $('#btnPdf').onclick = () => window.print();

  // ---- Exportar PNG (uma imagem por página) ----
  $('#btnPng').onclick = async () => {
    const pages = $$('.page', pagesEl);
    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i], {
        backgroundColor: '#ffffff',
        useCORS: true,
        scale: 2 // resolução maior para impressão/zoom
      });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `tabloide-pagina-${i + 1}.png`;
      a.click();
    }
  };

  // =========================================================
  // Navegação entre passos
  // =========================================================
  function goToStep(n) {
    $$('.step').forEach((el) => el.classList.add('is-hidden'));
    $(`#step${n}`).classList.remove('is-hidden');
    $$('#stepIndicator li').forEach((li) => li.classList.toggle('is-active', Number(li.dataset.step) === n));
    if (n === 2) renderProductList();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goToStep(1);
})();
