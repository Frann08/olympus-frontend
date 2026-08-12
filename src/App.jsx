import React, { useState } from 'react';
import { SlidersHorizontal, ScanLine, Smartphone, LogOut, Radio, X, WifiOff } from 'lucide-react';
import { login, logout, getUser, isAuthed, publicTag } from './api.js';
import { useData, Band, Pill, CertRow, Spinner, ErrorNote, Toast } from './ui.jsx';
import { useOnline } from './offline.js';
import Admin from './Admin.jsx';
import Traza from './Traza.jsx';
import Cliente from './Cliente.jsx';

const ROLES = {
  admin:   { label: 'Programador', icon: SlidersHorizontal, who: 'Back office · alta de activos, certificados y codificación de tags' },
  traza:   { label: 'Trazabilidad', icon: ScanLine, who: 'Depósito · lectura de tags UHF para armar entradas' },
  cliente: { label: 'Cliente', icon: Smartphone, who: 'Autogestión · escaneo NFC' },
};

function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden>
        <defs>
          <linearGradient id="olymGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F4DA86" />
            <stop offset="0.5" stopColor="#D9B44A" />
            <stop offset="1" stopColor="#A8842E" />
          </linearGradient>
        </defs>
        <circle cx="20" cy="20" r="18.2" fill="#0E0C09" stroke="url(#olymGold)" strokeWidth="1.6" />
        <path d="M22.5 7 L12.5 21.8 L18.6 21.8 L16.8 33 L28 16.6 L21.2 16.6 Z" fill="url(#olymGold)" />
        <path d="M13.5 34.2 H26.5" stroke="url(#olymGold)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <div style={{ lineHeight: 1 }}>
        <div style={{ font: '700 16px "Space Grotesk", sans-serif', letterSpacing: '1.5px' }}>
          <span style={{ color: '#F1EFE6' }}>OLYMPUS</span>{' '}
          <span style={{ color: '#D9B44A' }}>TRACE</span>
        </div>
        <div style={{ font: '500 8.5px "IBM Plex Mono", monospace', letterSpacing: '2.5px', color: '#8A7A55', marginTop: 3 }}>ASSET INTELLIGENCE</div>
      </div>
    </div>
  );
}

function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="offline-banner">
      <WifiOff size={14} /> Sin conexión — trabajando offline. Los cambios se sincronizan al recuperar internet.
    </div>
  );
}

export default function App() {
  // Página pública del tag (lo que abre el teléfono): ?tag=TOKEN
  const params = new URLSearchParams(window.location.search);
  const tagToken = params.get('tag');
  if (tagToken) return <PublicTag token={tagToken} />;

  const [user, setUser] = useState(isAuthed() ? getUser() : null);
  const [toast, setToast] = useState(null);

  const showToast = (m) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  };

  if (!user) return <div className="axt"><Login onLogin={setUser} /></div>;

  const role = ROLES[user.role] || ROLES.cliente;
  const RoleIcon = role.icon;

  return (
    <div className="axt">
      <header className="axt-chrome">
        <Logo />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="role-chip"><RoleIcon size={15} color="#D9B44A" /><span>{role.label}</span></div>
          <div style={{ textAlign: 'right', lineHeight: 1.3 }}>
            <div style={{ font: '600 13px "IBM Plex Sans"', color: '#DCE3E9' }}>{user.name}</div>
            <div style={{ font: '400 11px "IBM Plex Mono", monospace', color: '#6A7681' }}>{user.email}</div>
          </div>
          <button className="axt-x" onClick={() => { logout(); setUser(null); }} title="Cerrar sesión"><LogOut size={17} /></button>
        </div>
      </header>
      <div className="who-bar"><RoleIcon size={14} color="#D9B44A" /><span>{role.who}</span></div>
      <OfflineBanner />

      <div className="axt-content" key={user.role}>
        {user.role === 'admin' && <Admin toast={showToast} />}
        {user.role === 'traza' && <Traza toast={showToast} />}
        {user.role === 'cliente' && <Cliente toast={showToast} />}
      </div>

      {toast && <Toast msg={toast} />}
    </div>
  );
}

const DEMO_USERS = [
  { email: 'admin@axtag.io', label: 'Programador' },
  { email: 'traza@axtag.io', label: 'Trazabilidad' },
  { email: 'cliente@tecpetrol.com', label: 'Cliente' },
];

function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@axtag.io');
  const [password, setPassword] = useState('axtag1234');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true); setErr(null);
    try { const u = await login(email, password); onLogin(u); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div style={{ marginBottom: 22 }}><Logo /></div>
        <h1 style={{ font: '700 22px "Space Grotesk", sans-serif', color: '#EAF0F3', margin: '0 0 4px' }}>Ingresar</h1>
        <p style={{ font: '400 13px "IBM Plex Sans"', color: '#8B98A5', margin: '0 0 22px' }}>Panel de trazabilidad y cumplimiento.</p>

        <label className="fld" style={{ marginBottom: 12 }}><span>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        </label>
        <label className="fld" style={{ marginBottom: 16 }}><span>Contraseña</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        </label>

        {err && <div style={{ font: '500 12.5px "IBM Plex Sans"', color: '#E5A3A1', background: '#211011', border: '1px solid #3A1E1D', borderRadius: 8, padding: '9px 12px', marginBottom: 14 }}>{err}</div>}

        <button className="axt-btn primary" style={{ width: '100%', padding: '12px' }} onClick={submit} disabled={busy}>
          {busy ? 'Ingresando…' : 'Ingresar'}
        </button>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #2A2732' }}>
          <div style={{ font: '500 11px "IBM Plex Mono", monospace', color: '#6A7681', letterSpacing: '.5px', marginBottom: 10 }}>USUARIOS DE DEMO (pass: axtag1234)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {DEMO_USERS.map((u) => (
              <button key={u.email} className="axt-chip" onClick={() => { setEmail(u.email); setPassword('axtag1234'); }}>{u.label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Página pública: lo que ve el teléfono al escanear el NFC (?tag=TOKEN) */
function PublicTag({ token }) {
  const { loading, error, data } = useData(() => publicTag(token), [token]);
  return (
    <div className="axt" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 16 }}>
      <div className="phone" style={{ position: 'static', transform: 'none' }}>
        <div className="phone-notch" />
        <div className="phone-bar"><Radio size={13} color="#D9B44A" /> <span>OLYMPUS TRACE</span></div>
        <div className="phone-screen">
          {loading ? <Spinner /> : error ? <ErrorNote error={error} /> : (
            <>
              <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', paddingBottom: 14, borderBottom: '1px solid #201C24' }}>
                <Band status={data.status} h={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '400 11px "IBM Plex Mono", monospace', color: '#6A7681' }}>{data.asset.type} · {data.asset.client}</div>
                  <div style={{ font: '700 17px "Space Grotesk", sans-serif', color: '#EAF0F3', margin: '3px 0 6px' }}>{data.asset.name}</div>
                  <Pill status={data.status} />
                </div>
              </div>
              <div style={{ font: '600 11px "IBM Plex Mono", monospace', color: '#7A8792', letterSpacing: '.5px', margin: '16px 0 4px' }}>CERTIFICADOS</div>
              <div>
                {data.certificates.map((c, i) => <CertRow key={c.id || i} c={c} last={i === data.certificates.length - 1} />)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
