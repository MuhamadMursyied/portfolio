// Editor-only: keeps images and videos you add in the browser (IndexedDB) until they
// are published, and shrinks large photos before they are stored.
(function (root) {
  'use strict';

  const DB_NAME = 'portfolio-editor';
  const STORE = 'files';
  const MAX_VIDEO_MB = 50;      // bigger videos belong on YouTube
  const MAX_IMAGE_SIDE = 1920;  // px, longest side after resizing
  const RESIZE_OVER_BYTES = 600 * 1024;

  let dbPromise = null;
  function db() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'path' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  function tx(mode, work) {
    return db().then((d) => new Promise((resolve, reject) => {
      const t = d.transaction(STORE, mode);
      const result = work(t.objectStore(STORE));
      t.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
      t.onerror = () => reject(t.error);
    }));
  }

  const putFile = (record) => tx('readwrite', (s) => s.put(record));
  const getAllFiles = () => tx('readonly', (s) => s.getAll());
  const deleteFile = (path) => tx('readwrite', (s) => s.delete(path));

  function extensionFor(type, name) {
    const fromName = /\.([a-z0-9]{2,5})$/i.exec(name || '');
    const known = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'application/pdf': 'pdf' };
    return known[type] || (fromName ? fromName[1].toLowerCase() : 'bin');
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  }

  // Large JPEG/PNG/WebP photos are scaled down and saved as WebP (or JPEG where the
  // browser cannot encode WebP). A phone photo usually drops from ~4 MB to ~300 KB.
  async function shrinkImage(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || !root.createImageBitmap) return file;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= RESIZE_OVER_BYTES) { bitmap.close(); return file; }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    let blob = await canvasToBlob(canvas, 'image/webp', 0.85);
    if (!blob || blob.type !== 'image/webp') blob = await canvasToBlob(canvas, 'image/jpeg', 0.85);
    return blob && blob.size < file.size ? blob : file;
  }

  // Store a picked file and return its repo path, e.g. "media/robot-test-3fk2.webp".
  async function addFile(file, folder) {
    const isVideo = file.type.startsWith('video/');
    if (isVideo && file.size > MAX_VIDEO_MB * 1024 * 1024) {
      throw new Error(file.name + ' is ' + Math.round(file.size / 1048576) + ' MB. Videos over ' + MAX_VIDEO_MB + ' MB are too big for GitHub Pages; upload it to YouTube and add the link instead.');
    }
    const blob = file.type.startsWith('image/') ? await shrinkImage(file) : file;
    const base = root.PF.slugify(file.name.replace(/\.[^.]+$/, '')) || 'file';
    const suffix = Math.random().toString(36).slice(2, 6);
    const path = (folder || 'media') + '/' + base + '-' + suffix + '.' + extensionFor(blob.type || file.type, file.name);
    await putFile({ path, blob, type: blob.type || file.type, size: blob.size, added: Date.now(), published: false });
    return { path, blob, originalSize: file.size };
  }

  root.PF = Object.assign(root.PF || {}, {
    mediaStore: { addFile, getAllFiles, deleteFile, putFile, MAX_VIDEO_MB },
  });
})(window);
