const API = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
import { soloDatosDe, borrarDatosDe } from './offline.js';

// Lectura a prueba de datos corruptos o almacenamiento bloqueado (nunca pantalla en blanco)
function leer(k, json) {
  try { const v = localStorage.getItem(k); return json ? JSON.parse(v || 'null') : v; } catch { return null; }
}
function guardar(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } }

let token = leer('axtag_token') || null;
let user = leer('axtag_user', true);
if (!user || typeof user !== 'object' || !user.id || !user.role) { user = null; token = null; }

export function getUser() { return user; }
export function isAuthed() { return !!token; }

// lado: puerta del portal ('cliente' | 'operador' | 'admin'); el servidor rechaza otros roles
export async function login(usuario, password, lado) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, password, lado }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    const err = new Error(e.error || 'No se pudo iniciar sesión');
    err.ladoCorrecto = e.lado_correcto || null;
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!data.token || !data.user || !data.user.role) throw new Error('Respuesta inválida del servidor, probá de nuevo');
  token = data.token;
  user = data.user;
  guardar('axtag_token', token);
  guardar('axtag_user', JSON.stringify(user));
  soloDatosDe(user.id); // en este equipo no quedan datos guardados de otro usuario
  return user;
}

// borrarDatos: al salir a propósito se borran los datos guardados para usar sin señal
// (si la sesión solo venció, quedan: son del mismo usuario y nadie más los ve)
export function logout({ borrarDatos = false } = {}) {
  if (borrarDatos && user) borrarDatosDe(user.id);
  token = null;
  user = null;
  guardar('axtag_token', null);
  guardar('axtag_user', null);
}

// Aviso global de sesión vencida: App vuelve a la pantalla de ingreso
function sesionVencida() {
  const tenia = !!token;
  logout();
  if (tenia) window.dispatchEvent(new CustomEvent('ot:sesion-vencida'));
}

export async function api(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    const err = new Error('Sin conexión con el servidor. Revisá tu internet e intentá de nuevo.');
    err.status = 0;
    throw err;
  }
  if (res.status === 401) {
    sesionVencida();
    const err = new Error('Sesión expirada, volvé a entrar');
    err.status = 401;
    throw err;
  }
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    const err = new Error(e.error || `Error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

// Descargar el respaldo completo (dispara la descarga del archivo)
export async function downloadBackup() {
  const res = await fetch(`${API}/api/backup`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (res.status === 401) { sesionVencida(); throw new Error('Sesión expirada, volvé a entrar'); }
  if (!res.ok) throw new Error('No se pudo generar el respaldo');
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') || '';
  const m = cd.match(/filename="(.+?)"/);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = m ? m[1] : ('olympus-respaldo-' + new Date().toISOString().slice(0, 10) + '.json');
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Lo que abre el teléfono al escanear el NFC. Exige sesión: el servidor
// muestra la pieza solo a quien le corresponde (404 si no).
export function tagInfo(tok) {
  return api(`/api/tag/${encodeURIComponent(tok)}`);
}

// Dirección pública de Olympus que se graba en los tags. Si se configura VITE_PUBLIC_URL
// (por ejemplo, el dominio propio) se usa esa aunque se esté trabajando desde otra dirección.
export const PUBLIC_URL = String(import.meta.env.VITE_PUBLIC_URL || window.location.origin).replace(/\/+$/, '');

export { API };
