/* =========================================================
   ImageEditor — recorte 1x1 com pan/zoom
   API: ImageEditor.open(srcDataURLOuUrl) -> Promise<dataURL|null>

   IMPORTANTE (correção do bug original): esta função NUNCA grava
   nada em estado/IndexedDB por conta própria. Ela só resolve a
   Promise com o dataURL final quando o usuário clica "Aplicar".
   Se ele cancelar, a Promise resolve com null e quem chamou
   simplesmente não atualiza nada — a imagem crua (não quadrada)
   nunca chega a ser persistida.
========================================================= */
(function (global) {
  const SIZE = 900; // resolução do recorte exportado

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function open(src) {
    return new Promise(async (resolve) => {
      const modal   = document.getElementById('imgEditor');
      const canvas  = document.getElementById('imgEditorCanvas');
      const range   = document.getElementById('imgEditorRange');
      const btnOk   = document.getElementById('imgEditorApply');
      const btnNo   = document.getElementById('imgEditorCancel');
      const btnReset= document.getElementById('imgEditorReset');
      const ctx     = canvas.getContext('2d');

      canvas.width = canvas.height = SIZE;

      let img;
      try { img = await loadImage(src); }
      catch (_) { resolve(null); return; }

      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      const s0 = Math.min(SIZE / iw, SIZE / ih); // "contain": mostra a imagem inteira ao abrir

      const state = { scale: s0, min: s0, max: s0 * 8, x: 0, y: 0 };

      range.min = String(state.min);
      range.max = String(state.max);
      range.value = String(state.scale);

      function clampPan() {
        const dw = iw * state.scale, dh = ih * state.scale;
        const limX = Math.max(0, (dw - SIZE) / 2);
        const limY = Math.max(0, (dh - SIZE) / 2);
        state.x = clamp(state.x, -limX, limX);
        state.y = clamp(state.y, -limY, limY);
      }

      function render() {
        clampPan();
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, SIZE, SIZE);
        const dw = iw * state.scale, dh = ih * state.scale;
        const dx = Math.round(SIZE / 2 - dw / 2 + state.x);
        const dy = Math.round(SIZE / 2 - dh / 2 + state.y);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, iw, ih, dx, dy, Math.round(dw), Math.round(dh));
      }
      render();

      // ---- pan (mouse) ----
      let dragging = false, sx = 0, sy = 0, startX = 0, startY = 0;
      function onDown(cx, cy) { dragging = true; sx = state.x; sy = state.y; startX = cx; startY = cy; }
      function onMoveTo(cx, cy) { if (!dragging) return; state.x = sx + (cx - startX); state.y = sy + (cy - startY); render(); }
      function onUp() { dragging = false; }

      const mDown = (e) => onDown(e.clientX, e.clientY);
      const mMove = (e) => onMoveTo(e.clientX, e.clientY);
      const mUp = () => onUp();
      canvas.addEventListener('mousedown', mDown);
      window.addEventListener('mousemove', mMove);
      window.addEventListener('mouseup', mUp);

      const tStart = (e) => { if (e.touches.length === 1) { e.preventDefault(); onDown(e.touches[0].clientX, e.touches[0].clientY); } };
      const tMove = (e) => { if (e.touches.length === 1) { e.preventDefault(); onMoveTo(e.touches[0].clientX, e.touches[0].clientY); } };
      const tEnd = () => onUp();
      canvas.addEventListener('touchstart', tStart, { passive: false });
      window.addEventListener('touchmove', tMove, { passive: false });
      window.addEventListener('touchend', tEnd);

      const onWheel = (e) => {
        e.preventDefault();
        const next = clamp(state.scale * (e.deltaY < 0 ? 1.1 : 0.9), state.min, state.max);
        state.scale = next; range.value = String(next); render();
      };
      canvas.addEventListener('wheel', onWheel, { passive: false });

      const onRange = () => { state.scale = parseFloat(range.value); render(); };
      range.addEventListener('input', onRange);

      const onReset = () => { state.scale = s0; state.x = 0; state.y = 0; range.value = String(s0); render(); };
      btnReset.addEventListener('click', onReset);

      function cleanup() {
        modal.classList.add('is-hidden');
        canvas.removeEventListener('mousedown', mDown);
        window.removeEventListener('mousemove', mMove);
        window.removeEventListener('mouseup', mUp);
        canvas.removeEventListener('touchstart', tStart);
        window.removeEventListener('touchmove', tMove);
        window.removeEventListener('touchend', tEnd);
        canvas.removeEventListener('wheel', onWheel);
        range.removeEventListener('input', onRange);
        btnReset.removeEventListener('click', onReset);
        btnOk.onclick = null;
        btnNo.onclick = null;
      }

      btnNo.onclick = () => { cleanup(); resolve(null); };
      btnOk.onclick = () => {
        const out = canvas.toDataURL('image/png', 0.92);
        cleanup();
        resolve(out);
      };

      modal.classList.remove('is-hidden');
    });
  }

  global.ImageEditor = { open };
})(window);
