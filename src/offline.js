import { useState, useEffect } from 'react';

// Datos para usar sin señal, guardados POR USUARIO: si en el mismo celular entra
// otra persona (u otra empresa) no ve lo del anterior.
const uid = () => {
  try { return JSON.parse(localStorage.getItem('axtag_user') || 'null')?.id ?? null; } catch { return null; }
};
const K = {
  bundle: (id) => `ot_bundle:${id}`,
  queue: (id) => `ot_queue:${id}`,
};
const leer = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

// Versiones anteriores guardaban todo sin usuario: se borra el caché viejo y la lista
// pendiente pasa al primer usuario que la abra (en la práctica, el mismo de siempre).
try {
  localStorage.removeItem('ot_bundle');
} catch { /* sin almacenamiento */ }

// ---- caché de datos (activos + certificados) ----
export function saveBundle(data) {
  const id = uid();
  return id != null && escribir(K.bundle(id), { at: Date.now(), data });
}
export function loadBundle() {
  const id = uid();
  return id == null ? null : leer(K.bundle(id))?.data || null;
}
export function bundleAt() {
  const id = uid();
  return id == null ? null : leer(K.bundle(id))?.at || null;
}

// ---- cola de la lista de campo (relevamiento) ----
export function getQueue() {
  const id = uid();
  if (id == null) return [];
  let q = leer(K.queue(id));
  if (!Array.isArray(q)) {
    const vieja = leer('ot_queue');
    q = Array.isArray(vieja) ? vieja : [];
    try { localStorage.removeItem('ot_queue'); } catch { /* noop */ }
    if (q.length) escribir(K.queue(id), q);
  }
  return q;
}
export function saveQueue(q) {
  const id = uid();
  if (id != null) escribir(K.queue(id), q);
}

// ---- limpieza por usuario ----
export function borrarDatosDe(id) {
  try { localStorage.removeItem(K.bundle(id)); } catch { /* noop */ }
}
// Al entrar alguien, se borran los datos descargados de otros usuarios de este equipo
// (las listas pendientes de cada uno se conservan: solo las ve su dueño)
export function soloDatosDe(id) {
  try {
    const borrar = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('ot_bundle:') && k !== K.bundle(id)) borrar.push(k);
    }
    borrar.forEach((k) => localStorage.removeItem(k));
  } catch { /* noop */ }
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
