import React, { useState } from 'react';
import { SlidersHorizontal, ScanLine, Smartphone, LogOut, Radio, WifiOff, Tag, ArrowLeft } from 'lucide-react';
import { login, logout, getUser, isAuthed, publicTag } from './api.js';
import { useData, Band, Pill, CertRow, Spinner, ErrorNote, Toast } from './ui.jsx';
import { useOnline } from './offline.js';
import Admin from './Admin.jsx';
import Traza from './Traza.jsx';
import Cliente from './Cliente.jsx';
import Precintos from './Precintos.jsx';
import Portal, { SIDE_NAME } from './Portal.jsx';

const ROLES = {
  admin:     { label: 'Administración', icon: SlidersHorizontal, who: 'Administración · empresas, usuarios, carga y codificación de activos' },
  precintos: { label: 'Operador · Precintos', icon: Tag, who: 'Operador · carga de Hoja 2, grabado y colocación de tags' },
  traza:     { label: 'Operador · Trazabilidad', icon: ScanLine, who: 'Operador · entradas y salidas con pistola UHF' },
  cliente:   { label: 'Cliente', icon: Smartphone, who: 'Cliente · tus activos, vencimientos y relevamientos' },
};

// Administración también puede entrar a las pantallas de operador
const ADMIN_VIEWS = [['admin', 'Administración'], ['precintos', 'Precintos'], ['traza', 'Trazabilidad']];

