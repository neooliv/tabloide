/* =========================================================
   ImgDB — biblioteca de imagens de produto (IndexedDB)
   Guarda SEMPRE a versão já recortada em quadrado (900x900 PNG),
   indexada pela chave do produto (EAN/código).

   Quando este projeto migrar para WordPress, troque só este
   arquivo por uma versão que fale com um endpoint REST (wp-json)
   que leia/grave na Biblioteca de Mídia — a API pública abaixo
   (getImage/saveImage) pode continuar igual para o resto do app.
========================================================= */
(function (global) {
  const DB_NAME = 'tabloide-images';
  const STORE = 'images';
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function getImage(key) {
    if (!key) return null;
    try {
      const db = await openDB();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (_) {
      return null;
    }
  }

  async function saveImage(key, dataURL) {
    if (!key || !dataURL) return;
    try {
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(dataURL, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (_) { /* silencioso: pior caso, a imagem não fica salva pra próxima importação */ }
  }

  global.ImgDB = { getImage, saveImage };
})(window);
