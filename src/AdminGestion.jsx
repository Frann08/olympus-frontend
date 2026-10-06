import React, { useState } from 'react';
import { Building2, Users, UserPlus, Plus, Trash2, Pencil, KeyRound, Search, X, Boxes, DatabaseBackup, Loader2, FileDown, Upload } from 'lucide-react';
import { api, downloadBackup, getUser } from './api.js';
import { useData, Spinner, ErrorNote, sinTildes, useTanda, MostrarMas } from './ui.jsx';

/* Páginas de Administración: Empresas, Usuarios y Respaldo.
   Antes estaban todas juntas en una tarjeta de la página principal; con muchas
   empresas y usuarios eso no se podía usar. Ahora cada una tiene su página,
   con buscador, filtros y la lista de a tandas. */

const ROL_NOMBRE = { admin: 'Administración', traza: 'Trazabilidad', precintos: 'Precintos', cliente: 'Cliente' };
const ROL_COLOR = { admin: 'var(--t-D9B44A)', traza: 'var(--t-7FB0C8)', precintos: 'var(--t-E8A33C)', cliente: 'var(--t-9AA6B1)' };
const ROL_ORDEN = { admin: 0, precintos: 1, traza: 2, cliente: 3 };

// evita mandar dos veces lo mismo con un doble toque
function useUnaVez() {
  const [ocupado, setOcupado] = useState(false);
  const unaVez = async (fn) => { if (ocupado) return; setOcupado(true); try { await fn(); } finally { setOcupado(false); } };
  return [ocupado, unaVez];
}

