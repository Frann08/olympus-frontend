import React, { useState, useEffect, useRef } from 'react';
import { SlidersHorizontal, ScanLine, Smartphone, LogOut, Radio, WifiOff, Tag, ArrowLeft, Lock, SearchX, HelpCircle } from 'lucide-react';
import { login, logout, getUser, isAuthed, tagInfo } from './api.js';
import { Band, Pill, CertRow, Spinner, ErrorNote, Toast } from './ui.jsx';
import { useOnline } from './offline.js';
import Admin from './Admin.jsx';
import { Empresas, Usuarios, Respaldo } from './AdminGestion.jsx';
import Traza from './Traza.jsx';
import Cliente from './Cliente.jsx';
import Precintos from './Precintos.jsx';
import Portal, { SIDE_NAME } from './Portal.jsx';
import Ayuda, { HojaCliente, guiasPara } from './Ayuda.jsx';
import { BotonTema } from './tema.jsx';

const ROLES = {
  admin:     { label: 'Administración', icon: SlidersHorizontal, who: 'Administración · empresas, usuarios, carga y codificación de activos' },
  precintos: { label: 'Operador · Precintos', icon: Tag, who: 'Operador · carga de Hoja 2, grabado y colocación de tags' },
  traza:     { label: 'Operador · Trazabilidad', icon: ScanLine, who: 'Operador · entradas y salidas con pistola UHF' },
  cliente:   { label: 'Cliente', icon: Smartphone, who: 'Cliente · tus activos, vencimientos y relevamientos' },
};

// Páginas de Administración (también puede entrar a las pantallas de operador)
const ADMIN_VIEWS = [['admin', 'Activos'], ['empresas', 'Empresas'], ['usuarios', 'Usuarios'], ['precintos', 'Precintos'], ['traza', 'Trazabilidad'], ['respaldo', 'Respaldo']];

// Al recargar, Administración vuelve a la página en la que estaba
function vistaGuardada() {
  try { const v = sessionStorage.getItem('ot_vista'); if (ADMIN_VIEWS.some(([k]) => k === v)) return v; } catch { /* nada */ }
  return 'admin';
}

