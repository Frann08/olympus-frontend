import { useState, useEffect } from 'react';

const K = { bundle: 'ot_bundle', queue: 'ot_queue' };

// ---- caché de datos (activos + certificados) ----
export function saveBundle(data) {
  try { localStorage.setItem(K.bundle, JSON.stringify({ at: Date.now(), data })); } catch { /* noop */ }
}
export function loadBundle() {
  try { return JSON.parse(localStorage.getItem(K.bundle))?.data || null; } catch { return null; }
}
export function bundleAt() {
  try { return JSON.parse(localStorage.getItem(K.bundle))?.at || null; } catch { return null; }
}

// ---- cola de la lista de campo (relevamiento) ----
export function getQueue() {
  try { return JSON.parse(localStorage.getItem(K.queue)) || []; } catch { return []; }
}
export function saveQueue(q) {
  try { localStorage.setItem(K.queue, JSON.stringify(q)); } catch { /* noop */ }
}

// ---- estado de conexión ----
export function useOnline() {
  const [on, setOn] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  useEffect(() => {
    const u = () => setOn(navigator.onLine);
    window.addEventListener('online', u);
    window.addEventListener('offline', u);
    return () => { window.removeEventListener('online', u); window.removeEventListener('offline', u); };
  }, []);
  return on;
}

export function agoLabel(ts) {
  if (!ts) return 'nunca';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'hace instantes';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}