export function Encabezado({ icon: Icon, titulo, sub, children }) {
  return (
    <div className="gs-head">
      <div style={{ minWidth: 0 }}>
        <h1 className="gs-h1"><Icon size={20} color="var(--t-D9B44A)" /> {titulo}</h1>
        {sub && <div className="gs-sub">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function Buscador({ value, onChange, placeholder }) {
  return (
    <div className="axt-search sm gs-buscar">
      <Search size={15} color="var(--t-7A8792)" />
      <input className="axt-input" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} aria-label={placeholder} />
      {value && <button className="gs-limpiar" onClick={() => onChange('')} aria-label="Borrar búsqueda"><X size={14} /></button>}
    </div>
  );
}

function Vacio({ children }) {
  return <div className="gs-vacio">{children}</div>;
}

function IbmChips({ ibms, max = 6 }) {
  const l = ibms || [];
  if (!l.length) return <span className="gs-mute">sin IBM todavía</span>;
  return (
    <span className="gs-ibms">
      {l.slice(0, max).map((ib) => <span key={ib} className="gs-ibm">IBM {ib}</span>)}
      {l.length > max && <span className="gs-mute">+{l.length - max}</span>}
    </span>
  );
}

/* ================= Empresas ================= */
export function Empresas({ toast, ir, inicial }) {
  const [rev, setRev] = useState(0);
  const clients = useData(() => api('/api/clients'), [rev]);
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState((inicial && inicial.filtro) || 'todas');
  const [nombre, setNombre] = useState('');
  const [ocupado, unaVez] = useUnaVez();
  const [n, mas] = useTanda(q, filtro);

  const lista = clients.data || [];
  const FILTROS = [
    ['todas', 'Todas', () => true],
    ['vencer', 'Con inspecciones por vencer', (c) => c.por_vencer > 0],
    ['sinusu', 'Sin usuarios', (c) => c.users === 0],
    ['sinact', 'Sin activos', (c) => c.assets === 0],
  ];
  const s = sinTildes(q);
  const pasa = FILTROS.find((f) => f[0] === filtro)[2];
  const filas = lista.filter((c) => pasa(c) && (!s
    || sinTildes(c.name).includes(s)
    || (c.ibms || []).some((ib) => sinTildes('ibm ' + ib).includes(s) || sinTildes(ib) === s)));

  async function crear() {
    const nom = nombre.trim();
    if (!nom) { toast('Escribí el nombre de la empresa'); return; }
    await unaVez(async () => {
      try {
        await api('/api/clients', { method: 'POST', body: JSON.stringify({ name: nom }) });
        toast('Empresa creada');
        setNombre(''); setFiltro('todas'); setQ(nom); // queda a la vista para crearle el acceso
        setRev((r) => r + 1);
      } catch (e) { toast(e.message); }
    });
  }
  async function borrar(c) {
    const u = c.users;
    const msg = `¿Borrar la empresa "${c.name}"?` + (u === 1 ? '\nTambién se borra su usuario.' : u > 1 ? `\nTambién se borran sus ${u} usuarios.` : '') + '\nNo se puede deshacer.';
    if (!window.confirm(msg)) return;
    await unaVez(async () => {
      try { await api('/api/clients/' + c.id, { method: 'DELETE' }); toast('Empresa eliminada'); setRev((r) => r + 1); }
      catch (e) { toast(e.message); }
    });
  }

  const totAct = lista.reduce((a, c) => a + (c.assets || 0), 0);
  const totUsu = lista.reduce((a, c) => a + (c.users || 0), 0);

  return (
    <>
      <Encabezado icon={Building2} titulo="Empresas"
        sub={clients.data ? `${lista.length} empresas · ${totAct} activos · ${totUsu} usuarios de clientes` : null}>
        <div className="gs-nueva">
          <input className="gs-in" placeholder="Nombre de la nueva empresa" value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && crear()} aria-label="Nombre de la nueva empresa" />
          <button className="axt-btn small primary" onClick={crear} disabled={ocupado}><Plus size={13} /> Crear empresa</button>
        </div>
      </Encabezado>

      <div className="axt-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="axt-toolbar">
          <div className="gs-chips">
            {FILTROS.map(([k, l, f]) => (
              <button key={k} onClick={() => setFiltro(k)} className={'axt-chip' + (filtro === k ? ' active' : '')}>
                {l}{k !== 'todas' && clients.data ? <span className="gs-cuenta">{lista.filter(f).length}</span> : null}
              </button>
            ))}
          </div>
          <Buscador value={q} onChange={setQ} placeholder="Buscar empresa o IBM…" />
        </div>

        {clients.loading && !clients.data ? <Spinner /> : clients.error ? <div style={{ padding: 18 }}><ErrorNote error={clients.error} /></div> : !filas.length ? (
          <Vacio>{lista.length ? 'Ninguna empresa coincide con la búsqueda.' : 'Todavía no hay empresas. Creá la primera arriba.'}</Vacio>
        ) : (
          <div className="gs-list" role="table" aria-label="Empresas">
            <div className="gs-row gs-emp gs-hd" role="row">
              <span role="columnheader">Empresa</span><span role="columnheader">Activos</span><span role="columnheader">Por vencer</span><span role="columnheader">Usuarios</span><span role="columnheader" />
            </div>
            {filas.slice(0, n).map((c) => (
              <div key={c.id} className="gs-row gs-emp" role="row">
                <div className="gs-main" role="cell">
                  <div className="gs-name">{c.name}</div>
                  <IbmChips ibms={c.ibms} />
                </div>
                <div className="gs-num" data-l="Activos" role="cell">{c.assets}</div>
                <div data-l="Por vencer" role="cell">
                  <span className={'gs-pv' + (c.por_vencer ? ' hay' : '')}>{c.por_vencer}</span>
                </div>
                <div className="gs-num" data-l="Usuarios" role="cell">{c.users}</div>
                <div className="gs-acc" role="cell">
                  {c.assets > 0 && <button className="axt-btn small" onClick={() => ir('admin', { empresa: c.id })} title={'Ver los activos de ' + c.name}><Boxes size={13} /> Activos</button>}
                  {c.users > 0
                    ? <button className="axt-btn small" onClick={() => ir('usuarios', { empresa: c.id })} title={'Ver los usuarios de ' + c.name}><Users size={13} /> Usuarios</button>
                    : <button className="axt-btn small" onClick={() => ir('usuarios', { empresa: c.id, nuevo: true })} title={'Crear un acceso para ' + c.name}><UserPlus size={13} /> Crear acceso</button>}
                  {c.assets === 0 && <button className="axt-x sm" title="Eliminar empresa" aria-label={'Eliminar ' + c.name} onClick={() => borrar(c)} disabled={ocupado}><Trash2 size={13} /></button>}
                </div>
              </div>
            ))}
          </div>
        )}
        <MostrarMas total={filas.length} visibles={Math.min(n, filas.length)} onMas={mas} />
      </div>
      <div className="gs-nota">Los IBM de cada empresa se cargan solos al importar sus activos. Una empresa solo se puede borrar si no tiene activos.</div>
    </>
  );
}

/* ================= Usuarios ================= */
const USU_VACIO = { username: '', email: '', password: '', role: 'cliente', client_id: '', ibms: null };

export function Usuarios({ toast, inicial }) {
  const [rev, setRev] = useState(0);
  const users = useData(() => api('/api/users'), [rev]);
  const clients = useData(() => api('/api/clients'), [rev]);
  const reload = () => setRev((r) => r + 1);

  const empIni = inicial && inicial.empresa ? String(inicial.empresa) : '';
  const [q, setQ] = useState('');
  const [rol, setRol] = useState(empIni ? 'cliente' : 'todos');
  const [empresa, setEmpresa] = useState(empIni);
  const [n, mas] = useTanda(q, rol, empresa);

  const [nuevo, setNuevo] = useState(!!(inicial && inicial.nuevo));
  const [form, setForm] = useState({ ...USU_VACIO, client_id: empIni });
  const [editId, setEditId] = useState(null);
  const [editIbms, setEditIbms] = useState(null);
  const [pwId, setPwId] = useState(null);
  const [pw, setPw] = useState('');
  const [ocupado, unaVez] = useUnaVez();
  const yo = getUser();

  const empresas = clients.data || [];
  const ibmsDe = (id) => (empresas.find((c) => String(c.id) === String(id)) || {}).ibms || [];
  const nombreEmpresa = (id) => (empresas.find((c) => String(c.id) === String(id)) || {}).name || '';
  const quien = (u) => u.username || u.email;

  const todos = [...(users.data || [])].sort((a, b) =>
    (ROL_ORDEN[a.role] ?? 9) - (ROL_ORDEN[b.role] ?? 9)
    || String(a.client || '').localeCompare(String(b.client || ''), 'es')
    || String(quien(a)).localeCompare(String(quien(b)), 'es'));
  const s = sinTildes(q);
  const porEmpresa = (u) => !empresa || String(u.client_id) === String(empresa);
  const porTexto = (u) => !s || [u.username, u.email, u.name, u.client].some((f) => sinTildes(f).includes(s));
  const base = todos.filter((u) => porEmpresa(u) && porTexto(u));
  const filas = base.filter((u) => rol === 'todos' || u.role === rol);
  const cuenta = (r) => base.filter((u) => u.role === r).length;

  async function crear() {
    const f = form;
    if (!f.username.trim() || !f.password) { toast('Completá usuario y contraseña'); return; }
    if (/\s/.test(f.username.trim())) { toast('El usuario no puede tener espacios'); return; }
    if (f.role === 'cliente' && !f.client_id) { toast('Elegí la empresa'); return; }
    if (f.role === 'cliente' && Array.isArray(f.ibms) && !f.ibms.length) { toast('Elegí al menos un IBM o marcá "Todos"'); return; }
    if (f.password.trim().length < 6) { toast('La contraseña debe tener al menos 6 caracteres'); return; }
    await unaVez(async () => {
      try {
        const esCli = f.role === 'cliente';
        const body = { ...f, username: f.username.trim(), email: f.email.trim(), client_id: esCli ? f.client_id : null, ibms: esCli ? f.ibms : null };
        await api('/api/users', { method: 'POST', body: JSON.stringify(body) });
        toast('Acceso creado para ' + body.username);
        setForm({ ...USU_VACIO, role: f.role, client_id: esCli ? f.client_id : '' }); // listo para cargar otro de la misma empresa
        setQ(''); reload();
      } catch (e) { toast(e.message); }
    });
  }
  async function guardarIbms(u) {
    if (Array.isArray(editIbms) && !editIbms.length) { toast('Elegí al menos un IBM o marcá "Todos"'); return; }
    await unaVez(async () => {
      try {
        await api('/api/users/' + u.id, { method: 'PATCH', body: JSON.stringify({ ibms: editIbms || [] }) });
        toast('IBM actualizados para ' + quien(u)); setEditId(null); reload();
      } catch (e) { toast(e.message); }
    });
  }
  async function guardarPw(u) {
    if (pw.trim().length < 6) { toast('La contraseña debe tener al menos 6 caracteres'); return; }
    const propia = yo && String(yo.id) === String(u.id);
    await unaVez(async () => {
      try {
        await api(`/api/users/${u.id}/password`, { method: 'PATCH', body: JSON.stringify({ password: pw }) });
        setPwId(null); setPw('');
        toast(propia ? 'Contraseña cambiada: volvé a entrar' : 'Contraseña cambiada para ' + quien(u));
      } catch (e) { toast(e.message); }
    });
  }
  async function borrar(u) {
    if (!window.confirm(`¿Borrar el acceso de "${quien(u)}"?\nNo va a poder entrar más. No se puede deshacer.`)) return;
    await unaVez(async () => {
      try { await api('/api/users/' + u.id, { method: 'DELETE' }); toast('Acceso eliminado'); reload(); }
      catch (e) { toast(e.message); }
    });
  }

  const ROLES_F = [['todos', 'Todos'], ['cliente', 'Clientes'], ['precintos', 'Precintos'], ['traza', 'Trazabilidad'], ['admin', 'Administración']];
  const total = (users.data || []).length;

  return (
    <>
      <Encabezado icon={Users} titulo="Usuarios"
        sub={users.data ? `${total} accesos · ${(users.data || []).filter((u) => u.role === 'cliente').length} de clientes` : null}>
        <button className={'axt-btn small' + (nuevo ? '' : ' primary')} onClick={() => setNuevo((v) => !v)} aria-expanded={nuevo}>
          {nuevo ? <><X size={13} /> Cerrar</> : <><UserPlus size={13} /> Nuevo acceso</>}
        </button>
      </Encabezado>

      {nuevo && (
        <div className="axt-card gs-form">
          <div className="gs-form-t"><UserPlus size={15} color="var(--t-D9B44A)" /> Nuevo acceso</div>
          <div className="gs-form-grid">
            <label className="fld"><span>Usuario</span>
              <input autoCapitalize="none" autoCorrect="off" autoComplete="off" placeholder="ej: jperez" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </label>
            <label className="fld"><span>Contraseña (mín. 6)</span>
              <input autoComplete="new-password" placeholder="contraseña" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </label>
            <label className="fld"><span>Correo (opcional)</span>
              <input type="email" placeholder="para recuperar la contraseña" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="fld"><span>Lado</span>
              <select className="cor-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="cliente">Cliente</option>
                <option value="precintos">Precintos</option>
                <option value="traza">Trazabilidad</option>
                <option value="admin">Administración</option>
              </select>
            </label>
            {form.role === 'cliente' && (
              <label className="fld gs-ancho"><span>Empresa</span>
                <select className="cor-select" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value, ibms: null })}>
                  <option value="">— Elegí la empresa —</option>
                  {empresas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}
            {form.role === 'cliente' && form.client_id && (
              <div className="gs-ancho"><IbmPicker options={ibmsDe(form.client_id)} value={form.ibms} onChange={(v) => setForm({ ...form, ibms: v })} /></div>
            )}
          </div>
          {form.role === 'admin' && <div className="cor-nota" style={{ color: 'var(--t-EDA53C)' }}>Administración puede ver y cambiar todo, incluso borrar datos. Dáselo solo a quien corresponda.</div>}
          <div className="cor-botones">
            <button className="axt-btn small primary" onClick={crear} disabled={ocupado}><UserPlus size={13} /> Crear acceso</button>
            <button className="axt-btn small" onClick={() => { setForm({ ...USU_VACIO, client_id: empresa }); setNuevo(false); }}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="axt-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="axt-toolbar">
          <div className="gs-chips">
            {ROLES_F.map(([k, l]) => (
              <button key={k} onClick={() => setRol(k)} className={'axt-chip' + (rol === k ? ' active' : '')}>
                {l}{users.data ? <span className="gs-cuenta">{k === 'todos' ? base.length : cuenta(k)}</span> : null}
              </button>
            ))}
          </div>
          <div className="gs-filtros">
            <select className="cor-select gs-sel" value={empresa} onChange={(e) => setEmpresa(e.target.value)} aria-label="Filtrar por empresa">
              <option value="">Todas las empresas</option>
              {empresas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Buscador value={q} onChange={setQ} placeholder="Buscar usuario, correo o empresa…" />
          </div>
        </div>
        {empresa && (
          <div className="gs-activo">
            Mostrando los usuarios de <b>{nombreEmpresa(empresa) || 'la empresa elegida'}</b>
            <button className="axt-btn small" onClick={() => setEmpresa('')}><X size={12} /> Ver todas</button>
          </div>
        )}

        {users.loading && !users.data ? <Spinner /> : users.error ? <div style={{ padding: 18 }}><ErrorNote error={users.error} /></div> : !filas.length ? (
          <Vacio>{empresa && !q ? 'Esta empresa todavía no tiene accesos. Tocá "Nuevo acceso" para crearle uno.' : 'Ningún usuario coincide con la búsqueda.'}</Vacio>
        ) : (
          <div className="gs-list" role="table" aria-label="Usuarios">
            <div className="gs-row gs-usu gs-hd" role="row">
              <span role="columnheader">Usuario</span><span role="columnheader">Lado</span><span role="columnheader">Empresa</span><span role="columnheader">Puede ver</span><span role="columnheader" />
            </div>
            {filas.slice(0, n).map((u) => {
              const soyYo = yo && String(yo.id) === String(u.id);
              return (
                <div key={u.id} className="gs-row gs-usu" role="row">
                  <div className="gs-main" role="cell">
                    <div className="gs-name">{quien(u)}{soyYo && <span className="gs-yo">vos</span>}</div>
                    {u.email && u.email !== u.username && <div className="gs-mail">{u.email}</div>}
                  </div>
                  <div data-l="Lado" role="cell" className="gs-c-lado"><span className="gs-rol" style={{ color: ROL_COLOR[u.role] }}>{ROL_NOMBRE[u.role] || u.role}</span></div>
                  <div data-l="Empresa" role="cell" className="gs-txt gs-c-emp">{u.client || <span className="gs-mute">—</span>}</div>
                  <div data-l="Puede ver" role="cell" className={'gs-txt gs-c-ver' + (u.role === 'cliente' ? '' : ' gs-opc')}>
                    {u.role === 'cliente'
                      ? (u.ibms && u.ibms.length ? <IbmChips ibms={u.ibms} max={4} /> : <span className="gs-mute">Todos los IBM</span>)
                      : <span className="gs-mute">{u.role === 'admin' ? 'Todo' : 'Todas las empresas'}</span>}
                  </div>
                  <div className="gs-acc" role="cell">
                    {u.role === 'cliente' && (
                      <button className={'axt-x sm' + (editId === u.id ? ' on' : '')} title="Cambiar los IBM que puede ver" aria-label={'Cambiar IBM de ' + quien(u)} aria-expanded={editId === u.id}
                        onClick={() => { setPwId(null); if (editId === u.id) setEditId(null); else { setEditId(u.id); setEditIbms(u.ibms && u.ibms.length ? u.ibms : null); } }}>
                        <Pencil size={13} />
                      </button>
                    )}
                    <button className={'axt-x sm' + (pwId === u.id ? ' on' : '')} title="Cambiar contraseña" aria-label={'Cambiar contraseña de ' + quien(u)} aria-expanded={pwId === u.id}
                      onClick={() => { setEditId(null); setPw(''); setPwId(pwId === u.id ? null : u.id); }}>
                      <KeyRound size={13} />
                    </button>
                    {u.role !== 'admin' && <button className="axt-x sm" title="Eliminar acceso" aria-label={'Eliminar ' + quien(u)} onClick={() => borrar(u)} disabled={ocupado}><Trash2 size={13} /></button>}
                  </div>

                  {pwId === u.id && (
                    <div className="gs-edit">
                      <div className="gs-edit-row">
                        <input className="gs-in" autoFocus autoComplete="new-password" placeholder="nueva contraseña (mín. 6)" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && guardarPw(u)} aria-label={'Nueva contraseña de ' + quien(u)} />
                        <button className="axt-btn small primary" onClick={() => guardarPw(u)} disabled={ocupado}>Guardar</button>
                        <button className="axt-btn small" onClick={() => setPwId(null)}>Cancelar</button>
                      </div>
                      {soyYo && <div className="cor-nota">Es tu propia contraseña: después de cambiarla vas a tener que volver a entrar.</div>}
                    </div>
                  )}
                  {editId === u.id && (
                    <div className="gs-edit">
                      <IbmPicker options={ibmsDe(u.client_id)} value={editIbms} onChange={setEditIbms} />
                      <div className="cor-botones">
                        <button className="axt-btn small primary" onClick={() => guardarIbms(u)} disabled={ocupado}>Guardar IBM</button>
                        <button className="axt-btn small" onClick={() => setEditId(null)}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <MostrarMas total={filas.length} visibles={Math.min(n, filas.length)} onMas={mas} />
      </div>
    </>
  );
}

/* IBMs que puede ver un usuario cliente: null = todos; array = solo esos */
export function IbmPicker({ options, value, onChange }) {
  const [otro, setOtro] = useState('');
  const todos = value === null;
  const sel = value || [];
  const all = [...new Set([...(options || []), ...sel])];
  const toggle = (ib) => onChange(sel.includes(ib) ? sel.filter((x) => x !== ib) : [...sel, ib]);
  const add = () => {
    const v = otro.replace(/^\s*ibm\s*/i, '').trim();
    if (!v) return;
    onChange([...sel.filter((x) => x !== v), v]);
    setOtro('');
  };
  return (
    <div className="ibm-pick">
      <div className="ibm-pick-h">IBM que puede ver</div>
      <label className="ibm-opt"><input type="radio" checked={todos} onChange={() => onChange(null)} /> Todos los IBM de la empresa</label>
      <label className="ibm-opt"><input type="radio" checked={!todos} onChange={() => onChange(sel)} /> Solo algunos</label>
      {!todos && (
        <>
          <div className="ibm-chips">
            {all.map((ib) => (
              <label key={ib} className={'ibm-chip' + (sel.includes(ib) ? ' on' : '')}>
                <input type="checkbox" checked={sel.includes(ib)} onChange={() => toggle(ib)} /> IBM {ib}
              </label>
            ))}
            {all.length === 0 && <span className="ibm-note">Esta empresa todavía no tiene IBM cargados. Escribilo abajo.</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="axt-input" style={{ flex: 1, minWidth: 0, background: 'var(--s-0F0E12)', border: '1px solid var(--b-2A2732)', borderRadius: 8, padding: '7px 10px' }}
              placeholder="Otro IBM (ej: 210)" value={otro} onChange={(e) => setOtro(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} aria-label="Agregar otro IBM" />
            <button className="axt-btn small" onClick={add}><Plus size={13} /> Agregar</button>
          </div>
          {sel.length === 0 && <div className="ibm-note" style={{ color: 'var(--t-EDA53C)', marginTop: 6 }}>Elegí al menos un IBM.</div>}
        </>
      )}
    </div>
  );
}

/* ================= Respaldo de la base ================= */
export function Respaldo({ toast }) {
  const [busy, setBusy] = useState(null); // 'down' | 'up'

  async function descargar() {
    setBusy('down');
    try { await downloadBackup(); toast('Respaldo descargado'); }
    catch (e) { toast(e.message); }
    finally { setBusy(null); }
  }

  function elegir(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      let dump;
      try { dump = JSON.parse(ev.target.result); }
      catch { toast('El archivo no es un respaldo válido'); return; }
      if (!dump || dump.app !== 'olympus-trace') { toast('Ese archivo no es un respaldo de Olympus'); return; }
      const fecha = dump.at ? new Date(dump.at).toLocaleString('es-AR') : 'fecha desconocida';
      if (!window.confirm(`Vas a REEMPLAZAR todos los datos actuales por el respaldo del ${fecha}.\nSe pierde lo que haya ahora y no se puede deshacer.\n\n¿Continuar?`)) return;
      setBusy('up');
      try {
        const r = await api('/api/restore', { method: 'POST', body: JSON.stringify(dump) });
        const total = Object.values(r.counts || {}).reduce((a, b) => a + b, 0);
        toast('Respaldo recargado (' + total + ' registros). Puede que tengas que volver a entrar.');
      } catch (e2) { toast(e2.message); }
      finally { setBusy(null); }
    };
    reader.readAsText(file);
  }

  return (
    <>
      <Encabezado icon={DatabaseBackup} titulo="Respaldo" sub="Una copia de toda la base, por si algún día hay que recuperarla." />
      <div className="axt-card" style={{ padding: 20 }}>
        <div className="gs-resp">
          <div>
            <div className="gs-resp-t">Descargar una copia</div>
            <p>Baja un archivo con todo: empresas, activos, inspecciones, usuarios, tags y el historial de correcciones. Guardalo en un lugar seguro (contiene todos los datos). Conviene hacerlo seguido, por ejemplo una vez por semana.</p>
            <button className="axt-btn primary" onClick={descargar} disabled={!!busy}>
              {busy === 'down' ? <Loader2 size={14} className="spin" /> : <FileDown size={14} />} Descargar respaldo
            </button>
          </div>
          <div>
            <div className="gs-resp-t">Recargar una copia</div>
            <p><b>Reemplaza todo lo que hay ahora</b> por lo que tenga el archivo. Usalo solo si se perdieron datos. Antes de hacerlo, descargá un respaldo de lo actual por las dudas.</p>
            <label className="axt-btn" style={{ cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
              {busy === 'up' ? <Loader2 size={14} className="spin" /> : <Upload size={14} />} Recargar respaldo…
              <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={elegir} disabled={!!busy} />
            </label>
          </div>
        </div>
      </div>
    </>
  );
}
