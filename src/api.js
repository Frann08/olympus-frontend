const API = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

let token = localStorage.getItem('axtag_token') || null;
let user = JSON.parse(localStorage.getItem('axtag_user') || 'null');

export function getUser() { return user; }
export function isAuthed() { return !!token; }

// lado: puerta del portal ('cliente' | 'operador' | 'admin'); el servidor rechaza otros roles
export async function login(email, password, lado) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, lado }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    const err = new Error(e.error || 'No se pudo iniciar sesión');
    err.ladoCorrecto = e.lado_correcto || null;
    throw err;
  }
  const data = await res.json();
  token = data.token;
  user = data.user;
  localStorage.setItem('axtag_token', token);
  localStorage.setItem('axtag_user', JSON.stringify(user));
  return user;
}

export function logout() {
  token = null;
  user = null;
  localStorage.removeItem('axtag_token');
  localStorage.removeItem('axtag_user');
}

export async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    logout();
    throw new Error('Sesión expirada, volvé a entrar');
  }
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || `Error ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// Endpoint público (lo que abre el teléfono al escanear el NFC)
export async function publicTag(tok) {
  const res = await fetch(`${API}/api/public/tag/${tok}`);
  if (!res.ok) throw new Error('Tag no encontrado');
  return res.json();
}

export { API };