function Logo() {
  return (
    <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
      <svg className="logo-svg" width="36" height="36" viewBox="0 0 44 44" aria-hidden style={{ flex: 'none' }}>
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
        <div className="logo-txt" style={{ font: '700 18px "Oswald", sans-serif', letterSpacing: '.14em', whiteSpace: 'nowrap' }}>
          <span style={{ background: 'var(--grad-acero)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>OLYMPUS</span>{' '}
          <span className="logo-trace" style={{ letterSpacing: '.3em', background: 'var(--grad-oro)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>TRACE</span>
        </div>
        <div className="logo-sub" style={{ font: '500 8px "IBM Plex Mono", monospace', letterSpacing: '.32em', color: 'var(--t-8A7233)', marginTop: 4 }}>ASSET INTELLIGENCE</div>
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
  const params = new URLSearchParams(window.location.search);
  // Lo que abre el teléfono al escanear el NFC: ?tag=TOKEN (exige sesión)
  const tagToken = params.get('tag');
  // Instructivos como página suelta: ?ayuda=cliente|precintos|traza (y &hoja=1 para imprimir)
  const ayudaParam = params.get('ayuda');

  const [user, setUser] = useState(isAuthed() ? getUser() : null);
  const [door, setDoor] = useState(null);
  const [view, setView] = useState(vistaGuardada);
  const [vistaParams, setVistaParams] = useState(null); // p. ej. { empresa: 3 } al saltar de Empresas a Usuarios
  const [toast, setToast] = useState(null);
  const [ayuda, setAyuda] = useState(null); // { guias, inicial } · se abre encima de la pantalla actual
  const [avisoLogin, setAvisoLogin] = useState(null);
  const timerToast = useRef(null);

  // Sesión vencida (cualquier pedido respondió 401): volver al ingreso del mismo lado, con aviso
  const userRef = useRef(user);
  userRef.current = user;
  useEffect(() => {
    const alVencer = () => {
      const u = userRef.current;
      if (!u) return;
      setUser(null);
      setDoor(LADO_DE_ROL[u.role] || null);
      setAvisoLogin('Tu sesión venció. Volvé a entrar.');
    };
    window.addEventListener('ot:sesion-vencida', alVencer);
    return () => window.removeEventListener('ot:sesion-vencida', alVencer);
  }, []);

  const esBM = !!user && user.role !== 'cliente';
  const abrirAyuda = (guias, inicial) => setAyuda({ guias, inicial });
  const overlay = ayuda && (
    <Ayuda guias={ayuda.guias} inicial={ayuda.inicial} puedeImprimir={esBM} onClose={() => setAyuda(null)} />
  );

  if (ayudaParam != null) {
    if (params.has('hoja') && ayudaParam === 'cliente') return <HojaCliente />;
    return <Ayuda pagina guias={guiasPara(ayudaParam)} inicial={ayudaParam} puedeImprimir={esBM} Logo={Logo} />;
  }

  if (tagToken) return (
    <>
      <TagPage token={tagToken} user={user} onUser={setUser} onAyuda={() => abrirAyuda(['cliente'], 'cliente')} />
      {overlay}
    </>
  );

  const showToast = (m) => {
    setToast(m);
    clearTimeout(timerToast.current);
    timerToast.current = setTimeout(() => setToast(null), 2600);
  };

  if (!user) {
    return (
      <div className="axt">
        <div className="axt-haz" />
        {door
          ? <Login side={door} aviso={avisoLogin} onBack={() => { setDoor(null); setAvisoLogin(null); }} onSwitch={setDoor} onLogin={(u) => { setView('admin'); setVistaParams(null); setAvisoLogin(null); setUser(u); try { sessionStorage.removeItem('ot_vista'); } catch { /* nada */ } }}
              onAyuda={() => abrirAyuda(guiasPara(door), door === 'operador' ? 'precintos' : door)} />
          : <Portal onPick={setDoor} Logo={Logo} onAyuda={() => abrirAyuda(guiasPara('admin'), 'cliente')} />}
        {overlay}
      </div>
    );
  }

  const role = ROLES[user.role] || ROLES.cliente;
  const RoleIcon = role.icon;
  const screen = user.role === 'admin' ? view : user.role;
  const ir = (k, p) => {
    setVistaParams(p || null); setView(k);
    try { sessionStorage.setItem('ot_vista', k); } catch { /* sin almacenamiento: no pasa nada */ }
  };

  return (
    <div className="axt">
      <div className="axt-haz" />
      <header className="axt-chrome">
        <Logo />
        <div className="hdr-der" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="role-chip"><RoleIcon size={15} color="var(--t-D9B44A)" /><span>{role.label}</span></div>
          <div className="hdr-user" style={{ textAlign: 'right', lineHeight: 1.3 }}>
            <div style={{ font: '600 13px "IBM Plex Sans"', color: 'var(--t-DCE3E9)' }}>{user.name}</div>
            <div style={{ font: '400 11px "IBM Plex Mono", monospace', color: 'var(--t-6A7681)' }}>{user.username || user.email}</div>
          </div>
          <BotonTema />
          <button className="axt-x" onClick={() => abrirAyuda(guiasPara(user.role), user.role === 'admin' ? view : user.role)} title="Ayuda" aria-label="Ayuda"><HelpCircle size={17} /></button>
          <button className="axt-x" onClick={() => { logout({ borrarDatos: true }); setUser(null); setDoor(null); }} title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut size={17} /></button>
        </div>
      </header>

      {user.role === 'admin' ? (
        <nav className="adm-nav" aria-label="Secciones">
          {ADMIN_VIEWS.map(([k, l]) => (
            <button key={k} className={'adm-tab' + (view === k ? ' on' : '')} aria-current={view === k ? 'page' : undefined} onClick={() => ir(k)}>{l}</button>
          ))}
        </nav>
      ) : (
        <div className="who-bar"><RoleIcon size={14} color="var(--t-D9B44A)" /><span>{role.who}</span></div>
      )}
      <OfflineBanner />

      <div className="axt-content" key={screen + (vistaParams ? ':' + JSON.stringify(vistaParams) : '')}>
        <Resguardo>
          {screen === 'admin' && <Admin toast={showToast} ir={ir} inicial={vistaParams} />}
          {screen === 'empresas' && <Empresas toast={showToast} ir={ir} inicial={vistaParams} />}
          {screen === 'usuarios' && <Usuarios toast={showToast} inicial={vistaParams} />}
          {screen === 'respaldo' && <Respaldo toast={showToast} />}
          {screen === 'precintos' && <Precintos toast={showToast} />}
          {screen === 'traza' && <Traza toast={showToast} />}
          {screen === 'cliente' && <Cliente toast={showToast} />}
        </Resguardo>
        {user.role !== 'admin' && !ROLES[screen] && <ErrorNote error="Tu usuario no tiene un lado asignado. Pedíselo a Administración." />}
      </div>

      {toast && <Toast msg={toast} />}
      {overlay}
    </div>
  );
}

// Si una pantalla falla al dibujarse, se muestra un aviso en vez de dejar todo en blanco
class Resguardo extends React.Component {
  constructor(p) { super(p); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error(error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="axt-card" style={{ padding: 22, maxWidth: 520, margin: '20px auto', textAlign: 'center' }}>
        <div style={{ font: '700 17px "Oswald", sans-serif', color: 'var(--t-EAF0F3)', marginBottom: 8 }}>Algo falló en esta pantalla</div>
        <p style={{ font: '400 13px "IBM Plex Sans"', color: 'var(--t-8B98A5)', margin: '0 0 14px' }}>Recargá la página. Si vuelve a pasar, avisale a Administración de Olympus.</p>
        <button className="axt-btn primary" onClick={() => window.location.reload()}>Recargar</button>
      </div>
    );
  }
}

const LADO_DE_ROL = { cliente: 'cliente', precintos: 'operador', traza: 'operador', admin: 'admin' };

function Login({ side, aviso, onBack, onSwitch, onLogin, onAyuda }) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [otroLado, setOtroLado] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e && e.preventDefault();
    if (!usuario || !password) { setErr('Completá usuario y contraseña'); return; }
    setBusy(true); setErr(null); setOtroLado(null);
    try { const u = await login(usuario.trim(), password, side); onLogin(u); }
    catch (e2) { setErr(e2.message); setOtroLado(e2.ladoCorrecto && e2.ladoCorrecto !== side ? e2.ladoCorrecto : null); }
    finally { setBusy(false); }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-top">
          <button type="button" className="login-back" onClick={onBack}><ArrowLeft size={14} /> Portal</button>
          <BotonTema className="axt-x sm" size={14} />
        </div>
        <div style={{ margin: '14px 0 22px' }}><Logo /></div>
        <div className="login-side">{SIDE_NAME[side] || 'Ingreso'}</div>
        <h1 style={{ font: '700 22px "Oswald", sans-serif', color: 'var(--t-EAF0F3)', margin: '6px 0 4px' }}>Ingresar</h1>
        <p style={{ font: '400 13px "IBM Plex Sans"', color: 'var(--t-8B98A5)', margin: '0 0 22px' }}>Usá el usuario que te dio Administración.</p>
        {aviso && <div className="tag-aviso" role="status">{aviso}</div>}

        <label className="fld" style={{ marginBottom: 12 }}><span>Usuario</span>
          <input type="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="tu usuario" autoFocus />
        </label>
        <label className="fld" style={{ marginBottom: 16 }}><span>Contraseña</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>

        {err && (
          <div role="alert" style={{ font: '500 12.5px "IBM Plex Sans"', color: 'var(--t-E5A3A1)', background: 'var(--s-211011)', border: '1px solid var(--b-3A1E1D)', borderRadius: 8, padding: '9px 12px', marginBottom: 14 }}>
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
        <p style={{ font: '400 11.5px "IBM Plex Sans"', color: 'var(--t-6E6C69)', margin: '16px 0 0', textAlign: 'center' }}>¿No tenés acceso? Pedíselo a Administración de Olympus.</p>
        <p style={{ margin: '10px 0 0', textAlign: 'center' }}><button type="button" className="ay-link" onClick={onAyuda}>¿Primera vez? Ver el instructivo</button></p>
      </form>
    </div>
  );
}

/* ============================================================
   Escaneo del NFC (?tag=TOKEN)
   Sin sesión no se muestra ningún dato: primero hay que entrar.
   El servidor decide si la pieza le corresponde a ese usuario.
============================================================ */
function TagPage({ token, user, onUser, onAyuda }) {
  const [aviso, setAviso] = useState(null);
  const salir = () => { logout({ borrarDatos: true }); setAviso(null); onUser(null); };
  return (
    <div className="axt">
      <div className="axt-haz" />
      {user
        ? <TagView token={token} user={user} onSalir={salir}
            onExpired={() => { setAviso('Tu sesión venció. Volvé a entrar para ver la pieza.'); onUser(null); }} />
        : <TagLogin aviso={aviso} onAyuda={onAyuda} onLogin={(u) => { setAviso(null); onUser(u); }} />}
    </div>
  );
}

const irAOlympus = () => { window.location.href = window.location.origin + '/'; };

function TagLogin({ aviso, onLogin, onAyuda }) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e && e.preventDefault();
    if (!usuario || !password) { setErr('Completá usuario y contraseña'); return; }
    setBusy(true); setErr(null);
    try { const u = await login(usuario.trim(), password); onLogin(u); }
    catch (e2) { setErr(e2.message); setBusy(false); }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-top" style={{ margin: '0 0 22px' }}><Logo /><BotonTema className="axt-x sm" size={14} /></div>
        <div className="login-side" style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Lock size={12} /> Pieza registrada</div>
        <h1 style={{ font: '700 21px "Oswald", sans-serif', color: 'var(--t-EAF0F3)', margin: '6px 0 6px' }}>Iniciá sesión para ver esta pieza</h1>
        <p style={{ font: '400 13px "IBM Plex Sans"', color: 'var(--t-8B98A5)', margin: '0 0 20px', lineHeight: 1.5 }}>
          Esta pieza está registrada en Olympus Trace. Su información la ve solo quien tiene acceso.
        </p>

        {aviso && <div className="tag-aviso" role="status">{aviso}</div>}

        <label className="fld" style={{ marginBottom: 12 }}><span>Usuario</span>
          <input type="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="tu usuario" autoFocus />
        </label>
        <label className="fld" style={{ marginBottom: 16 }}><span>Contraseña</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>

        {err && (
          <div role="alert" style={{ font: '500 12.5px "IBM Plex Sans"', color: 'var(--t-E5A3A1)', background: 'var(--s-211011)', border: '1px solid var(--b-3A1E1D)', borderRadius: 8, padding: '9px 12px', marginBottom: 14 }}>{err}</div>
        )}

        <button type="submit" className="axt-btn primary" style={{ width: '100%', padding: '12px' }} disabled={busy}>
          {busy ? 'Ingresando…' : 'Ver pieza'}
        </button>
        <p style={{ font: '400 11.5px "IBM Plex Sans"', color: 'var(--t-6E6C69)', margin: '16px 0 0', textAlign: 'center' }}>¿No tenés acceso? Pedíselo a Administración de Olympus.</p>
        <p style={{ margin: '10px 0 0', textAlign: 'center' }}><button type="button" className="ay-link" onClick={onAyuda}>¿Cómo funciona? Ver el instructivo</button></p>
      </form>
    </div>
  );
}

function TagView({ token, user, onExpired, onSalir }) {
  const [st, setSt] = useState({ loading: true });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let live = true;
    setSt({ loading: true });
    tagInfo(token)
      .then((data) => { if (live) setSt({ data }); })
      .catch((e) => {
        if (!live) return;
        if (e.status === 401) { onExpired(); return; }
        setSt({ code: e.status || 0 });
      });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, intento]);

  return (
    <div className="tag-wrap" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 16 }}>
      <div className="phone tag-phone">
        <div className="phone-notch" />
        <div className="phone-bar"><Radio size={13} color="var(--t-D9B44A)" /> <span>OLYMPUS TRACE</span></div>
        <div className="phone-screen">
          {st.loading ? <Spinner />
            : st.data ? <PiezaInfo data={st.data} />
            : <TagProblema code={st.code} onRetry={() => setIntento((n) => n + 1)} />}

          <div className="tag-foot">
            <span>Usuario: <b>{user.username || user.email}</b></span>
            <span className="tag-foot-btns">
              <BotonTema className="axt-x" size={15} />
              <button type="button" className="axt-btn small" onClick={irAOlympus}>Ir a Olympus</button>
              <button type="button" className="axt-btn small" onClick={onSalir}>Salir</button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PiezaInfo({ data }) {
  const a = data.asset;
  return (
    <>
      <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', paddingBottom: 14, borderBottom: '1px solid var(--b-201C24)' }}>
        <Band status={data.status} h={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '400 11px "IBM Plex Mono", monospace', color: 'var(--t-6A7681)' }}>
            {a.type} · {a.client}{a.ibm ? ` · IBM ${a.ibm}` : ''}
          </div>
          <div style={{ font: '700 17px "Oswald", sans-serif', color: 'var(--t-EAF0F3)', margin: '3px 0 2px' }}>{a.name}</div>
          <div style={{ font: '400 11.5px "IBM Plex Mono", monospace', color: 'var(--t-8B98A5)', marginBottom: 7 }}>Nº {a.code}</div>
          <Pill status={data.status} />
        </div>
      </div>
      <div style={{ font: '600 11px "IBM Plex Mono", monospace', color: 'var(--t-7A8792)', letterSpacing: '.5px', margin: '16px 0 4px' }}>CERTIFICADOS</div>
      {data.certificates.length ? (
        <div>
          {data.certificates.map((c, i) => <CertRow key={c.id || i} c={c} last={i === data.certificates.length - 1} />)}
        </div>
      ) : (
        <div style={{ font: '400 12.5px "IBM Plex Sans"', color: 'var(--t-8B98A5)', padding: '8px 0' }}>Sin inspecciones registradas.</div>
      )}
    </>
  );
}

function TagProblema({ code, onRetry }) {
  const noEsta = code === 404;
  return (
    <div style={{ textAlign: 'center', padding: '26px 4px 8px' }}>
      <SearchX size={30} color={noEsta ? 'var(--t-8B98A5)' : 'var(--t-E5605C)'} />
      <div style={{ font: '700 16px "Oswald", sans-serif', color: 'var(--t-EAF0F3)', margin: '12px 0 6px' }}>
        {noEsta ? 'Pieza no disponible' : 'No pudimos cargar la pieza'}
      </div>
      <p style={{ font: '400 13px "IBM Plex Sans"', color: 'var(--t-8B98A5)', margin: '0 0 14px', lineHeight: 1.5 }}>
        {noEsta
          ? 'No encontramos esta pieza o no tenés permiso para verla. Si tenés otro usuario, tocá Salir y entrá con ese.'
          : 'Revisá tu conexión a internet e intentá de nuevo.'}
      </p>
      {!noEsta && <button type="button" className="axt-btn primary small" onClick={onRetry}>Reintentar</button>}
    </div>
  );
}
