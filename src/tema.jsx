import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

/* ============================================================
   Modo día / noche
   - Por defecto sigue el modo del teléfono (claro u oscuro).
   - Si el usuario lo cambia con el botón, queda recordado en ese equipo.
   - index.html lo aplica antes de dibujar la página (sin parpadeo).
============================================================ */
const K = 'ot_tema';
const COLOR_BARRA = { dia: '#ECE9E2', noche: '#0A0A0C' };

const guardado = () => { try { const t = localStorage.getItem(K); return t === 'dia' || t === 'noche' ? t : null; } catch { return null; } };
const sistema = () => (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'dia' : 'noche');

function aplicar(t) {
  document.documentElement.dataset.tema = t;
  let m = document.querySelector('meta[name="theme-color"]');
  if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
  m.content = COLOR_BARRA[t];
}

let actual = guardado() || sistema();
aplicar(actual);
const subs = new Set();
const avisar = () => subs.forEach((f) => f(actual));

if (window.matchMedia) {
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  const alCambiar = (e) => { if (!guardado()) { actual = e.matches ? 'dia' : 'noche'; aplicar(actual); avisar(); } };
  if (mq.addEventListener) mq.addEventListener('change', alCambiar); else if (mq.addListener) mq.addListener(alCambiar);
}

export function setTema(t) {
  actual = t;
  try { localStorage.setItem(K, t); } catch { /* sin almacenamiento: vale para esta visita */ }
  aplicar(t);
  avisar();
}

export function useTema() {
  const [t, setT] = useState(actual);
  useEffect(() => { subs.add(setT); setT(actual); return () => { subs.delete(setT); }; }, []);
  return t;
}

export function BotonTema({ className = 'axt-x', size = 17 }) {
  const dia = useTema() === 'dia';
  const txt = dia ? 'Pasar a modo noche' : 'Pasar a modo día';
  return (
    <button type="button" className={className} onClick={() => setTema(dia ? 'noche' : 'dia')} title={txt} aria-label={txt}>
      {dia ? <Moon size={size} /> : <Sun size={size} />}
    </button>
  );
}