function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <svg width="36" height="36" viewBox="0 0 44 44" aria-hidden>
        <defs>
          <linearGradient id="olymGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F6E29A" />
            <stop offset="0.5" stopColor="#E7C15A" />
            <stop offset="1" stopColor="#B98F32" />
          </linearGradient>
        </defs>
        <circle cx="22" cy="22" r="20.4" fill="#0C0C0D" stroke="url(#olymGold)" strokeWidth="1.8" />
        <path d="M24.6 8.5 L13.8 23.6 L20.5 23.6 L18.6 35 L30.8 18.4 L23.4 18.4 Z" fill="url(#olymGold)" />
        <path d="M15 36.6 H29" stroke="url(#olymGold)" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <div style={{ lineHeight: 1 }}>
        <div style={{ font: '700 18px "Oswald", sans-serif', letterSpacing: '.14em' }}>
          <span style={{ background: 'linear-gradient(180deg,#FFFFFF,#C4CBD2)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>OLYMPUS</span>{' '}
          <span style={{ letterSpacing: '.3em', background: 'linear-gradient(180deg,#F6E29A,#E7C15A 45%,#C79A3B)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>TRACE</span>
        </div>
        <div style={{ font: '500 8px "IBM Plex Mono", monospace', letterSpacing: '.32em', color: '#8A7233', marginTop: 4 }}>ASSET INTELLIGENCE</div>
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
  const tagToken = new URLSearchParams(window.location.search).get('tag');

  const [user, setUser] = useState(isAuthed() ? getUser() : null);
  const [door, setDoor] = useState(null);
  const [view, setView] = useState('admin');
  const [toast, setToast] = useState(null);

  if (tagToken) return <PublicTag token={tagToken} />;

  const showToast = (m) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  };

  if (!user) {
    return (
      <div className="axt">
        <div className="axt-haz" />
        {door
          ? <Login side={door} onBack={() => setDoor(null)} onSwitch={setDoor} onLogin={(u) => { setView('admin'); setUser(u); }} />
          : <Portal onPick={setDoor} Logo={Logo} />}
      </div>
    );
  }

  const role = ROLES[user.role] || ROLES.cliente;
  const RoleIcon = role.icon;
  const screen = user.role === 'admin' ? view : user.role;

  return (
    <div className="axt">
      <div className="axt-haz" />
      <header className="axt-chrome">
        <Logo />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="role-chip"><RoleIcon size={15} color="#D9B44A" /><span>{role.label}</span></div>
          <div className="hdr-user" style={{ textAlign: 'right', lineHeight: 1.3 }}>
            <div style={{ font: '600 13px "IBM Plex Sans"', color: '#DCE3E9' }}>{user.name}</div>
            <div style={{ font: '400 11px "IBM Plex Mono", monospace', color: '#6A7681' }}>{user.email}</div>
          </div>
          <button className="axt-x" onClick={() => { logout(); setUser(null); setDoor(null); }} title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut size={17} /></button>
        </div>
      </header>

      {user.role === 'admin' ? (
        <nav className="adm-nav" aria-label="Secciones">
          {ADMIN_VIEWS.map(([k, l]) => (
            <button key={k} className={'adm-tab' + (view === k ? ' on' : '')} aria-current={view === k ? 'page' : undefined} onClick={() => setView(k)}>{l}</button>
          ))}
        </nav>
      ) : (
        <div className="who-bar"><RoleIcon size={14} color="#D9B44A" /><span>{role.who}</span></div>
      )}
      <OfflineBanner />

      <div className="axt-content" key={screen}>
        {screen === 'admin' && <Admin toast={showToast} />}
        {screen === 'precintos' && <Precintos toast={showToast} />}
        {screen === 'traza' && <Traza toast={showToast} />}
        {screen === 'cliente' && <Cliente toast={showToast} />}
        {!ROLES[screen] && <ErrorNote error="Tu usuario no tiene un lado asignado. Pedíselo a Administración." />}
      </div>

      {toast && <Toast msg={toast} />}
    </div>
  );
}

function Login({ side, onBack, onSwitch, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [otroLado, setOtroLado] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e && e.preventDefault();
    if (!email || !password) { setErr('Completá email y contraseña'); return; }
    setBusy(true); setErr(null); setOtroLado(null);
    try { const u = await login(email.trim(), password, side); onLogin(u); }
    catch (e2) { setErr(e2.message); setOtroLado(e2.ladoCorrecto && e2.ladoCorrecto !== side ? e2.ladoCorrecto : null); }
    finally { setBusy(false); }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <button type="button" className="login-back" onClick={onBack}><ArrowLeft size={14} /> Portal</button>
        <div style={{ margin: '14px 0 22px' }}><Logo /></div>
        <div className="login-side">{SIDE_NAME[side] || 'Ingreso'}</div>
        <h1 style={{ font: '700 22px "Oswald", sans-serif', color: '#EAF0F3', margin: '6px 0 4px' }}>Ingresar</h1>
        <p style={{ font: '400 13px "IBM Plex Sans"', color: '#8B98A5', margin: '0 0 22px' }}>Usá el usuario que te dio Administración.</p>

        <label className="fld" style={{ marginBottom: 12 }}><span>Email</span>
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@empresa.com" autoFocus />
        </label>
        <label className="fld" style={{ marginBottom: 16 }}><span>Contraseña</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>

        {err && (
          <div role="alert" style={{ font: '500 12.5px "IBM Plex Sans"', color: '#E5A3A1', background: '#211011', border: '1px solid #3A1E1D', borderRadius: 8, padding: '9px 12px', marginBottom: 14 }}>
            {err}
            {otroLado && (
              <button type="button" className="axt-btn small" style={{ display: 'flex', marginTop: 8 }}
                onClick={() => { onSwitch(otroLado); setErr(null); setOtroLado(null); }}>
                Entrar por {({ cliente: 'Cliente', operador: 'Operador', admin: 'Administración' })[otroLado] || 'ese acceso'}
              </button>
            )}
          </div>
        )}

        <button type="submit" className="axt-btn primary" style={{ width: '100%', padding: '12px' }} disabled={busy}>
          {busy ? 'Ingresando…' : 'Ingresar'}
        </button>
        <p style={{ font: '400 11.5px "IBM Plex Sans"', color: '#6E6C69', margin: '16px 0 0', textAlign: 'center' }}>¿No tenés acceso? Pedíselo a Administración de Olympus.</p>
      </form>
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
                  <div style={{ font: '700 17px "Oswald", sans-serif', color: '#EAF0F3', margin: '3px 0 6px' }}>{data.asset.name}</div>
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
